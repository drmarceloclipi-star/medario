import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { adminFirestore } from '@medario/firebase/server';

export const runtime = 'nodejs';
const callback = 'https://app.medario.com.br/api/oauth/google/callback';

function encrypt(refreshToken: string) {
  const key = Buffer.from(process.env.MEDARIO_CALENDAR_TOKEN_KEY!, 'base64');
  if (key.length !== 32) throw new Error('calendar token key invalid');
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  return { ciphertext: Buffer.concat([cipher.update(refreshToken, 'utf8'), cipher.final()]).toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
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
  const tokens = await response.json() as { refresh_token?: string };
  if (!response.ok || !tokens.refresh_token) return NextResponse.json({ error: 'token_exchange_failed' }, { status: 502 });
  await db.collection('calendarConnections').doc(stateData.doctorId).set({ status: 'active', provider: 'google', refreshToken: encrypt(tokens.refresh_token), connectedAt: new Date(), updatedAt: new Date() }, { merge: true });
  return NextResponse.redirect(new URL('/conta?calendar=connected', url));
}
