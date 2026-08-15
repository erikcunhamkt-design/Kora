# Etapa 9 — item 3: Base de Conhecimento — Fase A (LGPD, escopo, custo)

> **Zero código tocado nesta rodada** — só desenho e doc, mesmo molde de profundidade de
> `etapa-5-flip-financeiro-fase-a.md`/`etapa-9-item2-cerebro-fase-a.md`, adaptado de "inventário
> de flip"/"desenho de feature nova" para "desenho condicionado a 3 perguntas obrigatórias"
> (LGPD, escopo de leitura, custo de contexto — roadmap §6, item 3, literal: **"Exige Fase A
> própria antes de qualquer código"**). Este documento é essa Fase A.

**Branch:** `etapa-9-item3-base-conhecimento-fase-a`, worktree `Kora-laneE`, criada a partir do
tip real de `origin/main` em `ba8061c` (confirmado por `git fetch origin main` + `git log
origin/main -1` antes de abrir a worktree — bate com o commit mais recente do momento, o runbook
de preparação Fases C/D do flip de Financeiro).

**Insumos diretos:**
- `docs/architecture/etapa-9-item1-parser-map.md` — mapa do parser Gemini→Claude; §4 já registra
  que "custo/limite de contexto" é explicitamente trabalho deste item 3, não do item 1, e que
  `MAX_HISTORY = 12` (mensagens de histórico, sem contagem de token) é o único controle de custo
  existente hoje em `whatsapp-bot-reply/index.ts`.
- `docs/architecture/etapa-9-item2-cerebro-fase-a.md` — desenho do "cérebro" (identidade da
  empresa, texto livre digitado à mão pelo operador). §2.3 e §6-R5 desse doc já cravam a fronteira
  que a §4 abaixo formaliza: o cérebro é texto de autoria humana declarada; a base de conhecimento
  (este item) é conteúdo **derivado** do workspace, potencialmente com dado pessoal de terceiro —
  dois problemas de LGPD de naturezas diferentes, que o revisor pediu explicitamente para não
  resolver no mesmo documento.
- `docs/architecture/kora-roadmap.md` §6, item 3 — as 3 perguntas que esta Fase A precisa
  responder, literal: (a) LGPD — que dado de cliente/conversa pode alimentar o contexto do modelo,
  sob qual base legal, com qual retenção; (b) escopo de leitura — quais tabelas/campos o robô lê
  pra "aprender"; (c) custo de contexto — impacto em tokens/custo, e interação com o rate limit
  (G5) já existente.

---

## 1. Escopo de leitura — o que o workspace tem, classificado por sensibilidade LGPD

### 1.1 Contexto que muda a análise: quem é o titular dos dados

Antes de listar tabelas, um ponto que decide toda a Fase A: o Kora Hub é uma ferramenta de
**agência/operador** (o "workspace") que atende **os clientes desse operador**. As tabelas
`clients`, `client_contacts`, `crm_opportunities` e as conversas de WhatsApp não contêm dados
pessoais do usuário do Kora — contêm dados pessoais dos **clientes do operador**, terceiros que
não têm nenhuma relação direta com a Kora nem com o provedor de IA (Anthropic) por trás do robô.
Isso muda a base legal aplicável: **não basta o operador clicar "autorizo"** para uma categoria
que contenha dado de um terceiro — o operador precisa ter, ele mesmo, uma base legal válida
perante o **seu** cliente para esse uso específico (LGPD, Lei 13.709/2018, art. 6º I — princípio
da finalidade: dado coletado para "atender esse cliente" não vira automaticamente base legal para
"treinar/contextualizar um robô que também responde a outros"). A Kora, como operadora da
plataforma, é neste desenho uma **operadora de dados (processor)** na cadeia — quem decide o
propósito (**controladora**, art. 5º IX) do dado de cada cliente final é o workspace/operador.

**Consequência prática para o design**: qualquer tela de opt-in (§2) precisa deixar claro que o
"sim" do operador é uma **declaração de que ele tem base legal**, não um consentimento que a Kora
está coletando em nome do titular — a Kora não tem, e não pretende ter nesta fatia, relação direta
com o cliente final para pedir consentimento a ele.

### 1.2 Inventário de tabelas candidatas, por categoria de sensibilidade

Levantamento feito por leitura direta de `src/integrations/supabase/types.ts` (schema real, não
suposição) — todas as tabelas abaixo já são `workspace_id`-scoped com RLS via
`is_workspace_member` (mesmo padrão citado em `etapa-9-item2-cerebro-fase-a.md` §2.4).

| Categoria | Tabelas | Conteúdo real (campos observados) | Titular do dado | Classificação LGPD |
|---|---|---|---|---|
| **A — Catálogo comercial** | `quotes`, `quote_items` (agregados/anonimizados, sem nome de cliente) | Descrição de serviço/produto, preço, condições | O próprio operador (dado de negócio) | **Baixa** — não é dado pessoal se agregado sem identificação do cliente; risco é confidencialidade comercial, não LGPD |
| **B — Operacional interno** | `tasks`, `projects` (campos de fluxo/status, sem o vínculo de cliente exposto) | Título, status, prazos, categorias de tarefa | O operador, mas texto livre pode citar nome de cliente | **Baixa-média** — risco não é estrutural (schema não tem campo de PII dedicado), mas texto livre pode vazar nome/contexto de cliente sem aviso |
| **C — CRM / cadastro de cliente** | `clients`, `client_contacts`, `crm_opportunities`, `client_technical_sheets` | Nome, e-mail, telefone, WhatsApp, endereço, `document` (CPF/CNPJ), `notes` livre, briefing/persona/branding (JSONB livre) | **Cliente do operador** (terceiro) | **Alta** — dado pessoal comum (art. 5º I) em quantidade; `document` é de alto risco de fraude (não é "sensível" no sentido estrito do art. 5º II, mas exige cuidado equivalente); campos livres (`notes`, `raw_payload`) podem conter qualquer coisa digitada por um humano, inclusive dado sensível incidental (saúde, opinião, etc.) |
| **D — Conversas WhatsApp** | `whatsapp_conversations`, `whatsapp_messages` | Nome/telefone de contato + **conteúdo verbatim** da conversa (`body`/`content`, texto livre trocado de verdade) | **Cliente do operador** (terceiro), maior identificabilidade (telefone é identificador direto) | **Altíssima** — é comunicação privada real de um terceiro que nunca interagiu com a Kora nem consentiu com nada relacionado a IA; risco de dado sensível incidental é maior aqui que em C (conversa livre, não formulário estruturado) |
| **E — Financeiro** | `financial_transactions` | Valor, método de pagamento, categoria, vínculo indireto a cliente/projeto | O operador (negócio), indiretamente o cliente | **Média-alta** — dado financeiro é sensível por natureza comercial mesmo quando não "LGPD-sensível" tecnicamente; vínculo a um cliente pessoa física o torna dado pessoal financeiro dele |

**Achado tangencial, não-bloqueante**: `client_technical_sheets` (categoria C) é, por conteúdo
(`branding`, `persona`, `editorial`), o candidato mais próximo a "conhecimento reaproveitável para
o robô falar sobre a marca/produto do CLIENTE do operador" — mas isso é uma bifurcação de produto
que esta Fase A não resolve (o robô fala pela empresa do OPERADOR, não pela empresa do cliente
dele; usar essa tabela como fonte assumiria um caso de uso — agência configurando o robô para
"aprender a marca de um cliente específico" — que não está confirmado no roadmap). Registrar como
pergunta em aberto para quem escopar a Fase B, não decidir aqui por suposição.

### 1.3 Duas dimensões que já emergem da tabela acima

1. **Dado do próprio negócio do operador (A/B, majoritariamente E) vs. dado pessoal de terceiro
   (C/D, e parte de E)** — a primeira dimensão pode ser tratada com opt-in simples do operador; a
   segunda exige o cuidado do §1.1.
2. **Dado estruturado (schema fixo, campo por campo) vs. texto livre (`notes`, `body`,
   `raw_payload`, mensagens)** — dado estruturado é filtrável campo a campo (ex.: ler só
   `products_services` sem tocar `document`/CPF); texto livre não tem essa garantia — uma vez que
   o campo entra no escopo de leitura, **tudo** que alguém digitou nele entra junto, sem forma
   automática de saber se contém dado sensível incidental. Isso é um limite técnico, não uma
   decisão de produto — vale para qualquer estratégia de custo do §3.

---

## 2. Consentimento e controle — opt-in por categoria, nunca tudo-ou-nada

### 2.1 Por que "tudo ou nada" está descartado

Uma única flag `kora.ai.knowledgeBase.enabled` (ligar "aprender com o workspace" de uma vez) força
o operador a aceitar o pacote inteiro — incluindo categoria D (conversas reais de clientes, a mais
sensível) — só para habilitar a categoria A (catálogo de produtos, a mais inofensiva). Dado o
§1.1 (o operador está atestando base legal sobre dado de terceiro, não sobre o próprio), misturar
as 5 categorias numa decisão binária é o oposto do que a LGPD pede (art. 6º III, necessidade —
tratar só o mínimo necessário à finalidade). O modelo tem que deixar o operador ligar só A, ou só
A+B, sem forçar C/D.

### 2.2 O que já existe no código — e por que nada é reaproveitável como está

Busca no repo (`consent`, `Consent*`) encontra duas peças, nenhuma serve de fonte de verdade:

- **`src/hooks/useCampaigns.ts` (`ConsentRecord`/`ConsentStatus`)** — modela opt-in/opt-out por
  contato e canal, com `consentSource`/`consentText`/`consentDate`, formato bem desenhado — mas é
  **100% `localStorage`, seed de demonstração** (`seedConsents`, `isDemo: true`), e o próprio
  `CampaignsSection.tsx:72` avisa em tela: *"Este módulo é uma preparação para campanhas
  consentidas. Nenhuma mensagem real é enviada nesta versão."* Não é Supabase, não é por
  workspace-membro real, não tem RLS. **A FORMA é um bom precedente de UX (granularidade por
  contato+canal, status tri-estado), o MECANISMO não é reaproveitável** — mesma lição já registrada
  em `etapa-9-item2-cerebro-fase-a.md` §4.1 sobre `CompanySettings`/localStorage.
- **`client_signup_requests.consent`** (`PublicClientSignup.tsx`) — um único booleano, texto fixo
  genérico de aceite ao preencher o formulário público de cadastro de lead. **Não é
  propósito-específico** (não diz "autorizo uso por IA", diz só "aceito o consentimento" de forma
  genérica) — não serve como base legal para o uso de IA proposto aqui, mesmo que já exista no
  banco.

**Conclusão**: como no item 2, nada é reaproveitável como fonte — o controle de consentimento por
categoria precisa nascer do zero em Supabase, mas o **formato tri-estado + fonte/data** de
`ConsentRecord` é uma referência de UX válida para copiar.

### 2.3 Modelo proposto

Tabela nova (nome proposto, a confirmar na Fase B): `public.ai_knowledge_consents`, granularidade
`(workspace_id, category)` — uma linha por categoria habilitável, não uma linha só por workspace:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | — |
| `workspace_id` | UUID NOT NULL, FK `workspaces(id)` | (com FK desde o início — mesma correção de padrão já recomendada em `etapa-9-item2-cerebro-fase-a.md` §2.2) |
| `category` | TEXT NOT NULL | `catalog` \| `internal_ops` \| `crm` \| `conversations` \| `financial` (as 5 do §1.2) — `CHECK` fechado, não texto livre |
| `enabled` | BOOLEAN NOT NULL DEFAULT false | Opt-in explícito, **default false para as 5**, sem exceção |
| `legal_basis_ack` | BOOLEAN NOT NULL DEFAULT false | Só relevante/exigido para categorias C/D/E (dado de terceiro) — operador confirma **ativamente** ter base legal para esse uso perante o próprio cliente dele (ver §1.1); UI bloqueia ligar `enabled` em C/D/E sem esse ack marcado |
| `legal_basis_note` | TEXT NULL | Campo livre opcional onde o operador pode registrar QUAL base legal está usando (auditoria própria, não validada pela Kora) |
| `enabled_by` / `enabled_at` | UUID / TIMESTAMPTZ NULL | Quem/quando ligou — trilha de auditoria |
| `revoked_at` | TIMESTAMPTZ NULL | Preenchido ao desligar — nunca hard-delete da linha, só flip de `enabled` + carimbo (auditoria de quando parou) |

Único par `(workspace_id, category)` — `UNIQUE`. RLS `is_workspace_member`, mesmo padrão dos itens
1/2 (`whatsapp_bot_settings`, `ai_brain_profiles`).

**UI**: 5 toggles (uma por categoria), cada um com texto de risco proporcional à sensibilidade —
copy para A/B pode ser neutra ("usar catálogo de produtos como referência"); copy para C/D precisa
ser explícita sobre o fato de envolver dado de clientes reais do operador, com o checkbox de
`legal_basis_ack` obrigatório antes de o toggle principal poder ligar. Local natural: mesma seção
"Cérebro do Robô" proposta em `etapa-9-item2-cerebro-fase-a.md` §4.1 (`Configuracoes.tsx`,
`SettingsNav`), como sub-seção "Base de conhecimento" — não um 5º nó no construtor visual, pelo
mesmo argumento do item 2 (configuração de workspace, não passo de fluxo).

### 2.4 Revogação — efeito precisa alcançar o que já foi derivado, não só a leitura ao vivo

Desligar uma categoria tem que parar leitura **prospectiva** imediatamente (trivial: a função de
composição do prompt, mesmo ponto único do item 2 §3.1, checa a flag antes de ler). O ponto que
NÃO é trivial: se a categoria já alimentou um **resumo pré-computado** (§3, estratégia 2) que ainda
está em cache/tabela, revogar o consentimento tem que também invalidar/apagar esse resumo — do
contrário o dado revogado continua influenciando respostas indiretamente através do resumo velho,
mesmo com a flag OFF. Isso vira risco nomeado (R2, §5) e requisito de design explícito para quem
implementar §3-estratégia-2 na Fase B: todo resumo derivado precisa de FK/referência que permita
apagá-lo em cascata quando o consentimento da categoria de origem é revogado.

---

## 3. Custo de contexto — estratégias comparadas

Ponto de partida (herdado do item 1 §4 e do item 2 §3.1): existe **um ponto único** onde
`systemInstruction` é composta antes de qualquer branch de provider
(`whatsapp-bot-reply/index.ts`, linhas 496-512/326) — qualquer estratégia abaixo se encaixa nesse
mesmo ponto, sem tocar os 4 branches de provider. `MAX_HISTORY = 12` já limita o histórico de
conversa por contagem de mensagens, não por token — nenhuma das 3 estratégias abaixo muda isso;
elas resolvem o problema **novo** que este item introduz (conteúdo do workspace, não histórico da
conversa atual).

### 3.1 Estratégia 1 — Injeção direta (toda a categoria habilitada, bruta, toda chamada)

Concatenar tudo que a categoria tem (ex.: todos os produtos, todos os `clients.notes`) direto no
prompt, mesmo mecanismo do cérebro (item 2 §3.2), só que sem o teto de "5 campos de texto curto".

- **Ordem de grandeza**: um catálogo de 50-100 produtos com descrições curtas já fica em
  **5.000-20.000 tokens**; `clients.notes` de uma base de algumas centenas de clientes facilmente
  passa de **50.000+ tokens**; categoria D (conversas) não tem teto natural — uma conversa longa
  sozinha pode exceder isso.
- **Custo**: pago **em toda mensagem do bot** (não é uma chamada isolada — mesmo alerta já
  registrado no item 2 §3.3, mas aqui multiplicado por categoria e sem o soft-cap de ~2.000
  caracteres que o cérebro tem).
- **Veredito**: aceitável só para A/B em workspaces pequenos (poucas dezenas de itens); **descartada
  para C/D** por escala — cresce sem limite conforme a base de clientes/conversas cresce, o oposto
  de um custo prevmarcado.

### 3.2 Estratégia 2 — Resumo pré-computado

Um job (trigger em escrita, ou periódico) resume a categoria inteira em um bloco fixo (ex.: "os 10
produtos mais vendidos, resumidos em 1 frase cada"), grava numa tabela/coluna de cache, e é esse
resumo — não os dados brutos — que entra no prompt.

- **Ordem de grandeza**: **500-2.000 tokens fixos por chamada**, independente do tamanho real dos
  dados de origem — a variável de custo migra de "por mensagem" para "por regeneração do resumo"
  (mais barato e mais previsível).
- **Trade-off**: (i) o resumo fica desatualizado entre regenerações (staleness — se um produto
  muda de preço, o bot pode responder o preço antigo até a próxima regeneração); (ii) resumir é,
  em si, uma chamada de LLM (custo indireto, mas pago 1x por atualização, não por mensagem); (iii)
  herda o problema do §2.4 — um resumo é um NOVO artefato com dado derivado, precisa do mesmo
  cuidado de revogação/exclusão que a fonte.
- **Veredito**: melhor opção para A/B/E (dado estruturado, resume bem, staleness é aceitável
  porque preço/catálogo não muda a cada minuto). Para C/D, resumir bem exige mais desenho (o que
  vira "resumo" de uma conversa real? risco de o próprio resumo já ser uma forma de reter dado
  pessoal por mais tempo do que o necessário — tensão direta com minimização de dados).

### 3.3 Estratégia 3 — Recuperação por relevância (RAG)

Buscar só os registros relevantes à mensagem atual do cliente, injetar só esses.

- **Duas variantes de implementação, custo de infraestrutura MUITO diferente:**
  - **Busca textual (FTS do Postgres)** — já existe precedente real no código:
    `idx_wa_msg_content_fts`, índice GIN com `to_tsvector('portuguese', ...)` sobre
    `whatsapp_messages.content` (`supabase/migrations/20260603013749_...sql`). Zero extensão nova,
    zero pipeline de embedding — só replicar o padrão em outras tabelas/campos candidatos. Custo de
    infra: baixo. Qualidade: casa só lexema/palavra, não sinônimo/intenção — pode não achar um
    produto relevante se a mensagem do cliente usa um termo diferente do catálogo.
  - **Busca semântica (embeddings + `pgvector`)** — **`pgvector` não está habilitado no projeto
    hoje** (confirmado por grep exaustivo por `vector`/`embedding` em `supabase/`/`src/` — zero
    resultado além do falso-positivo do FTS acima). Exigiria: habilitar a extensão, gerar
    embeddings (chamada de API extra, outro custo por atualização de dado), manter um índice
    vetorial e reindexar quando o dado muda. Custo de infra: alto — é a única das 3 estratégias que
    exige capacidade nova no banco, não só uso diferente do que já existe.
- **Ordem de grandeza (ambas as variantes)**: tipicamente 3-10 registros relevantes recuperados por
  chamada, **200-800 tokens** injetados — a mais barata em tokens de prompt das 3, mas com custo de
  infraestrutura/operação que as outras duas não têm.
- **Veredito**: a única estratégia que escala para C/D (CRM/conversas) sem custo de token crescer
  junto com o tamanho da base — mas só vale o investimento de infra quando o volume da categoria
  justificar (não para um catálogo de 20 produtos). Começar pela variante FTS (reaproveita padrão
  já existente) antes de considerar `pgvector`.

### 3.4 Recomendação

Não uma estratégia única para todas as categorias — a mesma composição em ponto único do item 2
aceita múltiplas fontes:

| Categoria | Estratégia recomendada na Fase B inicial | Por quê |
|---|---|---|
| A (catálogo) | Resumo pré-computado | Estruturado, muda pouco, resume bem, sem infra nova |
| B (operacional) | Resumo pré-computado (ou nem entra na Fase B inicial — baixo valor de "aprendizado" para o robô responder cliente) | Idem, mas caso de uso mais fraco |
| C (CRM) | Fora do escopo mínimo da Fase B; se entrar, resumo pré-computado por REGISTRO (não agregado — ver R5, §5) | Volume pode crescer, dado sensível — resumo agregado entre clientes é o risco de vazamento cruzado do §5 |
| D (conversas) | Fora do escopo mínimo da Fase B; se entrar, só recuperação por relevância (FTS primeiro), nunca injeção direta nem resumo agregado | Cresce sem limite, mais sensível, resumo pré-computado tensiona com minimização de dado |
| E (financeiro) | Resumo pré-computado, agregado (ex.: faixas de ticket médio, não valor exato por cliente) | Reduz exposição de dado financeiro individual mantendo utilidade |

---

## 4. Fronteira com o item 2 — regra escrita

**O cérebro (item 2, `ai_brain_profiles`) NUNCA deve conter dado pessoal de terceiro.** Isso vale
por construção, não por disciplina: os 5 campos do cérebro (`tone`, `talk_about`,
`dont_talk_about`, `products_services`, `limits`) são preenchidos manualmente pelo operador numa
tela de configuração — nenhum pipeline os popula automaticamente a partir de `clients`,
`crm_opportunities` ou `whatsapp_messages`. Não existe hoje, e esta Fase A não propõe criar,
nenhuma automação que copie dado de cliente para dentro do cérebro. A única forma de dado pessoal
entrar no cérebro é o operador digitá-lo manualmente por engano — risco de produto (copy/aviso na
UI), não risco arquitetural, e não é resolvido por nenhum dos dois itens sozinho (mesmo ponto já
registrado como R2 em `etapa-9-item2-cerebro-fase-a.md` — duplicação de conteúdo).

**A base de conhecimento (item 3) é o único dos dois que pode, quando a categoria C/D estiver
habilitada com consentimento válido, incluir dado pessoal de terceiro no contexto do modelo.**

**Regra de composição, para quando os dois existirem juntos**: o preâmbulo do cérebro e o bloco de
conhecimento recuperado/resumido **nunca se misturam sem rótulo** no prompt final. Proposta de
estrutura (estende o template do item 2 §3.2):

```
composedSystemInstruction = [brainPreamble, knowledgeBlock, systemInstruction]
  .filter(Boolean)
  .join("\n\n")
```

Onde `brainPreamble` continua com o cabeçalho "Sobre a empresa:" (item 2) e `knowledgeBlock` ganha
cabeçalho próprio e distinto (ex.: "Contexto relevante encontrado:") — a separação estrutural
serve a dois propósitos concretos, não é só estética: (1) **auditabilidade** — dado um trecho da
resposta do bot, dá para saber se veio de identidade declarada (cérebro) ou de dado derivado do
workspace (conhecimento); (2) **exclusão seletiva** — um pedido de exclusão de dado (LGPD art. 18
VI) ou uma revogação de consentimento (§2.4) precisa poder remover só o `knowledgeBlock`, sem
tocar o `brainPreamble` que o operador escreveu à mão e que continua válido.

---

## 5. Riscos nomeados, casos de homologação esboçados, estimativa

### 5.1 Riscos nomeados

- **R1 — Titular do dado é terceiro sem relação com a Kora** (§1.1). O "sim" do operador não é
  suficiente sozinho para categorias C/D/E — precisa ser uma declaração de base legal própria dele
  (`legal_basis_ack`, §2.3). A Kora não tem hoje, e esta Fase A não propõe, nenhum mecanismo de
  validar se essa declaração é verdadeira — é atesto, não verificação. Risco residual: um operador
  pode marcar o ack sem realmente ter base legal; mitigação é copy clara + registro de auditoria
  (`enabled_by`/`enabled_at`), não bloqueio técnico (que exigiria a Kora policiar a relação do
  operador com o cliente dele — fora de escopo e de capacidade).
- **R2 — Revogação/exclusão não alcança artefatos derivados** (§2.4, §3.2). Resumos
  pré-computados e (se existir cache de recuperação) índices persistem dado após a fonte ser
  apagada ou o consentimento revogado, a menos que o design da Fase B trate isso explicitamente com
  invalidação em cascata.
- **R3 — Infraestrutura de recuperação por relevância não existe hoje** (§3.3). `pgvector`
  ausente; FTS existe só em `whatsapp_messages.content`. Qualquer estratégia de RAG além do que já
  existe é trabalho de infra novo, a orçar à parte de qualquer estimativa de fatia de produto.
- **R4 — Nenhum mecanismo de consentimento real e auditável existe hoje** (§2.2). A única peça de
  código relacionada (`useCampaigns.ts`) é mock local, não reaproveitável — a tabela do §2.3 nasce
  do zero.
- **R5 — Vazamento cruzado entre clientes do mesmo workspace**. Se um resumo ou uma recuperação
  agregar dado de VÁRIOS clientes ao mesmo tempo (ex.: "principais objeções recebidas", minerado de
  várias conversas/oportunidades), existe risco real de o bot mencionar, numa conversa com o
  Cliente B, algo que só o Cliente A disse. Categorias C/D precisam de escopo de leitura sempre
  **por cliente/conversa-alvo** (o cliente com quem o bot está falando agora), nunca agregado
  cross-cliente dentro do mesmo workspace — isso restringe as opções de resumo do §3.2 para essas
  categorias (resumo por registro, não resumo agregado da base inteira).
- **R6 — Duplicação/sobreposição com o cérebro** (§4, compartilhado com R2 do item 2). Não
  resolvido por nenhum dos dois itens sozinho.
- **R7 — Custo agregado sem orçamento por chamada**. O R1 do item 2 (cérebro sem limite rígido, só
  soft-cap) se multiplica aqui por até 5 categorias independentemente habilitáveis — sem um teto
  agregado de tokens por chamada (soma de cérebro + todas as categorias ligadas), um workspace pode
  empilhar custo por chamada sem perceber, mesmo com cada categoria individualmente dentro de um
  soft-cap próprio. Fica em aberto para a Fase B decidir se existe um teto agregado, não só por
  categoria.

### 5.2 Casos de homologação esboçados

1. **Todas as categorias OFF (default)** — comportamento idêntico a hoje, zero regressão (mesmo
   espírito do Caso 1 do item 2).
2. **Só categoria A ligada** — resposta do bot reflete catálogo/preço; nenhum dado de `clients`/
   `crm_opportunities`/conversas aparece, mesmo que essas tabelas tenham dados no workspace.
3. **Tentativa de ligar categoria C sem marcar `legal_basis_ack`** — UI deve bloquear o toggle
   principal até o ack ser marcado (prova de que o gate de R1 é real, não decorativo).
4. **Revogação de categoria já habilitada e já refletida num resumo pré-computado** — próxima
   mensagem do bot não deve mais refletir aquele conteúdo; se a estratégia escolhida usa cache,
   confirmar que o cache foi invalidado, não só a flag desligada (prova de R2).
5. **Duas conversas simultâneas com clientes DIFERENTES, categoria C ou D ligada** — confirmar que
   nenhuma resposta menciona dado do outro cliente (prova de R5).
6. **Categoria D ligada com uma conversa mais longa que `MAX_HISTORY`** — confirmar que a
   estratégia de custo escolhida não reinjeta a conversa inteira a cada mensagem (prova de que R7/
   §3 foi respeitado na implementação, não só no desenho).
7. **Cérebro + conhecimento ligados ao mesmo tempo** — confirmar separação visível dos dois blocos
   no prompt composto (prova de §4), e que desligar só a base de conhecimento não afeta o
   preâmbulo do cérebro.

### 5.3 Estimativa honesta

**Não é uma fatia única — dois tamanhos bem diferentes dependendo de quais categorias entram na
Fase B inicial.**

- **Só categorias A/B/E (dado do próprio operador, sem terceiro)**: fatia **pequena-média**,
  comparável ao item 2 — 1 tabela de consentimento simplificada (sem exigir `legal_basis_ack` para
  essas 3), resumo pré-computado sem infra nova, encaixa no mesmo ponto único de composição.
- **Incluir C/D (dado pessoal de terceiro)**: fatia **grande**, não incremental trivial sobre a
  anterior — exige a tabela de consentimento completa com atesto de base legal (§2.3), desenho de
  resumo por-registro (não agregado, R5), e, se a qualidade de FTS não bastar, avaliação separada
  de `pgvector` (R3) — cada uma dessas partes tem escopo próprio de decisão, não é "mais um campo
  numa tabela que já existe".

**Recomendação de sequenciamento para a Fase B** (não decidido aqui, só registrado como
consequência natural do levantamento): começar por A, com a tabela de consentimento já desenhada
para as 5 categorias desde o schema (para não ter que migrar o modelo depois), mas com C/D
literalmente não lidas por nenhum código ainda — a mesma tática de "flag ligável, mas capacidade
ainda não implementada" que o roadmap já usa em outros pontos (ex.: `kora.ai.knowledgeBase.enabled`
citado como reserva de nome em `etapa-9-item2-cerebro-fase-a.md` §5.1, mesmo domínio `ai`).

---

## Referências

- `docs/architecture/etapa-9-item1-parser-map.md` — parser Gemini→Claude; §4 localiza `MAX_HISTORY`
  e credita este item 3 pela análise de custo/token.
- `docs/architecture/etapa-9-item2-cerebro-fase-a.md` — desenho do cérebro; §2.1-2.4 (modelo de
  dados/RLS), §3 (ponto único de composição, reaproveitado aqui), §4.1 (localStorage como padrão a
  NÃO repetir), §5.1 (convenção de nome de flag, reserva `kora.ai.knowledgeBase.enabled`), §6-R5
  (fronteira LGPD explicitamente adiada para este item).
- `docs/architecture/kora-roadmap.md` §6, item 3 — as 3 perguntas obrigatórias desta Fase A.
- `src/integrations/supabase/types.ts` — schema real de `clients`, `client_contacts`,
  `client_technical_sheets`, `crm_opportunities`, `whatsapp_conversations`, `whatsapp_messages`,
  `financial_transactions` (base do inventário §1.2).
- `supabase/migrations/20260603013749_916a43c5-3e51-4f02-9416-b4f2a429f4e8.sql` — precedente real
  de FTS (`to_tsvector`/GIN) em `whatsapp_messages.content`, citado no §3.3 como base da variante
  barata de recuperação por relevância.
- `src/hooks/useCampaigns.ts` / `src/components/campaigns/CampaignsSection.tsx` — `ConsentRecord`
  mock/localStorage, referência de UX (não de mecanismo) para o §2.
- `src/pages/PublicClientSignup.tsx` / `client_signup_requests.consent` — consentimento genérico
  de lead, não propósito-específico, não reaproveitável para base legal de IA (§2.2).
- `docs/qa/protocolo-homologacao.md` §16-19 — gates de worktree, hash de build e merge condicionado
  seguidos nesta rodada.

---

**PARADO aqui — Fase A encerrada, zero código alterado. Fase B (implementação, começando pelo
subconjunto de categorias que o revisor autorizar) só com novo "vai" do revisor.**
