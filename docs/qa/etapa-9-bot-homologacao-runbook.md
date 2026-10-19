# Etapa 9 · Itens 3 e 4 — Homologação do bot (fluxo scriptado, handover, modo IA, base de conhecimento) — Runbook

> **Escopo desta rodada: doc-only.** Este runbook NÃO executa nada — é o roteiro PRONTO
> para o operador, guiado pelo revisor, caso a caso. Molde: os runbooks de domínio da
> Etapa 5 ([`etapa-5-flip-tarefas-runbook.md`](etapa-5-flip-tarefas-runbook.md),
> [`etapa-5-flip-fichas-runbook.md`](etapa-5-flip-fichas-runbook.md)): **gatilho real →
> esperado → prova**, número de passo, SQL "depois da ação".
>
> **3 blocos, em ordem de pré-requisito:**
>
> | Bloco | Pré-requisito | Pode rodar hoje? | Cobre |
> |---|---|---|---|
> | **1A** — canvas e validação (só UI) | nenhum servidor novo | **SIM** | R6 canvas · R7 mensagem · R8 destinos · R9 palavra de retorno (campo) · R10 validação/exemplo · R11 exportar/importar |
> | **1B** — simulador do fluxo | function `whatsapp-bot-reply` **com o simulador** deployada (ver 1B.0) | **Só depois do deploy da function** — *não* é "sem servidor" (achado abaixo) | menu · inválida×N → entrega · mensagem → menu · opção → IA (selo) · palavra de retorno · Reiniciar |
> | **2** — smoke real por WhatsApp | §8-b-bot aplicado (4 migrations) **e** 3 functions deployadas | **NÃO** (depende do operador) | menu de entrada · inválida×N → handover · "Devolver ao robô" · modo IA · base de conhecimento |
> | **3** — critérios | — | — | vermelho / ressalva / achado, placar |
>
> **Achado de honestidade nº 1 (corrige o enquadramento "Bloco 1 sem servidor"):** o
> **Simulador do Fluxo NÃO roda só na UI.** O motor (menu/mensagem/handover/modo IA) é do
> servidor: `handleSimulateMessage` chama `supabase.functions.invoke("whatsapp-bot-reply")`
> com `isTest` + `simState` (`WhatsAppBotConfig.tsx`, `flowSimulatorModel.ts`), e **o
> estado do menu viaja de ida e volta pelo cliente**. Uma function ANTIGA ignora `simState`
> e devolve só a resposta da IA — o simulador "funciona" mas **não exercita o fluxo**
> (compat deliberada, `applySimulationResponse`). Por isso o simulador ficou no **Bloco 1B**,
> com pré-condição própria (1B.0), e **não** no 1A. O simulador **não** precisa das
> migrations (não toca `whatsapp_conversations`): só do **deploy de `whatsapp-bot-reply`**.
>
> **Achado de honestidade nº 2 — a homologação grava no fluxo REAL do workspace.** "Salvar
> Fluxo" escreve `flow_data` em `public.whatsapp_bot_settings`. Rode **só no workspace de
> teste** e tire o **snapshot** do §1.2 antes. "Exportar fluxo" **não é backup completo**:
> "Importar fluxo" **adiciona** menus/mensagens, não restaura os 4 nós fixos nem apaga o
> que existe (contrato da R11) — o restauro é pelo SQL do snapshot (§1.2/Caso 40).
>
> **Achado de honestidade nº 3 — o que o jsdom não prova.** Arrastar nó, ligar
> handle→nó e Delete numa aresta **não têm teste automatizado possível** (jsdom não mede
> nós; os testes cobrem o modelo e a lista textual "Conexões do fluxo"). Os Casos 2–4
> são a **primeira prova real** desses gestos — por isso um defeito neles é **vermelho**,
> não "já coberto".

## Abertura (§16/§17)

- Worktree/branch do runbook: `Kora-laneC` · `etapa-9-bot-fluxo-r11-export-import`.
- Código sob homologação: `origin/main` **depois do merge da R11** — hash a preencher na
  execução: **`<hash do tip pós-merge R11>`** (R6 `486611f`/`40bf3ca` → R7 `cd5daa5` → R8 `3f2aaab`
  → R9 `8e06894` → R10 `eea06d4` → R11). Nunca inferir correspondência código↔servidor
  pelo comportamento observado.
- **Pré-requisitos de dados do Bloco 2** (decididos no [pacote §8-b](etapa-9-bot-pacote-operador-8b.md)):
  4 migrations (`bot_flow_state`, `handover_at`, `ai_knowledge_consents`, `assignment_origin`)
  + deploy de `whatsapp-instance`, `whatsapp-bot-reply`, `whatsapp-webhook`.
  Code **nunca** aplica DDL nem faz deploy (protocolo §0/§6/§8-b).

## Referências (com o porquê de cada uma)

- [`etapa-9-bot-pacote-operador-8b.md`](etapa-9-bot-pacote-operador-8b.md) — **fonte primária do Bloco 2**: migrations (§2), SELECTs de prova (§3), deploy + pré-prova de hash (§4), smoke 1→28 (§5.2), logs proibidos (§5.3), rollback (§7).
- [`etapa-9-bot-fluxo-r6-canvas-xyflow.md`](etapa-9-bot-fluxo-r6-canvas-xyflow.md), [`…-r7-no-mensagem.md`](etapa-9-bot-fluxo-r7-no-mensagem.md), [`…-r8-destinos-handover-ai.md`](etapa-9-bot-fluxo-r8-destinos-handover-ai.md), [`…-r9-saida-modo-ia.md`](etapa-9-bot-fluxo-r9-saida-modo-ia.md), [`…-r10-validacao-exemplo.md`](etapa-9-bot-fluxo-r10-validacao-exemplo.md) — o desenho de cada rodada (o "esperado" dos casos vem daqui, conferido contra o código).
- [`etapa-9-bot-simulador-fluxo-cobertura.md`](etapa-9-bot-simulador-fluxo-cobertura.md) — contrato `simState` do simulador.
- [`etapa-9-item3-r1-base-conhecimento-liga.md`](etapa-9-item3-r1-base-conhecimento-liga.md) — bloco de conhecimento, categoria A.
- [`protocolo-homologacao.md`](protocolo-homologacao.md) — §0/§6 (Code não acessa banco), §1/§2 (EXPORT MANUAL, PRINT PRÉ-CLIQUE), §8-b, §16/§17 (isolamento, prova de build por hash), §18.

---

## 1. PRÉ-HOMOLOGAÇÃO — checklist do operador

### 1.1 Prova de servidor — protocolo §17, passo 0 (todos os blocos)
Declarar worktree + branch + URL do dev server e confirmar no console
`[Kora] BUILD <hash> (<branch>)` **igual ao hash acima**. Diferente → parar.

### 1.2 Snapshot do fluxo do workspace de teste (EXPORT MANUAL — protocolo §1)
Antes de qualquer "Salvar Fluxo". Operador roda e **guarda o resultado** (é o restauro do Caso 40):

```sql
SELECT id, is_active, respond_all, updated_at, flow_data
FROM public.whatsapp_bot_settings
WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';
```
Confirmação por escrito do operador ("tirei o snapshot") é o gate. Se o workspace de teste
não tiver linha (0 linhas), registrar — o primeiro "Salvar Fluxo" a cria (limpeza no Caso 40).

### 1.3 Workspace e prefixo
Workspace: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (o mesmo das homologações da Etapa 5).
Prefixo de **todo dado gravado**: **`HOMOLOG-BOT-`** (títulos dos nós, textos de mensagem,
rótulos de opção). O fluxo de exemplo nasce com títulos genéricos ("Menu principal"…): após
carregá-lo, **renomear o menu para `HOMOLOG-BOT-Menu`** (campo "Título do nó") e a mensagem de
horário para `HOMOLOG-BOT-Horario` antes do primeiro "Salvar".

### 1.4 IA configurada (só 1B e Bloco 2)
Os casos "opção → IA" respondem com a IA de verdade: o Agente IA precisa de um provedor
com credencial funcionando (ex.: "Créditos KORA", ou chave Gemini **já salva** no workspace).
Sem isso o simulador mostra "❌ Falha no fluxo: …" — **pré-requisito não satisfeito, não é vermelho**.

---

# BLOCO 1A — Canvas e validação (só UI) — pode rodar HOJE

Abrir **WhatsApp → aba "Robô IA"**. Sessão em fluxo com **só os 4 nós fixos** (o estado de
quem nunca montou nada; se o workspace de teste já tem fluxo, o snapshot §1.2 cobre).
Nada nesta seção precisa de migration nem de deploy. Print pré-clique (protocolo §2) em todo
"Salvar" (Casos 7 e 8).

**Caso 1 — Fluxo de exemplo (R10)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Abrir a aba "Robô IA" com só os 4 fixos | Canvas ("Visual Canvas") com 4 cards: **Gatilho de Entrada**, **Agente IA (Gemini)**, **Enviar Mensagem**, **Transbordo Humano** (este com selo **"Desabilitado"**, borda tracejada); setas tracejadas entre eles; botão **"Carregar fluxo de exemplo"** visível; **nenhum** painel "Problemas do fluxo"; botão **"Salvar Fluxo"** sem contagem | Visual |
| 1.2 | Clicar **"Carregar fluxo de exemplo"** | Alerta "Montar um fluxo de exemplo? Adiciona 1 menu e 2 mensagens…". Clicar **"Cancelar"** → nada muda e o botão de exemplo continua | Visual |
| 1.3 | **"Carregar fluxo de exemplo"** → **"Carregar exemplo"** | 3 cards novos: **Menu principal** (rosa), **Horário de atendimento** e **Saudação da IA** (ciano). Linhas: gatilho→Menu (ponto "Início do fluxo"), 3 linhas de opção (1→Horário, 2→Saudação da IA, 3→Transbordo Humano), Horário→Menu, Saudação→Agente IA. **Transbordo Humano agora habilitado** (sem selo). Inspector abre em **"Configuração do Nó: Menu principal"**. Botão de exemplo **some**. **Nenhum** painel de problemas; botão continua **"Salvar Fluxo"** | Visual |
| 1.4 | Clicar no card **Agente IA (Gemini)** | Campo **"Palavra para voltar ao menu (opcional)"** = `menu` | Visual |
| 1.5 | Renomear o menu (clicar no card → "Título do nó") para `HOMOLOG-BOT-Menu` e a mensagem de horário para `HOMOLOG-BOT-Horario` | Títulos mudam no card e no inspector | Visual |

**Caso 2 — Arrastar nó (R6)** — primeira prova real

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Arrastar o card `HOMOLOG-BOT-Menu` para outra posição do canvas | O card acompanha o mouse; **as linhas acompanham**; soltar mantém a nova posição | Visual |
| 2.2 | Rolar/zoom do canvas (Controls, MiniMap) | Navega sem mover nós por engano | Visual |

**Caso 3 — Ligar ponto → nó (R6/R7/R8)** — primeira prova real

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | No card do menu, arrastar o ponto da **opção 2** até o card **Transbordo Humano** | A linha troca de destino. No inspector do menu, a opção 2 mostra no "Ir para..." **Transbordo Humano** com o efeito "— entrega a um atendente humano" | Visual (canvas + inspector) |
| 3.2 | Arrastar o ponto da opção 2 de volta para **Saudação da IA** | Volta ao estado do exemplo; só **1** linha sai da opção 2 | Visual |
| 3.3 | **Conexão inválida:** arrastar qualquer ponto até o card **Gatilho de Entrada** | **Não conecta** (o gatilho não recebe linhas) | Visual |
| 3.4 | **Conexão inválida:** arrastar o ponto **"Início do fluxo"** do gatilho até **Agente IA** ou **Transbordo Humano** | **Não conecta** (a entrada só aceita menu/mensagem) | Visual |
| 3.5 | Arrastar o ponto **"Depois de enviar"** da mensagem de horário até **Transbordo Humano** | Conecta (mensagem → atendente é permitido). Voltar a ligar em `HOMOLOG-BOT-Menu` | Visual |
| 3.6 | Arrastar "Depois de enviar" até **Enviar Mensagem** | **Não conecta** (o nó de envio não é destino de mensagem) | Visual |

**Caso 4 — Apagar linha e nó com a tecla Delete (R6 acabamento)** — primeira prova real

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Clicar numa **linha de opção** (selecionar) e apertar **Delete** (foco no canvas) | A linha some. O painel **"Problemas do fluxo"** passa a mostrar um **Erro** "Opção N … não leva a lugar nenhum"; botão vira **"Salvar mesmo assim (1 erro)"** | Visual |
| 4.2 | **Segurança:** clicar no campo "Título do nó" ou "Mensagem" do inspector e apertar **Delete/Backspace** várias vezes | Só edita o texto; **nenhum nó nem linha é apagado** | Visual |
| 4.3 | Religar a opção (arrastar de novo até o destino) | Erro some; botão volta a **"Salvar Fluxo"** | Visual |
| 4.4 | Selecionar o card **Saudação da IA** e apertar **Delete** | O nó some; a opção 2 e as referências a ele ficam **sem destino** (Erro no painel); seleção volta ao Gatilho | Visual |
| 4.5 | Selecionar o card **Agente IA (Gemini)** e apertar **Delete** | **Nada acontece**; inspector mostra **"Nó fixo do fluxo — não pode ser excluído, só desabilitado."** | Visual |
| 4.6 | Recarregar o exemplo para seguir: **F5** (descarta o que não foi salvo) → "Carregar fluxo de exemplo" → "Carregar exemplo" (Caso 1.3) | Estado do exemplo de volta | Visual |

**Caso 5 — Excluir menu em 2 passos (R6 acabamento)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | **"+ Adicionar nó de menu"** → card "Menu 1" selecionado; ligar a opção de `HOMOLOG-BOT-Menu` ao "Menu 1" (ou adicionar uma opção em "Menu 1") | Nó criado no centro do canvas | Visual |
| 5.2 | No inspector do "Menu 1": **"Excluir nó"** | Alerta "Excluir “Menu 1”? N conexão(ões) que chegam ou saem dele serão removidas." com **"Confirmar exclusão"** e **"Cancelar"**. **"Cancelar"** mantém o nó | Visual |
| 5.3 | **"Excluir nó" → "Confirmar exclusão"** | Nó some, ligações limpas, seleção volta ao Gatilho | Visual |

**Caso 6 — Validação: provocar cada erro e cada aviso (R10)**

Cada linha: provocar → ver a linha no painel **"Problemas do fluxo — …"** (item com **"Erro"** ou
**"Aviso"**) → **clicar na linha** (seleciona o nó e abre o inspector dele) → corrigir → a linha some.
Partir do exemplo recém-carregado (Caso 1.3, sem problemas).

| Passo | Severidade | Como provocar | Linha esperada (trecho) |
|---|---|---|---|
| 6.1 | **Erro** `opcao-sem-destino` | No menu: **"Adicionar opção"** e deixar "Ir para..." vazio | "Opção N … não leva a lugar nenhum: escolha o destino." |
| 6.2 | **Erro** `fallback-sem-destino` | No menu, "Depois de esgotar" → **"Pular para outro nó"** sem escolher "Nó de destino" | "Resposta inválida está em “Pular para outro nó” sem nó de destino" |
| 6.3 | **Erro** `menu-sem-opcoes` | **"+ Adicionar nó de menu"** (nasce sem opções) | "é um menu sem nenhuma opção" |
| 6.4 | **Erro** `mensagem-vazia` | **"+ Adicionar nó de mensagem"** (nasce sem texto) | "está sem texto — o robô ignora uma mensagem vazia" |
| 6.5 | **Erro** `ciclo-mensagens` | Duas mensagens **com texto preenchido** (senão acusam também "mensagem vazia"): A → "Depois de enviar" B e B → A | "Ciclo de mensagens (“A” → “B” → “A”)" (**1** erro por ciclo) |
| 6.6 | **Erro** `cadeia-longa` | **6** mensagens **com texto preenchido**, cada uma ligada à próxima (a 6ª ao menu), a 1ª ligada a uma opção | "Cadeia de 6 mensagens seguidas … no máximo 5". Com **5** não deve aparecer |
| 6.7 | **Aviso** `inalcancavel` | O "Menu 1" criado em 6.3 com uma opção e **sem** ninguém apontando para ele | "não é alcançado por nenhum caminho a partir da entrada do fluxo" |
| 6.8 | **Aviso** `destino-desabilitado` | Desligar o switch **"Habilitar Transbordo Humano"** no card (a opção 3 aponta para ele) | "leva a “Transbordo Humano”, que está desabilitado" (e, no inspector da opção, o alerta "Opção 3 → “Transbordo Humano” está desabilitado — destino inválido"). Religar depois |
| 6.9 | **Aviso** `destino-sem-efeito` | Opção "Ir para..." → **Enviar Mensagem** (item "— sem efeito no fluxo") | "não faz nada como destino" |
| 6.10 | **Aviso** `entrada-ambigua` | Com 2 menus habilitados e "Começar por" em **"Automático (primeiro menu habilitado)"** | "“Começar por” está em Automático com 2 menus habilitados" (some ao escolher a entrada) |
| 6.11 | **Aviso** `retorno-colide-handover` | No Agente IA, palavra de retorno `atendente` (com Transbordo habilitado) | "contém uma palavra-chave de atendimento humano: ela vence". Voltar para `menu` |
| 6.12 | **Aviso** `sem-caminho-humano-ia` | **Raro por desenho** (esgotar tentativas já entrega a humano — R4). Para provocar: todos os menus em "Pular para outro nó" apontando uma **mensagem**, e **desligar** Agente IA e Transbordo | "Nenhum caminho do fluxo leva a um atendente humano nem à IA". **Se não conseguir provocar, é o esperado** — registrar como ressalva, não vermelho |
| 6.13 | Contagem | Com 2+ problemas | Título "Problemas do fluxo — N erros e M avisos"; erros listados **antes** dos avisos |

> **Não provocáveis pela UI (ressalva pré-declarada, cobertos por teste unitário):**
> `destino-removido` (excluir um nó já **limpa** as referências — o destino nunca fica "fantasma")
> e `entrada-invalida` ("Começar por" só lista menu/mensagem). Os dois só nasceriam de um
> `flow_data` editado à mão no banco. **Não são vermelho** se não reproduzidos.

**Caso 7 — "Salvar mesmo assim" (R10)** — o erro NÃO bloqueia

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Com **pelo menos 1 erro** no fluxo (ex.: 6.1) | Botão com o rótulo **"Salvar mesmo assim (N erros …)"**, **habilitado**; texto do painel "Você pode salvar mesmo assim…" | Visual |
| 7.2 | Clicar nele (print pré-clique) | Toast **"Fluxo de Atendimento salvo com sucesso!"** (ou "…criado e ativado!" se a linha não existia). O fluxo é salvo **com** o defeito (nada é "consertado") | `SELECT jsonb_array_length(flow_data) AS nos FROM public.whatsapp_bot_settings WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → número de nós **inclui** o nó com defeito |
| 7.3 | Com **só avisos** | Botão **"Salvar Fluxo (N avisos)"** (sem "mesmo assim") | Visual |
| 7.4 | Sem problemas | Botão **"Salvar Fluxo"** sem contagem | Visual |

**Caso 8 — Recarregar e conferir posições/arestas (R6)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | Corrigir os erros provocados, deixar o exemplo íntegro, **mover** 2 cards, **"Salvar Fluxo"** (print pré-clique) | Toast de sucesso | — |
| 8.2 | **F5** → aba "Robô IA" | **Mesmas posições** dos cards movidos; **mesmas linhas** (entrada, 3 opções, volta ao menu, saudação→IA) | Visual |
| 8.3 | — | Posições gravadas | `SELECT n->>'id' AS id, n->'position' AS posicao FROM public.whatsapp_bot_settings, jsonb_array_elements(flow_data) AS n WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → **todos** os nós com `{x,y}` |
| 8.4 | Comparar as ligações salvas | `nextNodeId` das opções batem com o canvas | `SELECT o->>'numero' AS opcao, o->>'nextNodeId' AS destino FROM public.whatsapp_bot_settings, jsonb_array_elements(flow_data) AS n, jsonb_array_elements(n->'properties'->'opcoes') AS o WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND n->>'type' = 'menu';` |

**Caso 9 — Exportar / Importar fluxo (R11)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 9.1 | Clicar **"Exportar fluxo"** | Baixa `fluxo-robo-AAAA-MM-DD.json` | Arquivo |
| 9.2 | Abrir o `.json` num editor | Começa com `"schema": "kora.whatsapp-bot-flow"`, `"version": 1`, `"exportedAt"`, `"nodes": [...]` (7 nós no exemplo). **Procurar por qualquer trecho da chave de IA do workspace** | Leitura do arquivo — **chave/service account no arquivo = VERMELHO AUTOMÁTICO** (`geminiApiKey` e `gcpServiceAccount` devem estar `""`) |
| 9.3 | **"Importar fluxo"** e escolher um arquivo que **não é JSON** (ex.: renomear um `.txt`) | Alerta **"Arquivo recusado (“…”): O arquivo não é um JSON válido. Nada foi alterado no fluxo."** + **"Fechar"**. Fluxo intacto | Visual |
| 9.4 | Escolher um JSON de **outra coisa** (ex.: `{"a":1}`) | "Este arquivo não é um fluxo exportado pelo Kora (campo “schema” ausente ou diferente)." | Visual |
| 9.5 | Editar o arquivo exportado: `"version": 99` → importar | "…é da versão 99 do formato; esta tela entende até a versão 1. Atualize o Kora." | Visual |
| 9.6 | Editar o arquivo: apagar a lista `opcoes` de um menu (`"opcoes": "x"`) → importar | Recusado apontando o nó: "Nó N (…): menu sem a lista “opcoes”." | Visual |
| 9.7 | Importar o arquivo **íntegro** do 9.1 | **Prévia** (região "Importar fluxo"): "Importar “fluxo-robo-….json”?", "Adiciona **1 menu** e **2 mensagens** ao fluxo atual, com ids novos…", "Nada do que já existe é apagado…", "credenciais nunca vêm do arquivo", nota "…posicionado abaixo deles…" (fluxo já tem menu). **Nada foi aplicado ainda** (contar os cards) | Visual |
| 9.8 | **"Cancelar"** | Prévia some, **nenhum card novo** | Visual |
| 9.9 | Importar de novo → **"Importar"** | +3 cards (**ids novos**, posicionados **abaixo** dos existentes, desenho relativo mantido), menu importado selecionado. O botão "Salvar" **ainda não** gravou nada | `SELECT jsonb_array_length(flow_data) FROM public.whatsapp_bot_settings WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → **igual ao do Caso 8** (nada persiste até "Salvar Fluxo") |
| 9.10 | **F5** | Os 3 nós importados **somem** (nunca foram salvos) | Visual |
| 9.11 | Editar o arquivo: num menu, `"nextNodeId": ""` em uma opção e `"mensagem": "  "` numa mensagem → importar | Prévia lista **"Problemas que esta importação traz — 2 erros …"** (Erro "Opção … não leva a lugar nenhum", Erro "…sem texto") e o botão vira **"Importar mesmo assim (2 erros)"**. Nada aplicado até clicar | Visual |
| 9.12 | Limpeza: **F5** (descarta o que não foi salvo) | Estado do Caso 8 | — |

**Caso 10 — Limpeza do Bloco 1A**: ver Caso 40 (junto com o 1B/Bloco 2, para restaurar o fluxo uma vez só).

---

# BLOCO 1B — Simulador do Fluxo — **só depois do deploy da function** (ver 1B.0)

Painel à direita do canvas: **"Simulador do Fluxo"**, campo "Envie uma mensagem de teste...",
botão (aria) "Enviar mensagem de teste", botão **"Reiniciar simulação"**, barra **"Estado:"**.
O fluxo precisa estar **salvo** ("Salve o fluxo antes de testar no simulador" — as credenciais
da IA vêm do servidor). Partir do exemplo íntegro salvo (Caso 8). IA configurada (§1.4).

**Caso 11 — Pré-condição: o simulador está falando com o servidor NOVO (1B.0)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 11.1 | Pré-prova do deploy: quem faz o deploy confirma `git log origin/main -1` = `<hash do tip pós-merge R11>` e o output de `npx supabase functions deploy whatsapp-bot-reply …` lista `_shared/botFlowSimulation.ts` e `_shared/botFlowMenu.ts` (pacote §4) | — | Output do deploy |
| 11.2 | Simulador: enviar `oi` | **Bolha = o menu** (`HOMOLOG-BOT-Menu`: "Olá! Como posso ajudar?" + "1 - Horário de atendimento / 2 - Falar com a IA / 3 - Falar com um atendente"); barra "Estado:" → **"No menu “HOMOLOG-BOT-Menu” — respostas inválidas: 0 de 3"** | Visual |
| 11.3 | Se, em vez disso, vier **resposta da IA** ou o Estado ficar **"Fora do menu — a próxima mensagem inicia o fluxo"** | **Function antiga** (ignorou `simState`): **parar o Bloco 1B** — pré-condição não satisfeita, **não é vermelho do código**. Rodar o deploy e repetir | Visual |

**Caso 12 — Menu → opção válida → mensagem → menu**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 12.1 | `1` | **Uma bolha só** com o texto da mensagem ("Atendemos de segunda a sexta, das 9h às 18h.") **e, na mesma bolha, depois de uma linha em branco, o menu de novo**. Estado: "No menu … 0 de 3". **Sem selo, sem IA** | Visual |
| 12.2 | `3` | Bolha = **cortesia padrão** ("Encaminhando o seu contato para o atendimento humano…") com selo **"Entregue a atendimento humano · opção do menu"**; Estado: **"Entregue a atendimento humano — o robô está em silêncio"** | Visual |
| 12.3 | **"Reiniciar simulação"** | Chat limpo ("Simulador reiniciado! Digite algo para rodar o fluxo."); Estado: "Fora do menu — a próxima mensagem inicia o fluxo" | Visual |

**Caso 13 — Resposta inválida ×N → entrega (tentativas esgotadas)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 13.1 | `oi` (menu) → `abc` | "Resposta inválida. Responda com uma opção válida." + o menu; Estado: **"respostas inválidas: 1 de 3"** | Visual |
| 13.2 | `xyz` | Idem; **"2 de 3"** | Visual |
| 13.3 | `qqq` (3ª inválida = `maxTentativas`) | Bolha = cortesia com selo **"Entregue a atendimento humano · tentativas esgotadas"**; Estado "Entregue a atendimento humano — o robô está em silêncio" | Visual |
| 13.4 | `alô?` | **Sem bolha de robô**; aviso do simulador "🔇 Robô em silêncio — esta conversa foi entregue a um atendente humano. Use “Reiniciar simulação” para devolver ao robô." | Visual — **o robô responder aqui é VERMELHO** |
| 13.5 | **"Reiniciar simulação"** | Volta ao início | Visual |

**Caso 14 — Opção → mensagem → IA (modo IA, selo)** (R8)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 14.1 | `oi` → `2` | Bolha = "Certo! Me conte o que você precisa. Para voltar ao menu, envie “menu”." com selo **"Passou para a IA — robô scriptado encerrado"** (**sem** chamar a IA); Estado: **"Conversa com a IA — robô scriptado encerrado"** | Visual |
| 14.2 | `qual o horário de vocês?` | **Resposta da IA** (texto livre), **sem** selo de transição; Estado continua "Conversa com a IA…" | Visual |
| 14.3 | Mais uma mensagem qualquer | IA responde de novo; **o menu NÃO volta** | Visual — o menu reaparecer sozinho é **VERMELHO** |

**Caso 15 — Opção → IA direto (R8 ajuste: IA responde já + fica em modo IA)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 15.1 | Canvas: religar a **opção 2** direto ao **Agente IA (Gemini)** (item "— a IA responde daqui em diante"), **"Salvar Fluxo"**, **"Reiniciar simulação"** | — | — |
| 15.2 | `oi` → `2` | **Resposta da IA já nesta mensagem**, com selo **"Passou para a IA — robô scriptado encerrado"**; Estado "Conversa com a IA…" | Visual |
| 15.3 | Mensagem seguinte | IA responde, sem selo; menu não volta | Visual |
| 15.4 | Restaurar a opção 2 → "Saudação da IA", **"Salvar Fluxo"** | — | — |

**Caso 16 — Palavra de retorno (R9)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 16.1 | Em modo IA (14.1), enviar `menu` | **Bolha = o menu** com selo **"Voltou ao menu — conversa com a IA encerrada"** (**sem** IA); Estado "No menu … 0 de 3" | Visual |
| 16.2 | Voltar a modo IA (`2`) e enviar `MENU`, depois ` Menu ` | Cada um **volta ao menu** (caixa e espaços não importam) | Visual |
| 16.3 | Voltar a modo IA e enviar `Ménu` | Volta ao menu (acento não importa) | Visual |
| 16.4 | Voltar a modo IA e enviar `quero voltar ao menu` | **A IA responde** (substring **não** dispara); Estado continua "Conversa com a IA…" | Visual — **voltar ao menu aqui é VERMELHO** |
| 16.5 | Idem `menus` e `menu!` | A IA responde | Visual |
| 16.6 | Apagar a palavra no Agente IA (campo vazio), **"Salvar Fluxo"**, repetir `2` → `menu` | **A IA responde** (sem palavra = sem saída); restaurar `menu` e salvar | Visual |

**Caso 17 — Faixa de problemas no simulador (R10)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 17.1 | Provocar 1 erro (6.1) **sem** salvar | No topo do painel do simulador, faixa **"Problemas do fluxo: 1 erro — o robô pode não se comportar como desenhado…"** | Visual |
| 17.2 | Corrigir | Faixa some | Visual |
| 17.3 | Provocar **só aviso** (6.9) | **Sem** faixa (avisos não poluem o simulador) | Visual |

---

# BLOCO 2 — Smoke real por WhatsApp — **depois do §8-b-bot**

**Gate gate:** só começa depois de TODOS: (a) as 4 migrations aplicadas e provadas
([pacote §2/§3](etapa-9-bot-pacote-operador-8b.md)): `bot_flow_state`, `handover_at`,
`ai_knowledge_consents` (RLS + 3 policies), `assignment_origin`; (b) as 3 functions
deployadas com a **pré-prova de hash** ([pacote §4.1](etapa-9-bot-pacote-operador-8b.md)) e com os
arquivos esperados no output do deploy; (c) o app web com o hash do §1.1. Qualquer um
faltando → **não iniciar** (não é vermelho; é pré-condição). Usar **número/instância de TESTE**
conectado ao workspace de teste — **nunca** cliente real. Print pré-clique em todo passo que grava.

**Caso 20 — Pré-prova do schema (SELECTs do pacote §3, resumidos)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 20.1 | Colunas | 2 linhas: `bot_flow_state` jsonb YES; `handover_at` timestamptz YES | `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='whatsapp_conversations' AND column_name IN ('bot_flow_state','handover_at') ORDER BY column_name;` |
| 20.2 | Consentimento | tabela existe, RLS ligada, 3 policies, 0 linhas | pacote §3.4 |
| 20.3 | `assignment_origin` | coluna + CHECK existem | pacote §3.5 |

**Caso 21 — Fluxo de teste salvo e bot ativo**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 21.1 | Exemplo íntegro (Caso 8) com `maxTentativas = 3`, títulos `HOMOLOG-BOT-…`; interruptor **"Status do Robô"** → **"🟢 Ativo em Produção"**; **"Salvar Fluxo"** | Toast de sucesso | `SELECT is_active, jsonb_array_length(flow_data) FROM public.whatsapp_bot_settings WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → `true`, 7 |

**Caso 22 — Menu de entrada (R3/R6)** — celular de teste

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 22.1 | Cliente envia `oi` | Recebe o menu (mensagem + opções numeradas) | WhatsApp + `SELECT bot_flow_state, handover_at FROM public.whatsapp_conversations WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND contact_phone = '<TEL_TESTE>';` → `{"currentNodeId":"<id do menu>","attempts":0}`, `handover_at` NULL |

**Caso 23 — Mensagem informativa → volta ao menu (R7)**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 23.1 | Cliente envia `1` | **Uma mensagem** com "Atendemos de segunda a sexta, das 9h às 18h." + linha em branco + o menu | WhatsApp; `bot_flow_state` = `{"currentNodeId":"<id do menu>","attempts":0}` (a mensagem **não** vira estado) |

**Caso 24 — Opção inválida ×N → handover (R4)** — `maxTentativas = 3`

| Passo | Cliente | Esperado no WhatsApp | `bot_flow_state` / `handover_at` |
|---|---|---|---|
| 24.1 | `abc` | "Resposta inválida. Responda com uma opção válida." + menu | `attempts = 1` / NULL |
| 24.2 | `xyz` | idem | `attempts = 2` / NULL |
| 24.3 | `qqq` | **Cortesia** ("Encaminhando o seu contato para o atendimento humano…") | `bot_flow_state` NULL / `handover_at` **preenchido** |
| 24.4 | `alô?` | **Nenhuma resposta do robô** | inalterado |

Prova do 24.3/24.4 (SELECT depois da ação): `SELECT bot_flow_state, handover_at FROM public.whatsapp_conversations WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND contact_phone = '<TEL_TESTE>';`.
Log (Dashboard → Edge Functions → `whatsapp-bot-reply` → Logs): `human handover for conversation <id> (reason: menu_exhausted)`; no 24.4, **nenhuma invocação** com o webhook novo (ou `skipped … handed over to human`).

**Caso 25 — UI de Atendimento: banner, badge, "Devolver ao robô"**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 25.1 | Abrir a conversa de teste em Atendimento (WhatsApp) | Banner **"Entregue a atendimento humano desde …"**; na lista, o badge **"Aguardando humano"** (entregue e **sem** atendente — `b40bb5a`); o badge calmo **"Humano"** só aparece quando há atendente atribuído (se algum humano já tinha escrito na conversa, o handover a atribui sozinho — `assignment_origin = 'auto'`) | Visual + o SELECT do Caso 24 (`handover_at` preenchido) |
| 25.2 | Clicar **"Devolver ao robô"** (print pré-clique) | Toast **"Conversa devolvida ao robô"**; banner some; badge some | `SELECT bot_flow_state, handover_at FROM public.whatsapp_conversations WHERE … contact_phone = '<TEL_TESTE>';` → **ambos NULL** |
| 25.3 | Cliente envia `oi` | **Menu de novo, do zero** | `bot_flow_state` volta a `{"currentNodeId":…,"attempts":0}` |

**Caso 26 — Opção → atendente (R4)**: repetir 22→`3` | Cortesia imediata | `handover_at` preenchido; log `(reason: menu_option)`. Devolver ao robô ao final.

**Caso 27 — Modo IA persistido pelo WhatsApp (R8/R9)** — IA configurada (§1.4)

| Passo | Cliente | Esperado | Prova |
|---|---|---|---|
| 27.1 | `oi` → `2` | Recebe a saudação ("Certo! Me conte o que você precisa. Para voltar ao menu, envie “menu”.") — **sem** resposta de IA nesta virada | `bot_flow_state` = `{"currentNodeId":"<id do nó ai, normalmente node-ai>","attempts":0}` |
| 27.2 | `qual o horário de vocês?` | **Resposta da IA**; o menu **não** reaparece | `bot_flow_state` inalterado (marcador) |
| 27.3 | `quero voltar ao menu` | **IA responde** (substring não dispara) | marcador inalterado |
| 27.4 | `Menu` | **Menu de volta**, sem IA | `bot_flow_state` = `{"currentNodeId":"<id do menu>","attempts":0}`; log `left AI mode (node …) by return word` |
| 27.5 | Opção 2 direto → Agente IA (se testado, Caso 15): `oi` → `2` | IA responde **já**; marcador gravado; log `menu flow handed to AI node` | `bot_flow_state` = marcador do nó ai |

**Caso 28 — Mensagem → atendente (R8)** (opcional, exige religar uma mensagem ao Transbordo): cliente escolhe a opção → recebe **o texto da mensagem como cortesia** (não a padrão) → `handover_at` preenchido; log `(reason: message_next)`. Devolver ao robô ao final.

**Caso 29 — Base de conhecimento, categoria A "itens já orçados" (item 3)** — pacote §5.2, passos 8–12

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 29.1 | Pré-requisito: o workspace de teste tem **≥ 2 orçamentos** enviados/aprovados/recusados (não rascunho, não arquivado) com **o mesmo item** (ex.: `HOMOLOG-BOT-Landing Page`) e que **não citam cliente cadastrado** | — | — |
| 29.2 | Configurações → **"Cérebro do Robô"** → **"Base de conhecimento do Robô"** → ligar **"Mostrar a base de conhecimento"** → ligar **"Itens já orçados"** (como dono/admin) | Toast **"Base de conhecimento ligada"** | `SELECT category, enabled, revoked_at FROM public.ai_knowledge_consents WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → 1 linha `catalog | true | NULL`. B/C/D/E aparecem **desabilitadas** (não tentar ligar) |
| 29.3 | **Simulador** (Bloco 1B): modo IA e uma pergunta sobre o item (`quanto custa HOMOLOG-BOT-Landing Page?`) | Resposta da IA com o selo **"Base de conhecimento · N itens já orçados no contexto"** | Visual |
| 29.4 | **WhatsApp real**: mesma pergunta em modo IA | **Resposta citando o item** (e o valor) vindo dos orçamentos | WhatsApp + log `[bot-reply] knowledge block entered: categories=catalog included=N omitted=M` |
| 29.5 | **Privacidade:** conferir selo, log e resposta | **Nenhum** nome de cliente, e-mail ou telefone; item que aparece em **1** orçamento só **não** entra | Visual + log |
| 29.6 | Desligar "Itens já orçados" | Toast **"Base de conhecimento desligada"**; próxima resposta de IA **sem** selo e **sem** a linha de log | `SELECT category, enabled, revoked_at FROM public.ai_knowledge_consents WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → `catalog | false | <timestamp>` |

**Caso 30 — Logs proibidos (pacote §5.3)**: depois de todo o Bloco 2, nos logs de `whatsapp-bot-reply`/`whatsapp-instance` **não** pode ter: `failed to persist handover state`, `failed to persist bot_flow_state`, `failed to persist AI-mode bot_flow_state`, `failed to record assignment_origin`, `failed to clear automatic assignment`, `knowledge consents unavailable`. Qualquer um → a coluna/tabela correspondente não está funcionando → **vermelho** (voltar ao pacote §3).

---

## Caso 40 — Limpeza final (todos os blocos)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 40.1 | **"Devolver ao robô"** em toda conversa de teste entregue; desligar "Itens já orçados" | Estados zerados | `SELECT count(*) FROM public.whatsapp_conversations WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND (handover_at IS NOT NULL OR bot_flow_state IS NOT NULL);` → **0** |
| 40.2 | Restaurar o fluxo: **operador** roda o UPDATE a partir do snapshot do §1.2 (Code não roda DML), ou, se o workspace não tinha linha, `DELETE` da linha criada; ou pela UI: excluir os nós `HOMOLOG-BOT-…` e salvar | Fluxo do workspace de teste = snapshot | `SELECT id, is_active, flow_data FROM public.whatsapp_bot_settings WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → idêntico ao snapshot |
| 40.3 | Interruptor "Status do Robô" volta ao valor do snapshot (`is_active`) | — | mesma SELECT |
| 40.4 | Consentimento: se a linha `catalog` foi criada pelo teste (a tabela estava vazia no §3.4 do pacote), o **operador** pode removê-la | Resíduo zero | `SELECT count(*) FROM public.ai_knowledge_consents WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9';` → 0 |
| 40.5 | Orçamentos sintéticos `HOMOLOG-BOT-…` (Caso 29.1): excluir/arquivar | — | `SELECT count(*) FROM public.quotes WHERE workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND title LIKE 'HOMOLOG-BOT-%';` → 0 (ajustar a coluna de título conforme o schema do workspace) |
| 40.6 | Mensagens/conversa do número de teste | Deixar (é o número de teste) **ou** o operador apaga | — |
| 40.7 | Limpar arquivos `.json` exportados e `localStorage` setado manualmente | — | — |

---

# BLOCO 3 — Critérios de vermelho, ressalva e achado

- **Vermelho (para a homologação):** o comportamento observado ao vivo diverge do desenhado/documentado. Aciona: diagnóstico → correção → novo commit → **PARADO** → aguardar novo "vai" (§18). **Vermelhos automáticos:**
  - **Caso 4.2** — Delete/Backspace dentro de um campo do inspector apaga nó ou linha (perda de dado);
  - **Caso 9.2** — qualquer trecho de credencial (chave Gemini / service account) no arquivo exportado;
  - **Caso 7.2** — "Salvar mesmo assim" não salva, ou "conserta" o defeito em silêncio;
  - **Caso 13.4 / 24.4** — o robô responde numa conversa já entregue a humano;
  - **Caso 14.3 / 15.3 / 27.2** — o menu reaparece sozinho em modo IA;
  - **Caso 16.4 / 27.3** — frase que apenas **contém** a palavra de retorno tira a conversa do modo IA;
  - **Caso 9.9** — importar grava no banco antes de "Salvar Fluxo", ou apaga/substitui algo existente;
  - **Caso 30** — qualquer log proibido depois das migrations.
- **Ressalva (não bloqueia):** mecanismo já provado por outra via (teste automatizado + outra observação) e só uma recaptura específica não foi refeita. A decisão de não reabrir é registrada explicitamente. **Ressalvas pré-declaradas** (não são vermelho se não reproduzidas): `destino-removido` e `entrada-invalida` (Caso 6, não provocáveis pela UI); `sem-caminho-humano-ia` (6.12, raro por desenho); passo 28 (opcional).
- **Achado catalogado, não é bug:** comportamento real, documentado, decisão de produto. **Já conhecidos:** (a) **sem saída do modo IA** além da palavra de retorno, do operador "devolvendo ao robô" ou de desabilitar o nó ai; (b) palavra de retorno que colide com palavra-chave de handover **vence** (aviso na validação, R9/R10); (c) a atribuição automática ao último atendente (`assignment_origin = 'auto'`) **existe desde `b40bb5a`** (handover) e `df023a3` (G101: controle de atribuição no painel; G102: assumir ao responder) e **só age com a 4ª migration**; este runbook **não a cobre** — o pacote 8-b, passos 17–28, sim; (d) exportar/importar **adiciona**, não restaura os 4 fixos (R11).
- **Pré-condição não satisfeita ≠ vermelho:** function antiga (Caso 11.3), IA sem credencial (§1.4), migration/deploy faltando (gate do Bloco 2). Registrar e parar o bloco.
- **Placar de fechamento (formato herdado):** `N/M casos verdes por bloco` — 1A (Casos 1–9), 1B (11–17), 2 (20–30) — **com** os Casos 2–4 (gestos do canvas, primeira prova real), 9.2 (sem credencial no arquivo) e 24 (handover ponta a ponta, com `SELECT handover_at`) **obrigatoriamente** incluídos e nenhum fechado como "assumido correto". Ressalvas e achados ficam listados no sign-off.
- **Rollback:** código — `git revert` do commit da rodada que falhou (nunca de vários juntos); banco/functions — [pacote §7](etapa-9-bot-pacote-operador-8b.md). Dado de teste: Caso 40.

## O que este doc NÃO faz

- Não executa nenhum caso, não aplica DDL/DML e não faz deploy (protocolo §0/§6/§8-b) — as SQLs de escrita (Caso 40.2/40.4) são **do operador**.
- Não cobre a atribuição automática (G48 D1, `b40bb5a`/`df023a3` — ver pacote 8-b, passos 17–28) nem os consentimentos B–E da base de conhecimento (desabilitados na UI).
- Não substitui os gates permanentes do protocolo (EXPORT MANUAL, PRINT PRÉ-CLIQUE, prova de servidor §17).
- Não promove as migrations a `supabase/migrations/*.sql` (pacote §8.1, outra rodada).
