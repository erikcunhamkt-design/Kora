# Etapa 9 · Item 3 — Base de conhecimento: categorias B–E — Fase A (para o operador DECIDIR)

> **Doc-only, zero código, zero DDL.** Este documento **não implementa nada** e **não pede aprovação de
> implementação**: ele existe para o operador **decidir** quais categorias além da A ("itens já orçados") o
> robô deve ler, **com quais limites**, e para deixar escrito *por que* cada uma é recomendada ou não.
> Continua a Fase A original ([`etapa-9-item3-base-conhecimento-fase-a.md`](etapa-9-item3-base-conhecimento-fase-a.md),
> §1.2: A–E definidas) e a fundação/liga ([`…-fundacao.md`](../qa/etapa-9-item3-r1-base-conhecimento-fundacao.md),
> [`…-liga.md`](../qa/etapa-9-item3-r1-base-conhecimento-liga.md)), onde o revisor deixou **só a A operante** e B–E
> "desabilitadas, com motivo".
>
> **Aviso (G29): isto é análise técnica de produto, não parecer jurídico.** As bases legais citadas (Lei 13.709/2018)
> são o enquadramento que o desenho precisa respeitar; **a validação final é do operador, com a assessoria dele**.

**Branch:** `docs-item3-categorias-b-e-fase-a`, a partir de `origin/main` = `7dd8acd` (2026-10-19).

**Categorias (as da fundação — `knowledgeConsent.ts`):** **A** `catalog` (feita) · **B** `internal_ops` (tarefas/projetos) ·
**C** `crm` (clientes, contatos, oportunidades, ficha técnica) · **D** `conversations` (conversas/histórico) · **E** `financial` (transações).

---

## 0. Resumo — a recomendação em uma tabela

A pergunta "o robô lê a categoria X?" é boa demais para responder "sim/não": **a mesma categoria tem partes que valem e partes
que nunca devem entrar.** A tabela quebra cada letra em sub-itens (as "linhas" que de fato decidem risco e valor).

| Sub-item | Exemplo de pergunta do cliente que só se responde com isso | Recomendação |
| :-- | :-- | :-- |
| **B-projetos** — status/prazo dos projetos **do próprio cliente da conversa** | "Como está o meu site?", "Qual o prazo da entrega do logo?" | ✅ **Implementar COM restrição** (só o cliente da conversa, campos permitidos, falha fechada) |
| **B-tarefas** — to-dos internos | "Alguém já olhou meu pedido?" (a resposta honesta é interna) | ❌ **Não implementar** (texto livre interno; o valor para o cliente é ~0, o risco de expor bastidor é real) |
| **C-orçamentos próprios** — status/total/validade dos orçamentos **do cliente da conversa** | "Meu orçamento foi aprovado?", "Quanto ficou?", "Até quando vale a proposta?" | ✅ **Implementar COM restrição** — é a pergunta de **maior valor** de todas (ver §4.2; a Fase A original não deu "casa" a ela) |
| **C-cadastro mínimo** — nome/empresa do cliente da conversa | tratar pelo nome certo | ✅ **Implementar COM restrição** (trivial; baixo valor isolado — nasce como cabeçalho do bloco "do cliente") |
| **C-resto** — e-mail, telefone, endereço, **CPF/CNPJ**, `notes`, contatos de terceiros, ficha técnica (briefing/persona/branding) | "Confirma meu CNPJ?" (nunca responder: é autenticação) | ❌ **Não implementar** |
| **D-histórico próprio além de 12 mensagens** — "memória" da própria conversa | "Como combinamos semana passada?" | ⚠️ **Não como categoria da base.** É um **botão de configuração do bot** (`MAX_HISTORY`), outra decisão (§4.3) |
| **D-outras conversas / de outros clientes** | "Qual foi a dúvida mais comum?" | ❌ **NUNCA** |
| **E-agregado** — faturamento, ticket médio por faixa | (nenhuma pergunta de cliente) | ❌ **Não implementar** (valor ≈ 0, expõe segredo do negócio) |
| **E-próprio cliente** — situação de cobranças/pagamentos do cliente da conversa | "Meu pagamento caiu?", "Quando vence meu boleto?" | ⏸️ **Não agora — depende de definição de produto** (o robô cobra? status-only?) (§4.4) |

**Sua hipótese (B e C só com escopo "do próprio cliente", resolvido por telefone→cliente; D nunca; E depende da definição) está
confirmada, com 3 ajustes que o código impõe:**
1. **O telefone→cliente que existe hoje no repo não serve** (primeira correspondência vence, sem detectar ambiguidade) e
   **`conversations.client_id` só é preenchido à mão** (§1, §3). O resolvedor novo precisa **falhar fechado**.
2. **Tarefas (B) saem fora, projetos ficam**; e **orçamentos próprios (C) são o item de maior valor** — a Fase A original
   não os classificou (a categoria A é só agregada).
3. **D "nunca" vale para conversas de outros; "memória da própria conversa" é uma decisão diferente e já parcialmente existe** (o robô
   já recebe as 12 últimas mensagens — §1).

---

## 1. Fatos verificados no código (nada de suposição)

| # | Fato | Evidência | Por que importa |
| :-- | :-- | :-- | :-- |
| 1 | O robô **já envia ao provedor de IA** as **últimas 12 mensagens da própria conversa** | `whatsapp-bot-reply/index.ts:203` (`MAX_HISTORY = 12`) | O "conteúdo de conversa do cliente" **já** sai do sistema hoje; D-própria não é um tipo novo de dado, é **mais** dele |
| 2 | `whatsapp_conversations.client_id` e `opportunity_id` **existem**, mas **só são gravados à mão** (painel do contato: "Vincular cliente"/"Criar cliente") | `WhatsAppContactPanel.tsx:312, 386`; **nenhuma** escrita de `client_id` em `whatsapp-webhook`/`-instance`/`-bot-reply` | Cobertura do vínculo = **disciplina do atendente**; conversa sem vínculo = o leitor **não tem cliente-alvo** |
| 3 | O único cruzamento telefone→cliente do repo (`whatsappAudiencesRepository.ts`, ~l.190–205) usa **"primeira correspondência vence"** (`!clientByPhone.has(p)`) | idem | Serve para estatística de audiência, **não** para decidir **de quem** é o dado que vai a um prompt |
| 4 | `bot-reply` lê a conversa com `select("*")` ⇒ a coluna **`client_id` já vem** na linha (e `contact_phone`, já tipado) — só **falta declará-la** na interface `ConversationRow` | `index.ts:637-643` (fetch) e `:90-94` (interface, sem `client_id`) | O leitor por-cliente cabe no mesmo ponto único de composição, **sem nova consulta de conversa** (só um campo a mais no tipo) |
| 5 | **A migration `ai_knowledge_consents` ainda NÃO foi aplicada** (§8-b do bot) e o draft só exige atesto (`legal_basis_ack`) para `crm`/`conversations`/`financial` — **não** para `internal_ops` | fundação §4; `knowledgeConsent.ts:33-35` | **Janela de decisão:** dividir/renomear categorias **agora** é grátis; **depois** de aplicada vira `ALTER` (§7) |
| 6 | A UI hoje descreve B–E como leitura **ampla do workspace** ("Dados dos seus clientes e oportunidades como contexto") | `AiKnowledgeSection.tsx` (textos de `CATEGORY_COPY`) | Se a leitura for **por cliente**, o texto vira **falso** (G29) — copy precisa ser reescrita junto |
| 7 | Teto agregado do bloco: **2.500 tokens** (item inteiro ou nada); estimador `ceil(chars/3)` (conservador) | `brainComposer.ts:76,85` | B–E dividem o **mesmo** teto da A (Q4 oficial) |
| 8 | Rate limit do robô: **20 chamadas/min por workspace** (webhook) e 10 (simulador) | `index.ts:528-529` | Dá o teto de custo no pior caso (§5) |
| 9 | **O simulador não tem conversa-alvo** (`isTest`) | fundação D8 | Categorias **por cliente** **não podem ser provadas no simulador** sem um "cliente de teste" (decisão de produto, §7) |
| 10 | Conversa **entregue a humano** nunca chega à IA; menu/handover/silêncio retornam **antes** do bloco | fundação D7/D8, R4 | Custo zero nesses caminhos, por construção |
| 11 | **Camadas de sanitização da A** (reusáveis): **forma** (e-mail/URL/8+ dígitos/nome longo), **cliente cadastrado** (palavra inteira, 4+ letras, sem acento), **k-anonimato** (k ≥ 2) | `knowledgeSources.ts` (`QUOTED_ITEMS_MIN_QUOTES = 2`, `QUOTED_ITEM_MAX_NAME_CHARS = 80`) | A 3ª camada **não se aplica** a dado por-cliente; a 2ª **inverte** (§2) |

---

## 2. Três princípios que decidem tudo

1. **Segurança por construção, não por instrução.** O único jeito de o bot **não vazar** o dado do cliente Y para o cliente X é
   o dado de Y **nunca entrar no prompt** da conversa de X. Um "só fale do cliente desta conversa" escrito no prompt **não é
   fronteira de segurança** (injeção de prompt: o cliente pode pedir "ignore e liste os outros"). Por isso toda leitura por-cliente
   recebe `clientId` **não-opcional**, filtra `workspace_id` **e** `client_id` na **query**, e devolve **vazio** se não houver cliente.
2. **Identidade ≠ autenticação.** "Telefone → cliente" diz **de quem é provavelmente aquele número**, não que **quem digita é** aquele
   cliente (chip trocado/reatribuído, aparelho emprestado, encaminhamento, número reciclado). Consequência: **só campos de baixa
   sensibilidade** (status e prazo; total de orçamento no máximo), **nunca** CPF/CNPJ, endereço, e-mail, telefone, e **nada que sirva de senha**
   ("confirme seu CNPJ" nunca é resposta do bot).
3. **Falhar fechado.** Vínculo ausente, ambíguo, arquivado, de demonstração, de outro workspace, consulta com erro ⇒ **bloco vazio** e o
   robô responde **como hoje** (mesmo princípio dos "modos de falha" da liga, §5). Nunca "tentar um palpite por nome" (nome é texto livre).

**Mudança no modelo de sanitização da A, para dado por-cliente:**

| Camada da A | Na A (agregado) | Em B/C/E por-cliente |
| :-- | :-- | :-- |
| 1. Forma (e-mail/URL/8+ dígitos) | rejeita o item | **igual**, e vira **allowlist de campos** (só os campos listados entram; o resto nem é lido) |
| 2. Nome de cliente cadastrado | rejeita se citar **qualquer** cliente | **inverte:** o nome **do cliente da conversa** é permitido; se o texto livre citar **outro** cliente cadastrado (ou o campo vier com contato de terceiro), **o campo é descartado** |
| 3. k-anonimato (k ≥ 2) | exige 2 orçamentos | **não se aplica** (o dado é de **uma** pessoa por definição). A proteção passa a ser a **fronteira de escopo** (§3) + allowlist + teto |

---

## 3. O resolvedor conversa → cliente (a peça que a Fase B precisaria construir primeiro)

`resolveConversationClient(conv, clients) → { clientId, via: "link" | "phone" } | null` — **pura**, testável sem banco.

| Passo | Regra | Falha |
| :-- | :-- | :-- |
| 1 — vínculo manual | usa `conv.client_id` **se** esse cliente existe, é do **mesmo** `workspace_id`, não está arquivado e **não é demonstração** (`is_demo`) | cliente inexistente/arquivado/demo ⇒ **`null`** (não cai no passo 2: um vínculo que quebrou é sinal de erro, não de "tente outro caminho") |
| 2 — telefone (só se `client_id` é `NULL`) | normaliza o telefone (mesma função do projeto, `normalizeBrazilianPhone`) e compara com `clients.phone`/`clients.whatsapp`; **exatamente 1** cliente elegível ⇒ resolve (`via: "phone"`) | **0** ⇒ `null`; **≥ 2** (número compartilhado, duplicado, contador/assistente em vários cadastros) ⇒ **`null`** — **ambiguidade nunca escolhe** |
| 3 — o que **não** se usa | `client_contacts` (contato ≠ cliente: o mesmo número aparece sob vários clientes), nome da conversa (`contact_name` é o nome do perfil do WhatsApp, texto livre), `opportunity_id` | — |

- **Toda leitura por-cliente** (projetos, orçamentos, financeiro) filtra `.eq("workspace_id", ws).eq("client_id", resolved)` **na query** e
  aplica a allowlist **em código de novo** (mesma defesa dupla do filtro de status na A).
- **Registro e invalidação:** nada é guardado/cacheado (leitura direta a cada mensagem, como a A) ⇒ **revogar o consentimento ou desvincular o
  cliente vale na mensagem seguinte**; **não há artefato derivado** para apagar (o R2 da Fase A não se aplica).
- **Cobertura honesta:** o vínculo é manual. Sem nenhuma melhoria, a Fase B **só funciona nas conversas que o atendente vinculou** (ou que o
  telefone resolve sem ambiguidade). Isso precisa ser **dito na tela** ("só para conversas com cliente vinculado") e o painel do contato
  deveria **incentivar o vínculo** (decisão de produto, §8-Q7).
- **Dados que não dão para amarrar por `client_id`:** orçamento/projeto/cobrança com `client_id` **nulo** (só o nome em texto) **não entram** — e **não** se tenta
  casar por nome. (O catálogo registra várias rodadas de G-IDs sobre exatamente esse vínculo: G79, G92/G93.)
- **Testes que a Fase B teria de ter** (o "canário" do R5): dois clientes com dados distintos e a mesma consulta ⇒ o bloco do X **não contém nenhuma
  string** do Y; telefone compartilhado ⇒ vazio; vínculo para cliente arquivado ⇒ vazio; falha de consulta ⇒ vazio; conversa sem cliente ⇒ **nenhuma
  consulta de dado de negócio** é feita.

---

## 4. Categoria por categoria

### 4.1 B — Tarefas e projetos (`internal_ops`)

**O que o robô ganharia lendo**
- *Projetos do próprio cliente:* "Como está o meu site?", "Qual o prazo de entrega do logo?", "Já terminaram a identidade visual?" — respostas que
  hoje exigem um humano abrir o painel. Valor **real e frequente** em agência.
- *Tarefas:* quase nada que o cliente pergunte se responde com um to-do interno ("ligar pro fornecedor", "cliente atrasou"). O que o to-do contém é
  **bastidor** — expor ao cliente é risco comercial, não ganho.

**Dado pessoal que entra**
- Projeto: `title` (texto livre — pode citar nome de gente), `status`, `due_date`, `deliverables` (JSON livre), `description` (texto livre), `budget`
  (**interno**). Indireto: é dado **do** cliente (a relação comercial dele).
- Tarefa: `title`/`description` (texto livre — o **pior** campo: cita cliente, terceiros e comentários internos).

**Allowlist proposta (B-projetos):** `title`, `status`, `due_date`, `completed_at`; **nunca** `budget`, `description`, `deliverables` (JSON livre), `notes`.
Máximo **5** projetos (mais recentes não arquivados/não excluídos).

**Base legal (LGPD):** o titular que recebe a informação é **o próprio interlocutor**, sobre **o contrato dele** ⇒ **execução de contrato** (art. 7º, V), finalidade
**compatível** com a da coleta (atendimento — art. 6º, I e II). Para **tarefas/agregado**: **sem base útil** — não há benefício ao titular que justifique, e o
conteúdo é do operador, não do cliente.

**Sanitização**
- *Reusável:* camada 1 (forma) como allowlist; camada 2 invertida (descarta o campo se citar **outro** cliente cadastrado).
- *Não dá para sanitizar:* **texto livre que cita terceiro nunca cadastrado** ("Reunião com a Maria do jurídico") e **comentário interno** no título. Mitigação: allowlist **só de
  `title`+status+datas** e aviso na UI de que o **título do projeto é lido** (o operador passa a saber que não deve escrever bastidor ali).

**Custo (estimativa):** linha de projeto ≈ 20–45 tokens (`ceil(chars/3)`); 5 projetos ≈ **100–225 tokens**.

**Risco de vazamento entre clientes:** **alto sem escopo, baixo com** (§3). Projeto de outro cliente **nunca** entra se a consulta exige `client_id` do resolvido.

**Recomendação:** **B-projetos — implementar com restrição.** **B-tarefas — não implementar.**

### 4.2 C — Clientes / CRM (`crm`)

**O que o robô ganharia lendo**
- *Orçamentos do próprio cliente* (a Fase A original **não deu casa a isto**: A é agregado e anônimo; C era "cadastro"): "Meu orçamento foi aprovado?", "Quanto ficou?",
  "Até quando vale a proposta?", "Vocês me mandaram o orçamento do site?" — **a pergunta mais comum e mais valiosa** de toda a lista.
- *Cadastro mínimo:* tratar o cliente pelo nome/empresa corretos (hoje o robô só vê o nome do perfil do WhatsApp).
- *Oportunidade (CRM):* etapa do funil é **interna** ("lead frio", "probabilidade 30%") — **não** é para o cliente.
- *Ficha técnica (briefing/persona/branding):* é o conhecimento **do cliente do operador sobre a marca dele** — o robô fala **pela empresa do operador**, não pela do cliente
  (já registrado como bifurcação de produto na Fase A §1.2). Caso de uso **não confirmado**.

**Dado pessoal que entra**
- Cadastro: nome, empresa (pessoal comum). **Fora**: e-mail, telefone, endereço, **`document` (CPF/CNPJ)**, `notes` (livre), `tags`.
- Orçamento do cliente: `title`, `status`, `total`, `validity_days`/data de aprovação; **fora**: `notes`, `description` (livre), `client_email`/`client_whatsapp`, itens com nome livre.
- Contatos (`client_contacts`): **terceiros** (funcionários do cliente) — **fora**.

**Allowlist proposta (C):** cliente: `name`, `company`; orçamentos (≤ 5, não rascunho/arquivado/excluído): `title`, `status`, `total`, `approved_at`/`validity_days`;
**itens do orçamento só pelo nome já sanitizado** ou **nenhum** (decisão de produto; o total costuma bastar).

**Base legal:** **execução de contrato** (art. 7º, V) / procedimentos preliminares (orçamento é fase pré-contratual — também art. 7º, V). O titular recebe **o próprio** dado
(compatível com o direito de acesso, art. 18, II). **`document`, endereço, e-mail e telefone ficam fora justamente porque nada justificaria enviá-los ao provedor para responder a pergunta do cliente** (minimização, art. 6º, III).

**Sanitização**
- *Reusável:* forma (allowlist; rejeita 8+ dígitos e e-mail em qualquer campo texto); camada 2 invertida (descarta título que cite **outro** cliente cadastrado).
- *Não dá para sanitizar:* título de orçamento com nome de **terceiro não cadastrado**; `total` é um número verdadeiro **sobre aquela pessoa** — se quem digita **não** é o cliente (identidade ≠ autenticação), é exposição de
  valor comercial para um estranho. **Por isso a recomendação inclui o teto de sensibilidade: status e validade sempre; `total` é decisão sua (§8-Q4).**

**Custo:** cadastro ≈ 15–30 tokens; 5 orçamentos ≈ 100–200 tokens ⇒ **≈ 120–230 tokens**.

**Risco de vazamento entre clientes:** o mesmo de B (§3). Risco **extra:** `quotes.client_id` nulo (orçamento só com nome) — **não entra**, ponto.

**Recomendação:** **C-orçamentos próprios e C-cadastro mínimo — implementar com restrição.** **C-resto (documento, endereço, e-mail, telefone, notes, contatos, ficha técnica, oportunidade) — não implementar.**

### 4.3 D — Conversas / histórico (`conversations`)

**O que o robô ganharia lendo**
- *Memória da própria conversa além de 12 mensagens:* "Como combinamos semana passada?", "Qual valor você me passou?" — **valor real em atendimento recorrente**.
- *Conversas de outros clientes (aprender FAQ/objeções):* o robô "aprenderia" respostas — **mas a fonte é comunicação privada de terceiros**.

**Dado pessoal que entra:** **conteúdo verbatim de mensagens** (texto livre trocado de verdade) — qualquer coisa que um humano digitou, incluindo **dado sensível incidental** (art. 11: saúde, opinião, etc.), mensagens do **atendente** (que podem citar outros clientes
ou comentário interno), legenda de mídia, nome de contato. É a categoria de **maior identificabilidade e menor controle de conteúdo**.

**Base legal**
- *Própria conversa, janela maior:* a mesma base do atendimento atual (o dado **já** vai ao provedor hoje, §1 fato 1) — **execução de contrato/legítimo interesse do operador**, finalidade compatível; **mas** o volume e o tempo de retenção no prompt aumentam e a **minimização** (art. 6º, III) pesa mais.
- *Conversas de outros:* **sem base** — o titular **nunca esperou** que a conversa dele alimentasse resposta a terceiro (art. 6º, II adequação; art. 6º, I finalidade). **Consentimento específico por titular seria a única base e é inviável** (a Kora não tem relação direta com o cliente final — Fase A §1.1).

**Sanitização**
- *Reusável:* quase nada. **Não há como sanitizar texto livre de conversa**: máscara de nomes só conhece **cadastrados**; sensíveis incidentais não têm detector; texto do atendente pode citar terceiros.
- *O que **não** dá para sanitizar:* **tudo** (é o limite técnico da Fase A §1.3, no extremo).

**Custo:** cada mensagem ≈ 30–60 tokens. Hoje 12 mensagens ≈ **360–720 tokens**. Janela de 40 ≈ **1.200–2.400** (come quase todo o teto de 2.500). **Sem teto natural** se virar "conversas anteriores".

**Risco de vazamento entre clientes:** **o maior de todos** para "outras conversas" (por construção mistura clientes). Para "própria conversa" é **zero** (é a própria conversa).

**Recomendação:**
- **D-outras conversas / de outros clientes — NUNCA** (confirma sua hipótese).
- **D-histórico próprio além de 12 — não é "base de conhecimento".** Se o produto quiser memória, é **um parâmetro do bot** (`MAX_HISTORY`, hoje 12) com **teto de tokens**, **sem** nova categoria, **sem** novo atesto — o dado **já** está nessa conversa e **já** vai ao provedor. Decisão separada (§8-Q5), custo/benefício acima.

### 4.4 E — Financeiro (`financial`)

**O que o robô ganharia lendo**
- *Agregado do negócio* (faturamento, ticket médio por faixa — a Fase A §3.4 propôs): **nenhuma pergunta de cliente** se responde com isso; só **expõe** segredo comercial. Valor ≈ 0.
- *Situação das cobranças do próprio cliente:* "Meu pagamento caiu?", "Quando vence meu boleto?", "Já mandaram a nota?" — valor real **mas** muda o **papel do robô** (de atendimento para **cobrança/financeiro**).
- *Política de pagamento* ("aceitamos Pix parcelado", prazos): **não vem de `financial_transactions`** — é política/catálogo, outro lugar (cérebro/catálogo).

**Dado pessoal que entra (próprio cliente):** `title`/`description` (livre), `amount`, `status`, `due_date`, `payment_method`, `paid_at`, `client_id` — **dado financeiro pessoal** (sensível por natureza comercial, não "sensível" do art. 11).

**Base legal:** execução de contrato (art. 7º, V) **para o próprio titular**. **Atenção a um enquadramento que não é LGPD:** um robô que **conversa sobre cobrança** pode esbarrar nas regras de cobrança ao consumidor (CDC, art. 42 — não expor o consumidor a constrangimento) — o **operador** precisa decidir se **quer** esse papel. Essa é a razão de "depende da definição".

**Sanitização**
- *Reusável:* forma + allowlist + camada 2 invertida.
- *Não dá para sanitizar:* **valor e vencimento são o dado** — não há versão "anônima" útil. A única mitigação é **mostrar menos**: **status-only** ("1 cobrança em aberto, vence em 10/11") **sem valores** nem título livre; identidade ≠ autenticação pesa mais aqui (quem tem o chip vê a dívida dele).

**Custo:** ≤ 5 linhas × 20–30 tokens ≈ **100–150 tokens**.

**Risco de vazamento entre clientes:** igual a B/C **se** escopado; **catastrófico** se agregado/sem escopo.

**Recomendação:** **E-agregado — não implementar.** **E-próprio cliente — NÃO AGORA; depende de definição de produto** (papel do robô em cobrança; status-only; quem aprova a copy). Se o operador definir, entra como **fase posterior**, **status-only, sem valores**, com atesto próprio.

---

## 5. Custo — quanto isto pesa, na prática

Teto **agregado** já decidido (Q4): **2.500 tokens** (compartilhado com a A; item inteiro ou nada). Proposta de **prioridade dentro do teto**: o bloco **"do cliente desta conversa"** vai **primeiro** (é sobre quem está perguntando), a A preenche o que sobrar.

| Bloco | Tokens (estimativa `ceil(chars/3)`) |
| :-- | :-- |
| C-cadastro mínimo | 15–30 |
| C-orçamentos próprios (≤ 5) | 100–200 |
| B-projetos (≤ 5) | 100–225 |
| E-próprio status-only (≤ 5, *se* um dia entrar) | 100–150 |
| **Bloco "do cliente" — teto proposto** | **600** (sub-teto; o que passar sai inteiro-ou-nada) |
| A "itens já orçados" | até o que restar de **2.500** |

- **Preço (do próprio doc da fundação, D6; conferir a tabela vigente):** Claude Haiku 4.5 ≈ **US$ 1 / MTok** de entrada. **600 tokens ≈ US$ 0,0006 por mensagem de IA.**
- **Pior caso com o limite de 20 chamadas/min por workspace:** 20 × 600 = 12.000 tokens/min ≈ **US$ 0,72/hora**; com o teto cheio (2.500) ≈ 50.000 tokens/min ≈ **US$ 3/hora**.
  É **irrelevante frente ao risco**: o custo **não** é o que decide B–E — **vazamento e autenticação são**.
- **Consultas extras por mensagem de IA** (só quando a categoria está ligada **e** há cliente resolvido): +1 resolução (em memória) + até 3 SELECTs (projetos, orçamentos, financeiro). Menu/handover/silêncio **não pagam nada** (retornam antes).
- **D "memória longa"** é o único item que **estoura** o teto (janela de 40 mensagens ≈ 1.200–2.400 tokens): por isso não é categoria, é parâmetro com teto próprio.

---

## 6. LGPD — o que vale para todas as categorias

- **Papéis:** o **workspace/operador é o controlador** do dado dos clientes dele; a **Kora é operadora**; o **provedor de IA** (Anthropic/Google) é **suboperador** na cadeia. O "sim" do operador no opt-in **é uma declaração de base legal dele**, não um consentimento que a Kora coleta (Fase A §1.1).
- **Transferência internacional (art. 33):** prompts saem para provedores que processam fora do Brasil. **Isso já é verdade hoje** (as 12 mensagens do histórico). B–E **ampliam o que sai** — a ampliação deve constar do **aviso/DPA do operador** (cláusulas do provedor são do operador/contrato, **fora** do controle do código).
- **Direitos do titular (art. 18):** como **nada é guardado em cache** (leitura direta a cada mensagem), **acesso/correção/eliminação** são atendidos **na fonte** (a tabela do negócio); **não nasce artefato derivado** (resposta ao R2 da Fase A). O **log** do servidor deve continuar registrando só **contagens/categorias** (`knowledge block entered: categories=… included=N omitted=M`), **nunca conteúdo**.
- **Revogação imediata:** o consentimento é lido **a cada mensagem** (1 SELECT); desligar vale na seguinte. Não cachear por workspace com TTL sem decidir que a revogação passa a demorar.
- **Minimização (art. 6º, III) é o critério de corte** de cada campo: se a resposta ao cliente não **precisa** do campo, **ele nem é lido**.
- **Decisões automatizadas (art. 20):** informar status de projeto/orçamento **não** é decisão que afete interesse do titular; **cobrança** (E) pode se aproximar disso — razão adicional para "não agora".

---

## 7. Impacto em schema, UI e simulador (se o operador aprovar algo)

| Tema | Efeito | Observação |
| :-- | :-- | :-- |
| **Categorias do consentimento** | O CHECK atual tem **5 categorias** e o atesto obrigatório em `crm`/`conversations`/`financial`. B-projetos por-cliente **também envolve dado pessoal indireto** ⇒ deveria exigir atesto. Dividir (`projects_own`, `quotes_own`, `financial_own`…) ou apenas **adicionar `internal_ops` ao CHECK do atesto** | **A migration ainda NÃO foi aplicada** (§8-b do bot, 3ª) — **alterar o draft agora custa uma edição de doc**; **depois de aplicada** custa um `ALTER` (+ rodada de lane). **Decisão com prazo: antes da sessão §8-b do bot.** |
| **Servidor** | `knowledgeConsent.ts` (`requiresLegalBasisAck`), loader por categoria **com leitor por-cliente**, resolvedor (§3), composição **com prioridade** do bloco do cliente | Hoje o servidor ignora B–E (`só catalog tem leitor`) — continua assim até a Fase B |
| **UI "Base de conhecimento do Robô"** | Reescrever **copy** (hoje promete leitura ampla — G29) para "**só do cliente da conversa, só com cliente vinculado**" + o que **não** é lido + atesto | Texto atual de B–E precisa mudar **junto** com qualquer habilitação |
| **Painel do contato (atendente)** | Sinalizar "cliente **não vinculado** — o robô não vai usar dados dele" e facilitar o vínculo | Sem isso a cobertura fica invisível |
| **Simulador** | **Não tem conversa-alvo**: B/C/E por-cliente **não aparecem** (já documentado, D8). Para provar, precisaria de um **seletor de "cliente de teste"** (e selo `Base de conhecimento · do cliente X`) | Decisão de produto; sem isso a homologação é **só por WhatsApp real** |
| **Selo/log** | Mesmo padrão da A: só **contagens** | — |

---

## 8. Tabela de decisão para o operador

Marque uma opção por linha. A coluna **Recomendo** é o padrão se não houver preferência. Nada disto é executado por este documento.

| # | Pergunta | Opções | Recomendo | Se escolher diferente |
| :-- | :-- | :-- | :-- | :-- |
| **Q1** | **B-projetos** (status/prazo dos projetos **do cliente da conversa**) | (a) liga com restrição · (b) não liga | **(a)** | (b): B continua desabilitada, sem trabalho |
| **Q2** | **B-tarefas** (to-dos internos) | (a) nunca · (b) liga | **(a) nunca** | (b): exige sanitização de texto livre interno que **não existe** — fora de proposta |
| **Q3** | **C-orçamentos próprios** (status/validade) e **C-cadastro mínimo** (nome/empresa) | (a) liga com restrição · (b) não liga | **(a)** — é o ganho mais claro | (b): a Fase B perde o motivo principal de existir |
| **Q4** | **C-orçamentos: mostrar o `total`?** | (a) só status e validade (sem valor) · (b) status + total | **(a)** no início (identidade ≠ autenticação); **(b)** depois, se o operador quiser | (b) já: aceita que quem controla aquele WhatsApp vê o valor |
| **Q5** | **Memória da própria conversa** (além de 12 mensagens) | (a) manter 12 · (b) subir (ex.: 20–30) com teto de tokens | **(a)** por ora; **(b)** como ajuste de **configuração do bot**, **não** categoria | (b): decidir o número e medir custo (§5) |
| **Q6** | **D-conversas de outros clientes** | nunca / liga | **NUNCA** | não há versão segura (§4.3) |
| **Q7** | **Vínculo conversa→cliente** | (a) só o vínculo manual (`client_id`) + telefone **sem ambiguidade** · (b) só manual · (c) criar vínculo automático (outra rodada) | **(a)** e **sinalizar no painel** quando não vinculado | (c) é trilha de produto à parte (WhatsApp/CRM) |
| **Q8** | **E-próprio cliente** (cobranças) | (a) nunca · (b) status-only, fase posterior · (c) agora | **(a)/(b)**: **não agora** — antes, **definir o papel do robô em cobrança** | (c): sem definição de produto (§4.4) |
| **Q9** | **E-agregado** | nunca / liga | **nunca** | — |
| **Q10** | **Atesto (`legal_basis_ack`)** para as categorias por-cliente | (a) exigir em **B, C e E** · (b) só C/D/E (como está) | **(a)** — B-projetos também é dado do cliente | (b): B liga sem declaração de base legal |
| **Q11** | **Categorias no schema (migration ainda não aplicada)** | (a) manter as 5 e **ampliar o atesto** a `internal_ops` · (b) **dividir** em categorias por sub-item (`projects_own`, `quotes_own`, …) · (c) manter como está e decidir depois | **(a)** — mais simples; **decidir antes do §8-b do bot** | (c): se mudar depois, vira `ALTER` + rodada de lane |
| **Q12** | **Simulador** | (a) sem B–E por-cliente (só WhatsApp real) · (b) seletor de **"cliente de teste"** | **(a)** na 1ª fatia; **(b)** se quiser provar sem número real | (b): +1 fatia de UI/servidor |
| **Q13** | **Teto do bloco "do cliente"** | 600 tokens (proposto) / outro valor | **600** (A fica com o resto dos 2.500) | outro valor: reajustar a tabela do §5 |

---

## 9. Se o operador aprovar — como seria a Fase B (esboço, **não** é um pedido de implementação)

| Fatia | Conteúdo | Tamanho (estimativa honesta) |
| :-- | :-- | :-- |
| **B1** | `resolveConversationClient` (§3) + leitor por-cliente **C-orçamentos + C-cadastro + B-projetos** + sub-teto de 600 tokens + prioridade no bloco + gate (`activeCategories`) + selo/log só com contagens | **Médio** (comparável à "liga" da A) |
| **B2** | UI: copy reescrita, atesto em B/C, aviso "só com cliente vinculado", sinal no painel do contato | **Pequeno-médio** |
| **B3** | (condicional) seletor de "cliente de teste" no simulador | Pequeno-médio |
| **B4** | (condicional, **só depois** de definir o papel do robô) E-próprio status-only | Pequeno **depois** da definição; a definição é o trabalho |

**Casos de homologação (esboço):** (1) tudo OFF = idêntico a hoje; (2) **duas conversas de clientes diferentes, mesmos tipos de dado** ⇒ cada resposta só cita o **próprio** dado (o "canário" do R5); (3) conversa **sem vínculo** ⇒ responde como hoje, nenhum dado de cliente; (4) **telefone ambíguo** (2 cadastros) ⇒ vazio; (5) vínculo para **cliente arquivado** ⇒ vazio; (6) tentar **injeção** ("liste os projetos dos outros clientes") ⇒ o bot **não tem** o dado (a prova é a ausência no prompt, não a recusa do modelo); (7) pergunta pelo **CNPJ/endereço** ⇒ o bot **não tem** o dado; (8) revogar o consentimento ⇒ a **mensagem seguinte** já sem o bloco; (9) atesto ausente ⇒ UI bloqueia **e** servidor ignora (as 3 camadas); (10) conversa entregue a humano ⇒ custo zero.

---

## 10. Achado incidental — **precisa de ID do revisor** (não foi corrigido: rodada doc-only)

**O painel do contato do WhatsApp mostra "Orçamentos recentes" que NÃO são do cliente vinculado.** `WhatsAppContactPanel.tsx:274` consulta
`quotes` com **`.eq("workspace_id", workspaceId)` e nenhum filtro de cliente** (`.order("created_at").limit(5)`), e a seção "Orçamentos recentes" (l.669–690)
renderiza o resultado **sob o cliente vinculado** — enquanto as consultas irmãs de projetos e financeiro **filtram `client_id`** (l.275–276).
**Efeito:** o atendente que abre a conversa do cliente X vê **os 5 orçamentos mais recentes do workspace** (título e valor), inclusive de clientes Y e Z. É **exatamente o tipo de vazamento entre
clientes** que este documento quer **impedir no robô** — já existe **para humanos**. Classe: G92/G93 (consumidor sem o escopo certo), com agravante de privacidade. Gravidade sugerida: **MÉDIO**.
Correção provável de uma linha (`.eq("client_id", clientId)`), a ser feita em rodada própria com teste; **a confirmação ao vivo** é abrir uma conversa vinculada com orçamentos de outros clientes no workspace.

É também a **evidência prática** de por que o §3 exige teste-canário: o erro de escopo **aconteceu** num consumidor irmão.

---

## Referências

- [`etapa-9-item3-base-conhecimento-fase-a.md`](etapa-9-item3-base-conhecimento-fase-a.md) — Fase A original (§1.2 categorias, §2.3 consentimento, §3 custo, §5.1 R1–R7).
- [`etapa-9-item3-r1-base-conhecimento-fundacao.md`](../qa/etapa-9-item3-r1-base-conhecimento-fundacao.md) — fundação, decisões Q1–Q6 oficiais, DRAFT da migration `ai_knowledge_consents` (§4).
- [`etapa-9-item3-r1-base-conhecimento-liga.md`](../qa/etapa-9-item3-r1-base-conhecimento-liga.md) — liga da categoria A (sanitização em 3 camadas §3, teto §4, modos de falha §5).
- [`etapa-9-bot-pacote-operador-8b.md`](../qa/etapa-9-bot-pacote-operador-8b.md) — §8-b do bot (a 3ª migration é a de consentimento) — **prazo da decisão Q11**.
- `supabase/functions/_shared/knowledgeConsent.ts`, `knowledgeSources.ts`, `knowledgeLoader.ts`, `brainComposer.ts` — código da A (camadas reaproveitáveis).
- `src/components/whatsapp/WhatsAppContactPanel.tsx`, `src/lib/whatsapp/repositories/whatsappAudiencesRepository.ts` — vínculo manual e o cruzamento por telefone existente.
- [`kora-roadmap.md`](kora-roadmap.md) §2.2 e §6 — B–E "nunca definidas" (este documento é a definição proposta, **a decidir**).

---

**PARADO aqui — Fase A de B–E encerrada, zero código, zero DDL. Nada será implementado sem a decisão do operador (§8) e um novo "vai" do revisor. §18.**
