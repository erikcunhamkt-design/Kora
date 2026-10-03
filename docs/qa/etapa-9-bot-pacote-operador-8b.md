# Etapa 9 · Item 4 — fluxo scriptado + handover — pacote do operador (§8-b)

> **Nada aplicado, nada deployado.** Este doc junta tudo que depende de ação do
> operador contra o banco/infra de produção pra o **fluxo scriptado (nó
> "menu", R1/R3)** e o **handover real (R4, fecha o G48)** ficarem VIVOS. O
> código já está em `main` e foi escrito pra degradar sem as colunas (ver §6) —
> mas **enquanto as 2 migrations abaixo não forem aplicadas, o menu não
> funciona de ponta a ponta e o handover não persiste**. Molde de formato:
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
| 2 | 2 migrations (`bot_flow_state`, `handover_at`) | operador | §2 |
| 3 | SELECTs de prova depois | operador | §3 |
| 4 | Deploy de 3 functions (`whatsapp-instance`, `whatsapp-bot-reply`, `whatsapp-webhook`) | operador | §4 |
| 5 | Verificação ao vivo + smoke ponta a ponta | operador | §5 |
| 6 | Espelho das migrations em `supabase/migrations/`, regenerar `types.ts`, tipar a leitura | operador (1 comando) + **lane** | §8 |

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
default, nenhum caminho antigo lê/escreve elas) — aplicar antes do deploy é
seguro mesmo que o deploy atrase.

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

---

## 2. As 2 migrations (verbatim dos docs de origem; idempotentes)

Rodar **nesta ordem**, no SQL Editor do dashboard (ou via CLI). Podem ir numa
única execução. Ambas usam `ADD COLUMN IF NOT EXISTS`: reaplicar é no-op (o
Postgres só emite um `NOTICE ... already exists, skipping`). Coluna nullable
sem default — não reescreve a tabela, lock instantâneo.

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

**Regra de parada:** §3.1 com ≠ 2 linhas, ou §3.2 com contagem > 0 antes do
deploy → parar e reportar; não seguir pra §4.

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

| Function | O que muda | Arquivos que DEVEM aparecer no output do deploy (no mínimo) |
|---|---|---|
| `whatsapp-instance` | ação nova `end_human_handover` (devolver ao robô) | `index.ts`, `_shared/botHandover.ts` |
| `whatsapp-bot-reply` | motor do nó menu (R3), handover real (R4), simulador do fluxo (opt-in, ver [`etapa-9-bot-simulador-fluxo-cobertura.md`](etapa-9-bot-simulador-fluxo-cobertura.md)) | `index.ts`, `_shared/botFlowMenu.ts`, `_shared/botHandover.ts`, `_shared/botFlowSimulation.ts` |
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

### 5.4 Regra de parada

**Parar em qualquer vermelho** de §5.1–§5.3 — não corrigir ao vivo. Ir pra §7.

---

## 6. Degradação (por que dá pra aplicar/deployar em qualquer ordem sem derrubar o bot)

| Situação | Efeito |
|---|---|
| Código novo, **sem** `handover_at` | bot volta ao comportamento pré-R4 (cortesia sem persistir); webhook invoca como antes; UI não mostra banner; ação "Devolver ao robô" responde **409** e a UI mostra "Migration pendente" |
| Código novo, **sem** `bot_flow_state` | fluxo **sem** nó menu: zero efeito. Fluxo **com** nó menu habilitado: loop de menu (§0) — **o único cenário ruim** |
| Colunas aplicadas, código antigo | inerte (nenhum caminho antigo as lê) |
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

---

## 8. Depois da aplicação

### 8.1 Espelho das migrations em `supabase/migrations/` (lane escreve, operador registra)

As 2 migrations hoje vivem **só nos docs** (R1 §2 / R4 §2) — não existem em
`supabase/migrations/`. Depois de aplicadas, o repo precisa refletir o banco
(mesmo padrão de [`migrations-espelho-8b.md`](migrations-espelho-8b.md)): uma
lane promove os 2 SQLs a arquivos com a **série real de aplicação** (a data da
sessão §8-b — o operador informa), e o operador registra no histórico do CLI
**sem rodar o SQL de novo**:

```bash
supabase migration repair --status applied <VERSÃO_bot_flow_state>
supabase migration repair --status applied <VERSÃO_handover_at>
```

### 8.2 Regenerar `types.ts` (operador, introspecção read-only — G10)

```bash
supabase gen types typescript --project-id ewamvzncsloagtcvkbxv > src/integrations/supabase/types.ts
```

Só lê o catálogo (não executa DDL/DML). Commitar o arquivo regenerado numa branch
de lane. Efeito colateral esperado: o `Row` de `whatsapp_conversations` passa a
ter `bot_flow_state` e `handover_at`.

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

### 8.4 Pendências de outras lanes que tocam este fluxo

- **Lane C — UI do simulador** (`WhatsAppBotConfig.tsx`, R6 canvas): o server já aceita o
  simulador do fluxo scriptado em modo opt-in; a UI precisa incorporar o contrato de
  [`etapa-9-bot-simulador-fluxo-cobertura.md`](etapa-9-bot-simulador-fluxo-cobertura.md) §4
  (hoje o simulador exige nó IA e fabrica o handover no navegador).

---

## Referências

- [`etapa-9-bot-fluxo-scriptado-r1-fundacao.md`](etapa-9-bot-fluxo-scriptado-r1-fundacao.md) §2 — origem de `bot_flow_state`.
- [`etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md`](etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md) — motor do menu.
- [`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`](etapa-9-bot-fluxo-scriptado-r4-handover-real.md) §2/§4 — origem de `handover_at`, ação `end_human_handover`.
- [`etapa-9-bot-fluxo-scriptado-r4-ui-atendimento-handover.md`](etapa-9-bot-fluxo-scriptado-r4-ui-atendimento-handover.md) — UI de Atendimento.
- [`etapa-6-g5-rate-limit.md`](etapa-6-g5-rate-limit.md) §8 — molde da pré-prova de hash / rollback de deploy.
- [`migrations-espelho-8b.md`](migrations-espelho-8b.md) — molde do espelho pós-aplicação.
- [`g71-credenciais-terceiros-pacote-operador.md`](g71-credenciais-terceiros-pacote-operador.md) — molde deste pacote.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G10 (types defasado), G48 (fechado pelo R4).

**PARADO aqui — nenhum SQL rodado contra produção, nenhum deploy executado, nenhuma migration em
`supabase/migrations/`. §18.**
