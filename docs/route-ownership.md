# Route ownership

Cutover contract for legacy Firebase Hosting and Next App Hosting.

| Route | Current owner | Next owner | Cutover gate |
| --- | --- | --- | --- |
| `/` | Firebase Hosting legacy | `apps/web` home | Final; SEO and Auth green |
| `/medicos/mariana-andrade` | Firebase Hosting legacy | Next SSR profile | Firestore profile migration + schema green |
| `/medicos/joinville` | Firebase Hosting legacy | Next directory | Three confirmed profiles + unique content |
| `/sou-medico` | Firebase Hosting legacy | Next acquisition page | Content and CTA parity |
| `/medario-pro` | Firebase Hosting legacy | Next authenticated Pro | Auth, callables and ownership rules green |
| `/conta` | Firebase Hosting legacy | Next account | Auth, account adapter and deletion green |
| `/institucional`, `/privacidade`, `/termos` | Firebase Hosting legacy | Next public pages | Link and metadata crawl green |

Rules:

- Preserve `/medicos/mariana-andrade` as canonical URL.
- `.html` aliases redirect to extensionless URLs after ownership transfer.
- No route transfers while its gate is red.
- Legacy bundle remains available as an immutable rollback release until the observation window ends.
