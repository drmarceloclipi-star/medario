import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';

import { ProfileContactActions } from '../../profile-contact-actions';
import { AppointmentRequest } from '../../appointment-request';
import { getPublicProfile, resolvePublicProfileSlug } from '../../profile-data';

type ProfilePageProps = { params: Promise<{ slug: string }> };

function safeJsonLd(value: unknown) {
  const replacements: Record<string, string> = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' };
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => replacements[character] ?? character);
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  if (!profile) return {};
  const canonical = `https://medario.com.br/medicos/${profile.slug}`;
  return { title: `${profile.name} — ${profile.specialty} em ${profile.location.city}/${profile.location.state} | Medário`, description: `${profile.name}, ${profile.specialty} em ${profile.location.city}. ${profile.crm}${profile.rqe ? `, ${profile.rqe}` : ''}.`, alternates: { canonical }, openGraph: { type: 'profile', url: canonical, title: `${profile.name} | Medário` } };
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { slug } = await params;
  const canonicalSlug = resolvePublicProfileSlug(slug);
  if (canonicalSlug !== slug) permanentRedirect(`/medicos/${canonicalSlug}`);
  const profile = await getPublicProfile(canonicalSlug);
  if (!profile) notFound();
  const schema = { '@context': 'https://schema.org', '@type': 'Physician', name: profile.name, medicalSpecialty: profile.specialty, url: `https://medario.com.br/medicos/${profile.slug}`, telephone: profile.contacts.phone.verified ? profile.contacts.phone.href.replace('tel:', '') : undefined, address: { '@type': 'PostalAddress', ...(profile.location.authorized ? { streetAddress: profile.location.address } : {}), addressLocality: profile.location.city, addressRegion: profile.location.state }, identifier: { '@type': 'PropertyValue', name: 'CRM', value: profile.crm } };

  return <main className="public-profile"><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} /><Link className="profile-back" href="/">← Voltar à busca</Link><header><p className="section-label">Dossiê profissional</p><h1>{profile.name}</h1><p>{profile.specialty} · {profile.crm}{profile.rqe ? ` · ${profile.rqe}` : ''}</p><div className="profile-badges">{profile.verified && <span>Perfil verificado</span>}{profile.claimed && <span>Perfil reivindicado</span>}<span>Dados atualizados em {profile.updatedAt}</span></div></header><p className="directory-bridge"><a href={`https://app.medario.com.br/perfil/${profile.slug}?city=${encodeURIComponent(profile.location.city.toLocaleLowerCase('pt-BR'))}`}>Continuar no app</a></p><ProfileContactActions profile={profile} /><AppointmentRequest slug={profile.slug} />{profile.pendingChange && <aside className="review-notice"><strong>Alteração em revisão</strong><p>{profile.pendingChange}</p></aside>}<section><h2>Sobre</h2><p>{profile.bio}</p></section><section><h2>Local de atendimento</h2><p>{profile.location.name}</p><p>{profile.location.authorized ? profile.location.address : 'Endereço exato não autorizado para exibição.'}</p><p>{profile.location.district}, {profile.location.city}/{profile.location.state}</p>{profile.location.authorized && <span>Localização autorizada</span>}</section><section><h2>Convênios</h2><ul>{profile.insurances.map((item) => <li key={item.name}>{item.name} · {item.confirmed ? 'Convênio confirmado' : 'Convênio informado: confirme antes'}</li>)}</ul></section><section><h2>Atendimento</h2><p>{profile.modalities.join(' · ')} · {profile.availability}</p></section></main>;
}
