import { getAuth } from 'firebase-admin/auth';
import { NextResponse } from 'next/server';
import { adminFirestore } from '@medario/firebase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const db = adminFirestore();
  const user = await getAuth().verifyIdToken(token).catch(() => null);
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const professional = await db.collection('professionalAccounts').doc(user.uid).get();
  const doctorId = professional.data()?.doctorId;
  if (!professional.exists || professional.data()?.status !== 'active' || typeof doctorId !== 'string') return NextResponse.json({ connected: false });

  const connection = await db.collection('calendarConnections').doc(doctorId).get();
  return NextResponse.json({ connected: connection.data()?.status === 'active' && connection.data()?.provider === 'google' });
}
