# Etapa 0 — Rede de segurança

**Objetivo:** criar a rede de proteção (CI, testes de fumaça, higiene de segredos)
que garante que as próximas etapas de refatoração não quebrem nada. Nesta etapa
**não** se altera lógica de negócio, hooks, repositories, migrations ou Edge Functions.

**Data:** 2026-07-02 · **Branch:** `main`

**Commits (isolados, um por tarefa):**

| Commit | Escopo |
|--------|--------|
| `99782d1` | `chore(ci)` — GitHub Actions + lint gate + `.npmrc` |
| `ac48b22` | `test` — smoke tests (phone, quoteMapper) + quarentena do teste legado |
| `6d10904` | `chore(env)` — `.env.example`, gitignore `.env*`, untrack `.env` |
| _(este doc)_ | `docs` — relatório da Etapa 0 |

> Os 23 arquivos modificados de uma etapa anterior (sweep de formatação, não
> commitados) **não** foram tocados — todos os `git add` usaram caminhos
> explícitos. Continuam na árvore de trabalho, fora destes commits.

---

## 1. CI (GitHub Actions)

**Arquivo:** [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — roda em
**todo push e pull request**. Job único `quality` (Ubuntu, Node 22, cache npm):

1. `npm ci` — usa `.npmrc` (`legacy-peer-deps=true`) por causa dos conflitos de
   peer do `vite@8`, senão o `npm ci` falharia.
2. `npx tsc --noEmit` — falha se houver **qualquer** erro de tipo.
3. `node scripts/lint-gate.mjs` — gate de lint (ver abaixo).
4. `npm run test` — Vitest.

**Gate de lint** ([`scripts/lint-gate.mjs`](../../scripts/lint-gate.mjs) +
[`ci/lint-baseline.json`](../../ci/lint-baseline.json)):

- Roda o ESLint uma vez e **reporta a contagem** de erros/warnings/`any` no log.
- **Falha** se o total de erros **subir** acima do baseline (`maxErrors`) **ou** se
  a contagem de `@typescript-eslint/no-explicit-any` **subir** (`maxAny`). Isso trava
  a regra "nenhum `any` novo" mesmo que outro erro seja removido para compensar.
- O baseline **só pode descer**: ao pagar dívida de lint, baixe os números no
  mesmo PR.

Baseline medido no tree commitado (com os 23 arquivos não-commitados temporariamente
em stash, para refletir exatamente o que o CI vê): **89 erros / 68 `any`**.

---

## 2. Testes de fumaça (Vitest)

O Vitest já estava instalado (`vitest@4.1.8`, scripts `test`/`test:watch`,
`vitest.config.ts`, jsdom). Foram adicionados testes para **helpers puros e mappers**,
sem tocar em UI nem em rede:

- [`src/lib/whatsapp/__tests__/phone.test.ts`](../../src/lib/whatsapp/__tests__/phone.test.ts)
  — `normalizeBrazilianPhone`, `validateBrazilianPhone`, `isLikelyValidBrazilianPhone`,
  `formatPhoneBR`. Cobre os casos BR documentados:
  - **válidos:** `"(51) 99999-9999"`, `"51999999999"`, `"5551999999999"`, `"+55 (11) 98765-4321"`
  - **inválidos:** `"99999-9999"`, `"123"`, `""` — além de DDD inexistente (00) e
    celular de 13 dígitos sem o 9.
- [`src/services/quotes/__tests__/quoteMapper.test.ts`](../../src/services/quotes/__tests__/quoteMapper.test.ts)
  — ida-e-volta `Quote`/`QuoteItem` ↔ Supabase: mapeamento de campos, coerções
  `Number()` (colunas numéricas que o PostgREST devolve como string), `archived`
  derivado de `status === "arquivado"`, fallbacks de nulos.

### Quarentena de teste legado

`src/hooks/__tests__/useLocalQuotesImport.test.ts` foi escrito para **Jest**
(`jest.mock` / `jest.Mock`) e importa `@testing-library/react-hooks` — pacote
deprecado e **não instalado**. Ele **nunca rodou** sob o Vitest (o `import` quebra em
tempo de transform), ou seja, o `npm run test` já estava vermelho antes da Etapa 0.

Foi colocado em **quarentena** via `exclude` em `vitest.config.ts` (mantendo os
defaults do Vitest), para o CI ficar verde sem esconder o problema.
**Follow-up:** migrar de Jest → Vitest (`vi.mock` + `renderHook` do
`@testing-library/react`) e remover da exclusão.

---

## 3. Segredos e ambiente

- [`.env.example`](../../.env.example) — documenta as vars **públicas** de frontend
  (`VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) e
  lista os **segredos de backend** (service_role, `UAZAPI_*`, `GEMINI_API_KEY`,
  `VERTEX_API_KEY`, `GCP_SERVICE_ACCOUNT`, `LOVABLE_API_KEY`) — que ficam **apenas**
  nos Supabase secrets, nunca no repositório.
- `.gitignore` — passou a ignorar `.env` e `.env.*`, mantendo só `.env.example`.
- `.env` foi **destrackeado** (`git rm --cached .env`); o arquivo local foi preservado.

### Varredura de segredos — achados

Varredura em arquivos versionados **e nos 1298 commits de histórico** (JWTs
decodificados por role; padrões de private key e prefixos de provedores
`sk_live_`/`sk_test_`/`re_`/`AIza`/`aact_`):

| Item | Resultado |
|------|-----------|
| JWTs no histórico | **1 único**, `role=anon` (ref `ewamvzncsloagtcvkbxv`) |
| `service_role` key | **Nenhuma** — nunca commitada |
| Private keys embutidas | **Nenhuma** — os matches de `BEGIN PRIVATE KEY` são código que _remove_ o header de uma key vinda de `Deno.env.get(...)` em runtime |
| Chaves Asaas/Resend/Gemini/UAZAPI | **Nenhuma** versionada |

**Conclusão:** nenhum segredo real versionado. O único valor sensível-aparente é a
**anon/publishable key** — pública por design (vai no bundle via
`src/integrations/supabase/client.ts`, gerado pelo Lovable) e protegida por RLS.
Como não é um segredo, **não** houve gatilho de "PARAR e avisar".

> **Lembrete de segurança (fora do repo):** um Personal Access Token do Supabase
> (`sbp_…`) foi colado no chat em sessão anterior. PATs não ficam no código, mas
> recomenda-se **rotacioná-lo** no painel do Supabase por precaução.

---

## Baseline — antes/depois

| Métrica | Antes (HEAD) | Depois (Etapa 0) |
|---------|--------------|-------------------|
| `npx tsc --noEmit` | **0 erros** | **0 erros** |
| ESLint — erros | 89 | **89** (sem regressão) |
| ESLint — `no-explicit-any` | 68 | **68** (sem regressão) |
| ESLint — warnings | 28 | 28 |
| `npm run test` | **vermelho** (1 arquivo Jest quebrado) | **verde** |
| Arquivos de teste | 6 (+1 quebrado) | **7 passando** |
| Testes | — | **48 passando** |

> Os arquivos novos (workflow, scripts `.mjs`, `.json`, `.md`, `.env.example`) **não**
> são lintados (a config só cobre `**/*.{ts,tsx}`); os dois novos `*.test.ts` foram
> escritos sem `any` e sem novos erros — por isso o baseline permaneceu 89/68.

---

## Critérios de aceite

- [x] CI roda em push/PR com `npm ci`, `tsc --noEmit` e lint.
- [x] Lint **não regride**: gate falha se erros aumentarem **ou** se surgir `any` novo;
      contagem reportada no log.
- [x] Vitest configurado + `npm run test` com ao menos 1 arquivo passando (na prática,
      2 novos arquivos / 27 testes novos; suíte total 48 verde).
- [x] Testes cobrem helpers puros/mappers (telefone BR, quoteMapper), sem UI/rede.
- [x] `.env.example` documenta todas as variáveis; segredos ficam só no backend.
- [x] `.env*` (exceto `.env.example`) no `.gitignore`.
- [x] Varredura de segredos executada (versionados + histórico) — **nenhum segredo real**.
- [x] `npx tsc --noEmit` = 0 e lint sem regressão ao final.
- [x] Commits pequenos e isolados (ci / testes / env / docs).
- [x] Nenhuma alteração em lógica de negócio, hooks, repositories, migrations ou Edge Functions.

## Follow-ups (fora do escopo da Etapa 0)

1. Migrar `useLocalQuotesImport.test.ts` de Jest → Vitest e tirar da quarentena.
2. Ir baixando `ci/lint-baseline.json` conforme a dívida de lint (89 erros / 68 `any`)
   for sendo paga nas próximas etapas.
3. Rotacionar o PAT do Supabase colado no chat (precaução).
4. Fazer o **push** dos 4 commits para o GitHub para o CI rodar pela primeira vez.
