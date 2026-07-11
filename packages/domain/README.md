# @medario/domain

Contratos centrais da aplicação Medário.

## Responsabilidades

- representar entidades e enums do domínio;
- padronizar IDs, slugs e datas ISO;
- fornecer mocks tipados para desenvolvimento visual;
- permanecer independente de React, Next.js, Firebase e CSS.

## Regras

- componentes de UI podem importar este pacote;
- este pacote não pode importar `@medario/ui` nem infraestrutura;
- persistência e serialização ficam em `packages/firebase`;
- novos contratos devem usar nomes em inglês no código e preservar a terminologia médica definida no projeto.

## Validação

```bash
npm --workspace @medario/domain run typecheck
```
