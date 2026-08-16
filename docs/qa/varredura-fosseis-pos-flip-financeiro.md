# Varredura sistêmica pós-flip Financeiro — gates/banners fósseis (inventário)

> **Zero código alterado nesta rodada** — só grep + leitura, inventário puro (lição G33/G55:
> todo cutover de domínio exige uma varredura de gates fósseis em domínios vizinhos, não só o
> domínio que acabou de flipar). Este documento é esse inventário.

**Branch:** `varredura-fosseis-pos-flip-financeiro`, criada a partir do tip real de `origin/main`
em `a7b110d` (confirmado por `git fetch origin` + `git log origin/main -1` — bate com o commit
mais recente do momento, o próprio fix do G55).

**Fora de escopo desta rodada (Lane A em voo, instrução explícita):** `QuotesSection.tsx`,
`QuoteToReceivableDialog.tsx`, `docs/qa/etapa-5-flip-financeiro-runbook.md` — não lidos além do
necessário para confirmar que G33/G55 já estão resolvidos ali (confirmado por leitura read-only,
sem edição).

---

## 1. Método

Dois eixos de busca no repo inteiro (`src/`), sem filtro por domínio a priori:

1. **Gates de escrita legados**: `blockWrite`/`blockWriteAction`, mais um segundo grep por nomes
   alternativos comuns (`isWriteEnabled`, `canWrite`, `writeGuard`, `guardWrite`,
   `isSupabaseWrite`) para não depender só do nome que os domínios já auditados usam.
2. **Flags de dataSource/write por domínio**: todas as `*_DATA_SOURCE_KEY` e os 4 hooks
   `useSupabase*WriteFlag.ts` existentes (`src/config/flags.ts`, `src/hooks/`), pra saber qual
   domínio já flipou (default opt-out) e qual ainda não — um gate só é fóssil se o domínio dele
   **já** flipou; se ainda não flipou, o mesmo texto é comportamento correto, não fóssil.
3. **Banners/toasts de classe G29**: grep por vocabulário de "ainda não existe" / "entra numa
   próxima etapa" / "somente leitura" / "modo leitura" / "volte para Local" nos arquivos de tela
   dos domínios já flipados, cruzado com o estado real do gate que cada texto descreve.

### 1.1 Estado de flip confirmado por domínio (contexto pra classificar os achados)

| Domínio | `dataSource` (leitura) | Write flag (master) | Confirmado por |
|---|---|---|---|
| CRM/Oportunidades | opt-out (supabase default) | opt-out (`useSupabaseCrmWriteFlag`, default `true`) | `flags.ts:189-191`, `useSupabaseCrmWriteFlag.ts:34-38` |
| Quotes/Vendas | opt-out | opt-out (`useSupabaseQuotesWriteFlag`) | `flags.ts:200-202`, `useSupabaseQuotesWriteFlag.ts:28-30` |
| Projects/Projetos | opt-out | opt-out (`useSupabaseProjectsWriteFlag`) | `flags.ts:211-213`, `useSupabaseProjectsWriteFlag.ts:36-38` |
| Finance/Financeiro | opt-out | opt-out (`useSupabaseFinanceWriteFlag`, flipado na Fase C, `fc55c20`) | `flags.ts:222-224`, `useSupabaseFinanceWriteFlag.ts:36-38` |
| TechnicalSheets/Ficha Técnica | opt-out (por cliente) | **sem write flag — nunca teve cutover de escrita** | `flags.ts:247-249`; zero `updateTechnicalSheet`/`createTechnicalSheet`/`technicalSheetsRepository` em `ClientTechnicalSheet.tsx` |
| Tasks/Tarefas | **sem seletor de dataSource ainda** (só `tasksSupabaseStatusTransition`, flag específica) | Fase B em andamento (Lane D) | `flags.ts` — nenhuma `TASKS_DATA_SOURCE_KEY` existe |

**Consequência direta**: qualquer gate/banner em CRM, Quotes, Projects ou Finance que ainda se
comporta como se a escrita estivesse opt-in (bloqueando por padrão) é candidato a fóssil. O mesmo
texto em TechnicalSheets ou Tasks é **esperado e correto** — esses dois domínios genuinamente não
têm caminho de escrita cloud ainda.

---

## 2. Achados — gates de escrita legados

### 2.1 CONFIRMADO — `CRM.tsx:630` (`handleSavePipeline`) — bloqueia sempre em modo Supabase, ignora o master flag

```ts
const handleSavePipeline = (data: ...) => {
  if (blockWriteAction()) return;   // bare — isMovingStage=false, isBasicEdit=false
  ...
};
```

`blockWriteAction` (definição em `CRM.tsx:192-202`):
```ts
const blockWriteAction = (isMovingStage = false, isBasicEdit = false) => {
  if (activeDataSource === "supabase") {
    if (isMovingStage && isStageMoveEnabled) return false;
    if (isBasicEdit && isBasicEditEnabled) return false;
    toast.error("Edição no CRM Supabase entra na próxima etapa. Volte para Local para editar.");
    return true;
  }
  return false;
};
```

Chamada **sem argumentos** (`isMovingStage`/`isBasicEdit` default `false`): em modo Supabase, nenhum
dos dois `if` internos casa — cai sempre no `toast.error(...)` + `return true`, **mesmo com
`supabaseWriteEnabled` (master flag) ligado**, que é o default hoje (§1.1). Salvar/editar um
pipeline do CRM em modo Supabase está bloqueado incondicionalmente, com um texto que promete
("entra na próxima etapa") uma limitação que não existe mais — o mesmo padrão de causa raiz do
G33/G55 (gate cobrindo uma ação que já deveria estar liberada).

### 2.2 CONFIRMADO — `CRM.tsx:640` (`handleConvertToClient`) — mesmo defeito, mesma causa raiz

```ts
const handleConvertToClient = (lead: Lead) => {
  if (blockWriteAction()) return;   // bare, mesmo defeito do §2.1
  ...
};
```

Converter um lead em cliente a partir do CRM em modo Supabase está bloqueado incondicionalmente,
pelo mesmo motivo do §2.1 — 2ª ocorrência da mesma classe no mesmo arquivo.

### 2.3 Evidência corroborante — o próprio banner do CRM contradiz os 2 achados acima

`CRM.tsx:793-799` (banner mostrado quando `supabaseWriteEnabled` está ligado, o default hoje):

> "CRM Supabase operacional" — "Criação, edição, movimentação, ganhar/perder e arquivamento estão
> ativos no Supabase. O modo local segue intacto."

O banner promete que "criação"/"edição" estão ativos — mas `handleConvertToClient` (uma ação de
criação, converter lead em cliente) e `handleSavePipeline` (uma ação de edição) estão bloqueados
de verdade pelos achados §2.1/§2.2. Mesma assinatura do G29 (banner promete mais do que o código
entrega), só que aqui o banner está tecnicamente certo sobre a INTENÇÃO do sistema — é o gate que
está errado, não o banner. Achado registrado aqui porque é a evidência mais direta de que o
usuário REALMENTE bateria nesse bug ao tentar as ações que o próprio banner diz que funcionam.

### 2.4 FALSO POSITIVO (código morto, não é bug ativo) — `CRM.tsx:480` e `CRM.tsx:603`

Ambos chamam `blockWriteAction()` sem argumentos, mas — diferente de §2.1/§2.2 — estão dentro de
um branch que só executa quando `activeDataSource !== "supabase"` (local):

- `:480` (`handleNewLead`) — está no `else` de `if (activeDataSource === "supabase") {...} else { if (blockWriteAction()) return; }`.
- `:603` (dentro de `handleMoveToStage`) — só é alcançado depois que o branch `if (activeDataSource === "supabase") { ...; return; }` já retornou antes.

Em ambos os casos, `blockWriteAction()` só roda quando `activeDataSource !== "supabase"` — e a
própria função começa com `if (activeDataSource === "supabase") {...} return false;`, então nesse
contexto ela **sempre** devolve `false` (nunca bloqueia). Não é um bug ativo — é código morto
confuso (chamar um gate de Supabase de dentro do branch local), candidato a limpeza mecânica
numa rodada futura, não um fóssil que bloqueia algo hoje.

### 2.5 FALSO POSITIVO — `Financeiro.tsx:199-204` (`blockWrite`)

```ts
const blockWrite = (): boolean => {
  if (dataSource !== "supabase") return false;
  if (writeEnabled) return false;
  toast.error("Escrita em modo Supabase ainda não existe pra Financeiro — volte para \"Local\"...");
  return true;
};
```

Corretamente reflete o estado pós-Fase-C: só bloqueia quando `writeEnabled` está **explicitamente**
desligado (estado raro, já que o default é opt-out). Texto do toast é preciso pra esse estado
específico — não é fóssil, é o gate correto e atual.

### 2.6 FALSO POSITIVO (já resolvido, fora de escopo) — `QuotesSection.tsx` G33/G55

Confirmado por leitura (sem edição, arquivo fora de escopo desta rodada): `blockWrite()` foi
**removido inteiro** no fix do G55 (`a7b110d`, o próprio tip desta branch) — `openReceivableDialog`
era seu único chamador, grep confirmou. Nada a reportar aqui; mencionado só para registrar que a
varredura passou por esse arquivo e não achou nada residual além do que G33/G55 já fecharam.

### 2.7 SUSPEITO, fora do escopo nomeado — CRM como um todo pode merecer varredura dedicada

CRM não estava entre os 3 domínios nomeados na tarefa ("Projetos, Tarefas e Financeiro"), mas já
flipou nos dois eixos (§1.1) e tem os 2 fósseis confirmados acima — sinal de que uma varredura
dedicada ao CRM (não feita em profundidade aqui, só os 8 call-sites de `blockWriteAction`
encontrados por grep exaustivo) pode valer a pena numa rodada própria. Os outros 6 call-sites
(`:563`, `:621`, `:1228`, `:1358`) foram lidos e confirmados corretos (parametrizados com
`isMovingStage`/`isBasicEdit` e dentro do branch certo).

### 2.8 Nenhum achado — Projetos, Tarefas, Clientes/Ficha Técnica

- **Projetos** (`ProjectsSection.tsx`): grep por `blockWrite`/banners fósseis não achou nada além
  de comentários já resolvidos (G33, `substitui o antigo blockWrite()`). O único texto
  "Volte para Local" encontrado (`:176`) é conselho de recuperação de erro num `catch` de falha de
  rede — continua válido pós-flip, não é uma promessa de capacidade quebrada.
- **Tarefas** (`Tarefas.tsx`): zero ocorrências de qualquer padrão de gate/banner fóssil — Tasks
  ainda não tem seletor de `dataSource` (§1.1), então não há nada "pós-flip" a verificar ainda.
- **Clientes/Ficha Técnica**: `Clientes.tsx` não referencia nenhum flag/gate de escrita (grep
  vazio) — sem cutover de escrita, nada a checar. `ClientTechnicalSheet.tsx:551` ("é somente
  leitura nesta etapa") é preciso — confirmado zero função de escrita nesse arquivo.

---

## 3. Achados — banners/toasts fósseis (classe G29)

| Local | Texto | Classificação | Motivo |
|---|---|---|---|
| `CRM.tsx:793-799` | "CRM Supabase operacional... Criação, edição... estão ativos" | **Confirmado — contradito pelos §2.1/§2.2** | Ver §2.3 |
| `CRM.tsx:2045` | "Permitida apenas edição básica de campos cadastrais" (quando `isBasicEditEnabled`) | **Suspeito** | Corretamente condicionado ao flag (não bloqueia nada indevido), mas o texto undersells: com o master flag ON, mover de estágio (`isStageMoveEnabled`, mesmo flag) e os 2 usos de `blockWriteAction(false, true)` (`:1228`/`:1358`) também funcionam — a cópia só menciona "edição básica de campos cadastrais", sem mencionar as outras ações já liberadas. Não bloqueia nada, mas pode subestimar o que o operador acha que pode fazer. |
| `Financeiro.tsx:202` | "Escrita em modo Supabase ainda não existe pra Financeiro" (dentro de `blockWrite()`) | **Falso positivo** | Só dispara quando `writeEnabled` está explicitamente OFF — preciso pra esse estado |
| `Financeiro.tsx:313` | "Escrita... ainda não existe nesse modo" (banner, ramo `!writeEnabled`) | **Falso positivo** | Corretamente ramificado — o ramo `writeEnabled=true` (linha 311-312) tem o texto certo pro estado atual (default) |
| `ProjectsSection.tsx:176` | "Tente novamente ou volte para Local" (toast de erro de rede) | **Falso positivo** | Conselho de recuperação de falha, não promessa de capacidade — continua válido |
| `ClientTechnicalSheet.tsx:551` | "A versão Supabase é somente leitura nesta etapa" | **Falso positivo** | Preciso — TechnicalSheets não tem cutover de escrita (§1.1/§2.8) |

---

## 4. Resumo executivo

| Classificação | Quantidade | Onde |
|---|---|---|
| **Fóssil confirmado** | 2 (+ 1 banner corroborante) | `CRM.tsx:630`, `CRM.tsx:640` — bloqueiam ações que o próprio banner do mesmo arquivo (`:793-799`) promete que funcionam |
| **Suspeito** (não bloqueia, mas cópia pode enganar) | 1 | `CRM.tsx:2045` |
| **Falso positivo / já resolvido** | 8 | Financeiro (2), QuotesSection/G33-G55 (já fechado), ProjectsSection (1), ClientTechnicalSheet (1), CRM código morto (2), Tarefas/Clientes (nada encontrado) |

**Nenhum código foi alterado nesta rodada** — inventário puro, conforme instrução. Os 2 fósseis
confirmados (§2.1/§2.2) foram candidatos a fix numa próxima rodada, não implementados nesta.

**Addendum (rodada seguinte):** `CRM.tsx:640` (`handleConvertToClient`) foi corrigido junto com um
achado maior (gravava só local, ver **G58** no catálogo mestre) — o gate fóssil bare-call que este
doc apontou virou **G59**. `CRM.tsx:630` (`handleSavePipeline`, §2.1) foi corrigido numa rodada
própria — **G62** (não G60: número reservado em paralelo pela LANE D pra um achado dela, não
relacionado a este doc; não parametrizado como `isBasicEdit={true}` como este doc havia sugerido; a
investigação da rodada de fix achou que `Pipeline` é 100% local, sem NENHUM caminho Supabase, então
o gate certo era removido por inteiro, não reparametrizado). O banner suspeito de §3 (`CRM.tsx:2045`)
também foi atualizado no mesmo commit do G62. Ver G58/G59/G62 no catálogo mestre para os detalhes
completos de cada fix.

---

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G33 (irmão original), G55 (achado que
  motivou esta varredura sistêmica).
- `src/pages/CRM.tsx` — `blockWriteAction` (`:192-202`), os 2 fósseis confirmados (`:630`, `:640`),
  o banner corroborante (`:793-799`), o texto suspeito (`:2045`).
- `src/config/flags.ts` — chaves de `dataSource` dos 5 domínios com seletor.
- `src/hooks/useSupabaseCrmWriteFlag.ts` / `useSupabaseFinanceWriteFlag.ts` /
  `useSupabaseProjectsWriteFlag.ts` / `useSupabaseQuotesWriteFlag.ts` — os 4 write flags, todos já
  opt-out.
- `docs/qa/protocolo-homologacao.md` §16-19 — gates de worktree, hash de build e merge condicionado
  seguidos nesta rodada.

---

**PARADO aqui — inventário encerrado, zero código alterado. Fix dos 2 achados confirmados (§2.1/
§2.2) só com novo "vai" do revisor, numa rodada própria.**
