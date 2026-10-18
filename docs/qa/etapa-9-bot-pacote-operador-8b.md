# Etapa 9 · Itens 3 e 4 — fluxo scriptado + handover + base de conhecimento — pacote do operador (§8-b)

> **Nada aplicado, nada deployado.** Este doc junta tudo que depende de ação do
> operador contra o banco/infra de produção pra o **fluxo scriptado (nó
> "menu", R1/R3)**, o **handover real (R4, fecha o G48)** e a **base de
> conhecimento do robô (item 3, categoria "itens já orçados")** ficarem VIVOS. O
> código já está em `main` e foi escrito pra degradar sem as colunas/tabela (ver
> §6) — mas **enquanto as 4 migrations abaixo não forem aplicadas, o menu não
> funciona de ponta a ponta, o handover não persiste e a base de conhecimento
> fica desligada (o robô responde como antes)**. Molde de formato:
> [`g71-credenciais-terceiros-pacote-operador.md`](g71-credenciais-terceiros-pacote-operador.md).
>
> **Gate de aplicação — vale pra tudo aqui:**
> 1. Code não roda DDL/DML nem `supabase functions deploy` contra produção
>    (protocolo §0/§6/§8-b) — tudo abaixo é do operador (SQL Editor/CLI).
> 2. **Ordem obrigatória: migrations (§2) ANTES do deploy (§4).** Motivo em §0.
> 3. Cada passo tem sua verificação — **parar no primeiro vermelho** (§5.4/§7).

---

## 0. Resumo e ordem

| # | Passo | Quem | Onde |
|---|---|---|---|
| 1 | Verificação prévia (SELECTs read-only) | operador | §1 |
| 2 | 4 migrations (`bot_flow_state`, `handover_at`, `ai_knowledge_consents`, `assignment_origin`) — **mesma sessão** | operador | §2 |
| 3 | SELECTs de prova depois | operador | §3 |
| 4 | Deploy de 3 functions (`whatsapp-instance`, `whatsapp-bot-reply`, `whatsapp-webhook`) | operador | §4 |
| 5 | Verificação ao vivo + smoke ponta a ponta | operador | §5 |
| 6 | Espelho das 4 migrations em `supabase/migrations/`, regenerar `types.ts`, tipar as leituras | operador (comandos) + **lane** | §8 |

**Por que migrations ANTES do deploy:** o código novo degrada sem as colunas, mas
degrada de forma **diferente** pro menu e pro handover:

- **Sem `handover_at`**: o bot volta ao comportamento de antes da R4 (cortesia
  enviada, estado não persiste, bot continua respondendo) — feio, não quebra.
- **Sem `bot_flow_state` + workspace com nó "menu" HABILITADO + bot ativo**: o
  estado do menu nunca persiste, então **toda mensagem do cliente re-apresenta o
  menu do zero** e a resposta numerada nunca é interpretada — o cliente fica
  preso num loop de menu. É o único cenário realmente ruim; o SELECT de §1.2
  diz se algum workspace já está nele. Aplicando as migrations primeiro, esse
  cenário não existe.

Migrations são **aditivas e inertes** pro código antigo (colunas nullable sem
default / tabela nova que nenhum caminho antigo lê ou escreve) — aplicar antes do
deploy é seguro mesmo que o deploy atrase.

**A 3ª migration (`ai_knowledge_consents`) não tem armadilha de ordem:** sem a
tabela, o servidor trata "nenhuma categoria ativa" e o robô é **idêntico ao de
hoje** (nenhum loop, nenhuma mensagem diferente). Ela entra na mesma sessão só pra
a UI de Configurações ("Base de conhecimento do Robô") ficar operável e pra a
sessão §8-b ser uma só. Ordem continua: **migrations → prova → deploy → smoke**.

**A 4ª migration (`assignment_origin`) também não tem armadilha de ordem:** sem a
coluna, o servidor trata toda atribuição como "origem desconhecida" = humana — o gate
`respond_all = false + assigned_to` e a devolução ao robô se comportam **exatamente
como antes** (testado: tabela-verdade completa). Ela prepara a **atribuição
automática ao último atendente** (G48, [proposta](../architecture/etapa-9-handover-assigned-to-proposta.md)),
que **ainda não existe**: hoje nada grava `'auto'`; só `assign_conversation` grava
`'manual'`. Aplicá-la agora é seguro e deixa a próxima rodada sem uma sessão §8-b a mais.

---

## 1. Verificação prévia (read-only)

### 1.1 As 2 colunas ainda não existem (esperado: **0 linhas**)

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'whatsapp_conversations'
  AND column_name IN ('bot_flow_state', 'handover_at');
-- Esperado: 0 linhas. Se vier 1 ou 2, alguém já aplicou (ou aplicou parcial) —
-- as migrations de §2 são idempotentes (IF NOT EXISTS), pode seguir, mas
-- registre qual coluna já existia.
```

### 1.2 Algum workspace já usa nó "menu" habilitado? (decide a urgência da ordem)

```sql
SELECT bs.workspace_id, bs.is_active
FROM public.whatsapp_bot_settings AS bs
WHERE jsonb_typeof(bs.flow_data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(bs.flow_data) AS node
    WHERE node ->> 'type' = 'menu'
      AND node ->> 'enabled' = 'true'
  );
-- Esperado: provavelmente 0 linhas (a UI do nó menu é recente — R5). Se vier > 0 com
-- is_active = true, esse workspace está EXPOSTO ao loop de menu descrito em §0
-- até as migrations serem aplicadas — não fazer o deploy (§4) antes de §2/§3.
```

### 1.3 `whatsapp_conversations` está na publicação de realtime (esperado: **1 linha**)

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'whatsapp_conversations';
-- Esperado: 1 linha (migration 20260602020951_d0f0c59d-...sql já faz isso). A UI
-- de Atendimento depende disto: é o realtime que tira o banner "Entregue a
-- atendimento humano" da tela depois de "Devolver ao robô". Se vier 0, o banner
-- só some com reload — não bloqueia, mas registre.
```

### 1.4 A tabela de consentimento ainda não existe (esperado: **0 linhas**)

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ai_knowledge_consents';
```

### 1.5 A coluna `assignment_origin` ainda não existe (esperado: **0 linhas**)

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'whatsapp_conversations'
  AND column_name = 'assignment_origin';
-- Esperado: 0 linhas.
```

---

## 2. As 4 migrations (verbatim dos docs de origem; idempotentes)

Rodar **nesta ordem**, no SQL Editor do dashboard (ou via CLI). Podem ir numa
única execução. As colunas usam `ADD COLUMN IF NOT EXISTS` e a tabela usa
`CREATE TABLE IF NOT EXISTS`: reaplicar é no-op (o Postgres só emite um
`NOTICE ... already exists, skipping`). Coluna nullable sem default — não reescreve
a tabela, lock instantâneo. **Atenção à 3ª:** `CREATE POLICY` e `CREATE TRIGGER` **não**
são idempotentes — numa reaplicação a tabela é pulada mas as policies/trigger dão
erro "already exists"; isso é esperado e inofensivo (as 3 policies e o trigger já
estão lá, ver §3.4) — **não** improvisar `DROP POLICY`. A 4ª (`ADD COLUMN IF NOT EXISTS` com o CHECK inline) é idempotente por inteiro.

### 2.1 `whatsapp_conversations.bot_flow_state` (origem: [R1 §2](etapa-9-bot-fluxo-scriptado-r1-fundacao.md))

```sql
-- Etapa 9 · Item 4 (construtor de fluxo scriptado) — R1, fundação de dados
-- (docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md §2). Guarda o estado
-- de navegação de UMA conversa dentro da árvore scriptada: em qual nó ela
-- está agora e quantas tentativas inválidas seguidas já acumulou (pro
-- fallback de re-prompt/limite de tentativas do nó "menu", decisão do
-- operador registrada em §0 do doc). NULL é o estado normal pra qualquer
-- conversa que nunca entrou num fluxo scriptado (a esmagadora maioria
-- hoje, já que o nó "menu" ainda nem existe em produção) — esta coluna
-- não é NOT NULL, não força preenchimento em nenhum caminho existente.
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b) — aplicação é gate do operador (sessão §8-b), e
-- só faz sentido no momento em que a fatia de EXECUÇÃO do fluxo (motor que
-- lê/escreve esta coluna) estiver pronta pra consumi-la — aplicar antes
-- disso não quebra nada (coluna nullable, ninguém lê/escreve ainda), mas
-- também não serve pra nada até lá. Decisão de QUANDO aplicar fica com o
-- operador, não uma pré-condição técnica desta migration.
--
-- Shape esperado do jsonb (não um schema JSON validado por CHECK nesta
-- rodada — mesma disciplina do restante da casa, que só trava vocabulário
-- fechado por CHECK depois de o produtor real existir e ser homologado,
-- ver etapa-5-flip-clientes-rodada3-check-drafts.md/etapa-5-flip-crm-
-- rodada3-check-drafts.md):
--   { "currentNodeId": "node-menu-1", "attempts": 0 }
-- `currentNodeId` (string) — id do nó onde a conversa está parada,
-- aguardando resposta. `attempts` (integer >= 0) — tentativas inválidas
-- seguidas desde a última resposta válida; zera a cada navegação bem-
-- sucedida pra outro nó.
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS bot_flow_state jsonb;
```

> Nota de contexto (não muda o SQL): o comentário acima, copiado verbatim, diz
> "o motor ainda não está pronto" — **já está** (R3, em `main`). O motor lê/escreve
> esta coluna; é exatamente por isso que §2 vem antes do deploy de §4.

### 2.2 `whatsapp_conversations.handover_at` (origem: [R4 §2](etapa-9-bot-fluxo-scriptado-r4-handover-real.md))

```sql
-- Etapa 9 · Item 4 (construtor de fluxo scriptado) — R4, handover REAL
-- (docs/qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md §2; fecha o G48).
-- Marca a conversa como ENTREGUE A HUMANO: preenchida = o robô fica em
-- silêncio nela (whatsapp-bot-reply responde `skipped`) até alguém devolver
-- (ação `end_human_handover` em whatsapp-instance zera de volta pra NULL).
-- NULL é o estado normal pra qualquer conversa que nunca foi entregue (a
-- esmagadora maioria) — coluna NÃO é NOT NULL e não força preenchimento em
-- nenhum caminho existente. timestamptz (em vez de boolean) porque o
-- "quando" é informação útil pro atendente (há quanto tempo o cliente
-- espera) sem custo extra; "entregue?" = `handover_at IS NOT NULL`.
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b). Aplicar antes
-- de ligar o handover não quebra nada (coluna nullable, nenhum caminho
-- existente lê/escreve ela fora do código da R4, que degrada sem a coluna).
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS handover_at timestamptz;
```

### 2.3 `public.ai_knowledge_consents` (origem: [item 3 — fundação §4](etapa-9-item3-r1-base-conhecimento-fundacao.md))

Tabela de **consentimento por categoria** da base de conhecimento do robô.
Default **tudo desligado**; leitura por membro, **escrita só por admin** (precedente
G71, `is_workspace_admin`); sem policy de DELETE de propósito (revogar = UPDATE com
`revoked_at`, nunca apagar). SQL **verbatim** do doc da fundação (extraído por script,
não retranscrito):

```sql
-- Etapa 9 · Item 3 (base de conhecimento) — consentimento por categoria
-- (docs/architecture/etapa-9-item3-base-conhecimento-fase-a.md §2.3;
-- docs/qa/etapa-9-item3-r1-base-conhecimento-fundacao.md §4).
-- Uma linha por (workspace, categoria). Default OFF. A linha é o GATE REAL no
-- servidor (a flag de UI não conta). Nunca hard-delete: revogar = enabled=false
-- + revoked_at (auditoria de quando parou).
CREATE TABLE IF NOT EXISTS public.ai_knowledge_consents (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category         text        NOT NULL
                   CHECK (category IN ('catalog', 'internal_ops', 'crm', 'conversations', 'financial')),
  enabled          boolean     NOT NULL DEFAULT false,
  -- Atesto do OPERADOR de que tem base legal própria perante o cliente dele
  -- (Fase A §1.1: o "sim" é uma declaração, não consentimento coletado pela Kora).
  legal_basis_ack  boolean     NOT NULL DEFAULT false,
  legal_basis_note text,
  enabled_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at       timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_consents_workspace_category_key UNIQUE (workspace_id, category),
  -- 3ª camada do gate (1ª: UI, 2ª: servidor — knowledgeConsent.ts): C/D/E não
  -- ficam ligadas sem o atesto, nem por UPDATE direto.
  CONSTRAINT ai_knowledge_consents_ack_required_chk
    CHECK (NOT (enabled AND category IN ('crm', 'conversations', 'financial') AND NOT legal_basis_ack))
);

COMMENT ON TABLE public.ai_knowledge_consents IS
  'Etapa 9 · item 3 — opt-in por categoria pra o robô usar dado do workspace como contexto. Default OFF; C/D/E exigem atesto de base legal. Gate real no servidor (supabase/functions/_shared/knowledgeConsent.ts).';

ALTER TABLE public.ai_knowledge_consents ENABLE ROW LEVEL SECURITY;

-- Leitura: membros. Escrita: ADMIN (atesto jurídico) — precedente G71
-- (is_workspace_admin, role IN ('owner','admin')). Sem policy de DELETE de
-- propósito: nunca hard-delete (revogar = UPDATE). Service role (servidor)
-- ignora RLS.
CREATE POLICY "Workspace members can view knowledge consents"
  ON public.ai_knowledge_consents FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace admins can insert knowledge consents"
  ON public.ai_knowledge_consents FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can update knowledge consents"
  ON public.ai_knowledge_consents FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE TRIGGER update_ai_knowledge_consents_updated_at
BEFORE UPDATE ON public.ai_knowledge_consents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

### 2.4 `whatsapp_conversations.assignment_origin` (origem: [proposta de `assigned_to` §3.2/§8](../architecture/etapa-9-handover-assigned-to-proposta.md))

Registra **quem atribuiu** a conversa, pra a devolução ao robô desfazer só o que o
próprio handover fez. SQL **deste pacote** (única fonte — a proposta aponta pra cá):

```sql
-- Etapa 9 · Item 4 (G48) — ORIGEM da atribuição da conversa
-- (docs/architecture/etapa-9-handover-assigned-to-proposta.md §3.2/§8; decisão do
-- revisor: a devolução ao robô desatribui SOMENTE atribuição automática).
--   'manual' = atribuída por uma pessoa (assign_conversation grava);
--   'auto'   = atribuída pelo handover ao último atendente que respondeu
--              (whatsapp-bot-reply grava; só age com esta coluna aplicada);
--   NULL     = sem atribuição, ou atribuição anterior a esta coluna (origem
--              desconhecida: tratada como humana, nunca desfeita pela devolução).
-- Coluna nullable, sem default, sem backfill. O CHECK vai inline no
-- ADD COLUMN IF NOT EXISTS: reaplicar é no-op inteiro (coluna E constraint).
-- NULL passa no CHECK.
--
-- PROPOSTA — NÃO aplicada pelo Code (protocolo §0/§6/§8-b).
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS assignment_origin text
    CONSTRAINT whatsapp_conversations_assignment_origin_chk
    CHECK (assignment_origin IN ('auto', 'manual'));
```

---

## 3. SELECTs de prova (depois de §2)

### 3.1 As 2 colunas existem, com o tipo certo (esperado: **2 linhas**)

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'whatsapp_conversations'
  AND column_name IN ('bot_flow_state', 'handover_at')
ORDER BY column_name;
-- Esperado:
--   bot_flow_state | jsonb                    | YES | (null)
--   handover_at    | timestamp with time zone | YES | (null)
```

### 3.2 Nenhuma conversa existente foi tocada (esperado: contagens **0**)

```sql
SELECT count(*)              AS total_conversas,
       count(bot_flow_state) AS com_bot_flow_state,
       count(handover_at)    AS com_handover_at
FROM public.whatsapp_conversations;
-- Esperado logo após §2 (ANTES do deploy): com_bot_flow_state = 0 e
-- com_handover_at = 0. Depois do deploy + smoke de §5 esses números podem
-- subir (o bot passa a gravar) — isso é o comportamento esperado, não regressão.
```

### 3.3 Idempotência (opcional, 10 segundos)

Reexecutar §2.1 e §2.2. Esperado: **sem erro**, só 2 `NOTICE ... already exists,
skipping`. Se der erro, **parar** — não improvisar `DROP`/`ALTER`.

### 3.4 A tabela de consentimento existe, com RLS e vazia (esperado: 1 tabela, 3 policies, 0 linhas)

```sql
SELECT count(*) AS linhas FROM public.ai_knowledge_consents;                       -- 0
SELECT polname, polcmd FROM pg_policy
WHERE polrelid = 'public.ai_knowledge_consents'::regclass ORDER BY polname;         -- 3
```

```sql
-- RLS ligada + constraints (CHECK de categoria, CHECK do atesto C/D/E, UNIQUE)
SELECT relrowsecurity AS rls_ligada
FROM pg_class WHERE oid = 'public.ai_knowledge_consents'::regclass;          -- true

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.ai_knowledge_consents'::regclass AND contype IN ('c', 'u')
ORDER BY conname;
-- Esperado: ai_knowledge_consents_ack_required_chk, ai_knowledge_consents_workspace_category_key
-- (+ o CHECK de categoria, nome gerado pelo Postgres)
```

### 3.5 A coluna `assignment_origin` existe, com o CHECK, e nenhuma linha foi tocada

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'whatsapp_conversations'
  AND column_name = 'assignment_origin';
-- Esperado: assignment_origin | text | YES | (null)

SELECT conname FROM pg_constraint
WHERE conrelid = 'public.whatsapp_conversations'::regclass
  AND conname = 'whatsapp_conversations_assignment_origin_chk';
-- Esperado: 1 linha

SELECT assignment_origin, count(*) AS conversas
FROM public.whatsapp_conversations
GROUP BY assignment_origin;
-- Esperado logo após §2 (ANTES do deploy): uma única linha, assignment_origin = NULL.
-- Depois do deploy, atribuir pela tela cria linhas 'manual' — esperado.
```

**Regra de parada:** §3.1 com ≠ 2 linhas, §3.2 com contagem > 0 antes do deploy, §3.4
com ≠ 3 policies / linhas > 0, ou §3.5 com coluna/constraint ausente ou qualquer
valor ≠ NULL antes do deploy → parar e reportar; não seguir pra §4.

---

## 4. Deploy das functions

### 4.1 Pré-prova de hash (mesma disciplina do `etapa-6-g5-rate-limit.md` §8.a)

O CLI empacota o diretório de trabalho **como está no disco**, não um ref
remoto. Antes de cada deploy:

```bash
git fetch origin
git log origin/main -1 --oneline        # anotar o hash — tem que conter este pacote
git log --oneline -1                    # NA PASTA de onde o deploy roda: mesmo hash acima
git status --short                      # tem que estar limpo (nada não-commitado entrando no deploy)
```

### 4.2 Comandos (use `npx.cmd` se o PowerShell bloquear `.ps1`)

```bash
npx supabase functions deploy whatsapp-instance  --project-ref ewamvzncsloagtcvkbxv
npx supabase functions deploy whatsapp-bot-reply --project-ref ewamvzncsloagtcvkbxv
npx supabase functions deploy whatsapp-webhook   --project-ref ewamvzncsloagtcvkbxv
```

(`project-ref` conferido contra `supabase/config.toml` — `project_id = "ewamvzncsloagtcvkbxv"`.)

**Commits desta parte do pacote (hashes em `main`):** `sender_id` nos 4 inserts de saída + origem da atribuição `c393d02`; atribuição automática no handover + devolução com `unassigned`/`botStillMuted` + badge "Aguardando humano" `b40bb5a`. Pendências abertas no catálogo: **G101** (controle de atribuição no painel) e **G102** (assumir ao responder).

| Function | O que muda | Arquivos que DEVEM aparecer no output do deploy (no mínimo) |
|---|---|---|
| `whatsapp-instance` | ação `end_human_handover` (devolver ao robô; **desatribui só atribuição automática** e responde `unassigned` + `botStillMuted`); `assign_conversation` registra a origem `'manual'`; **as 4 mensagens de saída humanas passam a gravar `sender_id`** (autor — `send`, `send_media`, 2× `forward_message`; sem migration) | `index.ts`, `_shared/botHandover.ts`, **`_shared/botAssignment.ts`** |
| `whatsapp-bot-reply` | motor do nó menu (R3), handover real (R4), simulador do fluxo (opt-in, ver [`etapa-9-bot-simulador-fluxo-cobertura.md`](etapa-9-bot-simulador-fluxo-cobertura.md)), **base de conhecimento (item 3, [`etapa-9-item3-r1-base-conhecimento-liga.md`](etapa-9-item3-r1-base-conhecimento-liga.md))** | `index.ts`, `_shared/botFlowMenu.ts`, `_shared/botHandover.ts`, `_shared/botFlowSimulation.ts`, **`_shared/knowledgeLoader.ts`, `_shared/knowledgeSources.ts`, `_shared/knowledgeConsent.ts`** (+ `_shared/brainComposer.ts`, já existente), **`_shared/botAssignment.ts`** (gate `respond_all=false + assigned_to` ajustado; **atribuição automática ao último atendente humano no handover** — só age com a 4ª migration aplicada) |
| `whatsapp-webhook` | **NÃO invoca** `whatsapp-bot-reply` em conversa já entregue a humano (poupa rate-limit) | `index.ts`, `_shared/botTrigger.ts`, `_shared/botHandover.ts` |

"No mínimo" porque o bundler pode listar também módulos `_shared/` importados só
por tipo (ex.: `botFlowMenu.ts` via `import type` em `botHandover.ts`) — arquivo
a MAIS não é problema. Se um arquivo da tabela **não** aparecer no output, o
deploy não subiu o código certo — **parar** (§7), não seguir pra §5.

> **`whatsapp-webhook` — antes CONDICIONAL, agora INCLUÍDO.** A versão anterior
> deste pacote marcava o webhook como "só se a rodada da Lane B mergear antes".
> **Mergeou**: commit `6ec103d` ("webhook não invoca whatsapp-bot-reply em
> conversa entregue a humano") já está em `main`. Ele é uma otimização
> (dívida registrada na R4 §3 — a invocação em conversa entregue contava no
> rate-limit por-workspace) e **degrada igual ao resto**: sem `handover_at`,
> `existingConv.handover_at` é `undefined` → invoca como antes. Pode ser
> deployado junto, sem ordem especial entre as 3 functions.
>
> Se, entre a escrita deste doc e o deploy, aparecerem **commits novos** em
> `supabase/functions/whatsapp-webhook`, `whatsapp-bot-reply` ou `whatsapp-instance`
> que não estejam listados aqui, rodar `git log --oneline origin/main --
> supabase/functions/<function>` e conferir antes de deployar — o deploy sobe o
> que estiver no disco.

O app web (SPA, `src/pages/WhatsApp.tsx`: banner "Entregue a atendimento humano"
+ botão "Devolver ao robô" + badge "Humano") **não** passa por
`supabase functions deploy` — é o deploy normal do host do app. A UI só mostra
algo quando `handover_at` existe e está preenchido, então a ordem entre o deploy
do app e o das functions é indiferente.

---

## 5. Verificação ao vivo (nesta ordem)

Usar um **workspace/número de TESTE** (nunca um cliente real).

### 5.1 Não-regressão do simulador atual

Aba **Robô IA** → Simulador → mandar uma mensagem. **Esperado:** responde via
IA normalmente (a UI atual não manda o campo novo `simState`, então o caminho é
byte a byte o de antes). Se mudou, **parar**.

### 5.2 Smoke ponta a ponta (workspace de teste)

Fluxo de teste no construtor: nó **Menu** (opções: `1 — Financeiro`, `2 — Falar com
atendente` apontando pro nó **Transbordo Humano** habilitado; fallback `reprompt`,
`maxTentativas = 2`) + nó **IA** + nó **Transbordo Humano** habilitado; bot ativo.
Do celular de teste:

| # | Mensagem do cliente | Esperado no WhatsApp | Estado no banco (query abaixo) |
|---|---|---|---|
| 1 | `oi` | recebe o menu (mensagem + opções numeradas) | `bot_flow_state = {"currentNodeId":"<id do menu>","attempts":0}`, `handover_at` NULL |
| 2 | `abc` | "Resposta inválida. Responda com uma opção válida." + menu de novo | `attempts = 1` |
| 3 | `xyz` | texto de cortesia ("Encaminhando o seu contato para o atendimento humano…") — atingiu `maxTentativas = 2` com `reprompt` ⇒ **entrega a humano** (decisão do operador) | `handover_at` **preenchido**, `bot_flow_state` NULL |
| 4 | `alô?` | **nenhuma resposta do robô** | inalterado (`handover_at` segue preenchido) |
| 5 | (na UI de Atendimento) | conversa mostra o banner "Entregue a atendimento humano desde …" e o badge "Humano" na lista; clicar **Devolver ao robô** → toast "Conversa devolvida ao robô" e o banner some | `handover_at` NULL, `bot_flow_state` NULL |
| 6 | `oi` | recebe o menu de novo, do zero | `bot_flow_state` volta a `{"currentNodeId":…,"attempts":0}` |
| 7 | (repetir 1→6 escolhendo `2` no passo 3) | `2` ⇒ cortesia imediata (gatilho "opção do menu leva ao nó handover") | `handover_at` preenchido |

**Smoke do bloco de conhecimento (categoria A "itens já orçados" LIGADA)** — depois dos
passos 1→7 acima, ainda no workspace de teste:

| # | Ação | Esperado |
|---|---|---|
| 8 | Pré-requisito: o workspace de teste precisa de **≥ 2 orçamentos enviados/aprovados/recusados** (não rascunho, não arquivado) que tenham **o mesmo item** (ex.: "Landing Page") — o robô só usa itens que aparecem em **2+ orçamentos** e que **não citam cliente cadastrado** | — |
| 9 | Configurações → "Cérebro do Robô" → "Base de conhecimento do Robô" → ligar o interruptor "Mostrar a base de conhecimento" → ligar **"Itens já orçados"** (como dono/admin) | toast "Base de conhecimento ligada"; `SELECT category, enabled, revoked_at FROM public.ai_knowledge_consents WHERE workspace_id = '<WS>';` → 1 linha `catalog | true | NULL` |
| 10 | Aba Robô IA → Simulador → mandar uma mensagem que caia na **IA** (fora do menu) | resposta da IA com o selo **"Base de conhecimento · N itens já orçados no contexto"** |
| 11 | Log do `whatsapp-bot-reply` (§5.3) | `[bot-reply] knowledge block entered: categories=catalog included=N omitted=M` |
| 12 | Desligar "Itens já orçados" | toast "Base de conhecimento desligada"; a linha passa a `enabled=false` + `revoked_at` preenchido; a próxima resposta de IA **sem** selo e **sem** a linha de log |

**Conferir também** (privacidade): nenhum nome de cliente, e-mail ou telefone no
selo/log; itens que aparecem em **um** orçamento só **não** entram (`included` < nº de
itens distintos, se houver). B/C/D/E aparecem **desabilitadas** na tela — não tentar ligar.

**Smoke de autoria e origem da atribuição (4ª migration aplicada):**

| # | Ação | Esperado |
|---|---|---|
| 13 | Na tela de Atendimento (conversa de teste) enviar **uma mensagem de texto**, **uma mídia** e **encaminhar uma mensagem** | `SELECT direction, type, sender_id, created_at FROM public.whatsapp_messages WHERE conversation_id = '<CONV>' ORDER BY created_at DESC LIMIT 5;` → as **3 linhas novas** (`outbound`) com `sender_id` = o **seu** user id. Mensagens do **robô** e as **digitadas no celular** seguem com `sender_id` NULL (esperado — nunca houve autor); mensagens **antigas** também (sem backfill) |
| 14 | ⚠ **Não há controle de atribuição na tela** (o painel de contato não o renderiza — proposta §10.6). Para exercitar `assign_conversation`, chamar a função com o JWT de um usuário do workspace: `curl -X POST "https://ewamvzncsloagtcvkbxv.supabase.co/functions/v1/whatsapp-instance" -H "Authorization: Bearer <JWT_USUARIO>" -H "apikey: <ANON_KEY>" -H "Content-Type: application/json" -d '{"action":"assign_conversation","workspaceId":"<WS>","conversationId":"<CONV>","userId":"<USER>"}'`; depois repetir com `"userId":null` | `SELECT assigned_to, assignment_origin FROM public.whatsapp_conversations WHERE id = '<CONV>';` → `<user> | manual`; depois `NULL | NULL` |
| 15 | Conversa **entregue** (`handover_at` preenchido) **e atribuída manualmente** (passo 14, ou `UPDATE … SET assigned_to = '<USER>', assignment_origin = 'manual'`) → **Devolver ao robô** | resposta `{ ok: true, cleared: {...}, unassigned: false, botStillMuted: <ver 20> }`; a atribuição **continua** (`assigned_to` e `manual` intactos) — decisão humana não é desfeita |
| 16 | *(opcional, sem depender do robô)* em conversa **de teste** entregue, simular a atribuição automática: `UPDATE public.whatsapp_conversations SET assigned_to = '<USER>', assignment_origin = 'auto' WHERE id = '<CONV_TESTE>';` → **Devolver ao robô** | `unassigned: true`; `assigned_to` e `assignment_origin` voltam a NULL |

**Smoke da atribuição automática** (4ª migration aplicada **e** `whatsapp-bot-reply` + `whatsapp-instance` deployados; workspace de teste com o gatilho em **"Qualquer Conversa (Irrestrito)"**):

| # | Ação | Esperado |
|---|---|---|
| 17 | Na conversa de teste, **responder pela tela** (grava `sender_id`); depois, como cliente, mandar uma palavra-chave de handover ("atendente") | cortesia do robô; `SELECT assigned_to, assignment_origin, handover_at FROM public.whatsapp_conversations WHERE id = '<CONV>';` → `<seu user> | auto | <timestamp>`; na lista, badge **"Humano"** (atribuída); log `[bot-reply] auto-assignment for conversation <id>: assigned` |
| 18 | **Conversa nova** (nenhuma resposta humana) → cliente manda "atendente" | handover normal; `assigned_to` e `assignment_origin` **NULL**; na lista, badge **"Aguardando humano"** (âmbar sólido); log `auto-assignment … : no-responder` |
| 19 | Na conversa do passo 17, **Devolver ao robô** | toast **"Robô de volta e conversa sem atribuição…"**; `assigned_to` e `assignment_origin` NULL; `handover_at` NULL; resposta `unassigned: true, botStillMuted: false` |
| 20 | Conversa **entregue e atribuída manualmente** (passo 15) com o gatilho do fluxo em **"Apenas Conversas Novas (Triagem)"** → **Devolver ao robô**; depois o cliente manda outra mensagem | toast de **aviso** "Devolvida, mas o robô continua em silêncio…" (resposta `botStillMuted: true`); a mensagem do cliente → log `skipped: assigned and respond_all is false`. **Voltar o gatilho para "Qualquer Conversa (Irrestrito)"** ao terminar |
| 21 | *(só se a 4ª migration AINDA não foi aplicada)* repetir o passo 17 | handover normal, **nada atribuído** (`assigned_to` NULL), badge **"Aguardando humano"**; log `auto-assignment skipped at write … assignment_origin` — é o comportamento esperado da degradação, **não** um erro |

Query de observação (trocar os dois valores):

```sql
SELECT id, contact_phone, bot_flow_state, handover_at, updated_at
FROM public.whatsapp_conversations
WHERE workspace_id = '<WORKSPACE_DE_TESTE>'
  AND contact_phone = '<TELEFONE_DE_TESTE>';
```

### 5.3 Logs (Dashboard → Edge Functions → `whatsapp-bot-reply` → Logs)

- **Esperado** nos passos 3/7: `[bot-reply] human handover for conversation <id> (reason: menu_exhausted)` (passo 3) e `(reason: menu_option)` (passo 7).
- **Esperado** no passo 4: com o webhook deployado, **nenhuma** invocação do `whatsapp-bot-reply` nessa mensagem; sem o webhook novo, uma linha `skipped … handed over to human`.
- **PROIBIDO** depois das migrations: `failed to persist handover state` ou `failed to persist bot_flow_state`. Se aparecer, a coluna correspondente não existe de fato — voltar a §3.
- **PROIBIDO** depois da 4ª migration: `failed to record assignment_origin` (em `assign_conversation`) ou `failed to clear automatic assignment` (na devolução) — a coluna/constraint não está funcionando; voltar a §3.5. (Antes da migration o primeiro **é esperado** e inofensivo — é a degradação.) Idem `auto-assignment skipped at write` no `whatsapp-bot-reply`: **esperado** antes da 4ª migration; **PROIBIDO** depois dela (a coluna existe e o UPDATE ainda falha — voltar a §3.5). `auto-assignment … : assigned` / `no-responder` / `already-assigned` são desfechos normais.
- **PROIBIDO** depois da 3ª migration: `knowledge consents unavailable`. Se aparecer, a tabela `ai_knowledge_consents` não está acessível ao servidor — voltar a §3.4. (Antes da migration essa linha **é esperada** e inofensiva — é a degradação.)

### 5.4 Regra de parada

**Parar em qualquer vermelho** de §5.1–§5.3 — não corrigir ao vivo. Ir pra §7.

---

## 6. Degradação (por que dá pra aplicar/deployar em qualquer ordem sem derrubar o bot)

| Situação | Efeito |
|---|---|
| Código novo, **sem** `handover_at` | bot volta ao comportamento pré-R4 (cortesia sem persistir); webhook invoca como antes; UI não mostra banner; ação "Devolver ao robô" responde **409** e a UI mostra "Migration pendente" |
| Código novo, **sem** `bot_flow_state` | fluxo **sem** nó menu: zero efeito. Fluxo **com** nó menu habilitado: loop de menu (§0) — **o único cenário ruim** |
| Código novo, **sem** a tabela `ai_knowledge_consents` | nenhuma categoria ativa: `warn` no log + **robô idêntico ao de hoje**; a tela mostra "ainda não está disponível neste ambiente" e os toggles ficam desabilitados |
| Código novo, **sem** a coluna `assignment_origin` | origem sempre "desconhecida" = humana: `assign_conversation` faz só a atribuição (warn no log da origem); a devolução **não** desatribui nada; **o handover só entrega — NÃO atribui** (o UPDATE único `assigned_to`+`assignment_origin` é recusado inteiro; warn `auto-assignment skipped at write`; nunca existe atribuição sem origem); o gate `respond_all=false + assigned_to` é **idêntico ao de antes** (tabela-verdade testada). A lista mostra "Aguardando humano" nas conversas entregues |
| Colunas/tabela aplicadas, código antigo | inerte (nenhum caminho antigo as lê) |
| Colunas aplicadas + código novo | comportamento completo |

---

## 7. Rollback

- **Código:** re-deployar a versão anterior de cada function. **Anotar ANTES de
  deployar** o hash hoje no ar (do registro da última janela de deploy) e
  preencher aqui:

  ```bash
  git checkout <HASH_ANTERIOR_DEPLOYADO> -- supabase/functions/whatsapp-bot-reply supabase/functions/whatsapp-instance supabase/functions/whatsapp-webhook supabase/functions/_shared
  npx supabase functions deploy whatsapp-bot-reply --project-ref ewamvzncsloagtcvkbxv
  npx supabase functions deploy whatsapp-instance  --project-ref ewamvzncsloagtcvkbxv
  npx supabase functions deploy whatsapp-webhook   --project-ref ewamvzncsloagtcvkbxv
  git checkout main -- supabase/functions
  ```

  O código antigo ignora as colunas novas — **as migrations podem ficar**.
- **DDL (só se for realmente necessário):** `ALTER TABLE public.whatsapp_conversations DROP COLUMN IF EXISTS bot_flow_state;` / `... DROP COLUMN IF EXISTS handover_at;`.
  **Destrói o estado** (conversas entregues deixam de estar marcadas; o bot volta a
  responder nelas). O app degrada sem as colunas (§6), então o DROP não derruba nada —
  mas não é reversível sem backup do que estava gravado.
- **DDL de `assignment_origin` (só se necessário):** `ALTER TABLE public.whatsapp_conversations DROP COLUMN IF EXISTS assignment_origin;` (o `DROP` leva o CHECK junto). Perde a distinção manual/automática; **conversas já auto-atribuídas ficam atribuídas** (e passam a valer como atribuição humana — a devolução não as desfaz mais, e com `respond_all=false` voltam a calar o robô): antes do `DROP`, `UPDATE public.whatsapp_conversations SET assigned_to = NULL WHERE assignment_origin = 'auto';`. Depois disso o app degrada para "origem desconhecida" e o handover volta a só entregar (§6).
- **DDL da base de conhecimento (só se necessário):** `DROP TABLE IF EXISTS public.ai_knowledge_consents;`.
  **Apaga os registros de consentimento/revogação** (trilha de auditoria LGPD: quem ligou
  e quando) — exportar antes. O robô degrada para "nenhuma categoria ativa" (idêntico a hoje).
  Preferível a apagar: **desligar** a categoria pela tela (grava `revoked_at`).

---

## 8. Depois da aplicação

### 8.1 Espelho das migrations em `supabase/migrations/` (lane escreve, operador registra)

As 4 migrations hoje vivem **só nos docs** (R1 §2 / R4 §2 / item 3 fundação §4 / este pacote §2.4) — não
existem em `supabase/migrations/`. Depois de aplicadas, o repo precisa refletir o banco
(mesmo padrão de [`migrations-espelho-8b.md`](migrations-espelho-8b.md)): uma
lane promove os 4 SQLs a arquivos com a **série real de aplicação** (a data da
sessão §8-b — o operador informa), e o operador registra no histórico do CLI
**sem rodar o SQL de novo**:

```bash
supabase migration repair --status applied <VERSÃO_bot_flow_state>
supabase migration repair --status applied <VERSÃO_handover_at>
supabase migration repair --status applied <VERSÃO_ai_knowledge_consents>
supabase migration repair --status applied <VERSÃO_assignment_origin>
```

### 8.2 Regenerar `types.ts` (operador, introspecção read-only — G10)

```bash
supabase gen types typescript --project-id ewamvzncsloagtcvkbxv > src/integrations/supabase/types.ts
```

Só lê o catálogo (não executa DDL/DML). Commitar o arquivo regenerado numa branch
de lane. Efeito colateral esperado: o `Row` de `whatsapp_conversations` passa a
ter `bot_flow_state` e `handover_at`, **`assignment_origin`**, **e a tabela `ai_knowledge_consents` passa a existir
em `Database["public"]["Tables"]`**.

### 8.3 Trocar a leitura por `unknown` de `handover_at` por acesso tipado (rodada de **lane**, não do operador)

Hoje a UI lê `handover_at` por `unknown` porque a coluna não está em `types.ts`.
Depois de §8.2, checklist da rodada:

1. `src/lib/whatsapp/handover.ts` → `getHandoverAt`: aceitar `Pick<WAConversation, "handover_at">`
   e ler `conversation.handover_at` direto; remover o comentário "coluna PROPOSTA".
2. `src/components/whatsapp/WhatsAppConversationItem.tsx` → `WAConvLike.handover_at?`
   passa a refletir o tipo real (hoje opcional só por documentação).
3. Fixtures de teste que montam `WAConversation` completo
   (`src/pages/__tests__/WhatsApp.handover.test.tsx#makeConversation` e correlatos)
   precisam do campo agora obrigatório no `Row` (`handover_at: null` por default;
   `bot_flow_state: null`).
4. Os testes de "coluna ausente" de `handover.test.ts` viram **testes de robustez**
   (campo ausente em runtime não deve quebrar) — manter, não apagar.
5. O 409 de "Migration pendente" na UI vira só rede de segurança — manter o tratamento.
6. **Não** mexer nas interfaces locais do server (`ConversationRow` em
   `whatsapp-bot-reply/index.ts`): são tipos locais da edge function, não dependem
   de `types.ts`.
7. **Base de conhecimento:** `src/repositories/aiKnowledgeConsentsRepository.ts` usa hoje
   um cliente **"untyped"** (`supabase as unknown as { from(table) }`) porque a tabela não
   está em `types.ts`. Depois de §8.2, trocar pelo cliente tipado (como
   `aiBrainRepository.ts`) e **manter** `isMissingTableError` (a degradação continua valendo
   em ambientes sem a migration). Os fixtures de `AiKnowledgeSection.test.tsx` e
   `aiKnowledgeConsentsRepository.test.ts` seguem válidos.
8. **`assignment_origin`** nas interfaces locais do server (`ConversationRow` em `whatsapp-bot-reply/index.ts`): continua `unknown` de propósito — tipo local da edge function, não depende de `types.ts`; só a leitura defensiva (`parseAssignmentOrigin`) importa.
9. **`WhatsAppContactPanel`** recebe `handoverAt` já resolvido pela página (via
   `getHandoverAt`); ao tipar o item 1, nada muda no painel.

### 8.4 Pendências de outras lanes que tocam este fluxo

- ~~**Lane C — UI do simulador**~~ **FEITO** (`818a2c3`, U1–U4 de
  [`etapa-9-bot-simulador-fluxo-cobertura.md`](etapa-9-bot-simulador-fluxo-cobertura.md) §7):
  o simulador agora simula fluxo só-menu, mostra o handover real do server, carrega o estado
  de ida e volta e o selo da base de conhecimento. Nada pendente aqui — a UI **antiga** (sem
  `simState`) segue funcionando contra o server novo, e a nova contra o server antigo.

---

## Referências

- [`etapa-9-bot-fluxo-scriptado-r1-fundacao.md`](etapa-9-bot-fluxo-scriptado-r1-fundacao.md) §2 — origem de `bot_flow_state`.
- [`etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md`](etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md) — motor do menu.
- [`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`](etapa-9-bot-fluxo-scriptado-r4-handover-real.md) §2/§4 — origem de `handover_at`, ação `end_human_handover`.
- [`etapa-9-bot-fluxo-scriptado-r4-ui-atendimento-handover.md`](etapa-9-bot-fluxo-scriptado-r4-ui-atendimento-handover.md) — UI de Atendimento.
- [`etapa-9-item3-r1-base-conhecimento-fundacao.md`](etapa-9-item3-r1-base-conhecimento-fundacao.md) §4 — origem de `ai_knowledge_consents` (SQL verbatim).
- [`etapa-9-item3-r1-base-conhecimento-liga.md`](etapa-9-item3-r1-base-conhecimento-liga.md) — o que a base de conhecimento lê, sanitização, modos de falha.
- [`etapa-9-handover-assigned-to-proposta.md`](../architecture/etapa-9-handover-assigned-to-proposta.md) — origem de `assignment_origin`, decisões do revisor, ajuste do gate.
- [`etapa-6-g5-rate-limit.md`](etapa-6-g5-rate-limit.md) §8 — molde da pré-prova de hash / rollback de deploy.
- [`migrations-espelho-8b.md`](migrations-espelho-8b.md) — molde do espelho pós-aplicação.
- [`g71-credenciais-terceiros-pacote-operador.md`](g71-credenciais-terceiros-pacote-operador.md) — molde deste pacote.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G10 (types defasado), G48 (fechado pelo R4).

**PARADO aqui — nenhum SQL rodado contra produção, nenhum deploy executado, nenhuma migration em
`supabase/migrations/`. §18.**
