import type { Metadata } from 'next';

import { PublicNotice, PublicPage, PublicSection } from '../public-page';

export const metadata: Metadata = {
  title: 'Termos de Uso — Medário',
  description: 'Termos de Uso da plataforma Medário: regras, responsabilidades e limitações do serviço.',
  alternates: { canonical: 'https://medario.com.br/termos' },
  openGraph: { type: 'article', title: 'Termos de Uso — Medário', url: 'https://medario.com.br/termos' },
};

export default function TermsPage() {
  return (
    <PublicPage eyebrow="Documento legal" title="Termos de Uso" description="Regras, responsabilidades e limitações para uso da plataforma Medário." updatedAt="julho de 2026">
      <PublicNotice><strong>Revisão jurídica necessária:</strong> este texto deve ser revisado por advogado antes da publicação definitiva.</PublicNotice>
      <PublicSection title="Sobre estes termos">
        <p>Estes Termos definem as regras para uso da plataforma Medário, um diretório médico digital. Ao criar uma conta ou utilizar o serviço, você concorda com eles.</p>
      </PublicSection>
      <PublicSection title="Cadastro e uso aceitável">
        <p>Forneça dados verazes e mantenha suas informações atualizadas. Guarde suas credenciais e não use a plataforma para automedicação ou autodiagnóstico.</p>
        <p>O Medário não substitui consulta médica. Em caso de emergência, ligue 192 (SAMU).</p>
      </PublicSection>
      <PublicSection title="Conteúdo e responsabilidade">
        <p>O Medário é um diretório. Não recomendamos médicos, não garantimos resultados clínicos e não nos responsabilizamos por decisões de saúde tomadas apenas com base nas informações da plataforma.</p>
        <p>Perfis profissionais são fornecidos pelos próprios médicos e verificados na medida do possível, sem garantia de exatidão absoluta.</p>
      </PublicSection>
      <PublicSection title="Conta, suspensão e mudanças">
        <p>A violação destes termos pode resultar na suspensão ou encerramento da conta. Os termos podem ser atualizados; alterações relevantes serão comunicadas aos usuários.</p>
      </PublicSection>
      <PublicSection title="Contato">
        <p>Para dúvidas sobre estes termos, escreva para <a href="mailto:contato@medario.com.br">contato@medario.com.br</a>.</p>
      </PublicSection>
    </PublicPage>
  );
}
