# Etapa 9 · Item 3 — Base de conhecimento do robô — R1 (liga a fundação)

> **Zero DDL/DML, zero deploy.** Esta rodada **liga** o que a fundação preparou
> ([`etapa-9-item3-r1-base-conhecimento-fundacao.md`](etapa-9-item3-r1-base-conhecimento-fundacao.md)),
> conforme as decisões **Q1–Q6 oficiais** do revisor. Tudo que depende do banco
> é **inerte até o operador aplicar a migration** (DRAFT no §4 da fundação):
> sem a tabela de consentimento nenhuma categoria está ativa e o robô é
> **idêntico ao de hoje** (§6, "modos de falha").

## 1. Decisões oficiais → o que foi implementado

| Decisão | Implementação |
|---|---|
| **Q1** fonte da A = `quote_items` agregado; rótulo "itens já orçados"; sem texto livre que possa conter nome de cliente | `_shared/knowledgeSources.ts` (agregação + sanitização em 3 camadas, §3); rótulo honesto na UI e no selo do simulador |
| **Q2** leitura direta com teto, sem cache | Sem tabela de resumo, sem job: o bloco é montado **na hora da chamada** (`knowledgeLoader.ts`) |
| **Q3** escrita admin, leitura member | DRAFT de RLS (fundação §4); UI usa `useWorkspaceRole` — não-admin vê o estado mas o toggle fica desabilitado, com o aviso |
| **Q4** teto agregado 2.500 tokens, item inteiro ou nada | `KNOWLEDGE_BLOCK_MAX_TOKENS = 2500` em `brainComposer.ts` + estimador conservador (§4) |
| **Q5** só A operante; C/D/E desabilitadas na UI | A operante; B/C/D/E desabilitadas com o motivo na tela; **o servidor também ignora** B/C/D/E (só `catalog` tem leitor) |
| **Q6** catálogo na nuvem fora do item 3 | **G94** (ABERTO); a UI diz que "itens já orçados" **não é** o catálogo |

## 2. Classificação das categorias (Q5: "as que você classificar como sem dado pessoal")

| Cat. | Conteúdo | Classificação | Operante nesta rodada? |
|---|---|---|---|
| **A** `catalog` — itens já orçados | nome do item + nº de orçamentos + faixa de preço, **agregado**, sanitizado (§3) | **Sem dado pessoal por construção** — o que sai é o nome de um serviço (já filtrado contra clientes cadastrados) e números | **Sim** |
| **B** `internal_ops` — tarefas/projetos | títulos/status em **texto livre** ("Reunião com Maria sobre contrato") | **Não** classificada como sem dado pessoal: o texto livre cita cliente com frequência e **não há leitor** nem sanitizador | **Não** — desabilitada, com motivo |
| **C** `crm` | cadastro/oportunidades | dado pessoal de terceiro | Não — exige atesto; desabilitada |
| **D** `conversations` | conteúdo de conversas | dado pessoal de terceiro (o mais sensível) | Não — exige atesto; desabilitada |
| **E** `financial` | transações | dado financeiro ligado a cliente | Não — exige atesto; desabilitada |

Decisão: **não habilitei B** porque (i) não é "sem dado pessoal" e (ii) ligá-la sem
leitor repetiria o padrão **G48** (toggle com efeito parcial — G29/G40).

## 3. Sanitização da categoria A (testada)

O item de orçamento (`quote_items.name`) é **texto livre digitado pelo operador**,
então "Landing Page para a Maria" é um nome de item válido. Pipeline (em
`knowledgeSources.ts`; na dúvida o item **não** entra):

1. **Forma** — rejeita e-mail/`@handle`, URL/domínio, 8+ dígitos (telefone/CPF/CNPJ) e nome com mais de 80 caracteres (descrição, não serviço).
2. **Cliente** — rejeita se o nome citar qualquer cliente/empresa **cadastrado** do workspace (`clients.name/company` + `quotes.client_name/company`): frase inteira **ou** qualquer palavra do nome com 4+ letras, sem acento/caixa, **palavra inteira** (cliente "Maria" não bloqueia "Mariana"). Esses nomes são lidos **só pra mascarar**; nunca saem.
3. **k-anonimato** — o item só entra se aparece em **≥ 2 orçamentos distintos**. O que aparece uma vez só é o que costuma carregar contexto de um cliente.

**O que nunca é lido:** título, descrição, notas, e-mail, WhatsApp, empresa do orçamento;
quantidades; qualquer campo de `clients` além do nome/empresa usados na máscara.
**Orçamentos considerados:** `sent`/`approved`/`rejected` (rascunho é inacabado), não
arquivados, não excluídos — filtro aplicado **na query e de novo em código**.

**Trade-offs assumidos (afinar com o revisor se incomodar):**
- *Falso positivo por palavra de cliente:* cliente "Social Brasil" derruba "Social Media Mensal" (palavra "social"). Custo: bloco menor, nunca vazamento.
- *Workspace novo / poucos orçamentos:* k=2 deixa o bloco vazio — o robô fica como hoje. Isso é aceito por desenho.
- *Limite do texto livre (Fase A §1.3):* a máscara só conhece clientes **cadastrados**; um nome que nunca foi cadastrado e aparece em 2+ orçamentos pode passar. O opt-in explícito + o aviso na UI cobrem o resto.

## 4. Teto de 2.500 tokens

Sem tokenizer na edge function: `estimateTokens = ceil(chars / 3)` — **conservador**
(o real fica em ~3,5–4 chars/token em português, então o bloco "de 2.500" é menor que
2.500 de verdade). Item **inteiro ou nada**; para no primeiro que estoura (ordem
preservada: mais orçado primeiro). `omitted` conta o que ficou de fora e vai pro log e
pro selo do simulador. É heurística de custo, não medição contábil.

## 5. Fluxo no servidor (`whatsapp-bot-reply/index.ts`)

Ponto único de composição, **logo depois do fetch do cérebro**, só no caminho de IA:

```
consentimento (1 SELECT) → parse defensivo → activeCategories (gate reaplicado)
  → ∩ categorias com LEITOR implementado ("catalog")
  → [vazio] fim — nenhuma leitura de dado de negócio
  → quotes+quote_items, clients, workspaces.currency (3 SELECTs, em paralelo)
  → sanitiza/agrega → buildKnowledgeBlock(teto) → composeSystemInstruction(brain, instrução, bloco)
```

- **Custo por mensagem de IA:** +1 SELECT leve (consentimento) com tudo desligado; +3 SELECTs quando a A está ativa. **Menu, handover e silêncio (R3/R4) nunca chegam aqui** — retornam antes: custo zero (D7).
- **Simulador (isTest):** mesmo ponto, mesmo primitivo (`loadKnowledgeForPrompt`).
- Quotes lidos: no máximo os **500 mais recentes**; clientes: até 2.000 (só pra máscara).

### Modos de falha (todos caem em "bot idêntico a hoje")

| Situação | Resultado |
|---|---|
| Tabela `ai_knowledge_consents` ausente (migration pendente) | `warn` + bloco vazio; sem leitura de dado |
| Sem linha / `enabled=false` / revogada | bloco vazio; sem leitura de dado |
| C/D/E ligadas **sem atesto** (UPDATE direto) | ignoradas (gate do servidor) |
| B/C/D/E ligadas **com** atesto, mas sem leitor | ignoradas — o servidor só lê `catalog` |
| Falha ao ler quotes **ou clients** | bloco vazio (nunca um bloco sem a máscara de clientes) |
| Falha só na moeda | segue com BRL |
| Qualquer exceção no loader | absorvida; bloco vazio; resposta do robô segue |

## 6. UI (Configurações → "Cérebro do Robô", abaixo do cérebro)

Seção **"Base de conhecimento do Robô"** (`AiKnowledgeSection.tsx`): interruptor
"Mostrar a base de conhecimento" (flag **só de UI** `kora.ai.knowledgeBase.enabled`,
default OFF — uma categoria já ligada continua valendo pro robô mesmo com ele
desligado, igual ao cérebro) + 5 categorias, default OFF. O que a tela mostra como
"ligado" é a **mesma regra** que o servidor aplica (`activeCategories`), não só a
coluna `enabled`. Admin-gated (Q3). **Tabela ausente:** aviso "ainda não está
disponível neste ambiente… o robô segue respondendo como antes" e tudo desabilitado.

## 7. Simulador — selo de paridade

Quando um bloco **realmente entrou** no prompt de uma resposta de IA, o server anexa
`simulation.knowledge = { categories, included, omitted }` (o **mesmo resultado** do
primitivo de produção, via `withKnowledgeInfo` — sem recalcular) e o painel mostra,
sob a bolha da IA, o selo **"Base de conhecimento · N itens já orçados no contexto
(+M de fora pelo limite)"** (ícone e cor próprios, distintos do selo de handover).
Sem categoria ativa: nenhum campo novo na resposta — simulador **idêntico a antes**.

## 8. Testes e prova

| Arquivo | Testes |
|---|---|
| `knowledgeSources.test.ts` | 25 — normalização, termos de cliente, sanitização (forma/cliente/palavra inteira), filtro de status, k-anonimato, agregação, formatação, ponta a ponta sem campo de cliente |
| `knowledgeLoader.test.ts` | 16 — default OFF, atesto, revogação, C/D/E/B ignoradas, degradação sem tabela/leitura/exceção, teto fim a fim |
| `botFlowSimulation.knowledge.test.ts` | 6 — selo anexado/ausente; **paridade com o primitivo de produção** |
| `brainComposer.knowledge.test.ts` | +estimador e teto em tokens (3 testes do builder **mudaram deliberadamente** de caracteres pra tokens) |
| `flowSimulatorModel.knowledge.test.ts` | 6 — selo, rótulo honesto, ausência, malformado |
| `aiKnowledgeConsentsRepository.test.ts` | 10 — tabela ausente = estado, gate do atesto, revogação sem apagar |
| `AiKnowledgeSection.test.tsx` | 14 — default OFF, rótulo honesto, só A operante, admin-gated, degradação |
| `WhatsAppBotConfig.simulator-knowledge.test.tsx` | 3 — painel real + motor real + primitivo real |
| `flags.test.ts` | +1 |

**Divergência deliberada em teste pré-existente:** `flowSimulatorModel.test.ts` — o
selo de handover ganhou `tagKind: "handover"` (o painel desenha o selo de handover e o
de conhecimento de forma diferente).

**Prova fail→fix→pass por patch (G65, sem `git stash`):** `git add -N` (4 arquivos novos)
→ `git diff` de todos os 11 arquivos de implementação → `git checkout --` → `vitest run`
dos 10 arquivos de teste: **81 falharam, 79 passaram** (os pré-existentes dos mesmos
arquivos) → `rm` + `git apply` do mesmo patch → **160/160**. O wiring em `index.ts`
(`Deno.serve`) não tem teste direto — convenção da function; toda a decisão está nos
módulos testados.

## 9. Passos do OPERADOR (nada executado aqui)

1. **Verificação prévia + DDL + prova:** exatamente o SQL do §4 de
   [`etapa-9-item3-r1-base-conhecimento-fundacao.md`](etapa-9-item3-r1-base-conhecimento-fundacao.md)
   (tabela esperada: ausente → 1 tabela, 3 policies, 0 linhas). **Sem alteração** nesta rodada.
2. **Deploy** (pré-prova de hash, como no pacote 8-b): `npx supabase functions deploy whatsapp-bot-reply --project-ref ewamvzncsloagtcvkbxv`. Arquivos que devem aparecer no output: `index.ts`, `_shared/knowledgeLoader.ts`, `_shared/knowledgeSources.ts`, `_shared/knowledgeConsent.ts`, `_shared/brainComposer.ts`, `_shared/botFlowSimulation.ts`.
3. **Ordem:** a migration pode vir antes **ou** depois do deploy — sem a tabela o servidor degrada (§5). Aplicar antes só deixa a UI operável.
4. **Smoke (workspace de teste):** ligar "itens já orçados" em Configurações → com ≥ 2 orçamentos enviados contendo o mesmo item, mandar uma mensagem de IA pelo simulador → selo "Base de conhecimento · N itens já orçados" na resposta → desligar → selo some e a próxima resposta volta ao normal. No log da function: `knowledge block entered: categories=catalog included=N omitted=M`.
5. **Depois:** regenerar `types.ts` e trocar o cliente "untyped" de `aiKnowledgeConsentsRepository.ts` pelo tipado (mesma rodada de lane do `handover_at`, pacote 8-b §8.3).

## 10. Em aberto / próximos passos

- **G94** — catálogo na nuvem (trilha Vendas/Serviços): quando existir, a categoria A pode trocar `quote_items` pelo catálogo real.
- **B/E** — ganhar leitor + sanitizador próprio antes de qualquer habilitação.
- **C/D** — Fase B própria (atesto na UI, escopo por cliente-alvo — R5, FTS/recuperação).
- Afinar k (=2), o limite de 500 orçamentos e a heurística de 3 chars/token com uso real.
- O consentimento é lido a **cada** mensagem de IA (1 SELECT); se virar custo relevante, cachear por workspace com TTL curto — não feito agora (revogação precisa valer imediatamente).

**PARADO aqui — conhecimento ligado (A) no servidor, UI e simulador; tudo inerte até a migration
(DRAFT) ser aplicada; zero DDL/deploy, zero push/merge. §18.**
