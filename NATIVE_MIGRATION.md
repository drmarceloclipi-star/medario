# Medário iOS nativo — matriz greenfield

O app iOS é uma nova superfície SwiftUI. Não existe aplicativo Capacitor para migrar, substituir ou preservar. O produto web e o backend Firebase continuam ativos e independentes.

## Fundação

| Área | Fonte atual | Slice 1 iOS | Estado | Próximo gate |
| --- | --- | --- | --- | --- |
| Projeto | Monorepo com `apps/web` | `apps/ios`, XcodeGen, iOS 18+, Swift 6.2 | Implementado e validado | Smoke físico quando o device estiver disponível |
| Identidade | Firebase `medario-doctor` | Bundle `br.com.medario.app`, Firebase app `1:702082375310:ios:afe4190897ec63fadb73df`, Firebase Auth por e-mail/senha | Implementado | App Attest físico e APNs real |
| Arquitetura | Contratos TypeScript e adapters web | SwiftUI + MVVM + repository + modelos `Codable` | Implementado | Expandir portas por feature sem importar código web |
| Dados públicos | `publicDoctors` e `specialties` no Firestore | Leitura de `publicDoctors` publicados e `publicReadSafe == true`; cache após primeira leitura | Implementado e ativo | Paginação e política de invalidação do cache |
| Busca | Busca e filtros web | Busca local por médico, especialidade, cidade e convênio | Parcial | Filtros objetivos e busca conversacional segura |
| Resultados | Cards web | Lista nativa, estados loading/empty/error/retry | Implementado | Ordenação explicável e paginação |
| Perfil | Página pública web | Perfil nativo com credenciais, local, convênios e disponibilidade | Implementado | Smoke do Universal Link em device físico |
| Contato | Links externos verificados | WhatsApp/telefone somente quando verificados e com destino permitido | Implementado | Telemetria consentida de saída |
| Autenticação | Firebase Auth web | Sessão loading/signed-out/signed-in; criar conta de paciente, login, logout e exclusão com reautenticação | Implementado no Slice 2 | Smoke com credencial QA dedicada e device físico |
| Conta | `users/{uid}` privado | Preferências de cidade, convênio, modalidade, idioma e acessibilidade | Implementado no Slice 2 | Integração com favoritos e agendamento |
| Consentimento | `consent_preferences` e `consent_at` | Consentimento de saúde opcional e revogável; falhas restauram valor persistido | Implementado no Slice 2 | Integrar buscas salvas no app nativo |
| Favoritos | Local + callables web | Favoritos e buscas objetivas locais; sincronização autenticada explícita | Implementado no Slice 3 | Smoke autenticado real dos seis callables |
| Agendamento | Functions e OAuth Calendar | Contratos Swift, reserva/remarcação/cancelamento e snapshot de local | Implementado e testado | Publicar tipos/slots reais e validar credencial profissional |
| Notificações | Preferências e outbox no backend | APNs/FCM, consentimento granular, conteúdo genérico e revogação | Implementado e publicado | Capability/APNs e push real em device físico |
| Privacidade | Política e gates web | Sem tracking; privacy manifest declara uso funcional de `UserDefaults`; App Check protege mutações nativas | Implementado localmente | App Privacy questionnaire no ASC |
| Release | Web em App Hosting | AppIcon final, archive arm64 assinado, export compliance explícito, TestFlight `0.1.0 (1)` válido e metadados da versão preenchidos | Parcial | Screenshots, App Privacy, grupo interno e smoke físico |

## Fronteiras

- Web permanece em `apps/web`; nenhum arquivo web é dependência de runtime do app.
- Swift replica contratos necessários de forma explícita. TypeScript não é compartilhado diretamente.
- Firestore expõe somente a projeção `publicDoctors` com `published == true`.
- A leitura pública exige também `publicReadSafe == true`. A migração só marca a projeção quando `location.address` não existe ou `location.authorized == true`.
- Dados privados e mutações continuam bloqueados por rules ou mediados por callables.
- Texto livre de saúde não é persistido neste slice.
- Analytics e tracking não são inicializados no app. Push só é ativado após opt-in granular; mapa usa apenas coordenadas públicas autorizadas.
- Senhas são entregues somente ao Firebase Auth, nunca persistidas pelo app nem registradas em logs.
- Exclusão chama `deleteMyAccount` no servidor; o callable remove o Firebase Auth e a limpeza vinculada. Quando Firebase exige login recente, o app informa que nada foi apagado e solicita reautenticação por senha antes de repetir o callable com token renovado.

## Comandos

```sh
cd apps/ios
xcodegen generate
xcodebuild -project Medario.xcodeproj -scheme Medario -destination 'platform=iOS Simulator,id=<SIMULATOR_UDID>' build
xcodebuild -project Medario.xcodeproj -scheme Medario -destination 'platform=iOS Simulator,id=<SIMULATOR_UDID>' test
```

Use um simulador disponível quando o nome acima não existir. O projeto gerado é derivado de `project.yml`; mudanças estruturais devem começar nesse arquivo.

## Evidência do Slice 1 — 2026-07-18

- Firebase iOS app registrado no projeto `medario-doctor` com bundle `br.com.medario.app`.
- Backfill revisado aplicado a `doctors/doctor-mariana-andrade` e `publicDoctors/doctor-mariana-andrade`; `publicReadSafe == true` porque o endereço possui autorização explícita.
- Firestore Rules publicadas após 11 testes de emulator: leitura/listagem exige `published == true` e `publicReadSafe == true`; projeções inseguras são negadas.
- 11 testes iOS e 21 testes de Functions aprovados; build Swift 6.2 com concorrência estrita aprovado.
- App instalado e aberto no simulador `test-iphone`; leitura live do Firestore exibiu Dra. Mariana Andrade após backfill e deploy das rules.
- Revisão independente encontrou dois bloqueios altos (endereço não autorizado e resposta de busca obsoleta); ambos foram corrigidos e cobertos por testes.

## Slice 2 — conta nativa

- Navegação raiz nativa em abas preserva diretório público sem exigir conta e oferece uma área de conta separada.
- FirebaseAuth e FirebaseFunctions entram via SwiftPM; SDKs ficam atrás de `AccountBackendGateway`, `AccountCallableGateway` e `AccountRepository`, todos injetáveis no `AccountViewModel`.
- Perfil privado segue os mesmos campos do contrato web e das Firestore Rules: `cidade`, `convenio`, `tipo_atendimento`, `idioma`, `acessibilidade`, `consent_preferences` e timestamps de servidor.
- Criação de conta depende do trigger backend `onUserCreate` para materializar `users/{uid}`; o repository também recupera com criação mesclada segura se o perfil ainda não estiver disponível.
- Exclusão não apaga diretamente Auth ou Firestore pelo cliente: chama `deleteMyAccount`; sucesso só é exibido após confirmação do servidor. `revokeHealthConsent` faz a revogação e a limpeza sensível no servidor.
- Smoke autenticado de produção usa conta QA transitória gerada em memória e excluída pelo próprio fluxo. Build, testes unitários e smoke de simulador não criam contas reais.

## Evidência do Slice 2 — 2026-07-18

- Sessão Auth cobre loading, visitante e conta conectada; cadastro de paciente, login e logout usam e-mail/senha sem persistir senha.
- Perfil privado lê e grava cidade, convênio, modalidade, idioma e acessibilidade; consentimento de saúde é opcional, revogável e restaura o valor persistido quando a operação falha.
- Exclusão exige confirmação destrutiva, usa callable, pede reautenticação quando necessário, renova o ID token e só então confirma: `Conta e dados vinculados excluídos.`
- `PrivacyInfo.xcprivacy` declara `UserDefaults` com motivo aprovado `CA92.1` e tracking desativado. Tipos de dados coletados permanecem obrigatórios no questionário App Privacy do App Store Connect.
- 41 testes iOS aprovados no simulador `test-iphone`, incluindo mapper, view model, repository, nomes/roteamento dos callables, tradução segura de erros do Firebase Functions e respostas de perfil obsoletas após logout/troca de usuário.
- Firestore Rules e 29 Cloud Functions foram publicadas no projeto `medario-doctor`; `revokeHealthConsent`, `deleteMyAccount` e o finalizer agendado estão ativos em Node.js 22.
- Smoke integrado Auth + Firestore + Functions + Pub/Sub passou no Emulator Suite: criação/defaults, grant/revogação/purge, exclusão, bloqueio de token antigo, limpeza de notificações/agendamento/conta profissional e sweep final.
- Smoke autenticado de produção passou com conta QA transitória: criação Auth, `onUserCreate`, grant com `serverTimestamp`, purge sensível, exclusão real, remoção Auth/Firestore e negação do token antigo em callable e Rules. Nenhuma conta Auth QA permaneceu.
- Binário nativo foi reinstalado e aberto no `test-iphone` após o deploy; leitura live continuou exibindo a projeção pública segura. A operação manual da tela de conta no Simulator permanece gate físico porque a sessão gráfica do Mac estava bloqueada.
- Gates do snapshot publicado: 41 testes iOS, 33 Functions, 14 Rules, 12 Firebase adapter/server, 54 web unitários e 30 Playwright E2E; revisão independente encerrou sem blocker, high ou medium aberto.

## Slice 3 — favoritos e buscas salvas

- Visitantes favoritam médicos nos cards e no perfil; snapshots mínimos ficam em `UserDefaults` dentro do sandbox do app e aparecem na aba `Salvos`.
- Buscas salvas aceitam somente especialidade, cidade, convênio e modalidade. Texto livre digitado no campo principal, sintomas e localização exata não fazem parte do modelo persistido nem do payload callable.
- Filtros objetivos são aplicados no diretório por uma tela nativa separada; busca textual continua efêmera.
- Login não carrega, combina ou envia itens automaticamente. A área autenticada exige `Carregar itens da conta` ou `Sincronizar agora`.
- Sincronização preserva itens locais, evita reenviar favoritos e critérios já existentes e usa exclusivamente `listSavedItems`, `favoriteDoctor`, `unfavoriteDoctor`, `saveAccountSearch`, `removeAccountSearch` e `setSavedSearchAlert`.
- `SavedItemsRepository`, `SavedItemsLocalStore`, `SavedItemsCallableGateway` e `SavedItemsSessionSource` mantêm persistência, Functions e sessão injetáveis. Respostas autenticadas tardias são descartadas após logout ou troca de UID.
- Estados remotos cobrem idle, loading, erro com retry e conteúdo; ações principais possuem rótulos e dicas de acessibilidade em português brasileiro.

## Evidência do Slice 3 — 2026-07-18

- XcodeGen regenerou o projeto com os novos arquivos Swift, Swift 6.2 e concorrência estrita completa. O target final suporta iOS 18 ou posterior.
- 56 testes iOS aprovados no `test-iphone`: persistência/recuperação local, descarte de campos sensíveis desconhecidos, deduplicação, roteamento dos seis callables, filtros objetivos, opt-in sem merge no login e descarte de resposta privada tardia após logout.
- Build de simulador aprovado sem assinatura. Nenhuma alteração backend, web, Rules, deploy ou commit foi feita neste slice.
- Gate aberto: executar smoke autenticado dos seis callables pela UI em conta QA transitória antes de classificar sincronização de produção como validada.

## Slice 4 — agendamento, mapa, deep links, push e release

- Agendamento nativo cobre opções públicas, solicitação manual/imediata, listagem privada, cancelamento e remarcação. Callables nativos exigem Auth, UID esperado e App Check.
- Local da consulta vira snapshot imutável no agendamento. UI mostra rótulo seguro; mapa e rota Apple Maps aparecem somente para coordenadas explicitamente autorizadas.
- Universal Link aceita apenas `https://medario.com.br/medicos/<slug>`. AASA está publicado no domínio e associado ao Team ID `X66WU4VS9N` + bundle `br.com.medario.app`.
- Push usa Firebase Messaging/APNs nativos. Preferências são granulares; token fica em coleção server-only; entrega revalida revogação, usa claim transacional e não coloca paciente, sintoma, especialidade ou endereço na tela bloqueada.
- Logout remove endpoint push antes de encerrar a sessão. Exclusão de conta também remove preferências, endpoints e outbox vinculados.
- `PrivacyInfo.xcprivacy` está dentro do bundle; `ITSAppUsesNonExemptEncryption=false`; AppIcon 1024×1024 não possui alpha.

## Evidência do Slice 4 — 2026-07-18

- 74 testes unitários iOS e 2 XCUITests aprovados no `test-iphone`, incluindo concorrência de sessão, push, deep links, coordenadas autorizadas, privacy manifest, export compliance, quatro abas nativas e ausência de `WebView` na raiz.
- 40 testes de Functions aprovados. Smoke Auth + Firestore + Functions + Pub/Sub validou revogação, endpoint ausente, outbox, exclusão e finalização; smoke de agendamento validou todos os estados e integração Calendar mockada.
- Functions nativas de preferências, registro/revogação de endpoint e entrega push estão ativas em produção. Chamadas sem App Check retornam `UNAUTHENTICATED`.
- Firebase App Check usa App Attest com TTL de 1 hora; o app iOS ativo está vinculado ao Team ID `X66WU4VS9N` e ao bundle `br.com.medario.app`.
- AASA responde `200 application/json` em `medario.com.br`; Safari reconhece o Smart App Banner.
- Bundle ID explícito `br.com.medario.app` possui Associated Domains, App Attest e Push Notifications. Profiles Development e App Store incluem App Attest; distribuição usa APNs produção e `get-task-allow=false`.
- App Medário criado no ASC com Apple ID `6792379820`; Firebase iOS app vinculado ao mesmo App Store ID.
- Archive arm64 assinado e IPA validados. Build TestFlight `0.1.0 (1)` processou como `VALID`, iOS mínimo 18.0, sem criptografia não isenta.
- Metadados da versão, URLs, copyright e informações de revisão foram salvos; o build `0.1.0 (1)` foi vinculado à versão `1.0`. Nenhuma revisão foi submetida.
- Gate posterior: enviar screenshots reais, concluir App Privacy/faixa etária/categoria, validar App Attest/APNs no iPhone físico quando liberado e criar grupo interno somente após autorização.
