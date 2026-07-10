# CONTEXT.md — Glossário do domínio Medário

> Glossário do domínio. Sem detalhes de implementação. Termos resolvidos durante a entrevista de planejamento (`/grill-with-docs`).

## Termos do domínio

### Médário
Catálogo médico digital nascido em Joinville/SC. Plataforma de diretório e visibilidade profissional: conecta pacientes a médicos com informações verificáveis (CRM, RQE) e ajuda médicos a serem encontrados localmente.

### Card preview
Card minimalista de médico exibido na home como teaser — foto, nome, selo *Disponível*, especialidade + CRM, convênios, bairro/cidade, ação *Ver perfil*. Intencionalmente leve; não é o card completo do diretório.

### Card completo (§10)
Card de médico exibido no diretório (`/medicos/joinville`). Inclui foto ou iniciais, nome, especialidade, CRM, RQE (quando aplicável), bairro e cidade, tipo de atendimento (presencial, teleconsulta ou ambos), principais convênios, selos de confiança (CRM verificado, RQE informado, perfil verificado, patrocinado) e ações (WhatsApp, ligar, ver perfil). O nome do médico é a hierarquia primária; selos não podem ofuscar a identidade do profissional.

### Perfil verificado
Selo de confiança indicando que o perfil do médico foi verificado pelo Medário. Exibido como texto navy sobre superfície aqua/paper. Não implica ranqueamento de qualidade médica.

### Perfil reivindicado
Status em que o próprio médico assumiu o controle do seu perfil no Medário, atualizando dados e contatos. Diferente de *perfil verificado* (que valida dados) — reivindicado valida autoria.

### CRM conferido
Selo indicando que o número de CRM (Conselho Regional de Medicina) foi verificado quanto à existência e consistência.

### RQE informado
Selo indicando que o número de RQE (Registro de Qualificação de Especialista) foi informado pelo profissional. Diferente de *CRM conferido* — RQE informado declara, não valida.

### Plano patrocinado
Posicionamento pago de um médico nos resultados de busca, claramente rotulado como *Patrocinado* antes do clique. Não afeta a verificação ou a hierarquia de identidade do profissional. O status patrocinado é visível e transparente.

### Dossiê profissional
Metáfora de layout para a página de perfil do médico (`/medicos/[slug]`). Deve parecer um dossiê profissional estruturado — credenciais, localizações, agendamento, foco clínico e verificação — não uma bio de rede social.

### Diagnóstico de presença digital
Serviço gratuito do Medário Pro que avalia a presença online de um médico ou clínica (SEO local, Google Business Profile, etc.) antes da contratação de um plano pago. Página dedicada (`/diagnostico-presenca-digital`) é deliverável de Stage 5.

## Termos do cadastro de usuário

### Bifurcação de usuário
Ponto de entrada onde o usuário se identifica como paciente ou médico ao clicar em "Começar". A partir daí, o fluxo se ramifica: paciente segue para cadastro com preferências; médico segue para o fluxo de aquisição (`/sou-medico`).

### Preferência operacional
Dado logístico não-sensível que o usuário fornece para refinar buscas: cidade/bairro, convênio, tipo de atendimento (presencial/teleconsulta), idioma, acessibilidade. Não é dado de saúde — já existe no fluxo de busca pública sem conta.

### Interesse derivado
Especialidade de interesse agregada do histórico de busca do usuário, sem armazenar os termos brutos pesquisados. Ex: três buscas por "dermatologista" geram o interesse `dermatologia` com contagem 3. É o resultado do processamento, não o insumo — princípio da minimização de dados.

### Perfil de afinidade
Score pré-computado por especialidade (ex: `dermatologia: 0.8, pediatria: 0.3`) gerado por Cloud Function a partir dos interesses derivados. Gravado no documento do usuário no Firestore. Usado pelo cliente para re-ranking leve dos resultados de busca — médicos cuja especialidade tem alta afinidade sobem nos resultados.

### Consentimento em duas camadas
Modelo de consentimento LGPD onde o cadastro básico (email/senha) não coleta dados sensíveis. O consentimento para processamento de interesses de saúde acontece no contexto da primeira busca, com pergunta contextual e ação afirmativa do usuário. Pode ser revogado a qualquer momento nas configurações.

## Conceitos que o glossário evita

- **Avaliações de pacientes** — o MVP não inclui reviews, estrelas ou rankings de qualidade médica.
- **Melhor médico / top physician** — linguagem de ranqueamento sem metodologia transparente é proibida.
- **Recomendado pelo Medário** — só permitido quando critérios são explícitos e publicados.