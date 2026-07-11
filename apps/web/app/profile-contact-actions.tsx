'use client';

import { useState } from 'react';

import type { PublicProfile } from './profile-data';

export function ProfileContactActions({ profile }: { profile: PublicProfile }) {
  const [message, setMessage] = useState('');
  const recordLead = () => setMessage('Contato externo aberto. Métrica anônima registrada.');

  return <section className="profile-actions" aria-label="Contato externo"><p>{profile.modalities.includes('Teleconsulta externa') ? 'Teleconsulta externa disponível por contato verificado.' : 'Contato externo verificado.'}</p><div><a href={profile.contacts.whatsApp.href} onClick={recordLead} target="_blank" rel="noreferrer">WhatsApp verificado</a><a href={profile.contacts.phone.href} onClick={recordLead}>Ligar para consultório</a></div>{message && <span role="status">{message}</span>}</section>;
}
