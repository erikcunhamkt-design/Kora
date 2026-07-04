# Etapa 1 — Organização do repositório

**Objetivo:** deixar o repositório navegável (banco / backend / frontend / design /
funções) movendo toda a documentação para `docs/` e adicionando READMEs de
orientação. **Baixo risco:** mexe SOMENTE em `.md` — nenhum arquivo de código é
tocado; o app permanece byte-a-byte idêntico em runtime.

**Data:** 2026-07-04 · **Branch:** `main`

**Commits (isolados):**

| Commit | Escopo |
|--------|--------|
| `6c8019b` | (a) estrutura `docs/` + `git mv` dos 34 `.md` + fix de links relativos |
| `aa4d965` | (c) 14 READMEs de pasta (mapa do repo) |
| `d43636a` | (b) README raiz + plano de auditoria |
| _(este doc)_ | relatório da Etapa 1 |

---

## Árvore da documentação — antes/depois

**Antes:** 35 `.md` soltos na raiz (poluição visual; item M4 do plano).

```
kora-hub/
├── README.md            (stub de 3 linhas)
├── INTEGRATIONS-ROADMAP.md
├── QA-REPORT.md
├── LINT-REPORT.md
├── SOUNDS-V1.md
├── SUPABASE-*.md        (31 arquivos)
└── ...
```

**Depois:** raiz limpa (só `README.md`); tudo classificado em `docs/`.

```
kora-hub/
├── README.md                         (mapa do repo + como rodar)
└── docs/
    ├── README.md                     (índice)
    ├── architecture/  (2 + plano)    FOUNDATION-SPEC, FOUNDATION-IMPLEMENTATION,
    │                                 kora-hub-auditoria-e-plano.md
    ├── database/      (0 + README)   pasta preparada p/ schema/RLS puro
    ├── integrations/  (3)            INTEGRATIONS-ROADMAP, WHATSAPP-CAMPAIGNS-V1, WHATSAPP-INBOX-V1
    ├── qa/            (5 + etapas)    QA-REPORT, LINT-REPORT, CRM-QA, TECHNICAL-SHEET-QA,
    │                                 SOUNDS-V1, etapa-0, etapa-1
    └── features/                     24 specs por módulo:
        ├── crm/               (7)
        ├── quotes/            (6)
        ├── clients/           (3)
        ├── projects/          (3)
        ├── technical-sheets/  (2)
        ├── storage/           (2)
        └── dashboard/         (1)
```

> Nota de classificação: a pasta `database/` do plano original ficaria vazia
> porque **nenhum** doc é referência pura de schema/RLS — os `SUPABASE-*.md` são
> specs por módulo (schema + implementação + QA misturados). Por isso foi criada
> `features/<módulo>/`, decisão confirmada com o dono do repo antes de mover.

---

## Arquivos movidos (34 `git mv`, histórico preservado)

| Destino | Arquivos |
|---------|----------|
| `architecture/` | SUPABASE-FOUNDATION-SPEC, SUPABASE-FOUNDATION-IMPLEMENTATION |
| `integrations/` | INTEGRATIONS-ROADMAP, SUPABASE-WHATSAPP-CAMPAIGNS-V1, SUPABASE-WHATSAPP-INBOX-V1 |
| `qa/` | QA-REPORT, LINT-REPORT, SUPABASE-CRM-QA, SUPABASE-TECHNICAL-SHEET-QA, SOUNDS-V1 |
| `features/crm/` | CRM-V1, CRM-BETA, CRM-BETA-OPERACIONAL, CRM-OPERATIONAL-V1, CRM-IMPORT, CRM-OPPORTUNITY-QUOTES, CRM-QUOTE-CREATE |
| `features/quotes/` | QUOTES-V1, QUOTES-APPROVAL, QUOTES-IMPORT, QUOTES-VIEWER, QUOTE-PROJECTS, QUOTE-RECEIVABLES |
| `features/clients/` | CLIENTS-V1, CLIENTS-DATASOURCE, CLIENTS-IMPORT |
| `features/projects/` | PROJECT-TASKS, PROJECT-TASKS-STATUS, PROJECT-TASKS-VIEWER |
| `features/technical-sheets/` | TECHNICAL-SHEETS-V1, TECHNICAL-SHEETS-BETA |
| `features/storage/` | STORAGE-V1, STORAGE-MATERIALS-V1 |
| `features/dashboard/` | OPERATIONAL-DASHBOARD |

**Links relativos ajustados** (apenas os quebrados pelo movimento, entre subpastas):
4 arquivos — `QUOTES-V1` (→ dashboard, → crm), `QUOTE-PROJECTS` (→ dashboard),
`QUOTE-RECEIVABLES` (→ dashboard), `OPERATIONAL-DASHBOARD` (→ projects).
Verificação automática: **12 links relativos entre docs, 0 quebrados**.

## READMEs criados (15)

- **Raiz:** `README.md` (reescrito: produto, como rodar, mapa do repositório, links).
- **Código:** `src/pages`, `src/components`, `src/components/ui`, `src/hooks`,
  `src/repositories`, `src/integrations`, `supabase/functions`, `supabase/migrations`.
- **Docs:** `docs/` + `architecture`, `database`, `integrations`, `qa`, `features`.

## Plano de auditoria

`docs/architecture/kora-hub-auditoria-e-plano.md` criado com o conteúdo fornecido
(apenas posicionado, sem reescrita). O link do README agora resolve.

---

## Resultado de tsc / lint / test (idênticos ao baseline)

| Métrica | Baseline (Etapa 0) | Após Etapa 1 |
|---------|--------------------|--------------|
| `npx tsc --noEmit` | 0 erros | **0 erros** |
| ESLint — erros | 89 | **89** |
| ESLint — `no-explicit-any` | 68 | **68** |
| `npm run test` | 7 arquivos / 48 testes | **7 / 48 verdes** |

Como esperado (nenhum `.ts`/`.tsx` tocado), tudo permaneceu idêntico.

## Confirmação: nenhum código alterado

`git diff --stat 68e0785..HEAD` → **50 arquivos, 100% `.md`**. Verificação de
não-`.md` no diff da etapa: **vazio**. Os 23 arquivos do sweep anterior e o `.env`
local seguem intocados (todos os `git add` foram por caminho explícito).

## Observação (follow-up, fora do escopo)

Vários docs de `features/` contêm **links absolutos `file:///…/.gemini/antigravity/
scratch/…`** apontando para arquivos de código no caminho de **outra máquina**
(31 ocorrências em ~10 docs). Eles **já estavam quebrados** antes desta etapa (não
são relativos e não foram afetados pelo movimento), então **não foram alterados** —
a regra da Etapa 1 permite ajustar apenas links relativos quebrados pelo move. Podem
ser convertidos para caminhos relativos do repo numa limpeza de documentação futura.

---

## Critérios de aceite

- [x] Toda a documentação da raiz movida para `docs/` e classificada por tema/módulo.
- [x] `git mv` usado — histórico preservado.
- [x] Links relativos quebrados pelo movimento corrigidos (e só esses).
- [x] README raiz com descrição, "como rodar" (scripts reais) e mapa do repositório.
- [x] README de orientação em cada pasta principal (código + docs).
- [x] Nenhum arquivo de código movido/renomeado/editado (`git diff` = 100% `.md`).
- [x] `npx tsc --noEmit` = 0 e lint sem regressão (89/68).
- [x] `npm run test` verde (7/48).
- [x] Commits pequenos e isolados; `git add` por caminho explícito.
- [x] Raiz limpa (só `README.md`); repositório navegável.
