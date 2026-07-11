# Launch readiness

Gate obrigatório para expor a nova jornada pública. A aplicação Next permanece isolada do legado até todos os itens possuírem evidência atual.

## Gates

| Gate | Evidência exigida | Estado atual |
| --- | --- | --- |
| Busca, resultado, perfil e contato | Playwright verde no fluxo completo | Parcial: busca, resultado e perfil cobertos; contato permanece link seguro, sem orquestração de lead. |
| Agendamento | Solicitação, confirmação, cancelamento e estado final contra orquestrador persistido | Bloqueado: agenda/Pro ainda não migrados para o fluxo Next/Firebase real. |
| Autorização | Revisão explícita de regras e emulador Firestore com acesso próprio/negação cruzada | Parcial: Auth, conta, favoritos, buscas salvas e consentimento usam Firebase real; agenda/Pro ainda não migrados. |
| Consentimento | Consentimento de saúde e telemetria verificável e revogável | Parcial: saúde coberto; telemetria ainda sem integração. |
| Acessibilidade e visual | WCAG AA, viewport aprovado e regressão visual principal | Verde no slice migrado: Lighthouse/Axe sem violações, viewport E2E e snapshot mobile revisado. |
| Observabilidade | Crash/error monitoring sem texto de busca, sintomas ou localização exata | Bloqueado: provedor e configuração inexistentes. |
| Analytics | Evento apenas após Consentimento de telemetria | Bloqueado: provedor e configuração inexistentes. |
| Degradação | Mapa e Google Calendar retornam caminho seguro testado | Mapa coberto; Calendar aguarda OAuth e agenda real. |
| Rollback | Versão anterior identificada, preview validado e reversão ensaiada | Parcial: legado versionado e App Hosting build 056 ativo; ensaio de reversão e aprovação do domínio ainda pendentes. |

## Operação antes do cutover

1. Executar `npm run qa:web` e os testes de domínio; evidência atual em [`docs/cutover-evidence.md`](./cutover-evidence.md).
2. Executar Firebase Emulator para regras e Hosting; manter smoke live de Auth, callables e perfil registrado.
3. Validar busca, resultado, perfil, contato e mapa no App Hosting; agenda aguarda integração persistida.
4. Revisar payloads de analytics e erros: somente código, rota e métricas agregadas; nunca busca, sintomas, identidade de visitante ou localização exata.
5. Registrar versão anterior, dono da reversão e smoke pós-deploy. Reverter antes de ampliar tráfego se um gate falhar.

Sem todos os gates verdes, manter o legado como superfície pública. Não apagar nem redirecionar a aplicação Capacitor/iOS inexistente neste repositório.
