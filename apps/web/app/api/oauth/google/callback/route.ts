import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminFirestore } from '@medario/firebase/server';

export const runtime = 'nodejs';
const callback = 'https://app.medario.com.br/api/oauth/google/callback';
const integrationCalendarSummary = 'Medário — Integração';

function encrypt(refreshToken: string) {
  const key = Buffer.from(process.env.MEDARIO_CALENDAR_TOKEN_KEY!, 'base64');
  if (key.length !== 32) throw new Error('calendar token key invalid');
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  return { ciphertext: Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function createIntegrationCalendar(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/calendar/v3/calendars', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ summary: integrationCalendarSummary, description: 'Agenda técnica do Medário. Não armazena dados clínicos.', timeZone: 'America/Sao_Paulo' }),
  });
  const payload = await response.json() as { id?: unknown };
  const calendarId = nonEmptyString(payload.id);
  if (!response.ok || !calendarId) throw new Error('calendar_setup_failed');
  return calendarId;
}

async function readAvailability(accessToken: string, calendarId: string) {
  const now = new Date();
  const response = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ timeMin: now.toISOString(), timeMax: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(), items: [{ id: calendarId }] }),
  });
  const payload = await response.json() as { calendars?: Record<string, { busy?: Array<{ start?: unknown; end?: unknown }> }> };
  const busy = payload.calendars?.[calendarId]?.busy;
  if (!response.ok || !Array.isArray(busy)) throw new Error('calendar_availability_failed');
  return { fetchedAt: now, busy: busy.flatMap((interval) => {
    const start = nonEmptyString(interval.start); const end = nonEmptyString(interval.end);
    if (!start || !end || Number.isNaN(new Date(start).getTime()) || Number.isNaN(new Date(end).getTime()) || new Date(start) >= new Date(end)) return [];
    return [{ start: new Date(start).toISOString(), end: new Date(end).toISOString() }];
  }) };
}

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get('code'); const state = url.searchParams.get('state');
  if (!code || !state) return NextResponse.json({ error: 'invalid_callback' }, { status: 400 });
  const db = adminFirestore(); const stateRef = db.collection('calendarOAuthStates').doc(createHash('sha256').update(state).digest('hex'));
  const stateSnap = await db.runTransaction(async (transaction) => { const snap = await transaction.get(stateRef); const data = snap.data(); if (!snap.exists || !data || data.expiresAt.toDate() < new Date()) return null; transaction.delete(stateRef); return snap; });
  if (!stateSnap) return NextResponse.json({ error: 'expired_state' }, { status: 400 });
  const stateData = stateSnap.data()!;
  const body = new URLSearchParams({ code, client_id: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_SECRET!, redirect_uri: callback, grant_type: 'authorization_code' });
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const tokens = await response.json() as { refresh_token?: unknown; access_token?: unknown };
  const refreshToken = nonEmptyString(tokens.refresh_token); const accessToken = nonEmptyString(tokens.access_token); const doctorId = nonEmptyString(stateData.doctorId);
  if (!response.ok || !refreshToken || !accessToken || !doctorId) return NextResponse.json({ error: 'token_exchange_failed' }, { status: 502 });
  const connectionRef = db.collection('calendarConnections').doc(doctorId);
  const existing = await connectionRef.get();
  const existingCalendarId = nonEmptyString(existing.data()?.integrationCalendarId);
  let integrationCalendarId;
  try { integrationCalendarId = existingCalendarId && existingCalendarId !== 'primary' ? existingCalendarId : await createIntegrationCalendar(accessToken); } catch { return NextResponse.json({ error: 'calendar_setup_failed' }, { status: 502 }); }
  let availability;
  try { availability = await readAvailability(accessToken, integrationCalendarId); } catch { return NextResponse.json({ error: 'calendar_setup_failed' }, { status: 502 }); }
  await Promise.all([
    connectionRef.set({ status: 'active', provider: 'google', integrationCalendarId, refreshToken: encrypt(refreshToken), connectedAt: new Date(), updatedAt: new Date() }, { merge: true }),
    db.collection('calendarAvailability').doc(doctorId).set({ status: 'available', integrationCalendarId, ...availability, updatedAt: new Date() }),
  ]);
  return NextResponse.redirect(new URL('/conta?calendar=connected', url));
}
