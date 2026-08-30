# Etapa 9 · Item 4 — Construtor de fluxo scriptado — R1 (fundação de dados)

> **Nada aplicado em runtime, UI nem banco.** Esta rodada só assenta a
> fundação de dados pra uma decisão de produto já tomada pelo operador —
> "Opção B-Kora": o fluxo do bot de WhatsApp deixa de ser uma sequência
> fixa (`trigger → ai → send → handover`, o que existe hoje em
> `WhatsAppBotConfig.tsx`) e passa a ser uma **árvore 100% montável pelo
> usuário**. O nó novo desta rodada (`menu`) é o primeiro tipo de nó da
> árvore que referencia outro nó explicitamente (`nextNodeId`) — os 4 nós
> existentes hoje não têm esse conceito, a ordem deles é só a posição no
> array `nodes`.

## Decisão do operador (contexto, não reaberta nesta rodada)

1. **Árvore 100% montável pelo usuário** — cada opção de um nó `menu` aponta
   pra outro nó qualquer da árvore via `nextNodeId` (string livre, não um
   enum fixo — o próprio usuário decide a topologia, mesmo padrão de
   `PipelineStage.id` no CRM/`usePipelines.ts`, que também é string livre
   pra suportar pipelines customizados).
2. **Fallback default = re-prompt** — resposta inválida reapresenta o
   mesmo menu ("responda com uma opção válida"), nunca pula direto pra
   transbordo. Um limite de tentativas **configurável** decide o que
   acontece depois de esgotado: reprompt indefinido OU pular pra outro nó
   (`fallbackNodeId`, tipicamente mas não necessariamente um nó
   `handover`).
3. **IA é nó OPCIONAL, nunca obrigatório** — o nó `menu` é uma alternativa
   ao nó `ai` na árvore (mensagem scriptada, zero custo de IA, resposta
   determinística), nunca uma dependência dele. Uma árvore inteira sem
   nenhum nó `ai` precisa continuar sendo um fluxo válido.

## Escopo desta rodada (R1) — só fundação, zero comportamento novo

1. Tipo `MenuWorkflowNode` na união discriminada `WorkflowNode`
   (`src/components/whatsapp/WhatsAppBotConfig.tsx`).
2. Draft de migration pra `whatsapp_conversations.bot_flow_state` (este
   doc, §2) — **NÃO aplicado**.
3. Testes de tipo/estrutura (`WhatsAppBotConfig.menu-node-types.test.ts`)
   — zero teste de comportamento de UI/runtime, porque nada disso existe
   ainda.

**Explicitamente FORA de escopo desta rodada** (fatias futuras, não
numeradas/agendadas aqui): construtor visual da árvore (drag-and-drop de
nós, edição de opções na UI), execução real do fluxo scriptado (o "motor"
que lê `bot_flow_state`, mostra o menu, conta tentativas, decide
transbordo), migração do array linear atual (`nodes` do componente) pra
uma árvore de verdade com `nextNodeId` em TODOS os tipos de nó (hoje só
`menu` tem esse conceito — os 4 nós existentes continuam implícitos por
posição no array até uma rodada dedicada tratar disso).

---

## 1. Tipo de nó "menu" — `WorkflowNode` (`WhatsAppBotConfig.tsx`)

Os 4 tipos existentes (`TriggerWorkflowNode`/`AiWorkflowNode`/
`SendWorkflowNode`/`HandoverWorkflowNode`) e a união `WorkflowNode` eram
module-private (sem `export`) — promovidos a `export` nesta rodada (mudança
de VISIBILIDADE apenas, zero mudança de forma ou de runtime) pra permitir
os testes de tipo/estrutura importá-los, e pra qualquer fatia futura
(motor de execução, mapper de `bot_flow_state`) reusar sem duplicar.

```ts
export interface MenuWorkflowNodeOption {
  numero: number;
  rotulo: string;
  /** Id de outro nó da árvore (`WorkflowNode.id`) — string livre, montada pelo usuário. */
  nextNodeId: string;
}

export interface MenuWorkflowNodeFallback {
  /** Quantas respostas inválidas em sequência antes de aplicar `acao`. */
  maxTentativas: number;
  /** "reprompt" reapresenta o mesmo menu (default do produto); "node" pula pra `fallbackNodeId`. */
  acao: "reprompt" | "node";
  /** Obrigatório quando `acao === "node"` — não validado em tipo, validar em runtime na fatia de execução. */
  fallbackNodeId?: string;
}

export interface MenuWorkflowNode extends WorkflowNodeBase {
  type: "menu";
  properties: {
    mensagem: string;
    opcoes: MenuWorkflowNodeOption[];
    fallback: MenuWorkflowNodeFallback;
  };
}

export type WorkflowNode =
  | TriggerWorkflowNode | AiWorkflowNode | SendWorkflowNode
  | HandoverWorkflowNode | MenuWorkflowNode;
```

**Por que `fallbackNodeId` é opcional em vez de a união se dividir em
`"reprompt" | { acao: "node"; fallbackNodeId: string }`:** a união
discriminada aninhada deixaria o tipo mais preciso (`fallbackNodeId`
obrigatório quando `acao === "node"`), mas o resto do arquivo já trata
`properties` como um objeto plano por tipo de nó (`updateNodeProperty`
faz spread genérico em `properties`, não em sub-uniões) — seguir esse
molde evita introduzir uma forma nova só pra este nó. Validação de
"`fallbackNodeId` presente quando `acao === "node"`" fica pra quando a
fatia de execução (motor do fluxo) existir e puder validar em runtime,
com uma mensagem de erro útil pro usuário que montou a árvore — mais
seguro que um erro de compilação genérico.

**Confirmado, por leitura do arquivo inteiro, que a adição não quebra
nada:** não existe nenhum `switch` exaustivo sobre `WorkflowNode["type"]`
nem checagem `never` — todo lugar que distingue os 4 tipos hoje usa
`if`/`===` (`node.type === "trigger"`, etc., linhas 478-543/589-780 antes
desta rodada). Adicionar um 5º membro à união não força nenhum desses
pontos a lidar com ele — e como nenhum nó `menu` é adicionado ao array
inicial `nodes` nem a nenhum outro estado, não há NENHUM caminho de
código nesta rodada que sequer produza um valor desse novo tipo em
runtime. `npm run gates`: tsc 0 erros confirma isso estruturalmente, não
só por leitura.

---

## 2. Draft — `whatsapp_conversations.bot_flow_state` (coluna nova, nullable)

**PROPOSTA — NÃO aplicada pelo Code.** Code não roda DDL contra produção
(protocolo §0/§6/§8-b) — aplicação é sempre do operador, via Supabase
CLI/dashboard, na sessão §8-b. Nome de arquivo sugerido, quando promovido a
migration real: `<timestamp>_etapa9_bot_fluxo_scriptado_bot_flow_state.sql`.

**Verificação prévia obrigatória do operador** (a coluna não existe hoje —
confirmado por leitura direta de `src/integrations/supabase/types.ts:1593-1611`,
o `Row` de `whatsapp_conversations` gerado a partir do schema real, e de
todas as migrations que tocam essa tabela — nenhuma cria essa coluna):

```sql
-- Confirma que a coluna ainda não existe, antes de tentar criá-la —
-- evita erro de coluna duplicada numa reaplicação manual e serve de
-- checagem de sanidade contra o schema real (não só contra o types.ts
-- gerado, que pode estar defasado — classe G10 do catálogo).
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'whatsapp_conversations'
  AND column_name = 'bot_flow_state';
-- Esperado: 0 linhas.
```

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

**Por que nenhum `CHECK`/schema JSON validado nesta rodada:** mesma
disciplina que os drafts de CHECK de vocabulário desta Etapa já seguem
(`etapa-5-flip-clientes-rodada3-check-drafts.md`/`etapa-5-flip-crm-
rodada3-check-drafts.md`) — travar uma forma de dado antes de o produtor
real existir é prematuro; se a forma do jsonb mudar durante o desenho do
motor de execução (fatia futura), um CHECK cedo demais só atrapalharia.

**Por que NÃO em `whatsapp_bot_settings.flow_data`** (onde a árvore de nós
em si é salva) **em vez de uma coluna nova em `whatsapp_conversations`:**
são dois dados de natureza diferente — `flow_data` é a DEFINIÇÃO da árvore
(1 por workspace, editada pelo operador do bot), `bot_flow_state` é o
PROGRESSO de uma conversa individual dentro dessa árvore (1 por conversa,
atualizado a cada mensagem recebida). Misturar os dois na mesma coluna
obrigaria reescrever a árvore inteira a cada mensagem só pra atualizar
onde uma conversa está — mesmo raciocínio de separar definição de estado,
já aplicado em todo o resto da casa (ex.: `client_technical_sheets` é a
definição, não guarda "em que aba o usuário está agora").

---

## 3. Testes de tipo/estrutura

`src/components/whatsapp/__tests__/WhatsAppBotConfig.menu-node-types.test.ts`
(novo, 5 testes) — sem nenhum teste de runtime/UI (nada disso existe
ainda). Prova, por COMPILAÇÃO (não por asserção em runtime — `import type`
é apagado pelo transform do Vite/SWC sem checar contra o export real, só
`tsc -p tsconfig.app.json --noEmit` pega esse tipo de erro; confirmado na
prova fail→fix→pass abaixo) e por estrutura:

1. `MenuWorkflowNode` compila como membro legítimo da união `WorkflowNode`.
2. Uma `WorkflowNode[]` aceita nós `menu` misturados com os 4 tipos
   existentes (útil pro dia em que a árvore de verdade existir).
3. `opcoes[]` carrega `{numero, rotulo, nextNodeId}` — `nextNodeId` é
   string livre, não amarrada a nenhum enum de tipo de nó.
4. Fallback default (`acao: "reprompt"`) não exige `fallbackNodeId`.
5. Fallback `"node"` aceita `fallbackNodeId` apontando pra qualquer nó da
   árvore, não só `handover` — a árvore não impõe destino fixo.

**Prova fail→fix→pass por patch (método G65/§14-A, sem `git stash`) — com
uma nuance registrada por precisão:** `git diff` do arquivo de
implementação → `git checkout --` (reverte só `WhatsAppBotConfig.tsx`,
teste fica) → `npx vitest run` sozinho **passou** mesmo com o tipo
revertido (5/5 verdes) — `import type` é erasado pelo transform do
Vite/SWC sem verificar contra o módulo real, então um teste puramente de
tipo não falha via `vitest run` quando o tipo desaparece. O gate real pra
essa classe de mudança é `tsc -p tsconfig.app.json --noEmit`, que reportou
5 erros (`TS2459`/`TS2305`, "has no exported member") contra o código
revertido, confirmando a dependência real. `git apply` do mesmo patch →
`tsc` 0 erros + `vitest run` 5/5 (e 12/12 no diretório inteiro de testes
de `WhatsAppBotConfig`, sem regressão nos 3 arquivos de teste
pré-existentes).

---

## Referências

- `src/components/whatsapp/WhatsAppBotConfig.tsx` — componente único onde
  vive hoje toda a definição de `WorkflowNode` e o array `nodes`.
- `supabase/migrations/20260602004057_36086c38-89a2-409b-abae-bcd09d297fd1.sql`
  — `CREATE TABLE public.whatsapp_conversations` original.
- `supabase/migrations/20260602040000_whatsapp_v2.sql` — precedente de
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` na mesma tabela (`assigned_to`).
- `docs/qa/etapa-5-flip-clientes-rodada3-check-drafts.md`/`etapa-5-flip-crm-
  rodada3-check-drafts.md` — precedente de formato de draft (gate duplo
  Code-não-aplica + SELECT de verificação prévia no corpo da migration),
  adaptado aqui pra um `ADD COLUMN` em vez de um `CHECK`.
- `src/hooks/usePipelines.ts` (`newStageId`) — precedente do padrão "id de
  nó/estágio é string livre, montada pelo usuário", mesmo raciocínio
  aplicado a `nextNodeId`.

**PARADO aqui — tipo exportado + testes de tipo/estrutura, zero mudança de
runtime/UI, zero DDL aplicado. §18.**
