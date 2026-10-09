# Etapa 9 · Item 3 — Base de conhecimento do robô — R1 (fundação)

> **Zero DDL/DML, zero deploy, zero mudança de comportamento em runtime.** Esta
> rodada executa a primeira fatia que a Fase A
> ([`etapa-9-item3-base-conhecimento-fase-a.md`](../architecture/etapa-9-item3-base-conhecimento-fase-a.md))
> propõe — **mas só a parte que não depende de decisão**. A Fase A está
> **defasada** em pontos que mudam a fatia (§2), e uma peça central (a fonte
> da categoria "catálogo") **não existe onde a Fase A supõe**. O que ficou
> pendente de decisão está em §3; a migration é só DRAFT (§4).

## 0. Escopo da primeira rodada, conforme a Fase A (5 linhas)

1. **Entra:** tabela de consentimento por categoria (`ai_knowledge_consents`, 5 categorias no schema, **default OFF**, atesto de base legal obrigatório pra C/D/E), UI de opt-in por categoria, e o bloco de conhecimento **rotulado** no ponto único de composição do prompt (§4/§5.3 da Fase A).
2. **Só a categoria A (catálogo)** é lida de fato (recomendação de sequenciamento §5.3); **C/D "literalmente não lidas por nenhum código ainda"** — tabela já desenhada pras 5, leitura só pra A.
3. **Estratégia da A:** resumo pré-computado (§3.4) — o que implica job de resumo + cache + invalidação em cascata na revogação (R2).
4. **Fica pra depois:** leitura de C/D/E; RAG (FTS primeiro, `pgvector` só se necessário); teto agregado por chamada (R7); resumo **por registro** pra C (R5).
5. **Exige coluna/migration?** **Sim — tabela nova** (`ai_knowledge_consents`; + tabela de cache do resumo se o resumo for mantido). **Só DRAFT** (§4), nunca aplicada pelo Code (§0/§6/§8-b).

## 1. O que foi codado (fundação sem decisão pendente, sem efeito em runtime)

| Peça | Arquivo | O que faz |
|---|---|---|
| Regras de consentimento (puro) | `supabase/functions/_shared/knowledgeConsent.ts` | As 5 categorias; quem exige atesto (C/D/E); `canEnableCategory` (o gate "ligar C sem ack bloqueia", Caso 3); `parseKnowledgeConsents` defensivo (tabela ausente / linhas ruins → "sem consentimento", nunca lança); `activeCategories` — **reaplica o gate no servidor**: linha `enabled = true` de C/D/E **sem** `legal_basis_ack` nunca conta como ativa, revogada nunca conta, duplicadas → basta uma inativa. Default OFF |
| Slot de composição rotulado | `supabase/functions/_shared/brainComposer.ts` | `composeSystemInstruction(brain, systemInstruction, knowledgeBlock?)` — 3º parâmetro **opcional e aditivo**: `[cérebro, conhecimento, instrução]`, cabeçalhos distintos (`"Sobre a empresa:"` × `"Contexto relevante encontrado:"`). Ausente/vazio → saída **idêntica à de antes**. + `buildKnowledgeBlock(items, maxChars)`: item inteiro ou nada (nunca corta um fato no meio), bloco vazio quando não há item, teto provisório de 2.000 chars |

### Por que NÃO liguei UI nem server nesta rodada

- **Risco G48 (nó de UI com efeito parcial):** um toggle "usar catálogo como referência" **sem a leitura do catálogo por trás** é exatamente o padrão que o G48 catalogou — a UI prometeria o que o robô não faz. G29/G40: vocabulário de UI = comportamento real.
- **Server:** consultar `ai_knowledge_consents` a cada mensagem de IA, sem nenhuma fonte implementada, seria uma query a mais por mensagem sem efeito. O slot do composer está pronto; o fio fica pra quando houver fonte (D1/D2).
- O que está pronto é **todo o miolo testável** (regras + composição + teto); o que falta é plugar a fonte e a UI — decisões abaixo.

## 2. Divergências Fase A × estado real, e ajuste proposto

| # | A Fase A assume | Realidade hoje | Ajuste proposto |
|---|---|---|---|
| **D1** | Categoria A = catálogo comercial lido de `quotes`/`quote_items` (agregado, anonimizado) | **O catálogo real (serviços/produtos) é 100% `localStorage`** — `useServices` (`orbyt.services.v1`) e `useProducts` (`kora.products.v1`); **não há tabela `services`/`products` no Supabase** e o server (Deno) **não lê `localStorage`**. `quote_items` (nuvem, pós-flip de Vendas) guarda só `name`/`quantity`/`unit_price`/`service_id` (id local) — é **"o que já foi orçado"**, não o catálogo | **Decidir (Q1):** (a) fonte = `quote_items` agregado por nome (preço típico) — barato e sem infra, mas é "histórico de orçamentos", não catálogo; ou (b) levar serviços/produtos pra nuvem **antes** (rodada própria, de Vendas); ou (c) a categoria A **fica fora** e o texto de produtos continua no cérebro (campo "Produtos/serviços", manual). **Recomendo (a) com rótulo honesto** + (b) como trilha separada |
| **D2** | A = **resumo pré-computado** (job + cache + invalidação, R2) | Pra A (dezenas de itens, estruturado) o resumo traz o custo todo do R2 — artefato derivado, job com LLM, staleness — sem necessidade: o próprio §3.1 da Fase A diz que injeção direta é aceitável pra A em workspace pequeno | **Q2:** leitura **direta e agregada na hora da chamada, com teto** (já implementado: `buildKnowledgeBlock`, 2.000 chars). **Sem cache ⇒ sem artefato derivado a invalidar ⇒ R2 some por construção** pra A. Resumo fica reservado pra quando a base crescer |
| **D3** | RLS `is_workspace_member` (igual `ai_brain_profiles`) | Pós-G71 a casa tem precedente de **escrita admin-gated** (`is_workspace_admin`) pra config sensível. Aqui a escrita é um **atesto jurídico** do operador sobre dado de terceiro | **Q3:** escrita **admin** (owner/admin), leitura member. Com a UI usando `useWorkspaceRole` (já existe, G71) pra desabilitar o toggle de não-admin com aviso |
| **D4** | Gate de consentimento na UI (toggle bloqueado sem ack) | Só UI = frágil (UPDATE direto/outra tela passa) | **Feito:** gate reaplicado no servidor (`activeCategories`) **e** CHECK no draft de migration (§4) — três camadas |
| **D5** | Composição: `[brainPreamble, knowledgeBlock, systemInstruction]` "a estender" | Composer já existe e foi desenhado pra isso (`brainComposer.ts`) — mas só com 2 parâmetros | **Feito** (§1): 3º parâmetro opcional, aditivo, testado byte-a-byte |
| **D6** | R7: teto agregado "em aberto" | Com **Claude Haiku 4.5** (default do provider Anthropic: US$ 1 / US$ 5 por MTok) um bloco de 5–20 mil tokens (estimativa da Fase A §3.1) custa **US$ 0,005–0,02 só de entrada, por mensagem** — material com `maxTokens` da resposta em 1.024 e rate-limit de 20/min por workspace | **Q4:** teto agregado **por chamada** (soma dos blocos), não por categoria. Provisório implementado: 2.000 chars (~500–700 tokens). Valor final = decisão |
| **D7** | Ponto de composição citado por linha (`496-512/326`) | Linhas obsoletas; composição hoje fica logo após o fetch de `ai_brain_profiles`, **só no caminho de IA**, depois dos retornos antecipados do menu/handover | Nenhuma mudança de desenho — mas fica **registrado**: menu, handover e silêncio (R3/R4) **nunca compõem prompt** ⇒ não leem consentimento nem dado ⇒ **custo zero** por construção |
| **D8** | Conversas (D): "o cliente com quem o bot fala agora" | R4: conversa **entregue a humano** nunca chega à IA; simulador (`isTest`, engine `ai`) **não tem conversa-alvo** | Categorias por-cliente (C/D) **não se aplicam ao simulador** — só categorias agregadas (A/B/E). Vale pra Fase B de C/D |
| **D9** | Local da UI: sub-seção da "Cérebro do Robô" em `Configuracoes.tsx` | Existe: `AiBrainSection.tsx` (flag **só de UI** `kora.ai.brain.enabled`; um perfil salvo vale mesmo com a flag OFF) | **Q5:** seguir o mesmo padrão — flag só de UI (nome `kora.ai.knowledgeBase.enabled`, reserva de nome da Fase A, ainda **não existe** em `flags.ts`); o **efeito** no servidor é gateado pela linha de consentimento ativa, nunca pela flag |
| **D10** | Convenção de migration | R1/R4 do fluxo mantêm o draft **no doc** até aplicar; item 2 escreveu o `.sql` em `supabase/migrations/` marcado "não aplicada" | **Seguir o mais recente** (draft no doc, §4) — o arquivo só entra em `supabase/migrations/` depois de aplicado (padrão `migrations-espelho-8b.md`) |

**Risco novo que a Fase A não nomeou (anexar ao R5):** `quote_items.name` é **texto livre digitado pelo operador** ("Landing Page para a Maria"). Mesmo agregando só `quote_items` (sem ler `quotes.client_name`/`client_email`/`client_whatsapp`/`company`, que existem em `quotes`), o nome de um cliente pode estar **dentro do nome do item**. É o limite técnico do §1.3 da Fase A (texto livre = tudo entra). Mitigação a decidir (Q1): copy de aviso no opt-in + só itens de orçamentos aprovados e não-arquivados.

## 3. Decisões que preciso do revisor (nada disto foi assumido no código)

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| **Q1** | Fonte da categoria A | (a) `quote_items` agregado · (b) levar catálogo pra nuvem antes · (c) A fora da 1ª rodada | (a) com rótulo honesto ("itens que já aparecem nos seus orçamentos") + (b) como trilha de Vendas |
| **Q2** | Estratégia da A | direta com teto (sem cache) · resumo pré-computado | direta com teto |
| **Q3** | Quem escreve o consentimento | member · admin | admin (atesto jurídico) |
| **Q4** | Teto de contexto | por categoria · agregado por chamada · valor | agregado; valor provisório 2.000 chars |
| **Q5** | Quais categorias entram na 1ª rodada | só A · A+B · A+B+E | só A (Fase A §5.3) — B/E sem caso de uso forte pro atendimento |
| **Q6** | Catálogo na nuvem (D1-b) | rodada própria agora · depois | fora do item 3; abrir como trilha de Vendas |

**Achado pra catalogar (ID: pedir ao revisor — não reservei):** "serviços/produtos do workspace vivem só em `localStorage` do navegador — invisíveis pra qualquer leitura server-side (robô, relatório, outro dispositivo)". Classe "dado de negócio sem persistência de nuvem"; afeta mais que este item.

## 4. DRAFT de migration — `public.ai_knowledge_consents` (**NÃO aplicada**)

> **PROPOSTA — NÃO aplicada pelo Code.** Code não roda DDL contra produção
> (§0/§6/§8-b); aplicação é do operador. Nome sugerido quando promovida:
> `<timestamp>_etapa9_item3_ai_knowledge_consents.sql`. **Só vale depois de
> Q3** (RLS admin vs member) e Q5 (categorias) — o CHECK de categoria já cobre
> as 5 (a Fase A pede o schema completo desde o início pra não migrar depois).

**Verificação prévia (read-only) — esperado: 0 linhas:**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'ai_knowledge_consents';
```

```sql
-- Etapa 9 · Item 3 (base de conhecimento) — consentimento por categoria
-- (docs/architecture/etapa-9-item3-base-conhecimento-fase-a.md §2.3;
-- docs/qa/etapa-9-item3-r1-base-conhecimento-fundacao.md §4).
-- Uma linha por (workspace, categoria). Default OFF. A linha é o GATE REAL no
-- servidor (a flag de UI não conta). Nunca hard-delete: revogar = enabled=false
-- + revoked_at (auditoria de quando parou).
CREATE TABLE IF NOT EXISTS public.ai_knowledge_consents (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id     uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category         text        NOT NULL
                   CHECK (category IN ('catalog', 'internal_ops', 'crm', 'conversations', 'financial')),
  enabled          boolean     NOT NULL DEFAULT false,
  -- Atesto do OPERADOR de que tem base legal própria perante o cliente dele
  -- (Fase A §1.1: o "sim" é uma declaração, não consentimento coletado pela Kora).
  legal_basis_ack  boolean     NOT NULL DEFAULT false,
  legal_basis_note text,
  enabled_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled_at       timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_knowledge_consents_workspace_category_key UNIQUE (workspace_id, category),
  -- 3ª camada do gate (1ª: UI, 2ª: servidor — knowledgeConsent.ts): C/D/E não
  -- ficam ligadas sem o atesto, nem por UPDATE direto.
  CONSTRAINT ai_knowledge_consents_ack_required_chk
    CHECK (NOT (enabled AND category IN ('crm', 'conversations', 'financial') AND NOT legal_basis_ack))
);

COMMENT ON TABLE public.ai_knowledge_consents IS
  'Etapa 9 · item 3 — opt-in por categoria pra o robô usar dado do workspace como contexto. Default OFF; C/D/E exigem atesto de base legal. Gate real no servidor (supabase/functions/_shared/knowledgeConsent.ts).';

ALTER TABLE public.ai_knowledge_consents ENABLE ROW LEVEL SECURITY;

-- Leitura: membros. Escrita: ADMIN (atesto jurídico) — precedente G71
-- (is_workspace_admin, role IN ('owner','admin')). Sem policy de DELETE de
-- propósito: nunca hard-delete (revogar = UPDATE). Service role (servidor)
-- ignora RLS.
CREATE POLICY "Workspace members can view knowledge consents"
  ON public.ai_knowledge_consents FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Workspace admins can insert knowledge consents"
  ON public.ai_knowledge_consents FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can update knowledge consents"
  ON public.ai_knowledge_consents FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE TRIGGER update_ai_knowledge_consents_updated_at
BEFORE UPDATE ON public.ai_knowledge_consents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
```

**Prova depois (read-only) — esperado: 1 tabela, 3 policies, 0 linhas:**

```sql
SELECT count(*) AS linhas FROM public.ai_knowledge_consents;                       -- 0
SELECT polname, polcmd FROM pg_policy
WHERE polrelid = 'public.ai_knowledge_consents'::regclass ORDER BY polname;         -- 3
```

**Se Q2 mudar pra "resumo pré-computado"**, entra uma 2ª tabela de cache
(`ai_knowledge_summaries`, FK `consent_id` com `ON DELETE CASCADE` + linha
apagada na revogação — R2). **Não desenhada aqui de propósito:** com Q2 =
"direta com teto" ela não existe.

## 5. Casos de homologação (Fase A §5.2, atualizados)

| # | Caso | Estado nesta rodada |
|---|---|---|
| 1 | Tudo OFF (default) = idêntico a hoje | **Provado por teste** (composer inalterado sem o 3º parâmetro; `activeCategories([])` = `[]`) |
| 2 | Só A ligada → só A lida | Regra provada (`activeCategories`); **leitura da A depende de Q1/Q2** |
| 3 | Ligar C sem ack é bloqueado | Regra provada (`canEnableCategory`) + reaplicada no servidor + CHECK no draft; **UI depende de Q3/Q5** |
| 4 | Revogar já refletido em resumo | Sem cache (Q2 = direta) o caso some por construção; revogada nunca conta (provado) |
| 5 | Dois clientes simultâneos (R5) | Não se aplica à A (agregada, sem cliente-alvo); **aberto pra C/D** |
| 6 | Conversa > `MAX_HISTORY` com D ligada | Fora desta rodada (D não é lida) |
| 7 | Cérebro + conhecimento: blocos separados | **Provado por teste** (ordem, cabeçalhos distintos, exclusão seletiva) |

## 6. Testes e prova

`supabase/functions/_shared/__tests__/`: `knowledgeConsent.test.ts` (19: categorias,
atesto, gate, parse defensivo, defesa em profundidade, revogada, duplicadas, ciclo
fim a fim) e `brainComposer.knowledge.test.ts` (12: 3º parâmetro aditivo/ordem/
rótulos/exclusão seletiva; builder com teto, item inteiro-ou-nada, vazio).
`brainComposer.test.ts` (cérebro, item 2) **não foi editado** — continua verde,
prova de que o 3º parâmetro é aditivo.

**Prova fail→fix→pass por patch (G65, sem `git stash`):** `git add -N` (módulo novo)
→ `git diff` dos 2 arquivos de implementação → `git checkout --` → `vitest run`:
**29 falharam, 10 passaram** (os 8 do cérebro + 2 guardas de retrocompatibilidade —
"sem 3º parâmetro" e "exclusão seletiva", verdadeiras por vacuidade sem conhecimento)
→ `rm` + `git apply` do mesmo patch → **39/39 passaram**.

## Referências

- [`etapa-9-item3-base-conhecimento-fase-a.md`](../architecture/etapa-9-item3-base-conhecimento-fase-a.md) — Fase A (§1.2 categorias, §2.3 modelo, §3.4 estratégias, §4 fronteira com o cérebro, §5.3 sequenciamento).
- [`etapa-9-item2-cerebro-fase-a.md`](../architecture/etapa-9-item2-cerebro-fase-a.md) — cérebro; `AiBrainSection.tsx`/`aiBrainRepository.ts` (padrão de UI/repositório a espelhar).
- `supabase/functions/_shared/brainComposer.ts` — ponto de composição.
- `src/hooks/useServices.ts` / `useProducts.ts` — catálogo em `localStorage` (D1).
- [`g71-credenciais-terceiros-pacote-operador.md`](g71-credenciais-terceiros-pacote-operador.md) — precedente de escrita admin-gated.
- [`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`](etapa-9-bot-fluxo-scriptado-r4-handover-real.md) — handover; conversa entregue nunca chega à IA (D7/D8).

**PARADO aqui — fundação testada, UI/server NÃO ligados (aguardam Q1–Q5), migration só DRAFT,
zero DDL/deploy, zero push/merge. §18.**
