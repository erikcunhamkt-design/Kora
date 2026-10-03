# Etapa 9 · Item 4 — Construtor de fluxo scriptado — R4 (handover REAL — fecha o G48)

> **Nada aplicado em banco, nada deployado.** Esta rodada implementa, no
> server, o handover de verdade: a conversa passa a um estado persistido de
> "entregue a humano" e o robô fica em silêncio nela até alguém devolver.
> A coluna que guarda esse estado (`whatsapp_conversations.handover_at`) é
> só um DRAFT de migration (§2) — aplicar é gate do operador (§0/§6/§8-b).
> Código defensivo: **coluna ausente → degrada pro comportamento de antes
> da R4, sem quebrar o fluxo** (§5).

Contexto: o G48 (`kora-hub-auditoria-e-plano.md`) registrou que o nó
"Transbordo Humano" mandava a mensagem de cortesia mas o robô continuava
respondendo a próxima mensagem. A R3 deixou isso registrado como aresta
("depois de `advanced-away`/`handover-fallback`, a próxima mensagem
reentra no menu do zero"). Esta rodada fecha as duas coisas.

## 1. Escopo

1. Estado persistido "entregue a humano" + gate de silêncio no
   `whatsapp-bot-reply`.
2. 4 gatilhos de entrada (3 do menu + o por palavra-chave que já existia):
   - **menu → nó handover**: a opção escolhida aponta pra um nó
     `handover` habilitado (`menu_option`);
   - **estouro com `acao: "node"` apontando pra um handover**
     (`menu_fallback_node`);
   - **estouro sem destino de nó utilizável** — `acao: "reprompt"`
     esgotada, ou `"node"` sem `fallbackNodeId` (`menu_exhausted`) — ver §3
     (decisão #1, conflito sinalizado);
   - **palavra-chave** (as 7 de sempre, nó `handover` habilitado) —
     `keyword`. É o caminho original do G48: agora também persiste o estado.
3. Devolução ao bot: ação `end_human_handover` em `whatsapp-instance`
   (contrato pra UI no §4; **UI não implementada nesta rodada**).
4. Testes: entrada pelos gatilhos, bot silencioso enquanto entregue,
   devolução, degradação sem coluna.

**Fora de escopo (decisão registrada):** UI em Atendimento (§4 documenta o
contrato — rodada separada); decidir **pra quem** atribuir a conversa
(`assigned_to`, pergunta de produto em aberto do G48/Fase A §2.3 — o estado
de handover é independente da atribuição e vale mesmo sem ninguém
atribuído); transbordo "lojas"/"atendentes" (Fase A R3/R4 — sem definição
de produto); aplicar a migration.

---

## 2. Draft — `whatsapp_conversations.handover_at` (coluna nova, nullable)

**PROPOSTA — NÃO aplicada pelo Code.** Code não roda DDL contra produção
(protocolo §0/§6/§8-b) — aplicação é do operador, via Supabase CLI/
dashboard, na sessão §8-b. Nome de arquivo sugerido quando promovido a
migration real: `<timestamp>_etapa9_bot_fluxo_scriptado_handover_at.sql`.
(Mesmo formato do draft de `bot_flow_state` da R1 §2 — fica no doc, não em
`supabase/migrations/`, até o operador promover.)

**Verificação prévia obrigatória do operador** (a coluna não existe hoje —
nenhuma migration a cria e `types.ts` gerado não a tem):

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'whatsapp_conversations'
  AND column_name = 'handover_at';
-- Esperado: 0 linhas.
```

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

Sem índice nesta rodada: o gate lê `handover_at` da MESMA linha que o
handler já carrega por `id` (`select("*")` da conversa) — não há consulta
nova por `handover_at`. Se a UI de Atendimento passar a filtrar/ordenar a
fila por "aguardando atendente", um índice parcial
(`... WHERE handover_at IS NOT NULL`) vira candidato — decisão da rodada de
UI, não desta.

**Depois de aplicada:** regenerar `src/integrations/supabase/types.ts` (G10
— o gerado fica defasado até lá; o handler não depende dele, mas a UI de
Atendimento vai querer o campo tipado).

---

## 3. Decisões e por quê

1. **⚠ CONFLITO SINALIZADO — `acao: "reprompt"` esgotada agora entrega a
   humano.** Esta é uma instrução EXPLÍCITA do prompt da R4 ("…ou com
   `acao="reprompt"` esgotada"), mas contradiz duas coisas já em `main`:
   - R1 §0 item 2 (decisão do operador): "limite de tentativas configurável
     decide o que acontece depois de esgotado: **reprompt indefinido** OU
     pular pra outro nó";
   - a UI do R5 (`WhatsAppBotConfig.tsx`): o select "Depois de esgotar"
     tem a opção **"Reapresentar o menu (padrão)"** e o texto de ajuda diz
     que isso "só decide o que fazer depois de N tentativas inválidas
     seguidas".

   Seguido o prompt: esgotar sem destino de nó utilizável → `exhausted` →
   handover. **Consequência prática:** com a config DEFAULT que a UI cria
   (`acao: "reprompt"`, `maxTentativas: 3`), a 3ª resposta inválida
   seguida entrega a conversa a um humano (antes: reapresentava o menu pra
   sempre). O rótulo da UI "Reapresentar o menu" passa a não descrever o
   comportamento — **UI não tocada** (arquivo da Lane C, fora do escopo
   desta rodada); se a decisão for mantida, o rótulo/ajuda precisam de
   ajuste numa rodada de UI. **Reverter é 1 trecho**: em
   `botFlowMenu.ts#resolveMenuTurn`, trocar o `return { kind: "exhausted" }`
   por cair no `reprompt` (e os 3 testes da lista abaixo voltam ao que a R3
   afirmava). Nada vai pra `main` sem o "vai" do revisor (§18).
2. **`assigned_to` intocado.** "Pra quem atribuir" é pergunta de produto
   em aberto (G48/Fase A §2.3, sem fila/rodízio hoje). `handover_at` é
   independente: a conversa fica "entregue" mesmo sem ninguém atribuído.
   Contrato pra UI: tratar `handover_at IS NOT NULL` como "aguardando
   atendente".
3. **Persistir o estado NÃO depende do envio da cortesia ter dado certo.**
   A decisão de entregar já foi tomada; se o uazapi falhar na hora, um
   humano continua sendo necessário. Falha de envio só é logada.
4. **Nó `handover` DESABILITADO no construtor não age** (mesma regra de
   `enabled` do resto do arquivo): opção do menu que aponta pra um handover
   desligado cai no comportamento da R3 (sai do rastreamento, fluxo normal
   roda). Testado.
5. **Destino que NÃO é handover mantém o comportamento da R3**
   (`advanced-away`/`handover-fallback` pra nó de outro tipo → limpa
   `bot_flow_state`, loga, segue o fluxo normal). Só o que aponta pra um
   handover habilitado, ou esgota sem destino, vira handover.
6. **O gate de silêncio vem ANTES de toda lógica de fluxo** — inclusive do
   `respond_all`: "entregue" é uma decisão já tomada por esta conversa, não
   uma preferência do fluxo. Roda logo depois de carregar a conversa.
7. **Ao entregar, `bot_flow_state` é limpo** (fluxo scriptado terminou) e
   **ao devolver também** (o bot volta do zero — a próxima mensagem
   re-apresenta o menu, não retoma um fluxo antigo).
8. **Cada coluna num UPDATE próprio** (`buildHandoverEntryUpdates`/
   `buildHandoverReturnUpdates`): se `handover_at` não existir, o Postgrest
   recusa aquele UPDATE inteiro; isolado, o erro nunca arrasta os outros
   campos (mesma disciplina da R3 pra `bot_flow_state`).
9. **Refator mínimo no `index.ts`**: o trio "envia por uazapi + insere a
   mensagem + atualiza a conversa" estava copiado em 2 lugares (handover
   por palavra-chave e menu da R3); virou `sendBotText()`, usado pelos dois
   + pelo handover novo. Mesmos campos, mesma ordem. A lista de
   palavras-chave e o texto de cortesia foram movidos pra
   `_shared/botHandover.ts` sem mudar valor nem critério (substring,
   case-insensitive) — testados.

**Efeito colateral conhecido, não tratado aqui (candidato de otimização):**
o `whatsapp-webhook` continua chamando o `whatsapp-bot-reply` a cada
mensagem inbound enquanto o bot está ativo; numa conversa entregue a
chamada agora responde `skipped` bem cedo, mas ainda conta 1 no rate-limit
por-workspace (`check_and_increment_ai_rate_limit`, roda antes do gate).
Evitar isso exigiria o webhook consultar `handover_at` antes de chamar —
mexe em outra function, fora do escopo.

---

## 4. Devolução ao bot — contrato

Ação nova em `whatsapp-instance` (mesma function da atribuição manual,
mesma checagem de membership do workspace já feita no topo dela):

```http
POST /functions/v1/whatsapp-instance
{ "action": "end_human_handover", "workspaceId": "<uuid>", "conversationId": "<uuid>" }
```

- **200** `{ ok: true, cleared: { handover_at: true, bot_flow_state: true|false } }`
  — o bot volta a responder; `bot_flow_state` zerado faz a próxima mensagem
  re-apresentar o menu do zero.
- **409** `{ ok: false, error: "handover state unavailable (migration pending)", cleared: {...} }`
  — `handover_at` ainda não existe (migration §8-b pendente). Diferente do
  bot (que degrada em silêncio), a ação é EXPLÍCITA: reporta em vez de
  fingir sucesso.
- **400** sem `conversationId`; **403** não-membro (gate pré-existente).

**Ponto de encaixe pra UI (rodada separada — NÃO implementado):** em
`src/pages/WhatsApp.tsx`, ao lado de `handleAssign` (~`:405`), um
`handleEndHumanHandover(conversationId)` com o mesmo molde
(`supabase.functions.invoke("whatsapp-instance", { body: { action:
"end_human_handover", workspaceId, conversationId } })`, toast de sucesso/
falha). Sugestão de UX: badge "Aguardando atendente" na lista/cabeçalho da
conversa quando `handover_at` não é nulo + botão "Encerrar atendimento
humano" que chama o handler. A devolução **não é automática** (nem
desatribuir nem responder pelo Inbox devolve ao bot): é sempre uma ação
explícita — decisão deliberada, evita o bot voltar a falar por cima de um
atendimento em andamento.

---

## 5. Degradação — coluna `handover_at` ausente

| Onde | Sem a coluna | Efeito |
|---|---|---|
| Leitura (gate, `index.ts`) | `select("*")` não traz o campo → `undefined` → `isHandedOver()` = `false` | bot NÃO fica mudo — comportamento de antes da R4 |
| Escrita na entrada (`enterHumanHandover`) | UPDATE de `handover_at` falha (erro do Postgrest, não exceção) → `console.warn`, segue | cortesia enviada normalmente; estado não persiste |
| Escrita na devolução (`end_human_handover`) | UPDATE de `handover_at` falha → **409 explícito** | quem chama sabe que a migration está pendente |
| Resto do fluxo de IA / nó menu ausente | nenhuma mudança | zero regressão |

Consequência aceita: **enquanto a migration não for aplicada, a aresta da R3
continua aberta** (a próxima mensagem reentra no menu) — o fix de código
está pronto, o efeito depende do operador aplicar o §2. Mesma situação do
`bot_flow_state` da R1/R3 (que também precisa da migration pra o menu
funcionar de ponta a ponta).

---

## 6. Testes

`supabase/functions/_shared/__tests__/botHandover.test.ts` (novo) +
`botFlowMenu.test.ts` (3 testes mudaram DELIBERADAMENTE). 51 testes nos 2
arquivos, zero mock de rede/banco (módulos puros):

- `matchesHandoverKeyword` (3): as 7 palavras originais, case-insensitive/
  substring, não casa vazio/sem palavra.
- `isHandedOver` (5 — "bot silencioso" + "degradação sem coluna"):
  string ISO → entregue; `undefined` (coluna ausente), `null`, garbage →
  não entregue; linha sem a coluna se comporta como hoje.
- `isEnabledHandoverNode` (3): habilitado, desabilitado, outro tipo/id.
- `decideHandoverFromMenuTurn` (7 — **entrada pelos gatilhos**):
  `menu_option`, `menu_fallback_node`, `menu_exhausted`; destinos que não
  são handover/handover desabilitado → sem handover; present/reprompt/none
  nunca viram handover.
- Contrato de escrita (3): entrada e devolução em UPDATEs separados, texto
  de cortesia preservado.
- Ciclo completo (2): menu → handover → mensagens seguintes encontram o
  bot mudo → devolução → bot volta do zero (próxima mensagem re-apresenta
  o menu) — **fecha a aresta da R3**; degradação sem coluna.

**Divergências DELIBERADAS vs R3 (testes que mudaram de asserção):**

| Teste (`botFlowMenu.test.ts`) | R3 afirmava | R4 afirma |
|---|---|---|
| estoura `maxTentativas` com `acao: "reprompt"` | `reprompt` (indefinido, `attempts` 6) | `{ kind: "exhausted" }` |
| `acao: "node"` sem `fallbackNodeId` | degrada pra `reprompt` | `{ kind: "exhausted" }` |
| novo: tentativa que ATINGE o limite vs a anterior | — | anterior `reprompt`, a que atinge `exhausted` |

**Prova fail→fix→pass por patch (G65, sem `git stash`):** `git add -N`
(arquivos novos) → `git diff` de `botHandover.ts` + `botFlowMenu.ts` →
`git checkout --` (esvazia `botHandover.ts`, volta `botFlowMenu.ts` ao
estado R3) → `npx vitest run` dos 2 arquivos: **26 falharam** (23 do
`botHandover` + os 3 acima) → `rm` do arquivo esvaziado + `git apply` do
mesmo patch → **51/51 passaram**.

O wiring (`whatsapp-bot-reply/index.ts`, `whatsapp-instance/index.ts`) não
tem teste direto — mesma disciplina do resto dessas functions (só a lógica
extraída pra `_shared/*.ts` é testada; aqui TODA a decisão está em
`botHandover.ts`/`botFlowMenu.ts`, o `index.ts` só faz I/O em cima delas).

## Referências

- `docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md` — decisões do
  operador (§0), draft de `bot_flow_state` (§2).
- `docs/qa/etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md` — motor
  do menu; a aresta que esta rodada fecha (§2, "Consequência aceita").
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G48.
- `docs/architecture/etapa-9-item4-construtor-sem-ia-fase-a.md` §1.2/§2.3 —
  achado original e a pergunta de produto "pra quem atribuir".
- `supabase/functions/_shared/botHandover.ts` — decisão pura de handover,
  estado, contrato de escrita.

**PARADO aqui — handover real implementado e testado, zero DDL aplicado,
zero deploy, zero push/merge. §18.**
