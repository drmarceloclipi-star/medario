# ADR-0001 — Nova aplicação web mobile em monorepo

- **Status:** Aceito
- **Data:** 2026-07-11
- **Issue:** #10
- **Epic:** #9

## Contexto

O Medário atual foi construído como um conjunto de páginas HTML estáticas, com CSS e JavaScript compartilhados, Firebase Hosting, Firebase Authentication, Cloud Firestore e Cloud Functions. Essa arquitetura atende bem à landing page, às páginas institucionais, ao diretório público e aos perfis médicos indexáveis.

A nova direção de produto exige uma aplicação mobile-first com comportamento semelhante a um app: busca conversacional, filtros combinados, favoritos, comparação, agendamento, estados persistentes, drawers, bottom sheets, navegação contextual e uma área Medário Pro com dashboard, leads, agenda, mensagens e analytics.

Continuar adicionando esses fluxos diretamente à estrutura estática aumentaria acoplamento, duplicação, especificidade de CSS, risco de regressão e dificuldade de teste. Ao mesmo tempo, uma reescrita total descartaria ativos públicos e SEO já funcionais.

## Decisão

Adotar um monorepo incremental no mesmo repositório, preservando o site público atual durante a construção da nova aplicação.

Estrutura-alvo:

```text
medario/
├── apps/
│   └── web/                 # nova aplicação Next.js mobile-first
├── packages/
│   ├── ui/                  # design system e componentes compartilhados
│   ├── domain/              # tipos, contratos e regras puras de domínio
│   ├── firebase/            # adaptadores para Auth, Firestore e Functions
│   └── config/              # configurações compartilhadas
├── functions/               # Cloud Functions existentes
├── docs/
│   └── adr/
├── assets/                  # ativos do site público atual
├── medicos/                 # páginas públicas atuais
├── index.html               # landing page atual
├── styles.css               # CSS atual, congelado salvo correções críticas
├── script.js                # JS atual, congelado salvo correções críticas
├── firebase.json
├── firestore.rules
└── CONTEXT.md
```

Durante a migração, os arquivos públicos existentes permanecem na raiz para evitar regressões no Firebase Hosting e perda de URLs indexadas. A movimentação física do site legado para uma pasta separada não faz parte desta decisão inicial e só poderá ocorrer com plano explícito de roteamento, redirects, canonical URLs e validação de SEO.

## Stack da nova aplicação

A nova aplicação em `apps/web` usará:

- Next.js com App Router;
- React;
- TypeScript em modo estrito;
- Tailwind CSS para composição visual, com tokens centralizados em `packages/ui`;
- Firebase Authentication, Cloud Firestore e Cloud Functions por meio de adaptadores em `packages/firebase`;
- Vitest para testes unitários;
- Playwright para testes de interface e regressão visual;
- ESLint e formatação compartilhada.

A versão exata das dependências será definida na issue #11, usando versões estáveis e compatíveis no momento da implementação.

## Responsabilidades dos módulos

### `apps/web`

Responsável por:

- rotas;
- layouts;
- composição de páginas;
- carregamento de dados;
- autenticação da aplicação;
- estado derivado da URL;
- integração entre domínio, UI e infraestrutura.

Não deve definir tokens visuais duplicados nem contratos de domínio locais quando estes forem compartilháveis.

### `packages/ui`

Responsável por:

- tokens de cor, tipografia, espaçamento, raios, sombras e movimento;
- primitivas acessíveis;
- componentes reutilizáveis;
- shell mobile;
- documentação visual dos componentes.

Não deve importar Firebase, lógica de persistência ou entidades específicas de páginas.

### `packages/domain`

Responsável por:

- tipos de domínio;
- enums;
- contratos;
- validações puras;
- regras sem dependência de React, Next.js, Firebase ou browser.

O vocabulário deve seguir `CONTEXT.md`.

### `packages/firebase`

Responsável por:

- inicialização dos SDKs;
- adaptadores de Auth, Firestore e Functions;
- mapeamento entre documentos persistidos e contratos de `packages/domain`;
- tratamento padronizado de erros de infraestrutura.

Não deve conter componentes visuais.

### `packages/config`

Responsável por configurações compartilhadas de TypeScript, lint e demais ferramentas quando a duplicação justificar um pacote próprio.

## Convenções de dependência

Fluxo permitido:

```text
apps/web → packages/ui
apps/web → packages/domain
apps/web → packages/firebase
packages/firebase → packages/domain
packages/ui → packages/domain apenas quando um componente genérico precisar de tipos estáveis
```

Fluxos proibidos:

```text
packages/domain → React, Next.js, Firebase ou packages/ui
packages/ui → packages/firebase
packages/firebase → packages/ui
```

Dependências circulares são proibidas.

## Convenções de importação

Os pacotes internos usarão nomes explícitos:

```text
@medario/ui
@medario/domain
@medario/firebase
@medario/config
```

Imports profundos só serão permitidos quando fizerem parte da API pública declarada do pacote. Componentes e tipos não devem depender de caminhos internos acidentais.

## Estratégia para o site público atual

O site atual será tratado como legado estável durante a primeira fase.

Regras:

1. Não remover nem renomear URLs públicas existentes.
2. Não alterar canonical, Open Graph ou JSON-LD sem tarefa específica de SEO.
3. Não migrar páginas públicas para Next.js durante a construção do shell mobile.
4. Manter Firebase Hosting funcionando para a raiz atual até que uma estratégia de deploy híbrido seja aprovada.
5. Novos fluxos interativos devem nascer em `apps/web`, não em `script.js` ou `styles.css`.
6. Correções críticas no legado continuam permitidas, desde que isoladas e testadas.

## Estratégia de deploy

A primeira fase não altera o deploy de produção.

A nova aplicação deve inicialmente ter build e preview independentes. A decisão entre Vercel, Firebase App Hosting ou integração avançada com Firebase Hosting será tomada em ADR separado após um protótipo funcional do shell.

Nenhuma rota de produção será apontada para `apps/web` antes de:

- build estável;
- testes mínimos;
- validação visual;
- definição de domínio ou subcaminho;
- plano de rollback.

## Estado e dados

Diretrizes iniciais:

- busca e filtros compartilháveis ficam na URL;
- drawers, sheets e estados efêmeros ficam em estado local;
- dados persistentes ficam no Firestore;
- autenticação e preferências essenciais podem usar contexto dedicado;
- evitar store global única para toda a aplicação;
- dados públicos devem aproveitar renderização do servidor e cache quando adequado;
- a interface deve ser desenvolvida primeiro com mocks tipados de `packages/domain`.

## Segurança e privacidade

- Regras do Firestore continuam sendo a barreira de autorização principal para clientes web.
- Dados sensíveis não devem ser expostos em componentes, logs ou parâmetros de URL.
- Novas coleções exigem revisão explícita de regras e minimização de dados.
- A integração existente de consentimento deverá ser corrigida em tarefa própria antes de uso em produção na nova aplicação.

## Alternativas consideradas

### 1. Continuar com HTML, CSS e JavaScript puros

Rejeitada para os novos fluxos. Mantém simplicidade de deploy, mas cria custo crescente de manutenção, estado e testes.

### 2. Reescrever todo o site em Next.js imediatamente

Rejeitada nesta fase. Aumenta risco de regressão de SEO, URLs, deploy e conversão antes de validar a nova experiência mobile.

### 3. Criar outro repositório para a aplicação

Rejeitada. Separaria domínio, Firebase, ativos, documentação e governança sem benefício suficiente no estágio atual.

### 4. Adotar biblioteca visual completa pronta

Não escolhida como padrão. O Medário possui direção visual própria. Bibliotecas headless poderão ser usadas pontualmente para acessibilidade, mas os componentes visuais permanecerão sob controle de `packages/ui`.

## Consequências positivas

- preserva o investimento atual;
- reduz risco de regressão pública;
- permite evolução incremental;
- melhora reutilização e testabilidade;
- separa domínio, interface e infraestrutura;
- prepara o Medário para PWA e futuras superfícies.

## Consequências negativas

- haverá coexistência temporária de duas arquiteturas;
- o repositório ficará mais complexo;
- build e deploy exigirão configuração adicional;
- alguns ativos e estilos poderão coexistir durante a transição;
- a equipe precisará respeitar rigorosamente os limites entre legado e nova aplicação.

## Plano de implementação

1. Issue #11: inicializar `apps/web` e workspace.
2. Issue #12: criar `packages/ui` e tokens.
3. Issue #13: criar `packages/domain`.
4. Issue #14: implementar o shell mobile.
5. Issue #15: configurar qualidade e regressão visual.
6. Criar ADR posterior para estratégia definitiva de deploy e roteamento.

## Critério de revisão desta decisão

Este ADR deve ser revisto se ocorrer qualquer uma das condições:

- necessidade de múltiplas equipes com ciclos de release independentes;
- mudança de backend principal;
- decisão de migrar integralmente o site público;
- incompatibilidade operacional comprovada entre o deploy legado e o novo app;
- custo de monorepo superar os ganhos de compartilhamento.
