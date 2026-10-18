# G48 — adendo de produto: `assigned_to` no handover — PROPOSTA

> **Só proposta. Zero código, zero DDL.** Decisão de produto pro **operador**. O
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

- **Rodada de pré-requisito (pequena, server):** gravar `sender_id = userId` nos 4 inserts de `whatsapp-instance`. Sem coluna nova, sem migration.
- **Sem backfill possível:** mensagens antigas ficam com `sender_id` nulo ⇒ conversas com histórico antigo caem na regra 2 ("não atribuído") até o primeiro atendimento depois da correção. É aceitável e honesto.
- **Mensagens enviadas pelo próprio celular** (WhatsApp do número conectado, que chegam pelo webhook como `fromMe`) **não têm autor conhecido** — o webhook não sabe qual membro digitou. Elas **não contam** como "atendente que respondeu". Limite técnico, não decisão.
- Mensagens do **robô** têm `sender_id` nulo por construção ⇒ nunca viram "último atendente".

### 3.2 Marcar que a atribuição foi automática

Pra a regra 3 distinguir "o handover atribuiu" de "um humano atribuiu", é preciso **lembrar a origem** — hoje `assigned_to` não carrega isso. Mínimo necessário: **1 campo** na conversa (nome sugerido `handover_auto_assigned`, booleano, default falso; **rascunho de nome, não migration**) ligado ao mesmo ciclo de vida de `handover_at`. Alternativa sem coluna (guardar o id atribuído dentro de `bot_flow_state`/outro jsonb) foi **descartada**: mistura estado de fluxo com dado de atendimento e some quando o fluxo é limpo.

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

## 7. Fatiamento sugerido (se aprovado)

1. **Server, pequena:** `sender_id` gravado nos 4 inserts de `whatsapp-instance` (§3.1) — vale por si só (a UI já lê o campo).
2. **Server + DRAFT de migration:** campo de origem da atribuição (§3.2) + atribuição condicional no handover (§3.4/§3.5) + desatribuição na devolução (regra 3) — com degradação sem a coluna, no padrão da R4.
3. **UI:** badge "sem atendente" + forma de destaque (§4) + aviso do §3.3.

**Risco principal:** entregar a (2) sem a (1) = atribuição automática que **nunca** acha ninguém (`sender_id` nulo) e vira "sempre não atribuído". Por isso a ordem acima é obrigatória.

**Esta proposta não altera nada em runtime.**
