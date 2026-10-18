# G48 — adendo de produto: `assigned_to` no handover — PROPOSTA + decisões do revisor

> **Proposta de produto** pro **operador** (zero DDL aplicado). **Decisões do revisor: §8 (oficiais — o operador pode vetar). Status de implementação: §7; ajuste exato do gate: §9.** O
> handover real (R4, `handover_at`) deixou **de propósito** em aberto "pra quem
> atribuir" ([`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`](../qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md) §1,
> decisão #2; G48 em [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md)).
> Este doc propõe uma resposta e **lista o que ela exige** — inclusive um
> pré-requisito que a proposta original não tinha como saber (§3.1).

## 1. Estado hoje (fatos, conferidos no código)

- Conversa entregue = `handover_at` preenchido: o robô fica **mudo**. **Ninguém é atribuído** — `assigned_to` fica como estava (geralmente `NULL`). O atendente só descobre pelo badge "Humano" na lista, o banner no cabeçalho e o estado no painel de contato.
- A atribuição é **100% manual** (`assign_conversation` em `whatsapp-instance`, disparada pela tela de Atendimento) e **uma pessoa só** por conversa — não existe fila, rodízio nem equipe.
- `assigned_to` **já silencia o robô por outro caminho**, mais antigo e independente do handover: com `respond_all = false` no gatilho, conversa **atribuída** ⇒ robô não responde (`whatsapp-bot-reply`, gate `!isUnrestricted && conv.assigned_to`). Esse gate **continua valendo** e interage com qualquer atribuição automática (§3.3).
- Devolver ao robô (`end_human_handover`) zera `handover_at` e `bot_flow_state`; **não mexe em `assigned_to`**.

## 2. Proposta

1. **Ao entregar** (qualquer dos 4 gatilhos do R4): atribuir **automaticamente ao último atendente humano que respondeu nessa conversa**, *se existir* e *se `assigned_to` ainda estiver vazio* (nunca sobrescreve uma atribuição manual).
2. **Se não houver esse atendente** (conversa que o robô atendeu sozinho do começo ao fim, ou histórico sem autor): fica **"não atribuído"**, mas com **destaque na lista** — é o caso que mais precisa de olho humano, porque ninguém é o dono.
3. **Devolução limpa:** "Devolver ao robô" desfaz **só o que o handover fez** — zera `handover_at`/`bot_flow_state` (como hoje) **e** desatribui **se, e somente se, a atribuição foi automática**. Atribuição manual feita por um humano fica.

## 3. O que a proposta exige (e o que o código de hoje não dá)

### 3.1 Pré-requisito: `sender_id` nunca é gravado ⚠

`whatsapp_messages.sender_id` **existe** (migration `20260602040000_whatsapp_v2.sql`, FK para `auth.users`) e a UI **lê** o campo (`WhatsApp.tsx:883`) — mas **nenhum insert do servidor o preenche**: os 4 `insert` de mensagem de saída em `whatsapp-instance` (ações `send`, `send_media` e os dois de `forward_message`) omitem `sender_id`, embora o `userId` do chamador esteja em escopo. Resultado: **"último atendente que respondeu" não é derivável hoje.**

- **FEITO (rodada de pré-requisito, server):** `sender_id = userId` gravado nos 4 inserts de `whatsapp-instance`, com teste por insert (`instanceAssignmentWiring.test.ts`). Sem coluna nova, sem migration — `sender_id` já está no schema aplicado.
- **Sem backfill possível:** mensagens antigas ficam com `sender_id` nulo ⇒ conversas com histórico antigo caem na regra 2 ("não atribuído") até o primeiro atendimento depois da correção. É aceitável e honesto.
- **Mensagens enviadas pelo próprio celular** (WhatsApp do número conectado, que chegam pelo webhook como `fromMe`) **não têm autor conhecido** — o webhook não sabe qual membro digitou. Elas **não contam** como "atendente que respondeu". Limite técnico, não decisão.
- Mensagens do **robô** têm `sender_id` nulo por construção ⇒ nunca viram "último atendente".

### 3.2 Marcar que a atribuição foi automática

Pra a regra 3 distinguir "o handover atribuiu" de "um humano atribuiu", é preciso **lembrar a origem** — hoje `assigned_to` não carrega isso. Mínimo necessário: **1 campo** na conversa. **Decidido pelo revisor (§8): `assignment_origin text CHECK ('auto','manual') NULL`** — no lugar do booleano que esta proposta sugeria (`handover_auto_assigned`), porque distingue também "atribuída por uma pessoa" de "origem desconhecida" (atribuições anteriores à coluna). DRAFT como **4ª migration do pacote §8-b** ([`etapa-9-bot-pacote-operador-8b.md`](../qa/etapa-9-bot-pacote-operador-8b.md) §2.4), **não aplicada**. Alternativa sem coluna (guardar o id atribuído dentro de `bot_flow_state`/outro jsonb) foi **descartada**: mistura estado de fluxo com dado de atendimento e some quando o fluxo é limpo.

### 3.3 Interação com o gate antigo de `respond_all`

Com `respond_all = false`, "atribuído" **silencia o robô sozinho**. Duas consequências a decidir:

- Se a devolução **não** desatribuísse, um workspace com `respond_all = false` ficaria com o robô **mudo para sempre** depois de "Devolver ao robô" — contradiz o botão. Por isso a regra 3 **precisa** desatribuir o que foi automático.
- Atribuição **manual** + `respond_all = false` continua silenciando o robô depois de devolver (comportamento **já existente**). Proposta: não mudar o gate; **avisar na UI** quando a conversa devolvida ainda está atribuída com "responder a todos" desligado ("o robô continua em silêncio: a conversa tem atendente").

### 3.4 Corrida

Handover automático e atribuição manual podem acontecer no mesmo instante. A atribuição automática deve ser **condicional** ("só se `assigned_to` ainda for nulo", no próprio UPDATE) — nunca ler-depois-escrever.

### 3.5 Quem pode ser o "último atendente"

Ainda ser **membro do workspace** com papel que **responde** (owner/admin/member — não `viewer`). Quem saiu do workspace ou virou `viewer` não recebe a conversa ⇒ cai na regra 2.

## 4. Destaque do "não atribuído" na lista (UI, rodada separada)

Hoje o badge é "Humano" (âmbar). Proposta: quando `handover_at` está preenchido **e** `assigned_to` é nulo, o badge vira **"Humano · sem atendente"** (mais forte), e a conversa ganha prioridade de visibilidade — **filtro/ordem "aguardando atendente"**. Obs.: a barra de filtros é um `TabsList` de 5 colunas fixas (já descartei adicionar um 6º chip na R4 por isso); a forma exata (chip, ordenação ou contador no cabeçalho) é decisão de design, não técnica.

## 5. Alternativas consideradas

| Alternativa | Por que não (agora) |
|---|---|
| Atribuir sempre ao **dono** do workspace | Concentra tudo numa pessoa; ignora quem já vinha atendendo o cliente |
| **Fila / rodízio** entre atendentes | Não existe conceito de equipe/fila (Fase A do item 4, R4); exigiria modelo novo — fora de escopo |
| **Manter como está** (nunca atribuir) | Funciona, mas o "ninguém é o dono" fica sempre; é o estado atual e a razão deste doc |
| Atribuir ao **primeiro** atendente da conversa | Pior que o último: o primeiro pode nem estar mais no caso |

## 6. Perguntas pro operador (decisão de produto)

1. **Aceita "último atendente que respondeu" como critério?** (vs. dono, vs. manter sem atribuição)
2. **Janela de validade:** um atendente que respondeu há 3 meses ainda vale como "último"? (proposta de partida: **sem janela** — simples; alternativa: ex. 30 dias)
3. **Aviso/notificação** ao atendente auto-atribuído? Hoje não existe canal de notificação por usuário; a atribuição automática seria o gancho natural (fora desta proposta).
4. **Destaque do "sem atendente":** chip, ordenação ou contador?
5. **Aviso de "robô continua mudo"** (§3.3) na conversa devolvida mas ainda atribuída com `respond_all` desligado — quer?

## 7. Fatiamento — com status

| Fatia | Status |
|---|---|
| **1.** `sender_id` gravado nos 4 inserts de saída de `whatsapp-instance` | ✅ **FEITO** (testes por insert) |
| **2a.** Preparação **com degradação**: origem lida/gravada, devolução desatribui só o automático, gate ajustado (§9) | ✅ **FEITO**, **inerte até a coluna existir** (hoje nada grava `'auto'`) |
| **2b.** DRAFT da coluna `assignment_origin` | ✅ no pacote §8-b como **4ª migration** — **NÃO aplicada** |
| **2c.** **Atribuição automática** no handover (escolher o último atendente por `sender_id`, UPDATE condicional) | ⏳ **NÃO implementada** — depende da coluna **e** da sessão do operador |
| **3.** UI: badge "Humano · sem atendente", destaque/ordem na lista, aviso do §3.3 | ⏳ |

**Ordem obrigatória:** a **2c** só depois da coluna aplicada (o `UPDATE` condicional e a devolução dependem dela) e de existir histórico com `sender_id` (a fatia 1 precisa estar no ar há algum tempo, senão toda conversa cai em "sem atendente").

## 8. Decisões do revisor — OFICIAIS (o operador pode vetar)

| # | Decisão | Onde está |
|---|---|---|
| **D1** | **Atribuição automática ao último atendente humano que respondeu** — quando derivável por `sender_id`; **senão "não atribuído" com destaque na lista** | §2 regras 1–2; fatias 2c e 3 (não implementadas) |
| **D2** | **A devolução ao robô desatribui SOMENTE atribuição automática.** Pra isso, campo de origem: `whatsapp_conversations.assignment_origin text CHECK ('auto','manual') NULL` | DRAFT = **4ª migration** do pacote §8-b (§2.4), **não aplicada**; lógica já pronta (§9) |
| **D3** | **O gate antigo `respond_all = false + assigned_to` é revisto** pra não deixar o robô mudo depois de "Devolver" | §9 (ajuste exato, implementado com degradação) |
| **D4** | **A atribuição automática NÃO é implementada ainda** | fatia 2c |

*Veto do operador:* qualquer uma das quatro pode ser vetada na sessão §8-b; D1/D2 são as de produto (D3 é correção de um efeito colateral, D4 é só sequenciamento).

## 9. Ajuste exato do gate `respond_all = false + assigned_to`

**O problema (§3.3):** depois de "Devolver ao robô" uma atribuição que sobrou ainda calaria o robô num workspace com `respond_all = false`.

**Antes** (`whatsapp-bot-reply/index.ts`):

```ts
if (!isUnrestricted && conv.assigned_to) return skipped;   // cala por QUALQUER atribuição
```

**Agora** (`_shared/botAssignment.ts#shouldBotYieldToAssignee`, no mesmo lugar):

```ts
if (input.respondAll) return false;      // respond_all ligado: nunca cede
if (!input.assignedTo) return false;     // sem atribuição: nunca cede
const staleAutoAssignment =
  parseAssignmentOrigin(input.assignmentOrigin) === "auto" && !input.handedOver;
return !staleAutoAssignment;             // cede, exceto atribuição AUTOMÁTICA fora de um handover em vigor
```

**Tabela-verdade** (a única linha que mudou é a última):

| `respond_all` | `assigned_to` | origem | entregue | antes | agora |
|---|---|---|---|---|---|
| ligado | qualquer | qualquer | qualquer | responde | responde |
| desligado | nulo | qualquer | qualquer | responde | responde |
| desligado | alguém | manual **ou desconhecida** (inclui coluna ausente) | não | cala | cala **(igual)** |
| desligado | alguém | auto | **sim** | cala (e já está mudo por `handover_at`) | cala **(igual)** |
| desligado | alguém | **auto** | **não** | **cala** ← o "mudo após Devolver" | **responde** |

**Por que só isso muda:** uma atribuição **automática** só existe **enquanto o handover que a criou está em vigor** — e então o robô já está mudo por `handover_at` (checado **antes** deste gate). Se a origem é `auto` e a conversa **não** está mais entregue, é sobra: a desatribuição da devolução falhou, ou a mensagem chegou entre os dois UPDATEs da devolução. Esse caso não pode calar o robô. Atribuição **manual** (ou de origem desconhecida) continua calando, como sempre.

**Degradação:** coluna `assignment_origin` ausente => `conv.assignment_origin` é `undefined` => origem "desconhecida" => o gate é **idêntico ao de antes em todas as combinações** (teste exaustivo `botAssignment.test.ts`). E, como nada grava `'auto'` hoje, o ajuste é **inerte** até a fatia 2c.

**Devolução (`end_human_handover`):** além de zerar `handover_at`/`bot_flow_state`, lê `assigned_to, assignment_origin`; se a origem é **auto**, desatribui com UPDATE **condicional** (`assignment_origin = 'auto'` e mesmo `assigned_to` — não pisa numa atribuição humana feita no meio). Resposta ganha `unassigned: boolean`. Erro de SELECT (coluna ausente) ⇒ nada é desatribuído. **`assign_conversation`** passa a gravar `assignment_origin = 'manual'` (ou NULL ao desatribuir) em UPDATE **separado**, pra coluna ausente não quebrar a atribuição.

### Caso residual — NÃO resolvido, decisão do operador

**Atribuição manual + `respond_all = false` + "Devolver ao robô"**: a atribuição é humana, a devolução (D2) não a desfaz, e o gate (por desenho antigo) segue calando o robô. Ou seja: o botão "Devolver" **não faz o robô voltar** nesse workspace. Opções (nenhuma implementada):

1. **Avisar** na devolução (a Pergunta 5 do §6): o servidor resolveria o `respond_all` efetivo e devolveria um sinal (ex.: `botStillMuted`) pra a UI explicar "o robô continua em silêncio: a conversa está atribuída a <nome> e 'responder a todos' está desligado". Não muda comportamento — só o torna honesto.
2. **Desatribuir também a manual** quando `respond_all = false` — resolve de vez, mas **contradiz D2** ("somente automática"); só com decisão explícita do operador.
3. **Manter** (atribuição humana é dona da conversa; devolver exige desatribuir).

Recomendo a (1): honesta, reversível, sem tocar na decisão humana.

**Esta proposta, por si, não altera runtime;** o que foi implementado (§7) é inerte sem a coluna e idêntico ao comportamento anterior quando ela falta.
