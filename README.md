# Kora Hub

Gestão e produtividade completa para agências, estúdios e empresas — CRM,
orçamentos, projetos, financeiro e WhatsApp, num só lugar.

**Stack:** React 18 + TypeScript + Vite + Tailwind/shadcn-ui, com Supabase
(Postgres + Auth + Storage + Edge Functions) como backend.

## Como rodar

Pré-requisitos: **Node 22+** e npm.

```bash
npm ci          # instala dependencias (usa .npmrc: legacy-peer-deps por causa do vite@8)
npm run dev     # servidor de desenvolvimento (Vite) em http://localhost:8080
npm run build   # build de producao
npm run test    # testes (Vitest)
npm run lint    # ESLint
```

Outros scripts: `build:dev` (build em modo development), `preview` (servir o build
localmente), `test:watch` (testes em watch).

**Ambiente:** copie `.env.example` para `.env`. As variáveis de frontend são
públicas (a anon key é protegida por RLS); os segredos de backend ficam apenas nos
Supabase secrets — nunca versionados. Detalhes em [`.env.example`](.env.example).

**Qualidade:** o CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda em
todo push e pull request — `tsc --noEmit`, gate de lint (sem regressão e sem `any`
novo) e testes.

## Mapa do repositório

| Caminho | Papel |
|---------|-------|
| `supabase/migrations/` | **Banco de dados** — schema, índices, RLS, funções (SQL versionado) |
| `supabase/functions/` | **Backend serverless** — Edge Functions (Deno): webhooks, WhatsApp, IA |
| `src/pages/` | **Telas** — uma por rota (React Router) |
| `src/components/ui/` | **Design system** — primitivos shadcn/ui + Radix + Tailwind |
| `src/components/<módulo>/` | **UI** — componentes por módulo (dashboard, crm, vendas, whatsapp…) |
| `src/hooks/` | **Estado e lógica** — hooks (`useFinance`, `useClients`, `useFormat`…) |
| `src/repositories/` | **Acesso a dados** — funções que falam com o Supabase |
| `src/integrations/supabase/` | **Client** — client Supabase gerado + tipos do banco |
| `src/lib/` | Utilitários (formatação, i18n, WhatsApp, notificações) |
| `docs/` | **Documentação** — veja [`docs/README.md`](docs/README.md) |

## Documentação

- [`docs/`](docs/README.md) — índice geral da documentação.
- Arquitetura e plano de auditoria/evolução: [`docs/architecture/kora-hub-auditoria-e-plano.md`](docs/architecture/kora-hub-auditoria-e-plano.md).
- Relatórios por etapa: [`docs/qa/`](docs/qa).
