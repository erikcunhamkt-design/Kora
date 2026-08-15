# Etapa 9 — item 2: "Cérebro" do robô — Fase A (desenho, somente leitura)

> Molde: mesma profundidade de `docs/architecture/etapa-5-flip-financeiro-fase-a.md`/`etapa-5-flip-tarefas-fase-a.md`, adaptado de "inventário de flip" para "desenho de feature nova". Zero código tocado nesta rodada — só desenho e doc. Item 1 (provider Anthropic) já está em `main` (`99822b9`), teste ao vivo pendente de API key do operador.

Branch: `etapa-9-item2-cerebro-fase-a`, a partir do tip real de `origin/main` em `c56428a` (merge de `99822b9` — Etapa 9 item 1 — com a auditoria R2 de Tarefas da Lane B).

Insumo direto: `docs/architecture/etapa-9-item1-parser-map.md`, que já localizou a origem única do prompt do bot (`WhatsAppBotConfig.tsx:568-580`, Textarea "Instruções de Personalidade") e marcou esse campo como o encaixe do item 2.

---

## 1. Estado atual do prompt

### 1.1 Como `systemInstruction` chega hoje na chamada do provider

Sempre uma `string` livre, sem formato estruturado, em `supabase/functions/whatsapp-bot-reply/index.ts`. Tipos declarados: `BotFlowNodeProperties.instruction?: string` (linha 13), `BotSettingsRow.system_instruction: string | null` (linha 34), `BotReplyRequestBody.systemInstruction?: string` (linha 85).

Valor-padrão de fallback (linha 312): `"Você é um atendente cordial e prestativo. Responda de forma clara, breve e em português."`

**Modo teste (simulador)**: linha 326 — `systemInstruction = body.systemInstruction || systemInstruction;` — vem direto do body enviado pelo browser, que por sua vez é `aiNode.properties.instruction` do estado do construtor visual (não é dado persistido, é o que está na tela no momento do teste).

**Modo webhook (produção)**: dois caminhos, mutuamente exclusivos:
- **Caminho do fluxo visual** (linhas 496-503, se existe um nó "ai" habilitado em `flow_data`): `systemInstruction = aiNode.properties?.instruction || systemInstruction;`
- **Caminho de fallback "colunas raiz da tabela"** (linhas 504-512, sem nó ai): `systemInstruction = bot.system_instruction || systemInstruction;`

**Sem limite de tamanho em lugar nenhum** — confirmado por grep: sem `maxLength` no Textarea (`WhatsAppBotConfig.tsx:575-580`), coluna `system_instruction` é `TEXT` sem constraint (ver §1.2), sem truncamento/validação server-side em `index.ts`.

**Onde cada provider usa o valor final** (todos leem a MESMA variável `systemInstruction`, já resolvida antes de qualquer branch — ponto central para o §3/§5):

| Provider | Campo no payload | Linha |
|---|---|---|
| `vertex_ai` | `bodyPayload.systemInstruction = { parts: [{ text: systemInstruction }] }` (shape nativo Gemini) | 563-567 |
| `gemini_api_key` | Mesmo shape `systemInstruction: { parts: [...] }` | 611-615 |
| `lovable` | Primeira entrada do array `messages`, `{ role: "system", content: systemInstruction }` | 643 |
| `anthropic` | Campo top-level `system` da requisição (fora do array `messages` — diferença de protocolo já documentada no código, linhas 673-678) | 694 |

### 1.2 O que já existe de configuração por workspace reaproveitável

**`whatsapp_bot_settings`** (tabela real, RLS `is_workspace_member`) — colunas atuais (cross-check com `src/integrations/supabase/types.ts:1185-1230`): `id, workspace_id (sem FK declarada), is_active, system_instruction (TEXT), model_name, created_at, updated_at, provider, gemini_api_key, gcp_project_id, gcp_region, gcp_service_account, flow_data (JSONB), respond_all`. **Não existe nenhuma coluna de "info da empresa"** hoje — o mais próximo é o `system_instruction` livre.

RLS confirmado (`supabase/migrations/20260602153027_...sql:27-35`):
```sql
CREATE POLICY "Workspace members can view bot settings"
    ON public.whatsapp_bot_settings FOR SELECT
    USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Workspace members can modify bot settings"
    ON public.whatsapp_bot_settings FOR ALL
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));
```

**Achado importante — existe um conceito de "empresa", mas é o lugar errado**: `src/hooks/useAppSettings.ts:11-26` define `CompanySettings` (nome, segmento, CNPJ, site, whatsapp, instagram, endereço) — **campos de cadastro/contato, sem tom, sem "o que falar/não falar", sem produtos/serviços**. Persistido em `localStorage` sob `kora.settings.company.v1` (`useAppSettings.ts:80,168`) — **não é por workspace no Supabase, é uma chave única do navegador**. UI em `Configuracoes.tsx` (nav "Empresa", linhas 330-427). **Nunca lido por `whatsapp-bot-reply/index.ts` nem por `WhatsAppBotConfig.tsx`** (confirmado por grep — zero referência cruzada). Não reaproveitável como está: teria que migrar de localStorage pra Supabase antes de virar fonte do cérebro, e mesmo migrado, os campos existentes não cobrem tom/limites/produtos.

**`AISection.tsx`** (`src/components/automacoes/AISection.tsx`) — marketplace de agentes/créditos, simulado (comentários confirmam), **nada de perfil de empresa ou instrução de IA**.

**Conclusão**: nada reaproveitável como fonte de dado — o cérebro precisa de estrutura nova. O que É reaproveitável é o padrão de RLS (`is_workspace_member`, idêntico ao de `whatsapp_bot_settings`) e o padrão de composição de string (já é como `systemInstruction` funciona hoje).

---

## 2. Proposta de modelo de dados

### 2.1 Tabela nova, não coluna em `whatsapp_bot_settings`

**Decisão: tabela própria** — `public.ai_brain_profiles` (nome proposto, ver §2.4), não colunas novas em `whatsapp_bot_settings`.

**Contra a alternativa (colunas em `whatsapp_bot_settings`)**:
1. **Escopo semântico errado.** `whatsapp_bot_settings` é configuração de fluxo (nós, provider, chaves de API) — dado operacional do canal WhatsApp. O cérebro é identidade da empresa (tom, o que falar, produtos) — dado de negócio, não de canal. O roadmap já enquadra "cérebro" como item da Etapa 9 (Robô IA) separado de qualquer canal específico; os itens 3 ("base de conhecimento") e 4 ("construtor sem IA") do mesmo Etapa 9 sugerem reaproveitamento futuro do mesmo perfil por outras superfícies de IA, não só o bot de WhatsApp. Acoplar o cérebro a `whatsapp_bot_settings` amarra essa reutilização futura ao canal errado.
2. **`whatsapp_bot_settings` já está com 14 colunas e crescendo** (chaves de 3 providers diferentes já misturadas na mesma linha) — mais 4-5 colunas de texto livre de negócio pioram a legibilidade sem ganho.
3. **Ciclo de vida diferente.** O cérebro muda quando a empresa muda de posicionamento (raro); `whatsapp_bot_settings` muda a cada ajuste de fluxo/provider (frequente). RLS/auditoria/rollback separados por tabela facilitam isolar o que mudou.

**A favor de tabela própria**: reaproveitável por qualquer feature futura de IA no workspace sem depender do domínio WhatsApp; RLS isolado; schema evolutivo independente (ex.: se o item 3 precisar referenciar o cérebro por FK, é mais limpo referenciar uma tabela de perfil do que uma tabela de configuração de canal).

### 2.2 Campos propostos

Todos **texto livre (`TEXT`)**, não JSONB estruturado — decisão deliberada, ver §2.3.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `workspace_id` | UUID NOT NULL UNIQUE, **com FK** para `workspaces(id)` | Uma linha por workspace (1:1) — ver nota sobre FK abaixo |
| `tone` | TEXT | Tom de voz (ex.: "formal e direto", "descontraído, usa emoji") |
| `talk_about` | TEXT | O que falar — produtos, diferenciais, argumentos permitidos |
| `dont_talk_about` | TEXT | O que NÃO falar — temas proibidos, concorrentes, promessas que não pode fazer |
| `products_services` | TEXT | Lista/descrição de produtos e serviços (texto livre, não catálogo estruturado — ver §2.3) |
| `limits` | TEXT | Limites operacionais (ex.: "não fecha vendas, só qualifica", "não dá desconto sem aprovação") |
| `created_at` / `updated_at` | TIMESTAMPTZ NOT NULL | `now()` + trigger de update, mesmo padrão de `whatsapp_bot_settings` |

**Nota sobre FK em `workspace_id`** (risco R3, §6): `whatsapp_bot_settings.workspace_id` **não tem FK declarada** para `workspaces(id)` (confirmado nas migrations originais — ausência não documentada, aparenta ser dívida técnica antiga, não decisão deliberada). Como esta é uma tabela nova, é a oportunidade de não repetir a lacuna — proposta: declarar `REFERENCES public.workspaces(id) ON DELETE CASCADE` desta vez. Decisão final fica para quem implementar a Fase B (não é um risco que bloqueia o desenho, só uma correção de padrão a confirmar).

### 2.3 Por que texto livre, não JSONB estruturado (ex.: array de produtos)

Um array JSONB de produtos (`[{name, description, price}, ...]`) foi considerado e **rejeitado para esta fatia**, por dois motivos:
1. **Fronteira limpa com o item 3.** O próprio roadmap já reserva "base de conhecimento" (item 3 da Etapa 9) como a fatia que trata de conteúdo estruturado/catalogável, explicitamente citando necessidade de Fase A própria por causa de LGPD, escopo de leitura e custo de contexto. Se o cérebro (item 2) já nascer com um editor de lista estruturada de produtos, a linha entre "cérebro" e "base de conhecimento" fica ambígua — dois itens do roadmap resolvendo o mesmo problema.
2. **Composição trivial.** Texto livre vira string de prompt por concatenação direta (§3) — sem lógica de serialização, sem componente de editor de lista (que não existe hoje na UI), sem decisão de formato de exibição pro LLM (Markdown? lista numerada? JSON inline?). Mantém a Fase B pequena.

### 2.4 RLS — mesmo padrão da casa

```sql
CREATE POLICY "Workspace members can view brain profile"
    ON public.ai_brain_profiles FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace members can modify brain profile"
    ON public.ai_brain_profiles FOR ALL TO authenticated
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));
```
Precedente citado: `whatsapp_bot_settings` (`20260602153027_...sql:27-35`) e `crm_opportunities` (`20260530050000_create_crm_opportunities.sql:48-72`), ambas usando `public.is_workspace_member(w_id)` (definida em `20260530000000_create_workspaces_schema.sql:36-49`).

**Nome da tabela**: `public.ai_brain_profiles` é proposta, não definitiva — alternativas consideradas: `whatsapp_bot_brain` (rejeitada por acoplar ao canal, ver §2.1) e `workspace_brain_profiles` (redundante, workspace já é o escopo implícito de toda tabela com `workspace_id`). Confirmar nome final na Fase B.

---

## 3. Composição do prompt

### 3.1 Onde a composição acontece — ponto único, antes de qualquer branch de provider

A variável `systemInstruction` já é resolvida em um ponto único antes da seleção de provider (linhas 496-512 no modo webhook, linha 326 no modo teste) — **os 4 branches de provider (vertex_ai, gemini_api_key, lovable, anthropic) só leem essa variável já pronta** (§1.1). Isso significa que a composição do cérebro precisa acontecer **nesse mesmo ponto único**, logo após `systemInstruction` ser resolvida e antes de qualquer `if (provider === ...)`.

**Consequência direta**: o cérebro é provider-agnóstico por construção, não por disciplina de manter os 4 branches sincronizados — os branches nem sabem que o cérebro existe, eles só recebem uma string mais longa. Nenhuma mudança nos 4 branches de provider seria necessária na Fase B, só uma função de composição chamada uma vez.

### 3.2 Template de composição proposta

```
composedSystemInstruction = [brainPreamble, systemInstruction]
  .filter(Boolean)
  .join("\n\n")
```

Onde `brainPreamble` é montado a partir da linha de `ai_brain_profiles` do workspace (quando a flag está ligada e a linha existe — ver §5), algo como:

```
Sobre a empresa:
- Tom: {tone}
- Fale sobre: {talk_about}
- Não fale sobre: {dont_talk_about}
- Produtos/serviços: {products_services}
- Limites: {limits}
```
(campos vazios omitidos da lista, não renderizados como "Tom: " em branco).

**Ordem escolhida — cérebro ANTES da instrução existente, não depois**: o cérebro fornece contexto/fatos (quem é a empresa), a instrução existente (`system_instruction`/`aiNode.properties.instruction`) fornece a diretiva de comportamento específica do fluxo (o que o usuário já escreveu manualmente hoje). Colocar o cérebro primeiro deixa a instrução do usuário por último no prompt — mais perto do fim, tipicamente com maior peso/prioridade para o modelo — sem *sobrescrever* nem duplicar o que o usuário já escreveu à mão.

**Cérebro vazio (workspace ainda não configurou) = comportamento idêntico a hoje**: `filter(Boolean)` garante que uma `brainPreamble` vazia não introduz linhas em branco nem um cabeçalho "Sobre a empresa:" sem conteúdo — importante para o Caso 3 de homologação (§6).

### 3.3 Tamanho máximo — limite de engenharia, não de LGPD/escopo

**Aqui entra APENAS o custo de contexto como limite de engenharia** — a dimensão de LGPD/escopo de leitura fica explicitamente fora desta Fase A, por instrução do revisor, e pertence ao item 3.

Proposta: **soft-cap de caracteres na UI** (ex.: ~2000 caracteres somados entre os 5 campos), com aviso visual (não bloqueio de salvar) quando excedido — mesmo espírito de "não travar o operador", já que `system_instruction` hoje também não tem limite e nunca precisou de um até aqui. Não há truncamento automático no servidor proposto nesta Fase A — cortar texto de negócio no meio de uma frase é pior do que deixar mais caro; a decisão de truncar (e como) fica em aberto para quem implementar a Fase B, registrada como risco R1 (§6), não resolvida aqui.

Motivo prático do soft-cap: qualquer aumento no prompt do sistema é custo pago em TODA mensagem do bot (não é uma chamada isolada) — com 4 providers, incluindo agora o Anthropic com preço por token real (ver Etapa 9 item 1), um cérebro maximalista sem nenhum limite indicativo tende a crescer sem que o operador perceba o custo recorrente.

---

## 4. Superfície de UI

### 4.1 Decisão: Configurações (novo item de nav "Cérebro"), não dentro do WhatsAppBotConfig

`WhatsAppBotConfig.tsx` **não tem sistema de abas** — é uma tela única com um "inspetor" que troca de formulário conforme o tipo de nó selecionado no canvas visual (`trigger | ai | send | handover`, condicionais em `activeNode.type === "..."`, linhas 526/569/694/717, sem `Tabs`/`TabsList` importado). Adicionar o cérebro como um 5º tipo de nó foi considerado e rejeitado: o cérebro não é um passo de fluxo, é uma configuração de workspace que deveria valer para qualquer fluxo/futuro agente, não ficar amarrada a um nó específico dentro do construtor visual do WhatsApp.

**Precedente citado**: `Configuracoes.tsx` já tem um padrão de nav lateral + seção (`SettingsNav`/`NAV_ITEMS`, `Configuracoes.tsx:98-112`) com cada item renderizando um bloco `SettingsSection`/`SettingsCard` (`src/components/settings/SettingsSection.tsx`, `SettingsCard.tsx`). A seção "Empresa" (`Configuracoes.tsx:330-427`) é o análogo estrutural mais próximo — mesmo tipo de dado (identidade da empresa, texto livre, poucos campos).

**Ressalva explícita**: a seção "Empresa" está em `localStorage` (`kora.settings.company.v1`), não em Supabase — **esse é exatamente o padrão a NÃO repetir**, porque o cérebro precisa alimentar `whatsapp-bot-reply` (edge function, sem acesso a localStorage do navegador do operador). O cérebro precisa ser Supabase desde o dia 1, com RLS por workspace (§2.4) — usar "Empresa" só como referência de layout/UX, não de mecanismo de persistência.

**Proposta**: novo item em `NAV_ITEMS` (ex.: `{ id: "brain", label: "Cérebro do Robô", icon: BrainCircuit }` — mesmo ícone já usado em `WhatsAppBotConfig.tsx:3` para o nó "ai"), com uma `SettingsSection`/`SettingsCard` contendo os 5 campos de texto do §2.2, lendo/gravando em `ai_brain_profiles` via Supabase client (mesmo padrão de `loadSettings`/`handleSaveSettings` já usado em `WhatsAppBotConfig.tsx:127-190,222-285`).

---

## 5. Rollout

### 5.1 Flag própria, default OFF

Nome proposto: **`kora.whatsapp.brain.enabled`** — segue a convenção documentada em `src/config/flags.ts` (`kora.<domain>.<feature>.<enabled|v1>`), irmã direta de `kora.whatsapp.campaignSender.enabled` já existente no mesmo domínio. Opt-in, default OFF — mesmo padrão de `kora.crm.supabaseWrite.enabled` e da maioria dos flags novos citados no arquivo.

Com a flag OFF: `brainPreamble` nunca é buscada/composta — `composedSystemInstruction` degrada exatamente para o `systemInstruction` de hoje (comportamento idêntico, zero risco de regressão — Caso 1 de homologação, §6).

Nota de nome: `kora.whatsapp.brain.enabled` amarra a flag ao domínio WhatsApp mesmo com a tabela (`ai_brain_profiles`) desenhada como canal-agnóstica (§2.1) — isso é intencional nesta Fase A: só o bot de WhatsApp CONSOME o cérebro hoje, então o gate de rollout é sobre o consumo (WhatsApp), não sobre o dado (que já nasce reaproveitável). Se um item futuro (3 ou 4) passar a consumir o mesmo perfil por outra superfície, esse segundo consumo ganha sua própria flag — não reabre esta.

### 5.2 Compatibilidade com os 4 providers — confirmada por desenho, não por teste

Como a composição acontece no ponto único descrito em §3.1, antes de qualquer `if (provider === ...)`, os 4 providers (vertex_ai, gemini_api_key, lovable, anthropic) recebem a mesma `composedSystemInstruction` sem nenhuma mudança nos seus branches. Não há necessidade de "portar" o cérebro provider a provider — é uma propriedade do desenho, não algo a testar depois; ainda assim, o Caso 5 de homologação (§6) verifica isso empiricamente antes de fechar a Fase B.

---

## 6. Esboço de casos de homologação e riscos

1. **Flag OFF (default)**: comportamento idêntico ao atual — mesmo com uma linha de `ai_brain_profiles` preenchida no banco, a reply não deve refletir nenhum campo do cérebro. Guarda de regressão.
2. **Flag ON + cérebro preenchido + fluxo simples**: reply deve refletir tom/produtos/limites configurados no cérebro.
3. **Flag ON + cérebro vazio** (workspace não configurou ainda): comportamento idêntico ao flag OFF — sem preâmbulo em branco, sem cabeçalho "Sobre a empresa:" vazio (prova do `filter(Boolean)`, §3.2).
4. **Flag ON + cérebro muito longo** (excede o soft-cap de ~2000 caracteres, §3.3): UI mostra aviso visual; comportamento do backend com texto longo é uma decisão em aberto (truncar vs. deixar passar) — este caso documenta a decisão tomada na Fase B, não a antecipa aqui.
5. **Paridade entre os 4 providers**: mesmo cérebro configurado, testar vertex_ai/gemini_api_key/lovable/anthropic e confirmar que todos recebem a mesma composição (nenhum branch de provider precisou de código novo).
6. **Edição ao vivo no simulador**: editar o cérebro, salvar, rodar o simulador da UI (`isTest:true`, mesmo caminho de produção) e confirmar que a composição reflete a edição sem precisar de deploy.

**Riscos nomeados:**

- **R1 — sem limite rígido, custo de token cresce sem o operador perceber.** Mitigado por soft-cap + aviso (§3.3), não por bloqueio. Fica em aberto se a Fase B precisa de truncamento server-side.
- **R2 — duplicação de conteúdo entre `system_instruction` e o cérebro.** O usuário pode digitar de novo na instrução algo que já está no cérebro (nada impede, já que ambos são texto livre). Não é bug — é uma sobreposição esperada entre "contexto" (cérebro) e "diretiva" (instrução) — mas precisa de copy clara na UI explicando a diferença, senão o operador preenche os dois campos com o mesmo conteúdo.
- **R3 — `workspace_id` sem FK declarada** é o padrão observado em `whatsapp_bot_settings` (dívida técnica antiga, não decisão deliberada). Tabela nova é oportunidade de corrigir — decisão de implementação, não bloqueio de desenho.
- **R4 — reaproveitamento futuro pelos itens 3/4 da Etapa 9 depende do cérebro ficar desacoplado do WhatsApp.** Se a Fase B implementar dentro de `WhatsAppBotConfig.tsx` por atalho (mais rápido de construir), perde a reutilização que justificou a tabela própria em §2.1 — reforça a decisão de UI em §4 (Configurações, não dentro do builder do WhatsApp).
- **R5 — fora de escopo, registrado deliberadamente**: quem pode LER o cérebro (LGPD, granularidade de dado sensível de negócio) fica para o item 3, por instrução explícita do revisor — não antecipado aqui.

---

## Fechamento — estimativa de tamanho da fatia de implementação

**Pequena-média**, e greenfield (sem migração de dado existente, ao contrário dos flips de Financeiro/Tarefas): 1 migration (tabela + RLS, ~30 linhas SQL seguindo o padrão de `crm_opportunities`), 1 flag nova, 1 função pura de composição de prompt (testável fora do Deno, mesmo padrão de `botFlowTemplate.ts`/`anthropicParser.ts`), 1 alteração de poucas linhas em `index.ts` (chamar a composição no ponto único do §3.1 — não em cada branch de provider), 1 seção nova de UI em `Configuracoes.tsx` (seguindo o padrão `SettingsSection`/`SettingsCard` já existente).

O que faria a fatia crescer: se a Fase B decidir por edição estruturada (lista de produtos em vez de texto livre) — deliberadamente adiado para o item 3 (§2.3) — ou se decidir truncar/validar tamanho no servidor (R1, ainda em aberto). Mantendo os campos como texto livre e o soft-cap como aviso client-side apenas, a fatia fica no tamanho de uma feature nova pequena, não de um flip de domínio inteiro.

---

## Referências

- `docs/architecture/etapa-9-item1-parser-map.md` — mapa do provider, origem do `systemInstruction` já localizada
- `docs/architecture/kora-roadmap.md` §6 — Etapa 9, 4 itens (Gemini→Claude, cérebro, base de conhecimento, construtor sem IA)
- `docs/architecture/etapa-5-flip-financeiro-fase-a.md` / `etapa-5-flip-tarefas-fase-a.md` — molde de estrutura/profundidade usado aqui
- `supabase/migrations/20260602153027_...sql` — precedente de RLS `is_workspace_member` em `whatsapp_bot_settings`
- `src/hooks/useAppSettings.ts` — `CompanySettings`/`kora.settings.company.v1`, o padrão de persistência local a NÃO repetir
