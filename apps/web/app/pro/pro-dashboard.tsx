'use client';

import { useState } from 'react';
import Link from 'next/link';

import { Button } from '@medario/ui';

const calendarLabel = 'Agenda Medário — Dra. Marina Alves';

const agenda = [
  { patient: 'Visitante verificado', when: '15 jul · 09:30', status: 'Solicitação de agendamento' },
  { patient: 'Paciente identificado', when: '16 jul · 14:00', status: 'Reserva confirmada' },
  { patient: 'Paciente identificado', when: '17 jul · 10:00', status: 'Atendimento pendente' },
] as const;

export function ProDashboard() {
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  return <main className="pro-dashboard">
    <header className="pro-header">
      <Link href="/" className="profile-back">← Diretório Medário</Link>
      <p className="section-label">Medário Pro · Conta profissional</p>
      <h1>Seu perfil. Sua agenda. Dados sob controle.</h1>
      <p>Esta visão pertence apenas à Dra. Marina Alves e ao Perfil médico reivindicado. Sem equipe, clínica ou múltiplos perfis.</p>
    </header>

    <section className="pro-account-card" aria-label="Conta profissional e perfil">
      <div><p className="section-label">Perfil reivindicado</p><h2>Dra. Marina Alves</h2><p>CRM-SC 12345 · Psiquiatria · Joinville</p></div>
      <Link href="/medicos/dra-marina-alves">Ver Perfil médico público</Link>
    </section>

    <section className="pro-grid" aria-label="Visão geral">
      <article><span>12</span><strong>Visualizações de perfil</strong><small>Métrica agregada. Sem identidade do visitante.</small></article>
      <article><span>4</span><strong>Contatos externos</strong><small>Métrica agregada. Sem texto de busca, sintomas ou localização exata.</small></article>
      <article><span>2</span><strong>Solicitações de agendamento</strong><small>Leads identificados apenas após identificação explícita.</small></article>
    </section>

    <section className="pro-section" aria-labelledby="profile-change-title">
      <div className="pro-section-heading"><div><p className="section-label">Dados verificáveis</p><h2 id="profile-change-title">Alteração em revisão</h2></div><span className="pro-status pending">Em revisão</span></div>
      <p>Você solicitou atualizar o Local de atendimento. O Perfil médico público continua exibindo o último dado confirmado até a conferência.</p>
      <Button variant="secondary" type="button" onClick={() => setRequestSent(true)}>Solicitar alteração verificável</Button>
      {requestSent && <p className="pro-feedback" role="status">Solicitação criada para revisão. Nenhum dado público foi alterado.</p>}
    </section>

    <section className="pro-section" aria-labelledby="agenda-title">
      <div className="pro-section-heading"><div><p className="section-label">Orquestrador de agendamento</p><h2 id="agenda-title">Agenda</h2></div><Link href="/medicos/dra-marina-alves">Configurar tipos de consulta</Link></div>
      <p>Solicitações, reservas e resultados de atendimento. O Medário controla estados; agenda externa não substitui a fonte operacional.</p>
      <div className="pro-agenda-list">
        {agenda.map((item) => <article key={`${item.patient}-${item.when}`}><div><strong>{item.patient}</strong><span>{item.when}</span></div><small>{item.status}</small></article>)}
      </div>
    </section>

    <section className="pro-section" aria-labelledby="calendar-title">
      <div className="pro-section-heading"><div><p className="section-label">Autorização de agenda</p><h2 id="calendar-title">Google Calendar</h2></div><span className={`pro-status ${calendarConnected ? 'connected' : 'neutral'}`}>{calendarConnected ? 'Conectado' : 'Não conectado'}</span></div>
      <p>{calendarConnected ? `${calendarLabel}. Leitura de livre/ocupado e escrita somente na Agenda de integração.` : 'Conexão opcional. O médico escolhe a agenda de livre/ocupado e uma Agenda de integração dedicada.'}</p>
      <p className="pro-privacy-note">Eventos enviados contêm horário, duração e identificador Medário. Nunca sintomas ou dados do paciente.</p>
      {calendarConnected ? <Button variant="secondary" type="button" onClick={() => setCalendarConnected(false)}>Revogar autorização</Button> : <Button type="button" onClick={() => setCalendarConnected(true)}>Simular conexão explícita</Button>}
      <p className="pro-feedback" role="status">{calendarConnected ? 'Autorização revogável a qualquer momento.' : 'Integração real requer OAuth do Google configurado no servidor.'}</p>
    </section>

    <section className="pro-section pro-identified" aria-labelledby="lead-title">
      <p className="section-label">Privacidade dos leads</p><h2 id="lead-title">Identificação só com ação explícita</h2>
      <p>Visitantes aparecem apenas em Métricas de lead. Solicitação de agendamento ou identificação no Contato externo cria Lead identificado dentro das permissões aplicáveis.</p>
    </section>
  </main>;
}
