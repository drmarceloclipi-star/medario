# Route ownership

Cutover contract for legacy Firebase Hosting and Next App Hosting.

| Route | Current owner | Next owner | Cutover gate |
| --- | --- | --- | --- |
| `/` | Firebase Hosting apex; App Hosting preview | `apps/web` home | Final; SEO and Auth green |
| `/medicos/mariana-andrade` | App Hosting preview; Firebase Hosting rollback | Next SSR profile | Firestore profile migration + schema green |
| `/medicos/joinville` | App Hosting preview; Firebase Hosting rollback | Next directory | Route migrated; indexação exige três perfis confirmados + conteúdo único |
| `/sou-medico` | Firebase Hosting legacy | Next acquisition page | Content and CTA parity |
| `/medario-pro` | Firebase Hosting legacy | Next authenticated Pro | Auth, callables and ownership rules green |
| `/conta` | App Hosting preview; Firebase Hosting rollback | Next account | Auth, account adapter and deletion green |
| `/institucional`, `/privacidade`, `/termos` | App Hosting preview; Firebase Hosting rollback | Next public pages | Link, metadata e aliases green |

Rules:

- Preserve `/medicos/mariana-andrade` as canonical URL.
- `.html` aliases das rotas migradas retornam 308 para URLs extensionless; aliases ainda legados permanecem no bundle de rollback.
- No route transfers while its gate is red.
- Legacy bundle remains available as an immutable rollback release until the observation window ends.
