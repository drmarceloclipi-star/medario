import type { Metadata } from 'next';
import Link from 'next/link';

import { AppointmentRequest } from '../../appointment-request';
import { ProfileContactActions } from '../../profile-contact-actions';
import { getPublicProfile } from '../../profile-data';
import { journeyUrl, readJourneyUrl } from '../../journey-url';

type AppProfilePageProps = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: AppProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfile(slug);
  return {
    title: profile ? `${profile.name} | Medário` : 'Perfil médico indisponível | Medário',
    robots: { index: false, follow: true },
    alternates: profile ? { canonical: `https://medario.com.br/medicos/${profile.slug}` } : undefined,
  };
}

function searchString(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (typeof value === 'string') params.set(key, value);
  return params.toString();
}

export default async function AppProfilePage({ params, searchParams }: AppProfilePageProps) {
  const { slug } = await params;
  const returnTo = journeyUrl(readJourneyUrl(`/?${searchString(await searchParams)}`).filters);
  const profile = await getPublicProfile(slug);

  if (!profile) return <main className="public-profile"><p className="section-label">Perfil médico</p><h1>Perfil indisponível</h1><p>Este perfil não está disponível no app neste momento.</p><Link className="profile-back" href={returnTo}>Voltar ao diretório</Link></main>;

  return <main className="public-profile"><Link className="profile-back" href={returnTo}>← Voltar aos resultados</Link><header><p className="section-label">Perfil médico</p><h1>{profile.name}</h1><p>{profile.specialty} · {profile.crm}{profile.rqe ? ` · ${profile.rqe}` : ''}</p></header><ProfileContactActions profile={profile} /><AppointmentRequest slug={profile.slug} /><section><h2>Atendimento</h2><p>{profile.modalities.join(' · ')} · {profile.availability}</p></section></main>;
}
