import type { Metadata } from 'next';

import { PublicPage, PublicSection } from '../public-page';

export const metadata: Metadata = {
  title: 'Institucional — Medário',
  description: 'Conheça o Medário, uma busca médica clara, local e verificável, feita em Joinville, SC.',
  alternates: { canonical: 'https://medario.com.br/institucional' },
  openGraph: { type: 'website', title: 'Institucional — Medário', description: 'Busca médica clara, local e verificável.', url: 'https://medario.com.br/institucional' },
};

export default function InstitutionalPage() {
  return (
    <PublicPage eyebrow="Medário" title="Institucional" description="Busca médica clara, local e verificável.">
      <PublicSection title="Sobre o Medário">
        <p>O Medário organiza informações profissionais para facilitar a busca por médicos, especialidades e formas de atendimento em Joinville e região.</p>
      </PublicSection>
      <PublicSection title="Como trabalhamos">
        <p>Apresentamos informações claras sobre CRM, RQE, localização, convênios e canais de contato. O Medário não faz avaliações, rankings de qualidade ou promessas de resultado clínico.</p>
      </PublicSection>
      <PublicSection title="Feito em Joinville, SC">
        <p>O projeto nasceu para tornar a busca por cuidado médico local mais simples, transparente e confiável.</p>
      </PublicSection>
    </PublicPage>
  );
}
