# Etapa 9 — item 4: Construtor de fluxo SEM IA — Fase A (desenho, doc-only)

> **Zero código tocado nesta rodada** — só desenho e doc, mesmo molde de profundidade de
> `etapa-9-item2-cerebro-fase-a.md`/`etapa-9-item3-base-conhecimento-fase-a.md`, adaptado de
> "desenho condicionado a perguntas obrigatórias" para "desenho condicionado a um insumo de
> produto incompleto" (roadmap §6, item 4: menus fixos + transbordo lojas/atendentes/humano,
> insumo mais próximo é o UX3, que **não é** uma descrição pronta de "menus fixos"). Este
> documento é essa Fase A — e o último item da Etapa 9 sem Fase A própria.

**Branch:** `etapa-9-item4-construtor-sem-ia-fase-a`, criada a partir do tip real de
`origin/main` em `26fb2e5` (confirmado por `git fetch origin` + `git log origin/main -1` antes
de abrir a branch — bate com o commit mais recente do momento, item 3 — base de conhecimento
Fase A, da Lane E).

**Insumos diretos:**
- `docs/architecture/kora-roadmap.md` §6, item 4 (linhas 294-300) — a definição do item, literal:
  *"Construtor de fluxo SEM IA — menus fixos, transbordo (lojas/atendentes/humano)"*. O próprio
  roadmap já registra a ressalva que este documento respeita: o insumo de produto é o **UX3**
  (`kora-ux-produto.md`), a nota de "modos de atendimento" do `BotRulesPanel.tsx` removido no
  **G21** — não é um protótipo pronto (o componente era 100% mockado, sem backend), é uma ideia
  de UX preservada antes da remoção do código morto. UX3 fala em "modos" pré-definidos com
  guardrails e regras de elegibilidade/transferência em accordion — **não descreve literalmente
  "menus fixos"**, é só o insumo mais próximo já catalogado (ver §4 abaixo para o que dele
  realmente serve).
- `docs/architecture/etapa-9-item2-cerebro-fase-a.md` e `etapa-9-item3-base-conhecimento-fase-a.md`
  — precedentes de profundidade/estrutura desta série de Fases A, e fonte dos padrões reaproveitados
  aqui: convenção de nome de flag (`kora.<domain>.<feature>.<enabled|v1>`), RLS `is_workspace_member`,
  e o hábito de citar arquivo:linha em vez de resumir de memória.
- `src/components/whatsapp/WhatsAppBotConfig.tsx` — o construtor de fluxo visual **que já existe em
  produção hoje**, ponto de partida obrigatório do §1 (não dá para desenhar "sem IA" sem primeiro
  entender exatamente o que "com IA" já construiu, e quanto disso é reaproveitável).
- `supabase/functions/whatsapp-bot-reply/index.ts` e `supabase/functions/_shared/botFlowTemplate.ts`
  — o runtime que de fato interpreta `flow_data` numa mensagem real; sem ler isto, qualquer
  afirmação sobre "o que é acoplado à IA" seria suposição sobre a UI, não sobre o comportamento
  real (mesma disciplina que os itens 2/3 já aplicaram a `whatsapp-bot-reply`).

---

## 1. Estado atual do fluxo do robô — o que já existe e quanto é reaproveitável

### 1.1 O que `WhatsAppBotConfig.tsx` representa: um editor de pipeline linear de 4 nós, não uma árvore

Tipo central (`WhatsAppBotConfig.tsx:21-56`): `WorkflowNode` é uma união de 4 tipos fixos, sempre
nesta ordem, sem ramificação —

| Nó | Linha | O que guarda (`properties`) | Editável na UI? |
|---|---|---|---|
| `trigger` ("Gatilho de Entrada") | `:27-30` | `respondAll: boolean` | Sim — 2 cards ("Irrestrito" vs "Apenas Novos", `:526-565`) |
| `ai` ("Agente IA") | `:32-44` | `instruction`, `model`, `provider`, chaves de credencial (Gemini/Vertex/Anthropic) | Sim — textarea de prompt + 2 selects (`:568-691`) |
| `send` ("Enviar Mensagem") | `:46-49` | `template: string` (default `"{{reply}}"`) | Sim — 1 input de texto (`:693-714`) |
| `handover` ("Transbordo Humano") | `:51-54` | `assignTo: string` (nunca lido em nenhum lugar do runtime — campo morto, ver §1.3) | Só liga/desliga (Switch), sem UI própria de configuração além do texto explicativo fixo (`:716-730`) |

O estado nasce hardcoded (`:67-105`, 4 nós fixos, nesta ordem) e é persistido cru como array JSON
em `whatsapp_bot_settings.flow_data` (JSONB) — `handleSaveSettings` grava `nodes as unknown as
Json` (`:257`) sem nenhuma validação de shape antes de salvar. **Não existe conceito de nó
customizado, nó novo, ou ordem alternativa na UI** — o "canvas visual" (`:404-515`) é uma grade
fixa de 4 cards com uma seta entre cada par consecutivo (`:456-464`), não um editor de grafo real
(sem drag-and-drop, sem adicionar/remover nó, sem reconectar). "Construtor de fluxo visual" é o
nome do produto; o que existe hoje é, mecanicamente, **um formulário de 4 seções com liga/desliga
por seção**, não um construtor de árvore de decisão.

### 1.2 Como o runtime realmente interpreta isso — a mesma pergunta que os itens 2/3 fizeram a `whatsapp-bot-reply`

Leitura de `flow_data` acontece 2 vezes: `handleSimulateMessage` manda `flowData: nodes` cru pro
modo teste (`WhatsAppBotConfig.tsx:320`); no caminho real (mensagem de WhatsApp de verdade), é
`whatsapp-bot-reply/index.ts:401-410` que parseia `bot.flow_data`. A partir daí:

1. **`trigger` — gate de elegibilidade, 100% sem IA** (`:412`, `:416-422`): `respondAll` decide só
   se o bot responde ou pula (`conv.assigned_to` já setado + `respondAll=false` → `skip`, sem
   chamar nada). Mecanismo puro de leitura de estado, zero acoplamento a IA.
2. **Se `flow_data` existe mas não tem nó `ai` habilitado → SILÊNCIO TOTAL, não um fallback**
   (`:424-428`, `hasFlowData && !aiNode` → `return { skipped: "AI node disabled in visual flow" }`).
   **Achado central para este item**: desligar o nó de IA hoje não troca de canal (IA → menu) —
   simplesmente não responde nada. Não existe, em lugar nenhum do runtime, um caminho de resposta
   que não passe pelo nó `ai`.
3. **`handover` — checado ANTES da IA, e é genuinamente sem IA** (`:456-494`): compara a última
   mensagem inbound contra uma lista fixa de 7 palavras-chave (`"atendente"`, `"humano"`,
   `"pessoa"`, `"falar com"`, `"suporte"`, `"ajuda"`, `"atendimento"`, substring case-insensitive,
   `:459-460`) — se bater, manda um texto FIXO hardcoded (`:461`) e retorna, **sem nunca chamar
   nenhum provedor de IA**. É o único ponto do pipeline hoje que já é, na prática, "sem IA" — mas é
   keyword-match cru, não um menu.
   - **Achado adicional, não documentado em lugar nenhum antes**: esse branch **não atribui a
     conversa a ninguém** — nunca escreve `conv.assigned_to`. O mecanismo real de atribuição
     (`whatsapp-instance/index.ts:853-862`, action `assign_conversation`, chamado por
     `WhatsApp.tsx:405-414`, `handleAssign`) é **100% manual, disparado só pelo operador na tela de
     Inbox** — o nó "Transbordo Humano" e a atribuição real de conversa são dois mecanismos que
     nunca se tocam. Na prática: o "transbordo humano" de hoje é uma mensagem de cortesia; o bot
     continua respondendo à próxima mensagem do mesmo contato a menos que `respondAll` já esteja
     `false` E alguém atribua a conversa manualmente depois.
4. **`send` — template aplicado sobre a saída da IA, nunca gerado sem ela** (`_shared/botFlowTemplate.ts`,
   `applySendTemplate`): se o template não contém `{{reply}}`, o texto é devolvido **verbatim**
   (mensagem estática) — tecnicamente já é possível hoje configurar uma resposta fixa por esse
   campo. Mas isso não é "sem IA" de verdade: `reply` (a variável substituída) só existe depois de
   uma chamada completa a um provedor de IA rodar (`index.ts:496-712`, o branch `if (aiNode)`) — o
   texto estático descartaria o resultado, mas o **custo/latência da chamada de IA já foi pago**
   antes de chegar lá. E o passo 2 acima já bloqueia esse caminho por completo se `aiNode` estiver
   desligado — então hoje não existe NENHUMA combinação de configuração que produza uma resposta
   fixa sem, ao mesmo tempo, ter um nó de IA habilitado e funcional.

### 1.3 Veredito de reaproveitamento

| Peça | Reaproveitável para fluxo determinístico? | Por quê |
|---|---|---|
| Persistência (`whatsapp_bot_settings.flow_data`, JSONB, sem schema rígido) | **Sim, sem mudança de coluna** | Já aceita qualquer array de nós; um novo `type` de nó cabe sem migration (ver §5) |
| `trigger` (gate `respondAll`) | **Sim, 100%** | Zero acoplamento a IA — decide só SE o bot roda, não COMO |
| `handover` (conceito de nó disparado por condição no texto) | **Parcialmente — a FORMA serve, o MECANISMO não** | A ideia "casar a mensagem do cliente contra um critério e desviar" é exatamente o que um menu numerado precisa, mas hoje é substring-match livre sobre texto qualquer, não escolha de opção 1-9 num menu — e o campo `assignTo` já existe na UI e nunca foi ligado a nada real (§1.2, achado adicional) |
| `send` (template com placeholder) | **Sim, como MECANISMO — mas precisa parar de depender de `reply`** | `applySendTemplate` já sabe devolver texto estático; falta só um caminho de execução que a alcance sem passar pelo nó `ai` obrigatório |
| `ai` (geração de texto livre) | **Não é reaproveitável para o modo sem-IA — é exatamente o que ele substitui** | É o único nó hoje que "decide o que responder"; um fluxo de menus fixos precisa de uma peça equivalente que decida por ÁRVORE, não por geração |
| Pipeline como um todo (trigger→ai→send→handover, linear, 4 nós fixos) | **Não** | É uma sequência fixa, não uma árvore — não existe nó de "pergunta com opções" nem de "ramificar conforme a resposta". Construir menus fixos exige um novo modelo de nó (ou uma estrutura paralela), não apenas religar os 4 nós existentes |

**Resumo honesto**: a infraestrutura de *persistência e gate de elegibilidade* é reaproveitável
quase de graça; a *lógica de decisão* (o que hoje é 100% "gerar com IA") precisa ser construída do
zero, porque hoje não existe nenhum nó cuja função seja "ramificar por escolha do usuário" — só
"gerar" (ai) e "casar substring solta" (handover, e mesmo assim sem consequência real de
atribuição).

---

## 2. O modelo do construtor — menus fixos, árvore de decisão, e os 3 transbordos

### 2.1 Menus fixos: opções numeradas, não botões — decisão já forçada pela infraestrutura de envio

Busca exaustiva por `send/button`, `interactive`, `quick_reply`, `buttonList`, `listMessage` em
`supabase/functions/` — **zero resultado**. Todo envio de mensagem no código hoje, sem exceção,
usa `POST {uazBase}/send/text` (`whatsapp-bot-reply/index.ts:465-469` no handover, `:726-730` na
resposta normal) — texto puro, nunca um payload de botão/lista interativa do WhatsApp. Construir
suporte a botões seria infraestrutura nova (endpoint diferente da uazapi, se ela suportar — não
verificado nesta Fase A, fora de escopo confirmar capacidade de terceiro), não um ajuste do que já
existe.

**Conclusão de design**: menus fixos nesta primeira fatia são necessariamente **opções numeradas em
texto** (ex.: `"1. Vendas\n2. Suporte\n3. Financeiro — digite o número da opção"`), com o
reconhecimento da resposta do cliente sendo *"a mensagem inbound é exatamente (ou começa com) um
dos números/rótulos esperados"* — mesmo tipo de comparação de string que o `handover` já faz
hoje (§1.2, item 3), só que contra um conjunto fechado de opções por nó, não uma lista global de
palavras-chave.

### 2.2 Árvore de decisão: um novo tipo de nó, não uma extensão dos 4 existentes

Proposta de modelo (nomes provisórios, a confirmar na Fase B):

```ts
interface MenuWorkflowNode extends WorkflowNodeBase {
  type: "menu";
  properties: {
    prompt: string;                 // texto do menu, ex. "Como posso ajudar?"
    options: Array<{
      label: string;                // "1. Vendas"
      match: string[];              // ["1", "vendas"] — aceita número OU palavra
      nextNodeId: string;           // pra onde vai se essa opção casar
    }>;
    fallbackNodeId?: string;        // se nada casar (repetir menu / transbordo humano / IA)
    noMatchMessage?: string;        // "Não entendi, digite um número de 1 a 3"
  };
}
```

Isso **não** é uma extensão do `handover` — é um nó novo, porque a semântica é diferente: `handover`
hoje é "monitorar continuamente por uma palavra-gatilho em qualquer momento da conversa";
`menu` é "apresentar um conjunto fechado de opções e esperar uma resposta que bata com uma
delas, com um `nextNodeId` explícito por opção" — a peça que falta é exatamente essa capacidade de
**ramificar para nós diferentes conforme a resposta**, que o modelo atual (array linear, sem
referência entre nós) não tem estrutura para expressar. Isso muda a forma do `flow_data`: de
"array de 4 nós fixos, lidos por tipo" para "grafo de nós, alguns dos quais referenciam outros por
id" — uma mudança de modelo de dados real, não incremental.

### 2.3 Os 3 transbordos — o que cada um significa em mecânica, hoje vs. proposto

| Transbordo | Existe hoje? | Mecânica proposta |
|---|---|---|
| **Humano** | Parcialmente (§1.2) — mensagem de cortesia sem atribuição real | Nó de transbordo passa a chamar a MESMA função que a atribuição manual já usa (`whatsapp-instance`, action `assign_conversation` — reaproveitar, não recriar) com um `userId` alvo configurável (ex.: "sempre atribuir ao dono do workspace" ou "deixar não-atribuído mas marcar `respondAll=false` implícito pra essa conversa" — decisão de produto para a Fase B, não resolvida aqui). "O que o bot faz ao devolver": quando um humano marca a conversa como resolvida/desatribui (`handleAssign(id, null)`, já existe), o bot precisa saber retomar — hoje não há sinal nenhum de "retomar fluxo" persistido por conversa; seria um campo novo (ex. `whatsapp_conversations.bot_flow_state`, ver §5) |
| **Atendentes** | Não existe nenhum conceito de "fila de atendentes" ou "atendente específico" hoje — só um `assigned_to UUID` único por conversa (1 pessoa, não uma fila/equipe) | Mecanicamente, é uma variação do transbordo humano: em vez de "atribuir ao operador que configurou", o menu escolhe QUAL atendente/equipe (ex.: opção "Financeiro" → atribui a um `userId` específico daquele departamento). Pressupõe um mapeamento opção→atendente que não existe em nenhuma tabela hoje — provavelmente um campo novo em `MenuWorkflowNode.properties.options[].assignToUserId`, reaproveitando a mesma RPC de atribuição do item acima |
| **Lojas** | **Não existe nenhum conceito de "loja" no schema** — o candidato estrutural mais próximo é `whatsapp_instances` (1 linha por número de WhatsApp conectado, `workspace_id`-scoped, campo `instance_name`), mas **`whatsapp_bot_settings` é escopado só por `workspace_id`, não por `instance_id`** (`src/integrations/supabase/types.ts:1185-1201`) — hoje só existe UM fluxo de bot por workspace inteiro, mesmo que existam várias instâncias/números conectados | "Transbordo pra loja" pressupõe, no mínimo, resolver a pergunta que este documento **não resolve**: transferir a CONVERSA para outra instância/número de WhatsApp (reencaminhar o cliente pra falar com outro número) é uma operação estruturalmente diferente de atribuir a um humano dentro da MESMA conversa/número — pode significar "enviar o contato do outro número" (mensagem de texto com um link/telefone, sem infra nova) ou "migrar a conversa para rodar sob outra instância" (mudança de schema/roteamento, infra nova e não trivial). **Decisão de produto em aberto, não uma escolha técnica que esta Fase A deva tomar** — registrado como pergunta a responder antes da Fase B (ver §5, riscos) |

---

## 3. Relação com o modo IA — opções com trade-offs para o operador decidir

Esta é a decisão de produto central do item, deliberadamente não resolvida aqui — 3 opções
levantadas:

### Opção A — Mutuamente exclusivos por workspace (like-for-like com o modelo atual)

O operador escolhe, num nível (workspace inteiro, ou por instância se §2.3-lojas empurrar nessa
direção): **ou** o robô roda o pipeline atual (trigger→ai→send→handover-por-palavra), **ou** roda
um fluxo de menus fixos, nunca os dois ao mesmo tempo.

- **A favor**: mais simples de implementar (reaproveita o gate binário que `respondAll`/`aiNode`
  já modelam, só troca qual "motor" o `send` final consulta) e mais fácil de explicar ao operador
  ("seu robô é IA OU é menu, escolha um").
- **Contra**: perde exatamente o caso de uso que motivou o UX3 no roadmap — "algo básico
  funcionando rápido" (§4) não precisa ser tudo-ou-nada; um operador pode querer um menu de
  triagem rápido MESMO tendo IA disponível para perguntas abertas.

### Opção B — Híbrido: menu primeiro, IA como fallback dentro do próprio menu

O nó `menu` (§2.2) ganha uma opção especial de "não é nenhuma das anteriores → cai no nó `ai`
existente" via `fallbackNodeId` apontando para o nó de IA. Tecnicamente barato (o `ai` node já
existe e já funciona; só precisa aceitar ser destino de um `nextNodeId`/`fallbackNodeId`, não
sempre o segundo nó fixo do array).

- **A favor**: aproveita 100% do investimento já feito no motor de IA (prompt, provedores,
  simulador) sem descartá-lo; resolve a UX real mais comum ("triagem rápida por número, mas se o
  cliente escrever algo fora do esperado, IA assume") — é o modelo que mais se aproxima do que o
  UX3 descrevia como "modos" (nem todo modo precisa ser 100% excludente).
- **Contra**: reintroduz o acoplamento que o nome do item ("SEM IA") sugere evitar — um workspace
  que configurou um fluxo "sem IA" continuaria, na prática, dependente de credenciais de IA
  configuradas e válidas para o caminho de fallback funcionar. Exige decisão explícita: o fallback
  é obrigatório (sempre existe um `ai` node de segurança) ou opcional (operador pode desligar de
  vez, aceitando que "não entendi" vira a resposta final)?

### Opção C — Por conversa, dinâmico (o robô decide em tempo real)

Uma heurística (não necessariamente IA — poderia ser "se a mensagem bate um dos gatilhos do menu,
usa menu; senão usa IA") decide por MENSAGEM, não por configuração fixa do workspace.

- **A favor**: mais flexível, mais próximo de "o melhor dos dois mundos" sem exigir configuração
  extra do operador.
- **Contra**: é a opção mais cara de construir (não é reaproveitamento de peça existente, é uma
  heurística nova a desenhar e testar) e a mais difícil de o operador prever/depurar ("por que o
  robô respondeu com menu numa conversa e com IA na outra?") — risco de comportamento
  imprevisível maior que A ou B, sem um ganho claro sobre o híbrido B mais simples.

**Recomendação não vinculante desta Fase A**: **Opção B (híbrido com fallback explícito)** é o
melhor equilíbrio entre reaproveitar o que já existe (§1.3) e entregar o valor que o roadmap
associa ao item (menus fixos, mais fácil de configurar que um prompt livre) — mas a decisão final
é do operador/revisor, não desta Fase A.

---

## 4. UX3 — o que realmente serve vs. o que é aspiracional

Releitura de `kora-ux-produto.md` (linhas 90-91), com a mesma honestidade que a nota original já
tinha:

**O que serve (mapeia direto para este desenho):**
- **"Modos de atendimento" como conceito de produto** — a ideia de o operador escolher um "modo"
  em vez de configurar campo a campo mapeia bem para a Opção A/B do §3: "modo IA", "modo Menu",
  "modo Híbrido" são rótulos de produto plausíveis para as opções técnicas já levantadas.
- **Guardrails visíveis** — a nota fala em regras de elegibilidade/transferência mostradas ao
  operador; isso já existe parcialmente hoje (o card de `trigger` já mostra 2 opções com
  descrição, `:526-565`) — um nó `menu` pode seguir o mesmo padrão visual (cards com descrição
  explicando o efeito de cada opção), não uma UI nova do zero.
- **Badges "Seguro"/"Recomendado"** — ideia de UX aplicável à escolha entre as 3 opções do §3 (ex.:
  rotular a Opção B como "Recomendado" na UI de configuração), sem custo de engenharia relevante.

**O que é aspiracional (não descrito com precisão suficiente para desenhar em cima, precisa de
decisão de produto nova, não só leitura do UX3):**
- **Os 5 "modos" específicos citados (desligado/sugestão/assistente/fora do horário/por tag)** —
  não correspondem 1:1 a nada deste item. "Por tag" pressupõe um sistema de tags de conversa
  aplicado a roteamento (não confirmado como requisito aqui); "fora do horário" é uma dimensão
  ortogonal (tempo, não menu/transbordo) que nem chega a ser mencionada no roadmap §6 item 4 — se
  entrar, é decisão nova, não algo que o UX3 já "resolveu".
- **"Menus fixos" como termo literal** — como o próprio roadmap já registra, o UX3 nunca usa essa
  frase; o desenho do §2 é original desta Fase A, inspirado na ideia geral de "modos guiados", não
  uma tradução do que o UX3 descrevia.
- **Qualquer mecanismo de transbordo específico** — UX3 fala em "regras de elegibilidade/
  transferência em accordion" de forma genérica, sem detalhar QUEM recebe a transferência nem
  COMO — os 3 transbordos do roadmap (lojas/atendentes/humano) e sua mecânica (§2.3) são
  desenhados aqui do zero, cruzando com o schema real (`whatsapp_instances`, `assigned_to`), não
  extraídos do UX3.

**Conclusão**: UX3 contribui a CAMADA DE PRODUTO (como apresentar a escolha ao operador — modos,
guardrails visíveis, badges), não a CAMADA TÉCNICA (que nó existe, como ele persiste, como o
runtime decide) — que é 100% desenho novo deste documento, cruzado com o código real de
`WhatsAppBotConfig.tsx`/`whatsapp-bot-reply`.

---

## 5. Modelo de dados esboçado, riscos, casos de homologação, estimativa

### 5.1 Onde o fluxo determinístico vive

**Recomendação: estender `flow_data` existente, não criar tabela própria** — pelos mesmos motivos
que o item 2 (§2.3 daquele doc) decidiu o oposto para o cérebro (ciclo de vida/reaproveitamento
diferentes): aqui, o fluxo determinístico É uma variação do MESMO conceito que `flow_data` já
representa (a jornada de atendimento do robô), só com um novo tipo de nó (`menu`) e uma mudança de
forma (grafo com `nextNodeId`, não array linear fixo). Criar uma tabela paralela obrigaria decidir
"qual dos dois manda" a cada mensagem — problema que o §1.3 do item 3 já registrou como padrão a
evitar (`ai_brain_profiles`/`whatsapp_bot_settings` como domínios SEPARADOS por design; aqui seria
o MESMO domínio duplicado, que é diferente).

**Mudanças de shape propostas (dentro do JSONB existente, sem migration de coluna):**
- Novo `type: "menu"` na união `WorkflowNode` (§2.2).
- Nós ganham a possibilidade de referenciar outro nó por id (`nextNodeId`/`fallbackNodeId`) — hoje
  a ordem é 100% posicional (`nodes[0]`, `nodes[1]`, `nodes[3]` hardcoded em vários pontos do
  runtime, ex. `whatsapp-bot-reply` usa `find(type===...)`, já é por tipo não posição — bom sinal,
  menos refatoração do que pareceria).
- **Campo novo fora do JSONB, sugerido**: `whatsapp_conversations.bot_flow_state` (TEXT/JSONB
  nullable) — "em qual nó da árvore esta conversa está agora" (ex.: cliente respondeu "1", bot
  está esperando a sub-opção do nó "Vendas"). Sem isso, o robô não tem memória de progresso dentro
  de uma árvore de menus — cada mensagem seria tratada como se fosse a primeira, o que quebra
  qualquer árvore com mais de 1 nível.

### 5.2 Riscos nomeados

- **R1 — Mudança de modelo de dados (array linear → grafo) é maior do que parece à primeira
  vista.** Vários pontos do runtime hoje assumem os 4 nós numa ordem/posição implícita
  (`whatsapp-bot-reply/index.ts` usa principalmente busca por `type`, mas o simulador e partes da
  UI ainda indexam por posição, ex. `nodes[1]`/`nodes[3]` em `WhatsAppBotConfig.tsx:224,300,330`)
  — introduzir um nó novo que pode aparecer em qualquer posição, ou múltiplas vezes (vários nós
  `menu` numa árvore), exige uma auditoria própria desses pontos antes da Fase B, não coberta
  aqui.
- **R2 — Falta de `bot_flow_state` (§5.1) é bloqueante para QUALQUER árvore com mais de 1 nível.**
  Sem persistir "onde a conversa está" na árvore, um menu de 2 níveis (ex.: "Vendas" → "Produto A
  ou B?") é estruturalmente impossível de implementar corretamente — cada mensagem nova reiniciaria
  do topo.
- **R3 — Transbordo "lojas" não tem definição de produto suficiente para estimar** (§2.3) —
  pode ser tão simples quanto "enviar uma mensagem de texto com o contato de outro número" (sem
  infra nova) ou tão complexo quanto "migrar o roteamento da conversa para outra instância"
  (infra nova). Este documento **não resolve** qual dos dois é o requisito real — é a pergunta
  mais aberta de todo o item, precisa de decisão do operador antes de qualquer estimativa de
  Fase B incluir esse transbordo específico.
- **R4 — Transbordo "humano"/"atendentes" reaproveita a RPC de atribuição existente, mas herda o
  problema dela: 1 conversa → 1 `assigned_to` (UUID único), não uma fila/equipe.** Se "atendentes"
  no roadmap significa "distribuir entre uma equipe" (não "atribuir a UMA pessoa configurada no
  nó"), falta um conceito de fila/rodízio que não existe hoje em lugar nenhum do schema — mesma
  classe de "pergunta em aberto" do R3, escopo menor.
- **R5 — Custo de IA já pago mesmo com fluxo "sem IA" configurado, se a Opção B (§3) for a
  escolhida e mal implementada.** Se o fallback do menu para IA não for cuidadosamente
  implementado como "só chama IA se realmente cair no fallback", existe risco de repetir o
  padrão já observado em `applySendTemplate` (§1.2, item 4) — chamar o provedor de IA sempre,
  mesmo quando o menu já resolveu a resposta, e descartar o resultado. Requisito de design
  explícito para a Fase B: a chamada de IA só deve acontecer quando o nó de fallback for
  efetivamente alcançado, nunca em paralelo/antecipadamente.
- **R6 — `assignTo` na UI do nó `handover` já existe e nunca foi ligado a nada (§1.2)** — ao
  desenhar o nó `menu`/transbordo novo, cuidado para não repetir o padrão "campo na UI que parece
  funcional mas não tem efeito nenhum no runtime" — qualquer campo novo de atribuição precisa ter
  seu uso real confirmado no mesmo PR que o introduz, não como TODO futuro.

### 5.3 Casos de homologação esboçados

1. **Menu de 1 nível, todas as opções respondidas corretamente** — cliente manda "1", recebe a
   sub-resposta configurada para a opção 1; "2" e "3" idem, cada um pro seu destino.
2. **Menu de 1 nível, resposta não reconhecida** — cliente manda algo fora do esperado; comportamento
   depende da opção do §3 escolhida (repete o menu / cai no fallback de IA / mensagem de erro fixa)
   — este caso PROVA qual das opções foi implementada, não é um único resultado esperado.
3. **Árvore de 2 níveis, estado persistido entre mensagens** — cliente escolhe "Vendas", bot
   pergunta sub-opção, cliente responde na mensagem SEGUINTE (não na mesma) — prova de R2
   (`bot_flow_state` realmente usado, não perdido entre mensagens).
4. **Transbordo humano dispara a atribuição real** — diferente do comportamento atual (§1.2), a
   conversa precisa aparecer atribuída na tela de Inbox depois do transbordo, não só receber uma
   mensagem de cortesia — prova de que R4/o achado do §1.2 foi corrigido, não repetido.
5. **Híbrido (se Opção B for a escolhida): fallback chama IA só quando necessário** — uma conversa
   que resolve tudo por menu nunca deve gerar nenhuma chamada ao provedor de IA (prova de R5);
   uma conversa que cai fora do menu deve gerar exatamente 1 chamada, com o contexto correto.
6. **Fluxo "sem IA" configurado sem nenhuma credencial de IA preenchida** — deve funcionar 100%
   (prova de que o modo realmente não depende de IA quando o operador não configura fallback) —
   este é o caso que testa se o nome do item ("SEM IA") é literalmente verdadeiro na Opção A ou
   na Opção B-sem-fallback-obrigatório.

### 5.4 Estimativa honesta

**Maior que os itens 2/3** — não por causa da mecânica de menu em si (relativamente simples, um
tipo de nó novo com opções), mas por 3 fatores que aqueles itens não tinham:

1. **Mudança de modelo de dados** (array linear → grafo com referências entre nós, R1) — toca
   pontos do runtime hoje indexados por posição, exige auditoria própria antes de estimar com
   confiança.
2. **Estado persistido por conversa** (`bot_flow_state`, R2) — nenhum dos itens 2/3 precisou disso
   (cérebro e base de conhecimento são "sem estado" por mensagem — compõem o prompt e pronto); um
   fluxo determinístico com árvore de mais de 1 nível PRECISA de memória entre mensagens, o que é
   uma peça nova de infraestrutura, não só um campo a mais.
3. **Duas perguntas de produto genuinamente não respondidas** (transbordo "lojas" R3, "atendentes"
   como fila vs. pessoa única R4) — ao contrário dos itens 2/3 (que tinham as 3 perguntas do
   roadmap §6 claras o suficiente pra responder numa Fase A), este item tem partes do próprio
   enunciado ("transbordo lojas") que não têm definição de produto suficiente para nem começar a
   estimar — precisam de decisão antes, não de mais leitura de código.

**Recomendação de sequenciamento**: se aprovado, a Fase B mínima viável é **Opção B (§3),
transbordo humano apontando pra atribuição real (R4 resolvido, sem fila — 1 pessoa configurável),
sem transbordo "lojas"** (adiado até R3 ter uma decisão de produto) — um escopo que já entrega o
valor central do item (menu + fallback IA + transbordo humano de verdade) sem carregar as duas
perguntas mais abertas.

---

## Referências

- `docs/architecture/kora-roadmap.md` §6, item 4 (linhas 294-300) — definição do item e ressalva
  sobre o UX3 não ser descrição pronta.
- `docs/architecture/kora-ux-produto.md` linhas 90-91 — UX3, nota de produto sobre
  `BotRulesPanel.tsx` (removido no G21).
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G21 (resgate/remoção de código morto que
  motivou o registro do UX3); G48 (catalogação do achado do §1.2 — nó "Transbordo Humano" nunca
  atribui a conversa de verdade — como achado ATIVO, fix adiado pra Fase B).
- `docs/architecture/etapa-9-item2-cerebro-fase-a.md` / `etapa-9-item3-base-conhecimento-fase-a.md`
  — precedentes de estrutura/profundidade desta série, fonte da convenção de nome de flag e padrão
  RLS reaproveitados aqui.
- `src/components/whatsapp/WhatsAppBotConfig.tsx` — construtor de fluxo visual atual (base do §1).
- `supabase/functions/whatsapp-bot-reply/index.ts` — runtime que interpreta `flow_data` numa
  mensagem real (base do §1.2, §1.3).
- `supabase/functions/_shared/botFlowTemplate.ts` — `applySendTemplate`/`findEnabledNode`, lógica
  pura do template do nó `send` (citada no achado do §1.2/item 4).
- `supabase/functions/whatsapp-instance/index.ts` (linhas 853-862) — RPC `assign_conversation`,
  mecanismo real (e hoje desconectado do bot) de atribuir uma conversa a um humano.
- `src/pages/WhatsApp.tsx` (linhas 405-414) — `handleAssign`, único chamador da RPC acima, manual,
  disparado pelo operador na tela de Inbox.
- `src/integrations/supabase/types.ts` (linhas 1185-1201, 1579-1597) — schema real de
  `whatsapp_bot_settings` (escopado só por `workspace_id`, sem `instance_id`) e
  `whatsapp_instances` (candidato estrutural mais próximo ao conceito de "loja", linhas 1579-1597).
- `docs/qa/protocolo-homologacao.md` §16-19 — gates de worktree, hash de build e merge condicionado
  seguidos nesta rodada.

---

**PARADO aqui — Fase A encerrada, zero código alterado. Fase B (implementação, condicionada à
decisão do operador sobre a Opção A/B/C do §3 e às perguntas abertas de R3/R4) só com novo "vai"
do revisor.**
