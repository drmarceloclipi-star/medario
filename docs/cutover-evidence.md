# Evidências do cutover incremental

Atualização: 2026-07-11

## Estado publicado

- Firebase Hosting legado usa `.firebase/legacy-public`, gerado por allowlist em `scripts/build-legacy-hosting.mjs`.
- App Hosting backend `medario`, região `us-east4`, root `/apps/web`, runtime Node 22.
- Rollout validado: build `build-2026-07-11-044`, commit `9575fbb`, rollout `rollout-2026-07-11-037`, tráfego 100% na revisão nova.
- Perfil `doctors/doctor-mariana-andrade` e projeção `publicDoctors/doctor-mariana-andrade` migrados.

## Smoke live

- `/`, `/conta` e `/medicos/mariana-andrade`: HTTP 200.
- Aliases `dra-marina-alves` e `marina-alves`: redirect canônico para `mariana-andrade`.
- Perfil entrega canonical, CRM/RQE, JSON-LD e contato somente quando verificado.
- Auth real: login, preferências Firestore, consentimento, exclusão de conta e limpeza via trigger.
- Callables reais: favorito + `listSavedItems` retornaram snapshot persistido; visitante continua local até merge explícito.
- Hosting legado: fontes/configs internas testadas retornam 404; assets allowlisted retornam 200.

## Domínio App Hosting

`app.medario.com.br` foi vinculado ao backend, mas aguarda DNS do provedor:

- A `app.medario.com.br` → `35.219.200.200`
- TXT `app.medario.com.br` → `fah-claim=023-02-ecae48a6-00a5-4455-b246-82a1ff0caaa9`
- CNAME `_acme-challenge_w2lv6yenuls7hto7.app.medario.com.br.` → `2c314b74-2596-4e27-b117-48fa7dfcd05a.0.authorize.certificatemanager.goog.`

Não houve alteração de `medario.com.br`, remoção do Hosting legado ou cutover apex.

## Gates ainda abertos

- DNS e SSL de `app.medario.com.br` dependem do provedor DNS.
- Diretório SEO continua `noindex` até existirem três perfis confirmados e conteúdo único.
- Agenda, Medário Pro, observabilidade e analytics permanecem fora do cutover público.
- Axe/Lighthouse e snapshot visual ainda precisam de execução dedicada.
- Rollback foi identificado por revisões App Hosting/Hosting; ensaio operacional antes do apex ainda pendente.
