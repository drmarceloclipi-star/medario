import type { Metadata } from 'next';

import { PublicNotice, PublicPage, PublicSection } from '../public-page';

export const metadata: Metadata = {
  title: 'Política de Privacidade — Medário',
  description: 'Política de Privacidade do Medário: como coletamos, usamos e protegemos seus dados em conformidade com a LGPD.',
  alternates: { canonical: 'https://medario.com.br/privacidade' },
  openGraph: { type: 'article', title: 'Política de Privacidade — Medário', url: 'https://medario.com.br/privacidade' },
};

export default function PrivacyPage() {
  return (
    <PublicPage eyebrow="Documento legal" title="Política de Privacidade" description="Como o Medário coleta, usa, armazena e protege dados de usuários." updatedAt="julho de 2026">
      <PublicNotice><strong>Revisão jurídica necessária:</strong> este texto deve ser revisado por advogado antes da publicação definitiva.</PublicNotice>
      <PublicSection title="Sobre esta política">
        <p>O Medário é uma plataforma de busca médica que conecta pacientes a profissionais de saúde verificados. Esta política se aplica a usuários cadastrados no Medário.</p>
      </PublicSection>
      <PublicSection title="Dados que coletamos">
        <p>Podemos tratar dados de cadastro fornecidos voluntariamente, como e-mail, cidade, bairro, convênio, modalidade de atendimento, idioma e necessidades de acessibilidade.</p>
        <p>Interesses derivados podem ser agregados a partir do histórico de busca, sem armazenar o texto original da busca. Esses dados podem revelar interesses de saúde e recebem proteção compatível.</p>
      </PublicSection>
      <PublicSection title="Base legal e finalidade">
        <p>O tratamento de dados de cadastro e interesses derivados depende de consentimento específico, explícito e revogável. Usamos esses dados para melhorar a relevância das buscas e a experiência do usuário.</p>
      </PublicSection>
      <PublicSection title="Compartilhamento e segurança">
        <p>Não vendemos dados de busca sensíveis nem criamos audiências segmentadas por condição de saúde. Os dados ficam isolados por conta e protegidos no Firebase Firestore por regras de acesso por usuário e TLS em trânsito.</p>
      </PublicSection>
      <PublicSection title="Retenção, exclusão e direitos">
        <p>Os dados são mantidos enquanto a conta estiver ativa. A exclusão da conta remove os dados associados. Você pode acessar, corrigir, eliminar dados e revogar consentimentos pela <a href="/conta">Minha conta</a>.</p>
        <p>Para dúvidas ou solicitações, escreva para <a href="mailto:contato@medario.com.br">contato@medario.com.br</a>.</p>
      </PublicSection>
    </PublicPage>
  );
}
