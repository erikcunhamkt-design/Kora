# G71 — Credenciais de terceiros com proteção mais fraca que o precedente do próprio repo — pacote do operador

> **Nada aplicado.** Este doc guarda os 3 artefatos que dependem de ação do
> operador contra o banco de produção, gerados a partir do achado G71
> (`docs/architecture/kora-hub-auditoria-e-plano.md`), catalogado a partir de
> `docs/qa/varredura-seguranca-classe-g63.md` §1 (achado #2) e §2 (achados
> #4/#5). O código (item 1 do fix, produtor+consumidor de
> `whatsapp_bot_settings.flow_data`) já foi corrigido e testado à parte —
> este doc cobre só o que exige aplicação manual: (1) SELECT de exposição,
> (2) UPDATE de remediação do dado já gravado, (3) drafts de migration RLS.
>
> **Gate de aplicação — vale pros 3 itens:**
> 1. Code não roda DDL/DML contra produção (protocolo §0/§6/§8-b) —
>    aplicação é sempre do operador, via Supabase CLI/dashboard.
> 2. **Item 3 (RLS) tem uma condição extra, não-técnica** — ver §3.0 antes
>    de aplicar qualquer um dos 2 drafts.

---

## 1. SELECT de exposição

Conta quantas linhas de `public.whatsapp_bot_settings` têm o nó `"ai"` do
`flow_data` com `geminiApiKey`/`gcpServiceAccount` preenchidos — o vetor do
achado #2 da varredura (duplicação da credencial dentro do jsonb, sem
redação, incluindo `private_key` de service account quando o provider é
`vertex_ai`).

```sql
-- Acha linhas onde o no "ai" do fluxo visual carrega uma credencial dentro
-- de flow_data (jsonb) - vetor do G71/achado #2 da varredura de seguranca.
SELECT id, workspace_id
FROM public.whatsapp_bot_settings
WHERE jsonb_typeof(flow_data) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(flow_data) AS node
    WHERE node ->> 'type' = 'ai'
      AND (
        COALESCE(node -> 'properties' ->> 'geminiApiKey', '') <> ''
        OR COALESCE(node -> 'properties' ->> 'gcpServiceAccount', '') <> ''
      )
  );
```

Diferente do G63 original (fichas técnicas, onde a expectativa era **0**
linhas — dado sensível dentro de um autosave recém-descoberto): aqui a
expectativa é **> 0** — este é o comportamento padrão do produtor desde que
o "Gestor de Fluxo Visual" existe (`WhatsAppBotConfig.tsx`, sem flag), então
todo workspace com o robô configurado via chave própria (`gemini_api_key`
ou `vertex_ai`) provavelmente tem a credencial duplicada em `flow_data`
hoje. Rodar esta query primeiro é o que decide se §2 (remediação) tem
objeto — se vier 0, pular §2 direto pra §3.

---

## 2. UPDATE de remediação

**Só rodar se §1 retornou > 0 linhas.** Estratégia: reconstrói `flow_data`
substituindo, em qualquer nó `"ai"`, `properties.geminiApiKey` e
`properties.gcpServiceAccount` por string vazia — mesmo estado que o
produtor já corrigido passa a gravar dali em diante. As colunas dedicadas
(`gemini_api_key`/`gcp_service_account`, fonte real, já lida pelo
consumidor pós-fix) não são tocadas.

### 2.1 Gate de export manual (antes de tocar em qualquer linha)

Passo do operador, **fora deste SQL**: exportar as linhas que §1 retornou
(dashboard do Supabase → Table Editor → filtro manual, ou
`\copy (SELECT ...) TO 'g71-backup.csv' CSV` via `psql`) antes de rodar o
UPDATE abaixo. Este UPDATE reescreve `flow_data` inteiro por linha — sem
backup, não tem como recuperar o valor anterior por engano de filtro.

### 2.2 SELECT antes (mesma query de §1, registrar o resultado)

```sql
SELECT count(*) FROM public.whatsapp_bot_settings
WHERE jsonb_typeof(flow_data) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(flow_data) AS node
    WHERE node ->> 'type' = 'ai'
      AND (
        COALESCE(node -> 'properties' ->> 'geminiApiKey', '') <> ''
        OR COALESCE(node -> 'properties' ->> 'gcpServiceAccount', '') <> ''
      )
  );
```

### 2.3 UPDATE

```sql
-- G71 - remove geminiApiKey/gcpServiceAccount do no "ai" dentro de
-- flow_data para as linhas ja gravadas antes do fix do produtor. Colunas
-- dedicadas (gemini_api_key/gcp_service_account) NAO sao tocadas - seguem
-- sendo a fonte real, ja lida pelo consumidor (whatsapp-bot-reply) pos-fix.
-- create_missing=false (4o arg) no jsonb_set: se um no "ai" antigo nao
-- tiver "properties" como objeto, o set vira no-op seguro pra aquele no,
-- sem erro.
UPDATE public.whatsapp_bot_settings AS bs
SET flow_data = (
      SELECT jsonb_agg(
        CASE
          WHEN node ->> 'type' = 'ai'
            THEN jsonb_set(
                   jsonb_set(node, '{properties,geminiApiKey}', '""'::jsonb, false),
                   '{properties,gcpServiceAccount}', '""'::jsonb, false
                 )
          ELSE node
        END
      )
      FROM jsonb_array_elements(bs.flow_data) AS node
    ),
    updated_at = now()
WHERE jsonb_typeof(bs.flow_data) = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(bs.flow_data) AS node2
    WHERE node2 ->> 'type' = 'ai'
      AND (
        COALESCE(node2 -> 'properties' ->> 'geminiApiKey', '') <> ''
        OR COALESCE(node2 -> 'properties' ->> 'gcpServiceAccount', '') <> ''
      )
  );
```

### 2.4 SELECT depois (mesma query de §2.2 — esperado: 0)

Rodar de novo a query de §2.2. Resultado esperado **0**. Se vier > 0,
**parar** — não repetir o UPDATE às cegas; investigar por que alguma linha
sobreviveu (ex.: `flow_data` malformado, nó "ai" sem `properties` como
objeto — ver a nota do `create_missing=false` acima) antes de decidir o
próximo passo.

---

## 3. Drafts de migration RLS

### 3.0 Condição extra antes de aplicar (não-técnica, dos 2 drafts)

Confirmado por grep no frontend: **nenhuma das 2 telas envolvidas hoje
restringe por papel** — `WhatsAppBotConfig.tsx` (renderizada em
`WhatsApp.tsx:1003`, dentro da aba do workspace, sem checagem de
`role`/`admin`/`owner`) e `VertexAIConnectionCard.tsx` (mesma ausência de
checagem). Ou seja: **hoje, qualquer membro do workspace** (não só
owner/admin) pode configurar o robô e a credencial Vertex pela UI. Aplicar
os 2 drafts abaixo tal como estão **quebraria a escrita para qualquer
membro não-admin** que hoje use essas 2 telas — sem aviso na UI (o
`INSERT`/`UPDATE` simplesmente falharia por RLS, e as duas telas tratam
esse erro genericamente com `toast.error`, não com uma mensagem de
permissão).

Isso não invalida o achado (a lacuna de RLS existe e é real — mesma classe
de dado que `whatsapp_official_credentials` já trata como admin-only), mas
significa que aplicar precisa de uma decisão de produto primeiro: (a)
aplicar RLS + adicionar checagem de papel nas 2 telas (esconder/desabilitar
pra não-admin, mesmo padrão que faltaria descobrir se já existe em algum
lugar do app pra outras telas admin-gated), ou (b) aplicar RLS mesmo assim,
aceitando que não-admins percam a escrita sem aviso claro até a UI ser
ajustada depois. **Não é decisão que este pacote toma** — só levanta o
draft pronto e a lacuna encontrada.

**Confirmação do revisor (rodada de merge do G71):** o(s) workspace(s) em
produção hoje têm um único usuário (owner) — não existe, hoje, nenhum
membro não-admin que dependa de escrever em `whatsapp_bot_settings` ou
`workspace_ai_credentials` pelas 2 telas de §3.0. **Aplicar os 2 drafts
agora é seguro** — não quebra escrita de ninguém, porque não há
não-admin no workspace atual pra quebrar. Isso NÃO fecha a ressalva de
§3.0, só muda quando ela vira bloqueante: o gate de papel na UI
(`WhatsAppBotConfig.tsx`/`VertexAIConnectionCard.tsx`) passa a ser
**obrigatório antes de qualquer workspace ganhar um segundo membro
não-admin** — se os drafts forem aplicados antes desse gate existir, e
depois o workspace virar multiusuário sem a UI ter sido ajustada, o
sintoma descrito em §3.0 (escrita falhando em silêncio por RLS, sem
mensagem de permissão) volta a valer. Registrado aqui pra não se perder
entre a aplicação dos drafts (que pode acontecer agora) e o trabalho de
UI (que precisa acontecer antes do workspace crescer) — são 2 pacotes
diferentes, sem dependência de ordem entre si, mas com essa janela de
risco se a ordem inverter.

### 3.1 Draft — `workspace_ai_credentials` (escrita → admin)

```sql
-- G71 - restringe escrita de workspace_ai_credentials (credencial jsonb da
-- Vertex AI, inclui private_key de service account) a admins do workspace -
-- precedente ja em uso no repo: whatsapp_official_credentials (migration
-- 20260615173900_aa74fe4c-...sql), mesma funcao is_workspace_admin
-- (role IN ('owner','admin')). SELECT permanece member: a propria aplicacao
-- ja exclui credentials_json da query de listagem (useVertexCredentials.ts,
-- select sem essa coluna) - restringir SELECT tambem seria alem do achado
-- (nenhum vazamento de leitura identificado na varredura).
--
-- ATENCAO (docs/qa/g71-credenciais-terceiros-pacote-operador.md §3.0): sem
-- checagem de papel na UI (VertexAIConnectionCard.tsx) hoje, aplicar isto
-- quebra a escrita pra membro nao-admin. Decisao de produto antes de
-- aplicar, nao so tecnica.
--
-- PROPOSTA - NAO aplicada pelo Code (protocolo §0/§6/§8-b).

DROP POLICY IF EXISTS "Members can insert AI credentials in their workspace" ON public.workspace_ai_credentials;
CREATE POLICY "Admins can insert AI credentials in their workspace"
  ON public.workspace_ai_credentials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Members can update AI credentials in their workspace" ON public.workspace_ai_credentials;
CREATE POLICY "Admins can update AI credentials in their workspace"
  ON public.workspace_ai_credentials FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "Members can delete AI credentials in their workspace" ON public.workspace_ai_credentials;
CREATE POLICY "Admins can delete AI credentials in their workspace"
  ON public.workspace_ai_credentials FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin(workspace_id));
```

### 3.2 Draft — `whatsapp_bot_settings` (escrita → admin)

A policy atual (`"Workspace members can modify bot settings"`) é `FOR ALL`
— cobre INSERT/UPDATE/DELETE num único `USING`/`WITH CHECK` member-level
(migration `20260602153027_67385c0b-...sql`). Precisa virar 3 policies
separadas pra restringir só a escrita — `SELECT` já tem policy própria
(`"Workspace members can view bot settings"`), intocada.

```sql
-- G71 - restringe escrita de whatsapp_bot_settings (guarda gemini_api_key/
-- gcp_service_account em colunas dedicadas) a admins do workspace. A policy
-- "Workspace members can modify bot settings" e FOR ALL - precisa ser
-- substituida por 3 policies separadas pra so a escrita virar admin-gated
-- (SELECT continua com a policy propria, intocada).
--
-- ATENCAO (docs/qa/g71-credenciais-terceiros-pacote-operador.md §3.0): sem
-- checagem de papel na UI (WhatsAppBotConfig.tsx) hoje, aplicar isto quebra
-- a escrita pra membro nao-admin. Decisao de produto antes de aplicar, nao
-- so tecnica.
--
-- PROPOSTA - NAO aplicada pelo Code (protocolo §0/§6/§8-b).

DROP POLICY IF EXISTS "Workspace members can modify bot settings" ON public.whatsapp_bot_settings;

CREATE POLICY "Workspace admins can insert bot settings"
  ON public.whatsapp_bot_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can update bot settings"
  ON public.whatsapp_bot_settings FOR UPDATE
  TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can delete bot settings"
  ON public.whatsapp_bot_settings FOR DELETE
  TO authenticated
  USING (public.is_workspace_admin(workspace_id));
```

---

## Referências

- `docs/qa/varredura-seguranca-classe-g63.md` §1 (achado #2, flow_data) e §2
  (achados #4/#5, RLS) — origem dos 3 itens deste pacote.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — entrada G71 (catálogo,
  ver §6 desta rodada).
- `supabase/migrations/20260615173900_aa74fe4c-d074-4217-ae9a-0193000259e3.sql`
  — precedente direto de RLS admin-gated pra credencial (`whatsapp_official_credentials`),
  molde reaplicado nos 2 drafts de §3.
- `supabase/migrations/20260603174051_4acfedd9-8d66-4fc2-9ae0-1717fd2331b7.sql`
  — definição de `is_workspace_admin` (`role IN ('owner','admin')`).
- `docs/qa/etapa-5-flip-clientes-rodada3-check-drafts.md` — precedente de
  formato (draft de migration + gate de aplicação, nada rodado pelo Code).

**PARADO aqui — nenhum SQL rodado contra produção, nenhuma migration em
`supabase/migrations/` ainda. §18.**
