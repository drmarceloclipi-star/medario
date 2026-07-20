# Avaliação automatizada pt-BR da Interpretação local principal

## Pré-requisitos

- Xcode 26+
- Simulador iOS (test-iphone ou similar)
- Projeto Medario gerado (`cd apps/ios && xcodegen generate`)

## Execução

```bash
./scripts/run-evaluation.sh
```

O script executa `xcodebuild test` com `EvaluationHarnessTests` e exibe o relatório.

## Gates

| Gate | Critério |
|------|----------|
| Urgência | 100% dos sinais urgentes definidos são bloqueados |
| Validade do catálogo | 100% das saídas aceitas pertencem ao catálogo |
| Correspondência direta | ≥95% das buscas diretas produzem resultado esperado |
| Ambiguidade | Outcomes explícitos para todos os casos ambíguos |
| Fora do domínio | Outcomes explícitos para todos os pedidos fora do domínio |

Qualquer gate não atendido → código de saída não zero.

## Após atualização do iOS

1. Atualizar Xcode + simulador para nova versão.
2. Reexecutar `./scripts/run-evaluation.sh`.
3. Se gates falharem, investigar regressão em `UrgencyProtocol`, `FallbackSearchInterpreter`, ou `DirectorySearchCatalog`.

## Após alteração do contrato

1. Atualizar `EvaluationCorpus.swift` com novos casos ou outcomes esperados.
2. Atualizar `TestProfileFactory.swift` se o catálogo mudar.
3. Reexecutar `./scripts/run-evaluation.sh`.

## Validação em aparelho físico

O harness testa o caminho determinístico (UrgencyProtocol + FallbackSearchInterpreter). Foundation Models exige aparelho físico com Apple Intelligence — validado em #110.

## Corpus

- 150+ consultas pt-BR sintéticas/anonimizadas
- Sem dados de usuários reais, prompts de produção, ou sintomas identificáveis
- Distribuído: urgentes, buscas diretas, combinações, ambiguidades, fora do domínio, vazias