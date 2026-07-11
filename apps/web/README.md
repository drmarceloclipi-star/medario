# Medário Web

Nova aplicação web mobile do Medário, isolada do site público existente na raiz do repositório.

## Requisitos

- Node.js 22+
- npm com suporte a workspaces

## Comandos a partir da raiz

```bash
npm install
npm run dev:web
npm run build:web
npm run lint:web
npm run typecheck:web
```

O site público legado continua sendo servido pelos arquivos estáticos da raiz. Esta aplicação não altera as rotas ou o deploy atuais até que uma estratégia de publicação própria seja configurada.
