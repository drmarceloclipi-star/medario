'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createFirebaseBrowserClient, type FirebaseBrowserClient } from '@medario/firebase';

type Dashboard = {
  calendar: { status: string; connectedAt: unknown | null };
  appointments: Array<{ id: string; status: string }>;
  appointmentTypes: Array<{ id: string; label: string; confirmationPolicy: 'immediate' | 'manual'; durationMinutes: number; enabled: boolean }>;
  openSlots: Array<{ id: string; typeId: string; startsAt: string; endsAt: string }>;
};

type AppointmentTypeForm = { label: string; locationId: string; durationMinutes: number; bufferMinutes: number; minimumLeadMinutes: number; maximumWindowDays: number; confirmationPolicy: 'immediate' | 'manual' };

const initialType: AppointmentTypeForm = { label: 'Consulta', locationId: 'principal', durationMinutes: 30, bufferMinutes: 0, minimumLeadMinutes: 60, maximumWindowDays: 30, confirmationPolicy: 'manual' };

export function ProfessionalScheduling() {
  const [client, setClient] = useState<FirebaseBrowserClient | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [type, setType] = useState(initialType);
  const [savedTypeId, setSavedTypeId] = useState('');
  const [slot, setSlot] = useState({ typeId: '', startsAt: '', endsAt: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = async (activeClient: FirebaseBrowserClient) => {
    const next = await activeClient.invoke<undefined, Dashboard>('getProfessionalDashboard', undefined);
    setDashboard(next);
    setSlot((current) => current.typeId ? current : { ...current, typeId: next.appointmentTypes[0]?.id || '' });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const nextClient = await createFirebaseBrowserClient();
        const next = await nextClient.invoke<undefined, Dashboard>('getProfessionalDashboard', undefined);
        if (cancelled) return;
        setClient(nextClient);
        setDashboard(next);
        setSlot((current) => ({ ...current, typeId: current.typeId || next.appointmentTypes[0]?.id || '' }));
      } catch {
        // A conta de paciente não recebe nenhuma superfície profissional.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client) return;
    setBusy(true);
    setMessage('');
    try {
      const created = await client.invoke<typeof type & { typeId?: string }, { id: string }>('saveProfessionalAppointmentType', { ...type, ...(savedTypeId ? { typeId: savedTypeId } : {}) });
      setSavedTypeId(created.id);
      setSlot((current) => ({ ...current, typeId: created.id }));
      await refresh(client);
      setMessage('Tipo de consulta salvo. Agora cadastre horários reais.');
    } catch {
      setMessage('Não foi possível salvar o tipo de consulta.');
    } finally { setBusy(false); }
  };

  const createSlot = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!client || !slot.typeId || !slot.startsAt || !slot.endsAt) return;
    setBusy(true);
    setMessage('');
    try {
      await client.invoke('createProfessionalAppointmentSlot', { typeId: slot.typeId, startsAt: new Date(slot.startsAt).toISOString(), endsAt: new Date(slot.endsAt).toISOString() });
      await refresh(client);
      setSlot((current) => ({ ...current, startsAt: '', endsAt: '' }));
      setMessage('Horário publicado. O Medário revalida livre/ocupado antes da confirmação.');
    } catch {
      setMessage('Horário inválido ou fora das regras da agenda.');
    } finally { setBusy(false); }
  };

  const decide = async (appointmentId: string, decision: 'accept' | 'decline') => {
    if (!client) return;
    setBusy(true);
    setMessage('');
    try {
      await client.invoke('decideAppointmentRequest', { appointmentId, decision });
      await refresh(client);
      setMessage(decision === 'accept' ? 'Consulta confirmada e enviada para a agenda.' : 'Solicitação recusada.');
    } catch {
      setMessage('Não foi possível concluir esta decisão. Atualize a disponibilidade e tente novamente.');
    } finally { setBusy(false); }
  };

  const sync = async () => {
    if (!client) return;
    setBusy(true);
    try {
      await client.invoke('syncProfessionalCalendarAvailability', undefined);
      await refresh(client);
      setMessage('Disponibilidade atualizada.');
    } catch {
      setMessage('Não foi possível atualizar a disponibilidade.');
    } finally { setBusy(false); }
  };

  if (!dashboard) return null;
  return <section className="professional-scheduling account-card"><h2>Agenda profissional</h2><p>Google Calendar: {dashboard.calendar.status === 'active' ? 'conectado' : 'indisponível'}.</p><button type="button" onClick={() => void sync()} disabled={busy || dashboard.calendar.status !== 'active'}>Atualizar disponibilidade</button><form onSubmit={saveType}><h3>Tipo de consulta</h3><label>Nome<input value={type.label} onChange={(event) => setType((current) => ({ ...current, label: event.target.value }))} required /></label><label>Identificador do local<input value={type.locationId} onChange={(event) => setType((current) => ({ ...current, locationId: event.target.value }))} required /></label><label>Duração (minutos)<input type="number" min="10" max="480" value={type.durationMinutes} onChange={(event) => setType((current) => ({ ...current, durationMinutes: Number(event.target.value) }))} required /></label><label>Buffer (minutos)<input type="number" min="0" max="180" value={type.bufferMinutes} onChange={(event) => setType((current) => ({ ...current, bufferMinutes: Number(event.target.value) }))} required /></label><label>Antecedência mínima (minutos)<input type="number" min="0" max="10080" value={type.minimumLeadMinutes} onChange={(event) => setType((current) => ({ ...current, minimumLeadMinutes: Number(event.target.value) }))} required /></label><label>Janela máxima (dias)<input type="number" min="1" max="365" value={type.maximumWindowDays} onChange={(event) => setType((current) => ({ ...current, maximumWindowDays: Number(event.target.value) }))} required /></label><label>Confirmação<select value={type.confirmationPolicy} onChange={(event) => setType((current) => ({ ...current, confirmationPolicy: event.target.value as 'immediate' | 'manual' }))}><option value="manual">Manual</option><option value="immediate">Imediata</option></select></label><button type="submit" disabled={busy}>Salvar tipo</button></form><form onSubmit={createSlot}><h3>Publicar horário</h3><label>Tipo<select value={slot.typeId} onChange={(event) => setSlot((current) => ({ ...current, typeId: event.target.value }))}>{dashboard.appointmentTypes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Início<input type="datetime-local" value={slot.startsAt} onChange={(event) => setSlot((current) => ({ ...current, startsAt: event.target.value }))} required /></label><label>Fim<input type="datetime-local" value={slot.endsAt} onChange={(event) => setSlot((current) => ({ ...current, endsAt: event.target.value }))} required /></label><button type="submit" disabled={busy || !dashboard.appointmentTypes.length}>Publicar horário</button></form><div><h3>Solicitações</h3>{dashboard.appointments.length ? dashboard.appointments.map((appointment) => <div className="professional-appointment" key={appointment.id}><span>{appointment.status}</span>{appointment.status === 'requested' && <><button type="button" disabled={busy} onClick={() => void decide(appointment.id, 'accept')}>Confirmar</button><button type="button" disabled={busy} onClick={() => void decide(appointment.id, 'decline')}>Recusar</button></>}</div>) : <p>Nenhuma solicitação.</p>}</div>{message && <p role="status">{message}</p>}</section>;
}
