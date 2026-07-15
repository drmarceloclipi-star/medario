# Launch readiness

Gate obrigatório para expor a nova jornada pública. A aplicação Next permanece isolada do legado até todos os itens possuírem evidência atual.

## Gates

| Gate | Evidência exigida | Estado atual |
| --- | --- | --- |
| Busca, resultado, perfil e contato | Playwright verde no fluxo completo | Parcial: busca, resultado e perfil cobertos; contato permanece link seguro, sem orquestração de lead. |
| Agendamento | Solicitação, confirmação, cancelamento e estado final contra orquestrador persistido | Parcial: OAuth, agenda dedicada, free/busy e entrega idempotente do evento estão implementados; falta smoke real com Conta profissional e cenários de cancelamento/remarcação. |
| Autorização | Revisão explícita de regras e emulador Firestore com acesso próprio/negação cruzada | Parcial: Auth, conta, favoritos, buscas salvas, consentimento e OAuth profissional usam Firebase real; falta smoke de credencial profissional em produção. |
| Consentimento | Consentimento de saúde e telemetria verificável e revogável | Verde no fluxo implementado: saúde persistido; analytics e erro sanitizado somente após consentimento de telemetria. |
| Acessibilidade e visual | WCAG AA, viewport aprovado e regressão visual principal | Verde no slice migrado: Lighthouse/Axe sem violações, viewport E2E e snapshot mobile revisado. |
| Observabilidade | Crash/error monitoring sem texto de busca, sintomas ou localização exata | Parcial: evento técnico sanitizado no Firebase Analytics após consentimento; falta validar recepção em produção e definir provedor dedicado de error reporting, se necessário. |
| Analytics | Evento apenas após Consentimento de telemetria | Parcial: Firebase Analytics configurado e carregado somente após consentimento; falta evidência de evento em produção. |
| Degradação | Mapa e Google Calendar retornam caminho seguro testado | Parcial: mapa coberto; OAuth Calendar falha fechado e agenda fica indisponível sem snapshot fresco. Falta smoke real. |
| Rollback | Versão anterior identificada, preview validado e reversão ensaiada | Verde: rollback ensaiado; domínio App Hosting público validado. |

## Operação antes do cutover

1. Executar `npm run qa:web` e os testes de domínio; evidência atual em [`docs/cutover-evidence.md`](./cutover-evidence.md).
2. Executar Firebase Emulator para regras e Hosting; manter smoke live de Auth, callables e perfil registrado.
3. Validar busca, resultado, perfil, contato, mapa e OAuth Calendar no App Hosting; usar Conta profissional ativa e conferir criação da agenda dedicada e do evento mínimo.
4. Revisar payloads de analytics e erros: somente código, rota e métricas agregadas; nunca busca, sintomas, identidade de visitante ou localização exata.
5. Registrar versão anterior, dono da reversão e smoke pós-deploy. Reverter antes de ampliar tráfego se um gate falhar.

Sem todos os gates verdes, manter o legado como superfície pública. Não apagar nem redirecionar a aplicação Capacitor/iOS inexistente neste repositório.
