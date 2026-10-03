# Etapa 5 · Projetos — wiring de `completed_at` (§8-b) + G80

Rodada da Lane A. Coluna `projects.completed_at timestamptz` já existe no banco (aplicada pelo operador; nenhuma DDL nesta rodada) e consta em `types.ts` (regenerado na rodada G81).

## 1. Regra implementada

| Camada | Comportamento |
|---|---|
| Leitura (`mapSupabaseProjectToLocal`) | `completed_at` → `completedAt`; NULL legado → `undefined` |
| Escrita (`mapLocalProjectToSupabase`) | passthrough puro: `completedAt ?? null`. Nunca fabrica data, nunca limpa |
| Produtor sem mapper (`useSupabaseProjects.updateProject`, usado por `ProjectDetailDrawer.handleStatus`) | ao entrar em `delivered`, injeta `completed_at = agora` se a linha ainda não tem valor e o caller não passou um explícito |

Vocabulário: o status terminal é `delivered` (não existe "completed", local nem nuvem).

**Decisão — manter o valor histórico (nunca limpar ao sair de `delivered`).** Espelha o local (`useProjects.ts:117`: seta uma vez, nunca limpa) e o precedente `paid_at` do Financeiro. O campo registra "quando foi entregue pela primeira vez", não "está entregue agora" (diferente de `won_at`/`lost_at` do CRM, que descrevem um desfecho vigente). Uma 2ª entrega não reseta.

Produtores auditados (classe G60/G68): criação nativa, import geral, espelho best-effort e `useLocalProjectsImport` passam todos por `mapLocalProjectToSupabase` e herdam a regra; `updateProject` (drawer) é o único que não passava e foi tratado; `CreateProjectFromQuoteDialog` (CRM) cria sempre `planning`, não é afetado.

## 2. Gaps aceitos

1. **Criação direta como `delivered` → `completed_at` NULL.** O formulário de criação não coleta a data de entrega; o mapper é passthrough e não fabrica. Um projeto criado já entregue fica com NULL até uma transição real.
2. **Legado sem backfill.** Linhas que já estavam `delivered` antes da coluna ficam com NULL. Nenhuma data é inventada pelo código; o backfill é decisão do operador (draft abaixo).

## 3. DRAFT de backfill (operador — NÃO executado)

> Protocolo §8-b: **export manual antes** de qualquer UPDATE. Aproximação: `updated_at` é o melhor proxy disponível da data de entrega, mas pode ser posterior (qualquer edição posterior a move). O operador decide se aceita a aproximação.

```sql
-- 1) ANTES: quantas linhas serão afetadas
SELECT count(*) FROM public.projects
WHERE status = 'delivered' AND completed_at IS NULL;

-- 2) UPDATE (somente após export manual)
UPDATE public.projects
SET completed_at = updated_at
WHERE status = 'delivered' AND completed_at IS NULL;

-- 3) DEPOIS: esperado 0
SELECT count(*) FROM public.projects
WHERE status = 'delivered' AND completed_at IS NULL;
```

## 4. G80

Conector visual do canvas do bot liga `node[index]→node[index+1]` por posição; comentário numerado no código e entrada no catálogo mestre. **Segue ABERTO** (correção = renderizar o grafo real, rodada própria).

## 5. Testes

`projectsMapper.test.ts` (+6: passthrough, NULL legado, roundtrip) e `useSupabaseProjects.test.ts` (+4: injeta ao entrar, não sobrescreve, nunca limpa ao sair, caller explícito). Prova fail→fix→pass por patch: 6 falham / 46 passam com os fontes revertidos; 52/52 com o fix.
