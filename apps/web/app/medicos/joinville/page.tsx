import type { Metadata } from 'next';
import Link from 'next/link';

import { PublicPage } from '../../public-page';
import { createPublicProfileReader } from '../../profile-data';
import { canIndexLocalDirectory } from '../../seo';
import type { PublicProfile } from '@medario/domain';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const canonical = 'https://medario.com.br/medicos/joinville';
const uniqueContent = 'Diretório local com informações profissionais confirmadas sobre especialidades, CRM, RQE, convênios, modalidades e formas de contato em Joinville.';

async function loadProfiles(): Promise<PublicProfile[]> {
  try {
    const page = await (await createPublicProfileReader()).list({ city: 'Joinville', limit: 100 });
    return page.profiles;
  } catch (error) {
    console.error('public Joinville directory load failed', error instanceof Error ? error.message : 'unknown error');
    return [];
  }
}

function isIndexable(profiles: PublicProfile[]) {
  return canIndexLocalDirectory({
    city: 'Joinville',
    uniqueContent,
    profiles: profiles.map((profile) => ({ slug: profile.slug, updatedAt: profile.updatedAt, confirmed: profile.verified })),
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const profiles = await loadProfiles();
  const indexable = isIndexable(profiles);
  return {
    title: 'Médicos em Joinville/SC | Medário',
    description: 'Encontre médicos em Joinville/SC por especialidade, convênio, bairro e tipo de atendimento. Perfis verificados com CRM e RQE.',
    alternates: { canonical },
    robots: { index: indexable, follow: true },
    openGraph: { type: 'website', title: 'Médicos em Joinville/SC | Medário', description: 'Diretório médico de Joinville com CRM, RQE e informações verificáveis.', url: canonical },
  };
}

function safeJsonLd(value: unknown) {
  const replacements: Record<string, string> = { '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029' };
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => replacements[character] ?? character);
}

function ProfileCard({ profile }: { profile: PublicProfile }) {
  return (
    <article className="directory-card">
      <div className="directory-card-heading">
        <div className="doctor-initials" aria-hidden="true">{profile.name.split(' ').slice(0, 2).map((part) => part[0]).join('')}</div>
        <div>
          <h2>{profile.name}</h2>
          <p>{profile.specialty} · {profile.crm}{profile.rqe ? ` · ${profile.rqe}` : ''}</p>
        </div>
      </div>
      <dl>
        <div><dt>Local</dt><dd>{profile.location.district}, {profile.location.city}/{profile.location.state}</dd></div>
        <div><dt>Atendimento</dt><dd>{profile.modalities.join(' · ')}</dd></div>
        <div><dt>Convênios</dt><dd>{profile.insurances.length > 0 ? profile.insurances.map((item) => item.name).join(' · ') : 'A confirmar'}</dd></div>
      </dl>
      <footer>
        <span>{profile.verified ? 'Perfil verificado' : 'Dados em confirmação'}</span>
        <Link href={`/medicos/${profile.slug}`}>Ver perfil</Link>
      </footer>
    </article>
  );
}

export default async function JoinvilleDirectoryPage() {
  const profiles = await loadProfiles();
  const indexable = isIndexable(profiles);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Médicos em Joinville/SC',
    itemListElement: profiles.map((profile, index) => ({ '@type': 'ListItem', position: index + 1, name: `${profile.name} — ${profile.specialty}`, url: `https://medario.com.br/medicos/${profile.slug}` })),
  };

  return (
    <PublicPage eyebrow="Diretório médico" title="Médicos em Joinville/SC" description="Perfis profissionais com CRM, RQE, convênios e modalidades de atendimento verificáveis.">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }} />
      {!indexable && <p className="directory-gate" role="note">Diretório em expansão. A indexação pública será habilitada após três perfis confirmados e conteúdo local suficiente.</p>}
      <p className="directory-bridge"><a href="https://app.medario.com.br/?city=joinville&entry=directory-joinville">Ver médicos em Joinville</a></p>
      <section className="directory-grid" aria-label="Perfis médicos">
        {profiles.length > 0 ? profiles.map((profile) => <ProfileCard key={profile.slug} profile={profile} />) : <p className="directory-empty">Nenhum perfil confirmado disponível no momento.</p>}
      </section>
      <p className="directory-disclaimer">O Medário organiza informações profissionais e não substitui consulta médica. Em caso de emergência, ligue 192.</p>
    </PublicPage>
  );
}
