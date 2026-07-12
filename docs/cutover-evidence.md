# Evidências do cutover incremental

Atualização: 2026-07-11

## Estado publicado

- Firebase Hosting legado usa `.firebase/legacy-public`, gerado por allowlist em `scripts/build-legacy-hosting.mjs`.
- App Hosting backend `medario`, região `us-east4`, root `/apps/web`, runtime Node 22.
- Rollout validado: build `build-2026-07-11-056`, commit `b5a56bb`, rollout `rollout-2026-07-11-049`, tráfego 100% na revisão nova.
- Perfil `doctors/doctor-mariana-andrade` e projeção `publicDoctors/doctor-mariana-andrade` migrados.
- Rotas públicas `/institucional`, `/privacidade`, `/termos` e `/medicos/joinville` servidas pelo Next; diretório real permanece `noindex,follow` até três perfis confirmados.
- `robots.txt` e `sitemap.xml` servidos pelo App Hosting; sitemap inclui somente home, páginas públicas legais e perfis confirmados.
- App Hosting preview usa `robots: Disallow: /`; domínio próprio e apex usam sitemap host-aware quando conectados.
- Headers live: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy e HSTS.
- Standalone final contém `.next/static` e `public`; favicon servido sem 404.

## Smoke live

- `/`, `/conta`, `/institucional`, `/privacidade`, `/termos`, `/medicos/joinville`, `/robots.txt` e `/sitemap.xml`: HTTP 200.
- Aliases `dra-marina-alves` e `marina-alves`: redirect canônico para `mariana-andrade`.
- Aliases legais e de diretório `.html`: HTTP 308 para as rotas extensionless.
- Diretório entrega ItemList, perfil real de Mariana, canonical e `noindex, follow` enquanto o gate de indexação está fechado.
- Perfil entrega canonical, CRM/RQE, JSON-LD e contato somente quando verificado.
- Auth real: login, preferências Firestore, consentimento, exclusão de conta e limpeza via trigger.
- Callables reais: favorito + `listSavedItems` retornaram snapshot persistido; visitante continua local até merge explícito.
- Hosting legado: fontes/configs internas testadas retornam 404; assets allowlisted retornam 200.

## QA final

- `npm run qa:web` reexecutado em 2026-07-11 20:46 -03: 38 testes unitários, 21 E2E, typecheck, lint e build standalone verdes.
- Functions reexecutado: 18/18 testes verdes. Rules Emulator: 9/9 testes verdes, incluindo consentimento explícito para `search_events`; o teste usa IDs de evento únicos para permanecer repetível contra o emulador persistente.
- Lighthouse no standalone local: home 96 performance / 100 acessibilidade / 100 best-practices / 100 SEO; institucional 99 / 100 / 100 / 100; diretório 99 / 100 / 100, com `noindex` intencional.
- Axe live: zero violações em home, institucional e diretório.

## Domínio App Hosting

`app.medario.com.br` foi vinculado ao backend. Em 2026-07-11, os registros foram adicionados no painel DNS da Hostinger. O primeiro CNAME foi salvo na raiz por engano; depois foi corrigido para o host `_acme-challenge_w2lv6yenuls7hto7.app`. A, TXT e CNAME agora respondem nos nameservers autoritativos, Google DNS e Cloudflare.

- A `app.medario.com.br` → `35.219.200.200`
- TXT `app.medario.com.br` → `fah-claim=023-02-ecae48a6-00a5-4455-b246-82a1ff0caaa9`
- CNAME `_acme-challenge_w2lv6yenuls7hto7.app.medario.com.br.` → `2c314b74-2596-4e27-b117-48fa7dfcd05a.0.authorize.certificatemanager.goog.`

Verificação DNS executada com `dig` contra `apollo.dns-parking.com`, `athena.dns-parking.com`, `8.8.8.8` e `1.1.1.1`: A/TXT/CNAME confirmados; não há AAAA, CNAME concorrente ou CAA restritiva. Nova verificação no console Firebase em 2026-07-11 20:47 -03 ainda informa `Mudanças de DNS ainda não detectadas`; às 20:48 -03 o CLI confirmou o backend saudável (`/apps/web`, Node 22, `reconciling=false`), enquanto HTTP responde redirect para HTTPS e TLS ainda não foi provisionado. A documentação do App Hosting informa que a emissão pode levar algumas horas e, em casos raros, até 24 horas.

Gate reproduzível: `PATH=/usr/local/bin:$PATH npm run verify:app-hosting-domain` confirmou A/TXT/CNAME (`ok: true`) e falhou somente no HTTPS (`ECONNRESET`).

Não houve alteração de `medario.com.br`, remoção do Hosting legado ou cutover apex.

## Gates ainda abertos

- SSL e status conectado de `app.medario.com.br` ainda dependem da emissão do certificado pelo App Hosting.
- Diretório SEO continua `noindex` até existirem três perfis confirmados e conteúdo único.
- Agenda, Medário Pro, observabilidade e analytics permanecem fora do cutover público.
- Snapshot visual mobile gerado e revisado; Lighthouse/Axe verdes. SEO do preview permanece bloqueado deliberadamente por `robots`.
- Rollback foi identificado por revisões App Hosting/Hosting; ensaio operacional antes do apex ainda pendente.
