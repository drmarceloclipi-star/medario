'use client';

import { useMemo, useState } from 'react';
import { Button } from '@medario/ui';
import { type AppointmentTypeConfig, type CalendarAvailability, type Slot, isSlotEligible } from '@medario/domain';

const config: AppointmentTypeConfig = { id: 'psychiatry-tele', doctorId: 'doctor-marina-alves', locationId: 'joinville-centro', modality: 'telemedicine', durationMinutes: 50, bufferMinutes: 10, minimumLeadMinutes: 60, maximumWindowDays: 45, confirmationPolicy: 'manual', cancellationPolicy: 'Cancelamento conforme política do profissional.' };
const slots: Slot[] = [
  { id: 'slot-1', appointmentTypeId: config.id, doctorId: config.doctorId, locationId: config.locationId, startsAt: '2026-07-15T13:00:00-03:00', endsAt: '2026-07-15T14:00:00-03:00', status: 'open' },
  { id: 'slot-2', appointmentTypeId: config.id, doctorId: config.doctorId, locationId: config.locationId, startsAt: '2026-07-16T15:00:00-03:00', endsAt: '2026-07-16T16:00:00-03:00', status: 'open' },
];

export function BookingPanel() {
  const [calendarAvailability, setCalendarAvailability] = useState<CalendarAvailability>('available');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [verification, setVerification] = useState<'email' | 'phone'>('email');
  const [submitted, setSubmitted] = useState(false);
  const eligibleSlots = useMemo(() => slots.filter((slot) => isSlotEligible(slot, config, calendarAvailability, new Date('2026-07-11T12:00:00-03:00'))), [calendarAvailability]);

  return <section className="booking-panel" aria-label="Agendamento"><p className="section-label">Agendamento</p><h2>Solicite uma consulta</h2><p>Teleconsulta externa · 50 minutos · confirmação manual.</p><label>Estado da agenda<select value={calendarAvailability} onChange={(event) => setCalendarAvailability(event.target.value as CalendarAvailability)}><option value="available">Agenda atualizada</option><option value="stale">Agenda a confirmar</option><option value="unavailable">Google indisponível</option></select></label>{calendarAvailability !== 'available' && <p role="status">Disponibilidade a confirmar. Você pode enviar uma solicitação manual.</p>}{eligibleSlots.length > 0 ? <div className="slot-list">{eligibleSlots.map((slot) => <button type="button" className={selectedSlot === slot.id ? 'selected' : ''} key={slot.id} onClick={() => setSelectedSlot(slot.id)}>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(slot.startsAt))}</button>)}</div> : <p>Nenhuma vaga confirmada agora.</p>}<fieldset><legend>Validar contato como visitante</legend><label><input type="radio" name="verification" checked={verification === 'email'} onChange={() => setVerification('email')} /> E-mail</label><label><input type="radio" name="verification" checked={verification === 'phone'} onChange={() => setVerification('phone')} /> Telefone</label></fieldset><Button type="button" disabled={!selectedSlot && calendarAvailability === 'available'} onClick={() => setSubmitted(true)}>Enviar solicitação</Button>{submitted && <p role="status">Solicitação enviada. Você receberá link seguro de gestão por {verification === 'email' ? 'e-mail' : 'telefone'}. O horário só será confirmado após a transição do Medário.</p>}<small>{config.cancellationPolicy} Lembretes por e-mail após reserva confirmada; WhatsApp somente com opt-in.</small></section>;
}
