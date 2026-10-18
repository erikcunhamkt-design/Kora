# G48 — adendo de produto: `assigned_to` no handover — PROPOSTA + decisões do revisor

> **Proposta de produto** pro **operador** (zero DDL aplicado). **Decisões do revisor: §8 (oficiais — o operador pode vetar). Status de implementação: §7; ajuste exato do gate: §9.** O
> handover real (R4, `handover_at`) deixou **de propósito** em aberto "pra quem
> atribuir" ([`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`](../qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md) §1,
> decisão #2; G48 em [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md)).
> Este doc propõe uma resposta e **lista o que ela exige** — inclusive um
> pré-requisito que a proposta original não tinha como saber (§3.1).

## 1. Estado hoje (fatos, conferidos no código)

- Conversa entregue = `handover_at` preenchido: o robô fica **mudo**. Antes desta proposta **ninguém era atribuído** — `assigned_to` ficava como estava (geralmente `NULL`). O atendente descobre pelo badge na lista ("Aguardando humano" / "Humano", §10.5), o banner no cabeçalho e o estado no painel de contato.
- A atribuição era **só manual** (`assign_conversation` em `whatsapp-instance`) e **uma pessoa só** por conversa — não existe fila, rodízio nem equipe. ⚠ **Correção de um fato que este doc dava como certo:** a tela **não** dispara `assign_conversation` — o painel de contato não renderiza controle de atribuição (§10.6). A ação só é alcançável por chamada direta.
- `assigned_to` **já silencia o robô por outro caminho**, mais antigo e independente do handover: com `respond_all = false` no gatilho, conversa **atribuída** ⇒ robô não responde (`whatsapp-bot-reply`, gate `!isUnrestricted && conv.assigned_to`). Esse gate **continua valendo** e interage com qualquer atribuição automática (§3.3).
- Devolver ao robô (`end_human_handover`) zera `handover_at` e `bot_flow_state`. Antes desta proposta **não mexia em `assigned_to`**; hoje desatribui **só a atribuição automática** (§9) e diz à UI o que aconteceu.

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

Ainda ser **membro do workspace** com papel que **responde** (owner/admin/member — não `viewer`). Quem saiu do workspace ou virou `viewer` não recebe a conversa ⇒ cai na regra 2. **Implementado** (`isAssignableRole` + checagem em `workspace_members`): o servidor deixa qualquer membro enviar, inclusive `viewer`, então um `viewer` pode constar como autor no histórico sem virar dono.

## 4. Destaque do "não atribuído" na lista — FEITO (ver §10.5)

Proposta original: quando `handover_at` está preenchido **e** `assigned_to` é nulo, o badge vira mais forte e ganha filtro/ordem. **Feito:** badge preenchido **"Aguardando humano"** (texto do revisor, no lugar de "Humano · sem atendente"). **Não feito:** filtro/ordem/contador — a barra de filtros é um `TabsList` de 5 colunas fixas (já descartei adicionar um 6º chip na R4 pelo mesmo motivo) e não cabe limpo (§10.5).

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
| **1.** `sender_id` gravado nos 4 inserts de saída de `whatsapp-instance` | ✅ **FEITO** em `c393d02` (testes por insert) |
| **2a.** Preparação **com degradação**: origem lida/gravada, devolução desatribui só o automático, gate ajustado (§9) | ✅ **FEITO** |
| **2b.** DRAFT da coluna `assignment_origin` | ✅ no pacote §8-b como **4ª migration** — **NÃO aplicada** |
| **2c.** **Atribuição automática** no handover (último atendente por `sender_id`, UPDATE único e condicional) | ✅ **FEITO (código)** em `b40bb5a` — **só age depois que a coluna existir** (coluna ausente ⇒ só entrega, sem dono; §10) |
| **3.** UI: badge **"Aguardando humano"** na lista, confirmação/aviso na devolução (§9, §10.4) | ✅ **FEITO** em `b40bb5a` — sem aba nova de filtro (§10.5) |
| **4.** Controle de atribuição no painel de contato (**G101**) e "assumir ao responder" (**G102**) — §11 | ✅ **FEITOS em código** (branch `etapa-9-item4-g101-g102`, aguardando "vai") — **ABERTOS** no catálogo até o merge e a confirmação ao vivo; o G102 também **só age com a coluna aplicada** |

**Ordem obrigatória:** a atribuição automática só **produz efeito** depois da coluna aplicada **e** de existir histórico com `sender_id` (a fatia 1 precisa estar no ar há algum tempo, senão toda conversa cai em "sem atendente"). Antes disso o código é inerte: o único efeito visível é o badge "Aguardando humano" nas conversas entregues e sem dono.

## 8. Decisões do revisor — OFICIAIS (o operador pode vetar)

| # | Decisão | Onde está |
|---|---|---|
| **D1** | **Atribuição automática ao último atendente humano que respondeu** — quando derivável por `sender_id`; **senão "não atribuído" com destaque na lista** | §2 regras 1–2; fatias 2c e 3 — **implementadas** (§10), a atribuição só age com a coluna aplicada |
| **D2** | **A devolução ao robô desatribui SOMENTE atribuição automática.** Pra isso, campo de origem: `whatsapp_conversations.assignment_origin text CHECK ('auto','manual') NULL` | DRAFT = **4ª migration** do pacote §8-b (§2.4), **não aplicada**; lógica já pronta (§9) |
| **D3** | **O gate antigo `respond_all = false + assigned_to` é revisto** pra não deixar o robô mudo depois de "Devolver" | §9 (ajuste exato, implementado com degradação) |
| **D4** | ~~A atribuição automática NÃO é implementada ainda~~ — **superada**: o revisor liberou a fatia 2c nesta rodada (código pronto atrás da degradação) | fatia 2c / §10 |

*Veto do operador:* qualquer uma das quatro pode ser vetada na sessão §8-b; D1/D2 são as de produto (D3 é correção de um efeito colateral, D4 era só sequenciamento). Vetar D1 = não aplicar a 4ª migration (sem a coluna a atribuição automática simplesmente não acontece — nenhum código a desligar).

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

**Degradação:** coluna `assignment_origin` ausente => `conv.assignment_origin` é `undefined` => origem "desconhecida" => o gate é **idêntico ao de antes em todas as combinações** (teste exaustivo `botAssignment.test.ts`).

**Devolução (`end_human_handover`):** além de zerar `handover_at`/`bot_flow_state`, lê a conversa (`select("*")`: coluna ausente vem `undefined`, `assigned_to` segue legível); se a origem é **auto**, desatribui com UPDATE **condicional** (`assignment_origin = 'auto'` e mesmo `assigned_to` — não pisa numa atribuição humana feita no meio). Resposta: `{ ok, cleared, unassigned, botStillMuted }`; `unassigned` só é `true` se o UPDATE **pegou uma linha** (não basta "sem erro" — correção desta rodada: antes, um UPDATE condicional que não casava nada reportava `true`). Erro de SELECT ⇒ nada é desatribuído. **`assign_conversation`** grava `assignment_origin = 'manual'` (ou NULL ao desatribuir) em UPDATE **separado**, pra coluna ausente não quebrar a atribuição.

### Caso residual — RESOLVIDO pela opção 1 (aviso honesto)

**Atribuição manual + `respond_all = false` + "Devolver ao robô"**: a atribuição é humana, a devolução (D2) não a desfaz, e o gate (por desenho antigo) segue calando o robô — o botão "Devolver" **não faz o robô voltar** nesse workspace. Opções que estavam em aberto:

1. **Avisar** na devolução (a Pergunta 5 do §6) ← **implementada**: o servidor resolve o `respond_all` efetivo (a MESMA regra do robô, `effectiveRespondAll`) e devolve `botStillMuted`; a UI mostra um **aviso** (não o toast de sucesso) explicando que o robô continua em silêncio. Não muda comportamento — só o torna honesto.
2. **Desatribuir também a manual** quando `respond_all = false` — resolveria de vez, mas **contradiz D2** ("somente automática"); só com decisão explícita do operador. *Não implementada.*
3. **Manter** sem aviso. *Descartada pela (1).*

**Ressalva importante (achada ao implementar a UI):** o painel de contato **não tem controle de atribuição** — carrega membros e recebe `onAssign`, mas nada disso é renderizado (§10.6). Por isso o aviso só orienta o que a tela realmente oferece (mudar o gatilho para "Qualquer Conversa (Irrestrito)"), e não "remova a atribuição".

## 10. Atribuição automática — como funciona (implementada, atrás da degradação)

### 10.1 Quando
No instante em que `handover_at` é gravado com sucesso. Todos os gatilhos passam por `enterHumanHandover` (única função que escreve o estado de entrega): os 3 da R4 (palavra-chave, opção de menu, menu esgotado/nó de fallback) e o destino **handover** da R8 (nó "message"). Se `handover_at` não foi gravado (coluna ausente), **não há handover e não há atribuição**.

### 10.2 Quem
`pickLastHumanResponder`: a mensagem de **saída** com `sender_id` mais recente (`created_at`). Ignorados: o robô (`sendBotText` não grava `sender_id`), mensagens digitadas no celular (`fromMe` via webhook, sem autor), mensagens de antes do pré-requisito (sem autor) e entradas do cliente. Mensagem de envio **com erro** ainda conta (o atendente tentou responder). **Sem janela de validade** (Pergunta 2 do §6, mantida a proposta de partida).

Salvaguardas, nesta ordem (qualquer falha ⇒ só entrega, sem dono):

| Situação | Resultado |
|---|---|
| A conversa **já tem dono** (qualquer origem) | não pisa; nem lê mensagens |
| Ninguém (com autor) respondeu | fica **não atribuída** → badge "Aguardando humano" |
| O último a responder **não é mais elegível** (saiu do workspace ou virou `viewer`, §3.5) | não atribui a um fantasma |
| Leitura/checagem/escrita falha (rede, coluna ausente…) | `console.warn` e segue; o handover já está persistido |
| O UPDATE não pegou linha (alguém atribuiu no meio) | `lost-race`: não pisa |

### 10.3 Como grava — UM update, origem junto
`UPDATE whatsapp_conversations SET assigned_to, assignment_origin = 'auto', updated_at WHERE id AND workspace_id AND assigned_to IS NULL`. **Regra de ouro:** nunca existir atribuição sem a origem marcada (sem ela a devolução não sabe desfazer e o robô ficaria mudo). Dois UPDATEs deixariam uma janela com isso possível; um só é **atômico**: coluna `assignment_origin` ausente ⇒ o PostgREST recusa o UPDATE inteiro ⇒ nada é gravado ⇒ a conversa só é entregue.

### 10.4 Devolução e UI
Três desfechos, três mensagens (a UI lê `unassigned`/`botStillMuted`; servidor antigo sem os campos ⇒ comportamento de antes):

| Estado ao devolver | Servidor | UI |
|---|---|---|
| Atribuição **automática** | desatribui | sucesso: "Robô de volta e conversa sem atribuição…" |
| Atribuição **manual** + gatilho "Apenas Conversas Novas (Triagem)" | nada desfeito; `botStillMuted: true` | **aviso**: "Devolvida, mas o robô continua em silêncio…" + como resolver |
| Sem atribuição, ou manual com "Qualquer Conversa (Irrestrito)" | nada a fazer | sucesso de sempre |

`botStillMuted` é o gate **real** do robô (`shouldBotYieldToAssignee`) aplicado ao estado de depois da devolução, com o `respond_all` efetivo de `whatsapp_bot_settings` — a UI não adivinha, repete o que o robô vai fazer.

### 10.5 Lista de conversas
Entregue e **sem atendente** ⇒ badge preenchido **"Aguardando humano"** (âmbar sólido); entregue **com** atendente ⇒ o "Humano" discreto de antes. **Sem aba/filtro novo:** o `TabsList` da lista já tem 5 colunas num painel de 340 px (≈61 px por aba, texto de 11 px, com contadores em "Não lidas"/"Atrasadas"); uma 6ª aba ("Aguardando humano" ou mesmo "Humano") faria "Resolvidas"/"Atrasadas" truncarem — não cabe limpo, então ficou só o badge na linha.

### 10.6 Achado da rodada anterior — RESOLVIDO pela rodada G101/G102 (§11)
*(texto original, para registro)*
1. **Não existe controle de atribuição na UI.** `WhatsAppContactPanel` declara `members`, `assigned` e `onAssign`, mas nunca renderiza nada com eles (`setAssigned` nunca é chamado; o histórico mostra que não foi removido — nunca existiu). `assign_conversation` só é alcançável por chamada direta. Consequência: atribuição **manual** (`'manual'`) praticamente não ocorre hoje, o que torna o caso residual do §9 raro — **mas** também significa que ninguém consegue "assumir" nem reatribuir uma conversa pela tela.
2. **"Aguardando humano" não some quando o humano responde.** Atribuição automática olha o histórico **no instante do handover**; uma conversa entregue antes de qualquer resposta humana fica sem dono, e responder nela **não a atribui** (pela decisão D1 só o handover atribui). Sem o controle de (1), o badge só some com "Devolver ao robô". Registrados no catálogo como **G101** (controle de atribuição no painel) e **G102** (assumir ao responder), ambos **ABERTOS**. Próximo passo previsto: "assumir ao responder" (primeira resposta humana numa conversa entregue e sem dono a atribui àquele atendente) e/ou o controle de atribuição no painel.

## 11. G101 + G102 — controle de atribuição no painel e "assumir ao responder"

### 11.1 G101 — o controle (painel de contato)
- **O que é.** Seção **"Atendente"** em `WhatsAppContactPanel`: o rótulo de quem é o dono ("Atribuída a Ana Lima (automática)" / "Sem atendente atribuído"), um **Select** de atendentes e **"Remover atribuição"**. O Select chama `assign_conversation` (origem `'manual'`).
- **Quem pode ser escolhido.** Membros do workspace com papel **owner/admin/member** (§3.5). A regra é **uma só**: `isAssignableRole` (`_shared/botAssignment.ts`) é **importada** pela UI e usada pelo servidor em `assign_conversation`, no claim e no handover — não há cópia que possa divergir. `viewer` não aparece no Select, mas o **nome** dele ainda resolve se for o dono atual.
- **Gate de papel.** O existente: `useWorkspaceRole().isAdmin` (owner/admin — espelha `is_workspace_admin`, o mesmo do Robô IA). **Não-admin só lê** (o rótulo, sem Select nem "Remover atribuição"). *Leitura do pedido ("Não-admin: respeitar o gate de papel existente"):* o gate existente é de administrador; membros comuns não atribuem pela tela, mas **ganham a conversa ao responder** (G102). ⚠ É um gate **de UI**, como os demais: o servidor continua aceitando `assign_conversation` de qualquer membro — se o operador quiser o gate também no servidor, é uma linha em `whatsapp-instance`.
- **Lista de atendentes vem do servidor (ação nova `list_attendants`).** O navegador **não consegue** montá-la: o embed que o painel tentava (`users:user_id(email, raw_user_meta_data)`) apontava para uma relação que não existe (`workspace_members.user_id` referencia `public.profiles`), nunca era renderizado, e a RLS de `profiles` (no repositório) só deixa ler a **própria** linha. `whatsapp-instance` (service role, depois de verificar que o chamador é membro) lê `workspace_members` + `profiles` **do próprio workspace** e devolve só `id`, `nome` e `papel` — **nunca o e-mail** (sem `display_name` usa a parte local do e-mail). Sem DDL. A leitura antiga de membros do painel saiu (teste-guarda).
- **O servidor passou a conferir o que a UI promete.** `assign_conversation` agora: recusa alvo que não seja membro elegível do workspace (400), **reporta** o erro do UPDATE (500) e conversa inexistente (404) — antes o erro era engolido e a ação respondia `ok` sem gravar, o que, com um controle na tela, faria "Conversa atribuída" mentir.
- **Degradação (coluna `assignment_origin` ausente).** O servidor atribui sem origem (como sempre fez) e responde `originRecorded: false`; a UI **avisa** ("Conversa atribuída, mas a origem não foi registrada… 'Devolver ao robô' não vai desfazê-la") em vez de confirmar como se estivesse tudo registrado. Servidor sem o campo ⇒ não alarma. Com a coluna presente, o painel mostra o que a devolução fará com **esta** atribuição (só com conversa entregue e origem conhecida): *automática* → "Devolver ao robô remove"; *manual* → "não desfaz".
- **Nome no lugar do genérico (G29).** O banner da conversa entregue mostra "Atribuída a **Ana Lima** (automática)" / "Sem atendente atribuído"; o aviso da devolução ("o robô continua em silêncio") diz "atribuída a **Ana Lima**" — quem não está na lista (saiu do workspace) vira "um atendente", sem inventar nome. O aviso agora também aponta a saída que existe ("um administrador pode remover a atribuição (painel de contato) ou mudar o gatilho").

### 11.2 G102 — assumir ao responder (`whatsapp-instance`)
- **Gatilho.** Os 4 pontos de saída humanos (`send`, `send_media`, 2× `forward_message` — neste último a conversa de **destino**): logo depois do insert da mensagem.
- **Condições (todas):** o envio **saiu** (`send.ok`); a conversa está **entregue** (`handover_at`); está **sem dono**; o remetente tem papel que atende (`viewer` pode responder mas não vira dono). Qualquer uma falhando ⇒ nada acontece. **Envio que falhou não assume:** "Aguardando humano" significa "ninguém respondeu ao cliente", e uma mensagem que não chegou não responde nada (por isso difere do §10.2, onde quem *tentou* responder conta como "último atendente").
- **Como grava.** O mesmo UPDATE **único e atômico** da §10.3 — `assigned_to` + `assignment_origin = 'auto'` — condicional a `assigned_to IS NULL` **e** `handover_at IS NOT NULL` (este último fecha a corrida com uma devolução simultânea). Origem **`'auto'`**: é uma assunção implícita, **a devolução ao robô a desfaz**.
- **Degradação idêntica à do handover.** Coluna `assignment_origin` ausente ⇒ UPDATE recusado inteiro ⇒ **nada atribuído** (`warn`), a resposta do atendente segue intacta. `handover_at` ausente ⇒ a linha em memória não está "entregue" ⇒ nem tenta. O `forward_message` lê a conversa de destino com `select("*")` (coluna nomeada ausente derrubaria o encaminhamento).
- **Efeito na lista.** O UPDATE dispara o realtime da conversa: o badge **"Aguardando humano"** vira "Humano" ao responder. **Nunca pisa** em atribuição existente (qualquer origem).

### 11.3 O que continua em aberto
- A **4ª migration** (`assignment_origin`) segue DRAFT: sem ela o G102 e a atribuição do handover **não agem** (só o G101 manual, sem origem, e os avisos).
- **Gate de servidor** em `assign_conversation` (hoje qualquer membro pode chamar; a UI limita a admin).

**Esta proposta não altera runtime por si;** o código das fatias 1–3 está em `main` atrás da degradação e as da §11 aguardam merge. Sem a 4ª migration os efeitos visíveis são o badge, as confirmações/avisos da devolução e o controle manual de atribuição.
