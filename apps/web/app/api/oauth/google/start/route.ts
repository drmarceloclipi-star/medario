import { randomBytes, createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { adminFirestore } from '@medario/firebase/server';

export const runtime = 'nodejs';

const callback = 'https://app.medario.com.br/api/oauth/google/callback';
const scope = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const user = await getAuth().verifyIdToken(token).catch(() => null);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  const db = adminFirestore();
  const professional = await db.collection('professionalAccounts').doc(user.uid).get();
  const doctorId = professional.data()?.doctorId;
  if (!professional.exists || professional.data()?.status !== 'active' || typeof doctorId !== 'string') return NextResponse.json({ error: 'professional_required' }, { status: 403 });
  const state = randomBytes(32).toString('base64url');
  await db.collection('calendarOAuthStates').doc(createHash('sha256').update(state).digest('hex')).create({ doctorId, uid: user.uid, expiresAt: new Date(Date.now() + 10 * 60 * 1000), createdAt: new Date() });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({ client_id: process.env.MEDARIO_GOOGLE_OAUTH_CLIENT_ID!, redirect_uri: callback, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', state }).toString();
  return NextResponse.redirect(url);
}
