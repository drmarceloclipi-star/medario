'use client';

import { useState } from 'react';
import { createFirebaseBrowserClient } from '@medario/firebase';

export function ProfessionalCalendarConnect() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const connect = async () => {
    setBusy(true); setMessage('');
    try {
      const { auth } = await createFirebaseBrowserClient();
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('signed out');
      const response = await fetch('/api/oauth/google/start', { method: 'POST', headers: { authorization: `Bearer ${token}` } });
      const payload = await response.json() as { url?: string };
      if (!response.ok || !payload.url) throw new Error('not professional');
      window.location.assign(payload.url);
    } catch { setMessage('Calendário disponível somente para Conta profissional ativa.'); setBusy(false); }
  };
  return <section className="account-card"><h2>Google Calendar</h2><p>Conecte uma agenda de integração. O Medário consulta livre/ocupado e cria somente eventos mínimos após confirmação.</p><button type="button" disabled={busy} onClick={() => void connect()}>{busy ? 'Redirecionando…' : 'Conectar Google Calendar'}</button>{message && <p role="status">{message}</p>}</section>;
}
