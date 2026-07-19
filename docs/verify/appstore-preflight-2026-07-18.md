# App Store preflight — 2026-07-18

## Estado atual

| Item | Estado vivo |
| --- | --- |
| Team ID | `X66WU4VS9N` |
| Bundle ID | `br.com.medario.app` |
| App Store Connect app | Ativo: Medário, Apple ID `6792379820`, locale `pt-BR`, SKU `medario-ios-2026` |
| Apple Bundle ID explícito | Ativo: `V25U936Y4A`, Associated Domains, App Attest e Push Notifications habilitados |
| TestFlight | `0.1.0 (1)`, build `e249e6da-75a6-49be-a5ca-5269b4b1bb8d`, `VALID`, “Pronta para envio” |
| Versão App Store | `1.0`, `PREPARE_FOR_SUBMISSION`; build `0.1.0 (1)` vinculado |
| Metadados pt-BR | Texto promocional, descrição, palavras-chave, suporte, marketing, copyright e informações de revisão salvos |
| Firebase iOS app | Ativo: `1:702082375310:ios:afe4190897ec63fadb73df` |
| Firebase App Attest | Registrado, TTL `3600s`, Team ID `X66WU4VS9N` |
| Firebase App Store ID | `6792379820` |

## Artefato local

- App SwiftUI nativo; nenhum runtime Capacitor ou Cordova.
- Bundle `br.com.medario.app`, versão `0.1.0`, build `1`, deployment target iOS 18+.
- AppIcon 1024×1024 sem alpha.
- `PrivacyInfo.xcprivacy` empacotado, tracking desativado e motivo `CA92.1` para `UserDefaults`.
- `ITSAppUsesNonExemptEncryption=false` empacotado.
- 74 testes unitários iOS e 2 XCUITests aprovados; o smoke prova quatro abas nativas e zero `WebView` na raiz.
- Suite física aprovada no iPhone 17 Pro Max (iOS 26.5.2): 74 testes unitários e 2 XCUITests, instalação e abertura do app `br.com.medario.app`.
- Universal Link de produção aprovado no aparelho: `https://medario.com.br/medicos/mariana-andrade` abriu diretamente a tela nativa `Perfil médico` da Dra. Mariana Andrade.
- App Attest de produção aprovado no aparelho: build Release assinada para desenvolvimento emitiu token real (`APP_CHECK_SMOKE_OK`); entitlements continham App Attest `production`, Associated Domains e APNs `development`.
- Push físico revelou falha: após autorização do iOS, `Messaging.messaging().token()` permaneceu aguardando por mais de 45 segundos; nenhum endpoint FCM foi registrado. Conta e documentos QA temporários foram removidos.
- Archive Release arm64 assinado com Apple Distribution e profile App Store aprovado.
- IPA validado e enviado sem erros; iOS mínimo `18.0`, `usesNonExemptEncryption=false`.
- Export options usa assinatura manual e profile `Medario iOS App Store AppAttest 2026`.

## Mudanças vivas realizadas

- Bundle ID explícito criado no Apple Developer.
- Associated Domains, App Attest e Push Notifications habilitados.
- Profiles `Medario iOS Development AppAttest 2026` e `Medario iOS App Store AppAttest 2026` criados e instalados. Ambos incluem App Attest; distribuição inclui APNs de produção e `get-task-allow=false`.
- App Medário criado no ASC com Apple ID `6792379820`.
- Firebase iOS app atualizado com Team ID e App Store ID.
- Build `0.1.0 (1)` validado, enviado e processado no TestFlight.
- Build `0.1.0 (1)` vinculado à versão App Store `1.0`.
- Metadados pt-BR, URLs, copyright, contato e notas de revisão salvos. Login de demonstração marcado como não obrigatório.
- Nenhum grupo, tester, Beta App Review ou App Review foi criado/submetido.

## Bloqueios

1. Corrigir ou limitar a espera por token APNs/FCM no fluxo `FirebaseNativeNotificationPermissionService.requestToken()`; repetir registro e entrega real de push no iPhone.
2. Criar grupo interno e adicionar testers somente após autorização específica.
3. Enviar screenshots reais e concluir App Privacy, faixa etária e categoria.
4. Submeter App Review somente após autorização explícita separada.

## Próxima ação

Corrigir o bloqueio de obtenção do token FCM e repetir o smoke físico de push. App Attest, Universal Link, instalação, abertura e suite Xcode no aparelho já estão validados.
