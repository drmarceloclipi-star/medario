# Launch readiness

Gate obrigatório para expor a nova jornada pública. A aplicação Next permanece isolada do legado até todos os itens possuírem evidência atual.

## Gates

| Gate | Evidência exigida | Estado atual |
| --- | --- | --- |
| Busca, resultado, perfil e contato | Playwright verde no fluxo completo | Parcial: busca, resultado e perfil cobertos; Contato externo ainda é mock local. |
| Agendamento | Solicitação, confirmação, cancelamento e estado final contra orquestrador persistido | Bloqueado: sem Auth, Firestore schema/rules e integração real. |
| Autorização | Revisão explícita de regras e emulador Firestore com acesso próprio/negação cruzada | Bloqueado: regras de agenda/Pro/favoritos inexistentes. |
| Consentimento | Consentimento de saúde e telemetria verificável e revogável | Saúde coberto; telemetria ainda sem integração. |
| Acessibilidade e visual | WCAG AA, viewport aprovado e regressão visual principal | Parcial: lint, viewport e E2E; Lighthouse/axe e snapshot visual pendentes. |
| Observabilidade | Crash/error monitoring sem texto de busca, sintomas ou localização exata | Bloqueado: provedor e configuração inexistentes. |
| Analytics | Evento apenas após Consentimento de telemetria | Bloqueado: provedor e configuração inexistentes. |
| Degradação | Mapa e Google Calendar retornam caminho seguro testado | Mapa coberto; Calendar aguarda OAuth e agenda real. |
| Rollback | Versão anterior identificada, preview validado e reversão ensaiada | Legado Hosting tem deploy versionado; novo app não tem destino de produção aprovado. |

## Operação antes do cutover

1. Executar `npm run qa:web` e os testes de domínio.
2. Executar Firebase Emulator para regras e Hosting; registrar resultado.
3. Criar preview do destino da nova app e validar busca, resultado, perfil, contato, mapa e agenda.
4. Revisar payloads de analytics e erros: somente código, rota e métricas agregadas; nunca busca, sintomas, identidade de visitante ou localização exata.
5. Registrar versão anterior, dono da reversão e smoke pós-deploy. Reverter antes de ampliar tráfego se um gate falhar.

Sem todos os gates verdes, manter o legado como superfície pública. Não apagar nem redirecionar a aplicação Capacitor/iOS inexistente neste repositório.
