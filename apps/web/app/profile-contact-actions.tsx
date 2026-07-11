'use client';

import type { PublicProfile } from './profile-data';

export function ProfileContactActions({ profile }: { profile: PublicProfile }) {
  const hasVerifiedContact = profile.contacts.whatsApp.verified || profile.contacts.phone.verified;
  return <section className="profile-actions" aria-label="Contato externo"><p>{profile.modalities.includes('Teleconsulta externa') ? 'Teleconsulta externa disponível por contato verificado.' : hasVerifiedContact ? 'Contato externo verificado.' : 'Contato disponível a confirmar.'}</p><div>{profile.contacts.whatsApp.verified && <a href={profile.contacts.whatsApp.href} target="_blank" rel="noreferrer">WhatsApp verificado</a>}{profile.contacts.phone.verified && <a href={profile.contacts.phone.href}>Ligar para consultório</a>}</div></section>;
}
