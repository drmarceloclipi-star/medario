# Evidências do cutover incremental

Atualização: 2026-07-11

## Estado publicado

- Firebase Hosting legado usa `.firebase/legacy-public`, gerado por allowlist em `scripts/build-legacy-hosting.mjs`.
- App Hosting backend `medario`, região `us-east4`, root `/apps/web`, runtime Node 22.
- Rollout validado: build `build-2026-07-11-050`, commit `a85841c`, rollout `rollout-2026-07-11-043`, tráfego 100% na revisão nova.
- Perfil `doctors/doctor-mariana-andrade` e projeção `publicDoctors/doctor-mariana-andrade` migrados.
- Rotas públicas `/institucional`, `/privacidade`, `/termos` e `/medicos/joinville` servidas pelo Next; diretório real permanece `noindex,follow` até três perfis confirmados.
- `robots.txt` e `sitemap.xml` servidos pelo App Hosting; sitemap inclui somente home, páginas públicas legais e perfis confirmados.

## Smoke live

- `/`, `/conta`, `/institucional`, `/privacidade`, `/termos`, `/medicos/joinville`, `/robots.txt` e `/sitemap.xml`: HTTP 200.
- Aliases `dra-marina-alves` e `marina-alves`: redirect canônico para `mariana-andrade`.
- Aliases legais e de diretório `.html`: HTTP 308 para as rotas extensionless.
- Diretório entrega ItemList, perfil real de Mariana, canonical e `noindex, follow` enquanto o gate de indexação está fechado.
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
- Axe/Lighthouse e snapshot visual ainda precisam de execução dedicada; a tentativa local foi limitada por disco raiz sem espaço.
- Rollback foi identificado por revisões App Hosting/Hosting; ensaio operacional antes do apex ainda pendente.
