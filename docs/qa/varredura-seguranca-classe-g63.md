# Varredura de Segurança — classe G63 (repo inteiro) — SOMENTE LEITURA

> Zero código tocado. Generaliza a lição sistêmica do G63 (`kora-hub-auditoria-e-plano.md`):
> um objeto local com campo sensível pode vazar pra nuvem por um caminho que ninguém desenhou
> pra isso (catch-all serializado, flag nascida ligada). 3 eixos: segredos em payloads, RLS,
> flags opt-out em domínio não homologado. Achados classificados **conforme / suspeito /
> violação**; fixes ficam para rodada própria, com "vai" explícito.

## Abertura

- Branch: `varredura-seguranca-g63`, worktree `Kora-laneE`, a partir do tip real de
  `origin/main` em `5e70bd7` (`docs: atualiza vocabulario do draft CHECK de CRM + registra dono
  unico de CRM.tsx`), confirmado por `git fetch origin main` antes de abrir.
- **Insumo direto**: G63 (`kora-hub-auditoria-e-plano.md`) — `accesses[].password` vazando pra
  `client_technical_sheets.raw_payload` via clone bruto (`JSON.parse(JSON.stringify(...))`),
  fechado nesta mesma Lane. Este doc pergunta "onde mais esse padrão pode existir?", nos 3
  ângulos que o G63 tocou: payload/segredo, RLS da tabela de destino, flag que abriu o caminho.
- **Base reaproveitada**: `docs/qa/etapa-5-auditoria-g37-espelhos.md` (Lane D) já inventariou os
  6 mappers `mapLocal*ToSupabase` campo a campo pra completude (classe G37 clássica — campo
  OMITIDO). Este doc usa o mesmo inventário de arquivos, mas com a lente oposta (campo INCLUÍDO
  quando não devia). Não duplica a auditoria de completude, só cruza contra ela quando relevante.
- **Não tocados** (leitura permitida, edição não): `CRM.tsx` (Lane C, G64), `quoteMapper.ts`/
  `crmOpportunityMapper.ts` (Lane D, G68 em merge no momento desta rodada — achados abaixo
  citam esses arquivos como estavam no tip `5e70bd7`; podem já ter mudado quando o G68
  mesclar).

---

## 1. Segredos em payloads — inventário

### 1.1 Método

`grep` por `JSON.stringify(JSON.parse(...))`/`JSON.parse(JSON.stringify(...))` (o padrão de
clone bruto que causou o G63) em todo `src/` — **1 único resultado**: `technicalSheetMapper.ts`,
já corrigido. Nenhum outro mapper usa esse padrão — os outros 5 mappers de domínio
(`finance`/`projects`/`tasks`/`crm`/`quote`) montam payload campo a campo, sem catch-all
(confirmado por releitura, cruzando com `etapa-5-auditoria-g37-espelhos.md` §1). Isso restringe
a pergunta "que campo sensível existe nos objetos locais" (`grep` em `types/domain.ts` por
`password`/`token`/`apiKey`/`secret`/`credential`/`senha`/`serviceAccount`) e depois "esse campo
tem algum caminho de escrita, mesmo que não seja o padrão de clone bruto".

### 1.2 Tabela de achados

| # | Local (coluna cloud) | Objeto de origem tem campo sensível? | Sanitizado antes do write? | Classe | Severidade | Evidência |
|---|---|---|---|---|---|---|
| 1 | `client_technical_sheets.raw_payload` | Sim — `ClientAccess.password` | **Sim, desde o hotfix G63** (`cf6d52f`) | Segredo | **FECHADO** | `technicalSheetMapper.ts:37-46` (`delete sanitizedRaw.accesses`) |
| 2 | `whatsapp_bot_settings.flow_data` | Sim — `aiNode.properties.geminiApiKey` (texto) e `aiNode.properties.gcpServiceAccount` (JSON de service account **com `private_key`**) | **Não** — `nodes` (array de nós do fluxo visual, incluindo o nó `ai` com as 2 credenciais) é gravado inteiro em `flow_data`, sem excluir nada | Segredo, **duplicação ativa** (não é dado morto) | 🔴 **VIOLAÇÃO — ALTO** | `WhatsAppBotConfig.tsx:246-257` — `gemini_api_key`/`gcp_service_account` já viajam nas colunas dedicadas (linhas 252/255) **e de novo** dentro de `flow_data: nodes` (linha 257), sem redação |
| 3 | `whatsapp_messages.raw_payload` | Não é um objeto local com campo estruturado sensível — é o corpo bruto do webhook do provedor (mensagem, telefone, metadados) | N/A (não é a classe "campo de credencial estruturado") | Diferente — PII de conversa, não segredo/credencial | 🟡 **NOTA** — fora do escopo estrito desta varredura (é retenção de dado de terceiro, já tratado como tema LGPD em `etapa-9-item3-base-conhecimento-fase-a.md`), registrado por completude | `whatsapp-webhook/index.ts:560`, `whatsapp-official-webhook/index.ts:182` |
| 4 | `workspace_ai_credentials.credentials_json` | Sim — JSON de service account completo (`private_key`, `client_email`, etc.) | **Sim, é o propósito da coluna** — tabela dedicada, não um catch-all alheio; a própria leitura da UI (`useVertexCredentials.ts:39`) evita `SELECT credentials_json` na listagem | Segredo — armazenamento intencional | ✅ **CONFORME** (achado de RLS relacionado — ver §2.2) | `useVertexCredentials.ts:37-94` |
| 5 | `whatsapp_official_credentials` (colunas de token, via edge function) | Sim — token de acesso da API oficial | Fluxo passa por `supabase.functions.invoke("whatsapp-official-credentials", ...)` — não há `.from(table).upsert()` direto no client; escrita 100% server-side | Segredo — armazenamento intencional, caminho mais isolado que o dos outros 2 | ✅ **CONFORME** | `useWhatsAppOfficial.ts:23,61` |
| 6 | `ai_brain_profiles.*` | Não — `AiBrainProfileFields` é interface tipada (`tone`/`talk_about`/`dont_talk_about`/`products_services`/`limits`), nenhum campo de credencial | N/A | — | ✅ **CONFORME** | `aiBrainRepository.ts:41-44` (spread tipado, não `any`) |
| 7 | Os 5 mappers de domínio restantes (`finance`/`projects`/`tasks`/`crm`/`quote`) | Nenhum campo local correspondente é password/token/secret (confirmado em `types/domain.ts`/`useLeads.ts`/`useFinance.ts`/`useProjects.ts`/`useTasks.ts`/`useQuotes.ts` — zero match) | N/A | — | ✅ **CONFORME** | grep exaustivo, zero resultado |

### 1.3 Achado #2 em detalhe — por que não é "zero perda funcional" como o G63 original

Diferente do fix do G63 (onde `accesses` nunca era lido de volta — perda funcional zero ao
excluir), `flow_data` **é lido de volta e usado de verdade**: `WhatsAppBotConfig.tsx:143`
(`const savedFlow = data.flow_data`) reconstrói o fluxo visual inteiro a partir dele, e
`supabase/functions/whatsapp-bot-reply/index.ts` (achado do item1 do Robô IA,
`etapa-9-item1-parser-map.md` §1.1) lê `aiNode.properties?.gcpServiceAccount`/`geminiApiKey`
**a partir do fluxo carregado do banco** no "caminho do fluxo visual" — ou seja, `flow_data` não
é um resíduo morto, é uma 2ª cópia FUNCIONALMENTE ATIVA da mesma credencial que já vive nas
colunas dedicadas (`gemini_api_key`/`gcp_service_account`). Um fix aqui não pode ser "só
excluir" como o do G63 — precisa decidir se a credencial fica só nas colunas dedicadas (e o
caminho de leitura do fluxo visual passa a buscar de lá, não de `flow_data`) ou se a duplicação
é aceita como está, mas pelo menos com o mesmo nível de proteção nos dois lugares (ver §2 —
`whatsapp_bot_settings` tem a mesma lacuna de RLS-por-role que `workspace_ai_credentials`).
**Não corrigido nesta rodada** — desenho de fix fica pra quem pegar o achado.

---

## 2. RLS — cobertura por tabela

### 2.1 Tabelas de domínio (dado de negócio)

| Tabela | RLS habilitado | SELECT/INSERT/UPDATE/DELETE | Anchor | Status |
|---|---|---|---|---|
| `clients` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `client_contacts` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `financial_transactions` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `quotes` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `quote_items` | ✓ | 4/4 | `is_workspace_member` (indireto, via subquery em `quotes.workspace_id`) | ✅ CONFORME |
| `projects` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `tasks` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `crm_opportunities` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `client_technical_sheets` | ✓ | 4/4 | `is_workspace_member` | ✅ CONFORME |
| `ai_brain_profiles` | ✓ | SELECT + `FOR ALL` (cobre INSERT/UPDATE/DELETE) | `is_workspace_member` | ✅ CONFORME |

**Todas as 10 tabelas de domínio**: RLS habilitado, as 4 operações cobertas, todas ancoradas em
`is_workspace_member` — nenhum achado nesta camada. Mesmo padrão em todo o repo, sem exceção.

### 2.2 Tabelas de credencial — achado real: sem distinção de papel dentro do workspace

| Tabela | RLS habilitado | SELECT | INSERT/UPDATE/DELETE | Status |
|---|---|---|---|---|
| `workspace_ai_credentials` (Vertex/Gemini, `credentials_json` com `private_key`) | ✓ | `is_workspace_member` | `is_workspace_member` (todas as 3) | 🔴 **VIOLAÇÃO — MÉDIO/ALTO** |
| `whatsapp_official_credentials` (token da API oficial) | ✓ | `is_workspace_member` | **`is_workspace_admin`** (as 3) | 🟡 **SUSPEITO — parcial** |
| `whatsapp_bot_settings` (`gemini_api_key`/`gcp_service_account` em colunas dedicadas + `flow_data`, ver §1.3) | ✓ | `is_workspace_member` | `is_workspace_member` (todas as 3) | 🔴 **VIOLAÇÃO — MÉDIO/ALTO**, mesma classe de `workspace_ai_credentials` |

**O achado**: `is_workspace_admin` **existe e já é usado** neste repo
(`supabase/migrations/20260603174051_...sql`, aplicado em `whatsapp_official_credentials` pras
3 operações de escrita) — é precedente real, não uma função hipotética a criar. Mas
`workspace_ai_credentials` e `whatsapp_bot_settings` (as 2 tabelas com credenciais de
provedores de IA de terceiros, incluindo uma chave privada de service account) **não usam esse
precedente** — qualquer membro do workspace (não só quem configurou a integração) pode:
- Ler `credentials_json`/`gcp_service_account` por completo via `SELECT` direto (a UI evita
  puxar essas colunas na listagem, mas isso é só uma escolha de query da própria UI — RLS não
  impede um `SELECT credentials_json FROM workspace_ai_credentials` via API/console do
  navegador com a própria sessão autenticada de qualquer membro).
- Sobrescrever/apagar a credencial do workspace inteiro sem ser admin.

**Mesmo `whatsapp_official_credentials`**, que já restringe ESCRITA a admins, ainda permite
`SELECT` por qualquer membro — o token de acesso da API oficial do WhatsApp é legível por
qualquer um, só não é editável.

**Não é uma inconsistência de convenção acidental** — é uma inconsistência entre 2 decisões de
design conscientes (`whatsapp_official_credentials` decidiu proteger escrita; os outros 2 não
decidiram nada, herdaram o padrão-padrão de `is_workspace_member` de tabelas de domínio comum).
Nenhuma das 3 tabelas restringe leitura a admin — pode ser aceitável (nenhuma RBAC granular
existe no produto hoje, `kora-roadmap.md` §7.2 lista RBAC como "backlog, não planejado ainda")
ou pode ser um gap real — decisão de produto, não decidida aqui.

---

## 3. Flags opt-out nascidas ligadas — domínio não homologado

### 3.1 Método

`grep -n '!== "false"'` em `flags.ts` — **zero resultados** após o fix do G63 (as 2 flags de
Fichas Técnicas eram os únicos casos ali, já viraram opt-in). Busca estendida pro resto de
`src/` pelo mesmo padrão literal — 3 arquivos adicionais, analisados um a um abaixo.

### 3.2 Tabela de achados

| # | Flag | Onde | O que gateia | Domínio homologado? | Classificação |
|---|---|---|---|---|---|
| 1 | `kora.technicalSheets.supabaseExperimental.enabled` / `...supabaseAutoSave.enabled` | `flags.ts` | Escrita cloud ambiente (autosave a cada edição) | **Não tinha passado por nenhuma fase de flip formal** | **FECHADO (G63, `cf6d52f`)** — opt-in agora |
| 2 | `kora.whatsapp.campaignSender.enabled` | `src/lib/whatsapp/featureFlags.ts` (fora de `flags.ts`, citado no header dele) | **Disponibilidade de um botão "Enviar campanha"** (ação manual, não escrita ambiente) | Domínio tem fluxo de UI dedicado (`CampaignSendDialog.tsx`) que exige navegação + confirmação explícita | 🟡 **NOTA — classe diferente do padrão-raiz do G63.** O root cause do G63 era "editar QUALQUER campo dispara escrita, sem ação dedicada de enviar". Aqui, a ação já é dedicada e manual (clicar "Enviar") — o flag só decide se esse botão existe, não se um efeito colateral dispara sozinho. Comentário do próprio arquivo alega "o servidor tem suas próprias travas, esta flag é só UX" — **não verificado nesta rodada** (fora do escopo: exigiria ler as edge functions `whatsapp-campaign-processor`/`whatsapp-campaign-v2-sender`). Registrado como item a verificar, não como violação confirmada. |
| 3 | `useSupabaseCrmWriteFlag` / `useSupabaseQuotesWriteFlag` / `useSupabaseProjectsWriteFlag` / `useSupabaseFinanceWriteFlag` (os 4 masters de escrita de CRM/Quotes/Projects/Finance) | `src/hooks/useSupabase*WriteFlag.ts` | Escrita real em modo Supabase pros 4 domínios já flipados | **Sim — os 4 nasceram opt-in (default OFF) e foram flipados pra opt-out em Fase C, decisão DELIBERADA e documentada** (comentário de cada arquivo: "Pacote do Flip (Fase C) — default flipado pra opt-out... exceção consciente") | ✅ **CONFORME — não é o padrão-raiz do G63.** Diferença categórica: o G63 nasceu opt-out desde o dia 1, sem ninguém decidir isso conscientemente; estes 4 nasceram opt-in e só viraram opt-out depois de uma Fase C de flip real, com decisão registrada. Mesmo resultado técnico (default ligado), origem oposta (decisão vs. omissão). |

**`wa:sound`** (`WhatsApp.tsx:151`, toggle de som de notificação) — checado e descartado: preferência de UX sem nenhuma implicação de escrita/segurança.

### 3.3 Conclusão do eixo 3

**Zero achado novo do padrão-raiz do G63** (flag opt-out nascida sem decisão, em domínio nunca
homologado) além do que o próprio G63 já fechou. O único candidato adicional
(`campaignSender`) é estruturalmente diferente (gateia disponibilidade de ação manual, não
escrita ambiente) — registrado como item de verificação, não como achado confirmado.

---

## 4. Resumo consolidado

| # | Eixo | Achado | Severidade | Status |
|---|---|---|---|---|
| 1 | Segredos em payload | `client_technical_sheets.raw_payload` ↔ `accesses[].password` | Alto | **FECHADO (G63)** |
| 2 | Segredos em payload | `whatsapp_bot_settings.flow_data` duplica `gemini_api_key`/`gcp_service_account` (com `private_key`), sem redação, duplicação ATIVA (lida de volta) | **Alto** | **ABERTO — novo achado** |
| 3 | Segredos em payload | `whatsapp_messages.raw_payload` — payload bruto de webhook (PII, não credencial) | Baixo | Nota, fora do escopo estrito |
| 4 | RLS | `workspace_ai_credentials` — sem distinção de papel (SELECT/INSERT/UPDATE/DELETE todos `is_workspace_member`), guarda `private_key` | **Médio/Alto** | **ABERTO — novo achado** |
| 5 | RLS | `whatsapp_bot_settings` — mesma lacuna de #4 (sem `is_workspace_admin`) | **Médio/Alto** | **ABERTO — novo achado** |
| 6 | RLS | `whatsapp_official_credentials` — escrita já protegida por `is_workspace_admin`, leitura ainda `is_workspace_member` | Médio (parcial) | Suspeito, parcialmente mitigado |
| 7 | Flags opt-out | `campaignSender` — gate de ação manual, não escrita ambiente; claim de trava server-side não verificado | Baixo | Nota, verificação pendente |

**3 achados novos e reais** (#2, #4, #5) — todos na mesma família: credenciais de provedores de
IA/mensageria de terceiros com proteção mais fraca do que o precedente que o próprio repo já
criou (`is_workspace_admin` em `whatsapp_official_credentials`). Nenhum é idêntico ao G63
(nenhum é "campo nunca lido de volta, perda funcional zero ao remover") — os 3 exigem desenho
de fix, não uma exclusão simples.

---

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G63 (achado original, padrão-raiz desta
  varredura)
- `docs/qa/etapa-5-auditoria-g37-espelhos.md` — inventário-base dos 6 mappers (completude,
  lente complementar a esta)
- `docs/architecture/etapa-9-item1-parser-map.md` §1.1 — confirma que `flow_data` é lido de
  volta pelo `whatsapp-bot-reply/index.ts` (caminho do fluxo visual), sustentando o achado #2
- `docs/architecture/etapa-9-item3-base-conhecimento-fase-a.md` — LGPD/retenção de dado de
  conversa, tema relacionado ao achado #3 (`whatsapp_messages.raw_payload`)
- `docs/architecture/kora-roadmap.md` §7.2 — RBAC listado como "backlog, não planejado" —
  contexto pra julgar os achados #4/#5/#6 (falta de granularidade de papel é um gap do
  produto, não uma regressão desta rodada)
- `supabase/migrations/20260603174051_...sql` — definição de `is_workspace_admin`, precedente
  citado nos achados de RLS

---

**PARADO aqui — varredura encerrada, zero código alterado. 3 achados novos (payload #2, RLS
#4/#5) registrados pra decisão do revisor — não corrigidos nesta rodada por instrução explícita
de escopo (só leitura + doc).**
