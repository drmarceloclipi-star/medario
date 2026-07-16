'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createFirebaseBrowserClient, type FirebaseBrowserClient } from '@medario/firebase';

type AppointmentType = { id: string; label: string; confirmationPolicy: 'immediate' | 'manual' };
type AppointmentSlot = { id: string; typeId: string; startsAt: string; endsAt: string };
type AppointmentOptions = { doctorId: string; calendarAvailable: boolean; types: AppointmentType[]; slots: AppointmentSlot[] };

function slotLabel(startsAt: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(startsAt));
}

export function AppointmentRequest({ slug }: { slug: string }) {
  const [client, setClient] = useState<FirebaseBrowserClient | null>(null);
  const [options, setOptions] = useState<AppointmentOptions | null>(null);
  const [typeId, setTypeId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [submittedSlotId, setSubmittedSlotId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [visitorEmail, setVisitorEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextClient = await createFirebaseBrowserClient();
        const nextOptions = await nextClient.invoke<{ slug: string }, AppointmentOptions>('listPublicAppointmentOptions', { slug });
        if (cancelled) return;
        setClient(nextClient);
        setOptions(nextOptions);
        setTypeId(nextOptions.types[0]?.id || '');
      } catch {
        if (!cancelled) setMessage('Agenda indisponível neste momento.');
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const slots = useMemo(() => options?.slots.filter((slot) => slot.typeId === typeId) || [], [options, typeId]);
  const selectedSlotId = slots.some((slot) => slot.id === slotId) ? slotId : slots[0]?.id || '';

  const request = async () => {
    if (!client || !options || !typeId || !selectedSlotId) return;
    if (!client.auth.currentUser) return;
    const key = idempotencyKey || crypto.randomUUID();
    if (!idempotencyKey) setIdempotencyKey(key);
    setBusy(true);
    setMessage('');
    try {
      const result = await client.invoke<{ doctorId: string; typeId: string; slotId: string; idempotencyKey: string }, { status: 'requested' | 'confirmed' }>('createAppointmentRequest', { doctorId: options.doctorId, typeId, slotId: selectedSlotId, idempotencyKey: key });
      setSubmittedSlotId(selectedSlotId);
      setMessage(result.status === 'confirmed' ? 'Horário confirmado. Você receberá a confirmação no Medário.' : 'Solicitação enviada para confirmação profissional.');
    } catch {
      setMessage('Este horário não está mais disponível. Escolha outro horário.');
    } finally {
      setBusy(false);
    }
  };

  const requestVisitorAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !visitorEmail.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      const { sendSignInLinkToEmail } = await import('firebase/auth');
      const continueTo = `${window.location.pathname}${window.location.search}`;
      await sendSignInLinkToEmail(client.auth, visitorEmail.trim(), {
        url: `${window.location.origin}/conta?continue=${encodeURIComponent(continueTo)}`,
        handleCodeInApp: true,
      });
      window.sessionStorage.setItem('medario.appointment-email', visitorEmail.trim());
      setMessage('Enviamos um link de acesso para seu e-mail. Confirme-o para solicitar este horário sem criar senha.');
    } catch {
      setMessage('Não foi possível enviar o link de acesso agora. Verifique o e-mail e tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  if (!options) return <section className="appointment-request"><h2>Agendamento</h2><p>{message || 'Consultando disponibilidade…'}</p></section>;
  if (!options.calendarAvailable || !options.types.length) return <section className="appointment-request"><h2>Agendamento</h2><p>Agenda disponível somente após configuração profissional.</p></section>;

  return <section className="appointment-request"><h2>Agendamento</h2><p>Escolha um horário. O Medário confirma disponibilidade antes de criar o evento mínimo na agenda.</p><label>Tipo de consulta<select value={typeId} onChange={(event) => { setTypeId(event.target.value); setSlotId(''); setIdempotencyKey(''); setSubmittedSlotId(''); }}>{options.types.map((type) => <option key={type.id} value={type.id}>{type.label} · {type.confirmationPolicy === 'immediate' ? 'confirmação imediata' : 'confirmação profissional'}</option>)}</select></label><label>Horário<select value={selectedSlotId} onChange={(event) => { setSlotId(event.target.value); setIdempotencyKey(''); setSubmittedSlotId(''); }}>{slots.map((slot) => <option key={slot.id} value={slot.id}>{slotLabel(slot.startsAt)}</option>)}</select></label>{client?.auth.currentUser ? <button type="button" onClick={() => void request()} disabled={busy || !selectedSlotId || submittedSlotId === selectedSlotId}>{busy ? 'Enviando…' : submittedSlotId === selectedSlotId ? 'Solicitação enviada' : 'Solicitar horário'}</button> : <form className="visitor-appointment-access" onSubmit={requestVisitorAccess}><label>E-mail para acesso de visitante<input type="email" value={visitorEmail} onChange={(event) => setVisitorEmail(event.target.value)} required autoComplete="email" /></label><button type="submit" disabled={busy || !selectedSlotId}>{busy ? 'Enviando…' : 'Receber link para solicitar horário'}</button><p>Confirmamos seu e-mail antes de criar a solicitação. Não é necessário definir senha.</p></form>}{message && <p role="status">{message}</p>}</section>;
}
