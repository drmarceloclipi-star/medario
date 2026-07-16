# ADR-0002 — Jornada contínua entre frontends públicos e de produto

- **Status:** Aceito
- **Data:** 2026-07-15

## Contexto

O Medário mantém dois frontends por responsabilidades diferentes:

- `medario.com.br` é a superfície pública indexável, responsável por descoberta orgânica, conteúdo institucional e páginas SEO;
- `app.medario.com.br` é a superfície de produto interativa, responsável por busca, conta, favoritos, comparação, agendamento e Medário Pro.

Domínios distintos não devem criar a percepção de produtos distintos. A transição atual interrompe identidade visual, linguagem e navegação, criando uma ruptura entre descoberta e ação.

## Decisão

Os dois domínios compõem uma única **Jornada contínua**. A pessoa deve perceber continuidade invisível ao ir do conteúdo público ao produto.

O frontend público claro e editorial em `medario.com.br` é a referência visual da marca. O app aproxima-se dessa linguagem — paper como superfície, navy como âncora de confiança, azul como estrutura e vermelho floral como microacento — sem sacrificar padrões mobile de interação.

O frontend público encaminha para o app com CTAs contextuais e somente filtros objetivos, por exemplo especialidade, cidade, convênio e modalidade. O app recebe, explica e permite editar esses filtros.

Texto livre de busca, sintomas, localização exata, identidade ou outros dados de saúde não transitam pela URL ou por redirecionamento entre domínios.

## Contrato de experiência

1. Marca, tom, vocabulário, hierarquia e estados de confiança são consistentes entre as superfícies.
2. O CTA do conteúdo público descreve a próxima ação no app, sem tratar o app como produto externo.
3. Cada página SEO tem uma continuação contextual no app quando houver filtros objetivos equivalentes.
4. O app mantém o contexto recebido visível e editável antes de iniciar uma nova busca.
5. Login e preferências não são pré-requisitos para a descoberta pública nem para a primeira busca.
6. A transição preserva privacidade: nenhum dado sensível integra URL, analytics de campanha ou parâmetro de redirecionamento.

## Ordem de entrega

As pontes são complementares, não alternativas. Serão entregues nesta ordem:

1. Páginas SEO de especialidade ou cidade em `medario.com.br` encaminham para Busca interpretada no app com filtros objetivos equivalentes.
2. Perfil médico público encaminha para contato ou agendamento no app, preservando apenas o identificador público estável do Perfil médico.
3. Home pública encaminha para a busca no app, com uma entrada geral e sem inventar contexto que a pessoa não forneceu.

A primeira ponte recebe prioridade por conectar descoberta orgânica a uma intenção já contextualizada. A segunda fecha a jornada de maior intenção. A terceira unifica a porta de entrada de marca depois que as transições contextuais existirem.

## Comportamento da primeira ponte

Uma página SEO encaminha diretamente para a lista de resultados no app. A lista abre com os filtros objetivos da página já aplicados, visíveis e editáveis. Não há tela intermediária, confirmação ou texto de busca sintetizado.

O primeiro recorte é exclusivamente o Diretório local indexável de Joinville. Sua ponte envia `city=joinville`. Páginas por especialidade, convênio ou modalidade não entram nesta entrega; serão avaliadas depois da validação da ponte inicial.

Nessa página, a ação principal é um CTA único: **"Ver médicos em Joinville"**. Ele aponta para `https://app.medario.com.br/?city=joinville`. A busca livre legada não participa da ponte inicial.

Os cards estáticos existentes permanecem abaixo do CTA como prova de conteúdo público. O CTA global do header também passa a encaminhar ao app, sem filtro. O primeiro ajuste visual obrigatório no app é adotar `paper` e superfícies claras; demais convergências visuais seguem depois.

## Critério de aceite inicial

A ponte Joinville está aceita quando o CTA abre o app e a lista apresenta resultados com `city=joinville` aplicado, visível e editável. Não depende de instrumentação de taxa de clique nem de início de agendamento nesta etapa.

Enquanto o diretório tiver menos de três Perfis médicos confirmados, mantém `noindex`. Nesta condição, a ponte valida jornada e experiência, não aquisição orgânica. O CTA abre na mesma aba. O app não expõe controle de retorno ao site público.

O tema claro do app é entregue antes da ponte Joinville, no mesmo release.

O mínimo visual do tema claro inclui `paper`, cards claros e a paleta navy, azul e vermelho definida em `DESIGN.md`. Tipografia editorial não é aplicada indiscriminadamente à UI de produto. O topo do app usa wordmark completo para tornar a marca inequívoca na troca de domínio.

## Ponte de Perfil médico

O Perfil médico permanece público e indexável em `medario.com.br`. Seu CTA de contato ou agendamento abre o app; o perfil não migra integralmente nesta etapa.

O CTA abre a página do mesmo Perfil médico no app, usando sua URL pública estável. Ação de contato ou agendamento permanece uma escolha posterior dentro do perfil no app.

A URL usa slug público, resolvido internamente para a identidade persistida do perfil. Se não houver perfil disponível no app, ele exibe estado explícito e oferece retorno ao diretório no app; não redireciona silenciosamente. Contato e agendamento aceitam Visitante: contato abre canal externo verificado e o agendamento de visitante usa validação por telefone ou e-mail, sem exigir conta.

## Navegação compartilhada

- O CTA global do header público é **"Encontrar médicos"** e abre a home do app sem filtros.
- **"Entrar"** abre `app.medario.com.br/conta`.
- **"Especialidades"** continua apontando para o diretório público de Joinville.
- Cards do diretório abrem o Perfil médico público; o CTA desse perfil é que abre o mesmo perfil no app.
- O wordmark do app volta à home do app. Não há atalho visual de retorno ao outro domínio.
- Medário Pro permanece na página pública atual até que seu fluxo tenha ponte própria.

## Dados, estado e falhas

Cards públicos só afirmam CRM, RQE, convênio ou disponibilidade quando houver Dado atualizado com data de confirmação. No app, filtro vindo da ponte aparece como chip visível com controle **"Editar filtros"**.

A passagem de domínio não usa intersticial. O app exibe seu skeleton nativo durante carregamento. Se falhar, mostra erro explícito e **"Tentar novamente"**, sem redirecionamento automático.

## Identidade, SEO e privacidade entre domínios

Tokens de logo, cor e tipografia têm fonte única em `packages/ui`; o legado deve consumir valores compatíveis. O app substitui avatar com iniciais de Visitante por entrada explícita de conta e repete, em forma curta, a promessa pública: **"Encontre médicos em Joinville com informações verificáveis."**

Chegada via SEO abre filtros objetivos; busca por sintomas só começa por iniciativa da pessoa dentro do app. URLs de resultado filtrado no app usam `noindex,follow`, deixando a página pública canônica responsável por indexação.

Sessão autenticada deve sobreviver entre os subdomínios quando tecnicamente seguro. Consentimento de telemetria não é herdado automaticamente: o app coleta consentimento contextual próprio.

A ponte pode incluir `entry=directory-joinville`, exclusivamente para depuração e somente usado em telemetria após consentimento. A política de referrer permanece `strict-origin-when-cross-origin`. Testes de contrato aceitam somente `specialty`, `city`, `insurance`, `modality` e `entry`; demais parâmetros são descartados.

## Comportamento do diretório e dos perfis

`www.medario.com.br` redireciona permanentemente para `medario.com.br`. O app renderiza lista ou estado inicial no servidor; interações exigem JavaScript. `city` inválida é descartada com explicação e controle para editar filtros.

No diretório público, o CTA único fica após a introdução e antes dos cards. Cards continuam abrindo o Perfil médico público; não recebem CTA secundário para o app nesta etapa.

No perfil do app, **"Ver opções de agendamento"** só é a ação principal quando existir Slot elegível. Sem agenda configurada, aparece apenas Contato externo verificado. Dado atualizado usa prazo configurável por tipo: inicialmente 90 dias para convênio e contato, e cinco minutos para disponibilidade integrada.

O terceiro Perfil médico necessário para indexação só pode ser real, com CRM conferido e autorização aplicável. Tema claro é aceito por screenshot mobile de topbar, fundo, CTA, card e filtro, com contraste validado.

## Continuidade dentro do app

Abrir Perfil médico a partir de resultados preserva os filtros objetivos na URL para que voltar restaure a mesma busca. Editar filtros atualiza a URL somente com os parâmetros permitidos. Link público para perfil no app pode levar `city=joinville` como contexto de retorno, além do slug público.

Após troca de tela, foco acessível vai para `main` ou para o título dos resultados. Skeleton reproduz estrutura de cards sem dados fictícios. Em falha de rede, filtros permanecem e **"Tentar novamente"** repete a consulta.

Voltar no navegador mantém comportamento nativo. CTA de contato declara seu destino externo, como **"Falar por WhatsApp"** ou **"Ligar para consultório"**. Testes visuais cobrem 360 px, 390 px e 1280 px. Falha do tema claro ou da ponte reverte somente o release do app; URLs e site público permanecem intactos.

## Indexação, marca e desempenho

Perfil no app usa metadados do Perfil médico, mas canonical aponta para o Perfil público; a versão do app fica `noindex`. Sitemap lista somente URLs públicas canônicas. A ponte captura `entry` uma vez e o remove da URL com `replaceState`.

App usa Sora para UI e Source Serif para marca, hero e momentos editoriais. Favicon é o mesmo do Medário e `theme-color` passa a ser paper. O app permanece claro nesta fase, sem alternância automática por preferência de sistema.

Legado não recebe reescrita ampla em tokens compartilhados: valores compatíveis são migrados incrementalmente. Aceite de desempenho: LCP do destino no app abaixo de 2,5 s em rede móvel simulada.

## Consequências

- O site público continua responsável por SEO e URLs indexáveis.
- O app continua responsável pelos fluxos com estado e interação.
- O tema escuro atual do app não é a referência visual para novas telas ou para a convergência entre superfícies.
- Design system, navegação e parâmetros permitidos passam a ser contratos compartilhados entre os dois frontends.
- Qualquer rota migrada deve preservar seu papel de descoberta pública ou declarar explicitamente sua nova estratégia de indexação.

## Registro de entrega — 2026-07-16

- Tema claro, contrato de URL, ponte Joinville, ponte de Perfil médico, ações de Visitante e entradas públicas foram entregues e verificados em produção.
- O backend App Hosting `medario` está no build `2026-07-16-019`, com 100% do tráfego restaurado após teste de rollback e restauração.
- A URL de chegada `https://app.medario.com.br/?city=joinville&entry=directory-joinville` apresentou LCP de 2,04 s em auditoria direta.
- `medario.com.br` permanece no Firebase Hosting; `app.medario.com.br` permanece no Firebase App Hosting.
- `www.medario.com.br` está ativo no Firebase Hosting e redireciona permanentemente ao apex, preservando caminho e query. O provedor emite HTTP 301 para esse tipo de redirecionamento. O CNAME `www -> medario-doctor.web.app` não aponta o domínio ao App Hosting.
