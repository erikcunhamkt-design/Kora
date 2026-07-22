# Levantamento — Etapa 6 (Fila, rate limit e worker)

> **Escopo deste documento: SOMENTE levantamento. Zero implementação.** Lido o plano mestre
> ([`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md), `## 6`, `### Etapa 6`),
> inventariado o estado real do código/schema em 2026-07-21, e proposto um escopo mínimo
> viável com riscos citados. Nenhum código foi alterado; nenhuma extensão foi habilitada;
> nenhum cron foi criado.

---

## 1. O que a Etapa 6 promete (plano mestre)

Do plano mestre, `### Etapa 6 — Fila, rate limit e worker (WhatsApp + IA + e-mail)`:

- `pg_cron` + `pg_net` acionando `whatsapp-campaign-v2-sender` em lotes automáticos, com
  **retry** e idempotência (G4).
- Rate limit + quota por workspace nas funções de IA e e-mail; tabela de contadores/janela
  (G5).
- Webhook de delivery/read mapeando `provider_message_id` → recipient.
- **Aceite (do plano):** campanha de milhares processa em lotes sozinha; abuso é barrado;
  custo previsível.

Contexto dos gargalos que motivam a etapa (`## 2` do plano mestre):

- **G4** — "Envio é em lote manual, `MAX_BATCH_SIZE = 10`, sem cron, sem retry automático,
  sem agendamento real (`scheduled_at` é só metadata)."
- **G5** — "Endpoints de IA (Gemini/Vertex) e e-mail (Resend) sem limitação permitem abuso e
  explosão de custo."

**Achado central deste levantamento:** as três promessas acima **não partem de zero**. Uma
já existe (para um sistema diferente do nomeado), uma já foi entregue, e uma continua
totalmente em aberto. Ver `§2` e `§3`.

---

## 2. Inventário do estado atual

### 2.1 Edge Functions ativas (`supabase/functions/`)

| Função | Papel | `verify_jwt` (`config.toml`) | Rate limit próprio? | Acionada por cron? |
|---|---|---|---|---|
| `whatsapp-webhook` | Webhook do provedor uazapi (inbound + ack delivery/read) | default (`true`) | não | não (evento externo) |
| `whatsapp-bot-reply` | Gera resposta de IA (Vertex AI / Gemini / Lovable AI Gateway) para mensagem inbound | default | **não** (só repassa 429 do gateway upstream, ver `§2.4`) | não |
| `whatsapp-campaign-processor` | Processa `whatsapp_queue` (campanhas **legadas**), gate anti-ban no banco | default | n/a (é o próprio worker) | **sim — já em produção**, ver `§2.2` |
| `whatsapp-campaign-v2-sender` | Processa **um lote** de `whatsapp_campaign_recipients` (campanhas **v2**) | default | não | **não** — clique manual, ver `§2.3` |
| `whatsapp-instance` | Provisiona/gerencia instância uazapi | default | não | não |
| `whatsapp-official-credentials` | Credenciais WhatsApp Cloud API oficial (Meta) | default | não | não |
| `whatsapp-official-send` | Envio via WhatsApp Cloud API oficial (Meta) | default | não | não |
| `whatsapp-official-webhook` | Webhook da WhatsApp Cloud API oficial (Meta) | **`false`** (correto — é público) | não | não (evento externo) |

Só `config.toml` (`supabase/config.toml`) declara override para `whatsapp-official-webhook`;
as demais usam o default (`verify_jwt = true`).

**Não há nenhuma Edge Function dedicada a IA genérica ou e-mail.** A lógica de IA
(Vertex AI / Gemini / Lovable AI Gateway) está embutida dentro de `whatsapp-bot-reply`
(`index.ts:1,24-41,373-464`) — chamadas `fetch` diretas, sem um módulo `_shared` de IA.
`e-mail (Resend)` aparece **só em documentação** (`docs/integrations/INTEGRATIONS-ROADMAP.md`,
`docs/architecture/SUPABASE-FOUNDATION-SPEC.md`) — **nenhuma função, nenhuma chamada Resend
em nenhum lugar do código.**

> **Nota lateral (drift de documentação):** o mapa do repositório no plano mestre (`## 1`)
> lista `_shared/` como contendo `cors`, `vertex.ts` — esse arquivo
> (`supabase/functions/_shared/vertex.ts`) foi **removido** por estar órfão (commit
> `9262245`, merge `f231893`, 2026-07-20). O plano mestre ainda não reflete essa remoção;
> não é bloqueante, só uma referência desatualizada a ajustar numa próxima revisão do mapa.

### 2.2 `pg_cron` + `pg_net` — já habilitados e em produção (não é gap zero)

Migration `supabase/migrations/20260602161206_abe508c3-758d-49be-a9a8-d1e136a29c87.sql`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
...
SELECT cron.schedule(
  'whatsapp-campaign-processor',
  '* * * * *',
  $$ SELECT net.http_post(url := '.../functions/v1/whatsapp-campaign-processor', ...); $$
);
```

Isso já dispara `whatsapp-campaign-processor` **todo minuto**, desde 2026-06-02. O que essa
função faz (`index.ts` + RPCs `claim_campaign_messages`/`reap_stuck_campaign_messages` em
`supabase/migrations/20260701220000_batch3_campaign_robustness.sql`) já cobre, para o
sistema de campanhas **legado** (`whatsapp_campaigns` + `whatsapp_queue`), exatamente o que
a Etapa 6 pede:

- **Lotes automáticos sem intervenção do operador** — cron, não clique.
- **Idempotência real** — `claim_campaign_messages` usa `UPDATE ... WHERE status='pending'`
  como arbiter atômico (não upsert), uma linha só é reivindicada por uma execução.
- **Retry** — `reap_stuck_campaign_messages` devolve a `pending` qualquer linha presa em
  `sending` há mais de 5 min (crash/timeout), reprocessada no próximo tick.
- **Anti-ban / pacing no banco** — gate por instância (`whatsapp_instances.campaign_next_send_at`),
  não por `sleep()` na função (o design anterior, que estourava o wall-clock — documentado no
  cabeçalho da própria migration).

**Isso é maduro e já funciona.** O gap real não é "não existe cron" — é que esse cron
**não** aciona a função que o plano mestre nomeia (`whatsapp-campaign-v2-sender`). Ver `§2.3`.

### 2.3 `whatsapp-campaign-v2-sender` — o gap real de G4

Sistema **v2** (`whatsapp_campaigns_v2` + `whatsapp_campaign_recipients`, tabelas distintas
das do sistema legado) é mais novo, mais rigoroso em validação (autoriza por
`workspace_members` via JWT do chamador, valida template/instância antes de enviar,
idempotência por linha via `UPDATE ... WHERE status='queued'`), mas **cada invocação
processa só um lote de até 10 destinatários** (`MAX_BATCH_SIZE = 10`,
`quotesRepository.ts` não — `whatsapp-campaign-v2-sender/index.ts:23`) e **precisa ser
chamada manualmente**: `CampaignSendDialog.tsx:105` chama `invokeCampaignSenderBatch` a
partir de um clique do operador (botão "Enviar lote"); não há loop nem cron. Para uma
campanha de milhares, o operador precisaria manter a aba aberta e clicar dezenas/centenas
de vezes — exatamente o que G4 descreve, mas no sistema v2, não no legado.

Isso **coincide** com o histórico do próprio recurso: `docs/integrations/SUPABASE-WHATSAPP-CAMPAIGNS-V1.md`
já listava, em rodadas anteriores, como "Próximos passos" pendentes:
- linha 99: *"Edge function `whatsapp-campaign-v2-sender` com fila, rate limit e idempotência"*
- linha 282: *"Cron job (`pg_cron` + `pg_net`) para `whatsapp-campaign-v2-sender` rodar lotes
  automaticamente"*

Nenhum dos dois foi feito até hoje (confirmado lendo o código atual, não só o histórico do
doc).

**Duas arquiteturas de campanha paralelas coexistindo** (legada com cron maduro, v2 sem
cron) é, em si, um achado a registrar — não necessariamente um problema a resolver dentro da
Etapa 6, mas uma decisão de produto/arquitetura que a proposta de escopo (`§4`) não pode
ignorar.

### 2.4 Webhook de delivery/read → recipient — já entregue (contradiz uma das 3 promessas)

A terceira promessa da Etapa 6 ("Webhook de delivery/read mapeando `provider_message_id` →
recipient") **já está implementada**, para o sistema v2: `whatsapp-webhook/index.ts:199-325`
normaliza o ack do uazapi (`sent`/`delivered`/`read`), casa por `provider_message_id`
(`:296`) contra `whatsapp_campaign_recipients`, e promove o status só para frente
(`sent → delivered → read`, nunca regride, nunca sobrescreve `replied`/`failed`, `:312-315`).
Confirmado também pelo próprio histórico do recurso (`SUPABASE-WHATSAPP-CAMPAIGNS-V1.md:470`:
*"sem cron próprio para polling"* — a única limitação registrada é que depende do uazapi
**emitir** o evento; não é polled, mas o mapeamento em si existe e funciona).

**Ação recomendada:** tirar este item da lista de pendências da Etapa 6 no plano mestre — já
está feito.

### 2.5 Rate limit / quota por workspace — G5 totalmente em aberto

Busca por `rate.?limit|throttl|quota` em `supabase/functions/`: **um único resultado**, e é
reativo, não preventivo — `whatsapp-bot-reply/index.ts:492` só **repassa** um 429 que o
Lovable AI Gateway upstream já devolveu (`"Limite de requisições excedido no Lovable AI
Gateway (429)"`). **Não existe nenhuma contagem, janela, ou quota própria do Kora** — nem por
workspace, nem por função, nem global. Nenhuma tabela de contadores. Nenhum middleware
compartilhado.

Como `§2.1` mostra, hoje **só existe um alvo real** para esse rate limit — o caminho de IA
dentro de `whatsapp-bot-reply`. E-mail (Resend) não tem função nenhuma para limitar ainda.

### 2.6 Financeiro — recorrências (candidato citado no pedido, hoje não acionável)

`RecurringEntry` (`src/hooks/useFinance.ts:172-186`, campo `nextChargeAt`) é **CRUD 100%
local** (`localStorage`, chave `kora.finance.recurring.v1`) — `addRecurring`/
`updateRecurring`/`deleteRecurring` só manipulam estado do navegador. **Não existe nenhuma
geração automática de transação a partir de `nextChargeAt`**, nem client-side (não há
checagem "está vencido? materializa") nem server-side. Seria, em tese, candidato a
`pg_cron` — mas a Fatia 6 (finance, `localStorage → Supabase`, mesclada em `main` em
2026-07-21, commit `dd6d55a`) manteve a **leitura** de finance local (mesmo padrão de
carência das fatias anteriores — import é write-through, não cutover). **Não é candidato
viável agora**: automatizar geração de recorrência no Supabase antes do cutover de leitura
do financeiro criaria uma segunda fonte de verdade que o app nem lê. Revisitar só depois do
cutover de leitura de `transactions`/`financial_transactions`.

### 2.7 Notificações — não existe

Busca por `notification|notificaç` em `supabase/migrations/`: **zero resultados**. Não há
tabela, trigger, nem função relacionada a notificações no backend hoje. Não é candidato
acionável — não há o que agendar.

---

## 3. Tabela-resumo: promessa vs. estado real

| Promessa da Etapa 6 | Estado real |
|---|---|
| `pg_cron`+`pg_net` acionando o sender em lotes, com retry e idempotência | **Parcial.** Já existe e roda em produção — mas para o sistema **legado** (`whatsapp_queue`), não para `whatsapp-campaign-v2-sender` (o nomeado no plano). |
| Rate limit + quota por workspace (IA/e-mail) | **Não existe.** Zero infraestrutura. Único alvo real hoje é a IA em `whatsapp-bot-reply`; e-mail não tem função para limitar. |
| Webhook delivery/read → recipient | **Já entregue**, para o sistema v2 (`whatsapp-webhook/index.ts`). Remover do escopo. |

---

## 4. Proposta de escopo mínimo viável (para decisão do operador, não iniciada)

1. **Cron para o sistema v2** — em vez de desenhar do zero, **reaproveitar o padrão já
   provado** do legado (`claim_*`/`reap_*` + gate por instância + cron a cada minuto),
   adaptado às tabelas v2 (`whatsapp_campaign_recipients`). Antes de implementar, decisão do
   operador em aberto: **unificar os dois sistemas de campanha agora, ou automatizar os dois
   em paralelo e unificar depois?** Este levantamento não recomenda uma opção — só registra
   que a decisão existe e precede o código.
2. **Rate limit mínimo** — uma tabela de contadores por `workspace_id` + função + janela
   (ex.: `workspace_function_usage(workspace_id, function_name, window_start, count)`),
   aplicada primeiro (e só) em `whatsapp-bot-reply` — único alvo real hoje. Generalizar para
   e-mail quando (e se) uma função de e-mail existir; construir a infraestrutura genérica
   antes de ter um segundo consumidor real é especulativo.
3. **Fora do escopo mínimo, explicitamente:** recorrência financeira (`§2.6`, bloqueada pelo
   cutover de leitura), notificações (`§2.7`, não existem), migração/consolidação dos dois
   sistemas de campanha (decisão de produto, não uma tarefa de infra).
4. **Aceite mínimo proposto:** campanha v2 processa em lotes sem clique manual do operador;
   `whatsapp-bot-reply` rejeita com 429 próprio (não só repassa o do gateway) acima de um
   teto por workspace; nenhuma regressão nos dois cron jobs (legado continua rodando).

---

## 5. Riscos

- **Plano Supabase confirmado: Free, sem backup ativo.** Declaração verbatim do operador em
  [`protocolo-homologacao.md` §0](../qa/protocolo-homologacao.md): *"Estou ciente de que meu
  projeto Supabase está no plano free e não tem backup ativo."* Qualquer trabalho de Etapa 6
  herda esse risco geral (não é específico de cron).
- **`pg_cron` no plano Free — não há trava documentada por tier, e há evidência direta de
  que já funciona neste projeto.** A documentação oficial do guia de Cron não menciona
  restrição de plano — só uma recomendação operacional: *"For best performance, we recommend
  no more than 8 Jobs run concurrently. Each Job should run no more than 10 minutes"*
  ([Supabase Docs — Cron](https://supabase.com/docs/guides/cron)). Um mantenedor da Supabase
  respondeu numa discussão pública que *"Cron is only limited by the resources it uses
  CPU/Memory/Disk wise on any tier"* ([GitHub Discussion #37405](https://github.com/orgs/supabase/discussions/37405)).
  Isso é consistente com o achado do `§2.2`: este projeto (Free, confirmado acima) **já tem**
  `pg_cron`+`pg_net` habilitados e um job rodando a cada minuto desde 2026-06-02 — evidência
  empírica de primeira mão, mais forte que a doc de terceiros.
- **O risco real do Free não é "não ter `pg_cron`", é o projeto pausar.** Página oficial de
  preços: *"Free projects are paused after 1 week of inactivity"*
  ([Supabase Pricing](https://supabase.com/pricing)). Se o projeto pausar por inatividade de
  API, os cron jobs param junto — silenciosamente, sem alerta próprio do Kora hoje (não há
  monitoramento disso). Isso já é um risco para o cron **existente** do sistema legado, não
  só para um novo cron da Etapa 6.
- **Limite de jobs concorrentes.** `pg_cron` na Supabase roda versão 1.6.4, com suporte a até
  32 jobs concorrentes segundo a doc, mas a própria Supabase recomenda **não passar de 8**
  rodando ao mesmo tempo. Hoje há 1 job. Adicionar um segundo (v2) mantém a folga.
- **`net.http_post` com `apikey` (anon key) em texto puro na migration** (`20260602161206_...sql:20`).
  Não é vazamento de segredo — a chave publicável já é pública por design (mesmo padrão
  confirmado na auditoria de Fatia 2.1, `AUDITORIA_FASE_02_1.md §22`) — mas é um ponto de
  manutenibilidade: se a chave rotacionar, essa migration histórica fica com o valor antigo
  (inofensivo, mas morto). Não é bloqueante.
- ~~Este levantamento é estático (leitura de código/migrations), não verificação ao vivo.~~
  **Confirmado ao vivo pelo operador em 2026-07-21 — ver `§6`.** Query usada, para
  referência/reprodutibilidade:

```sql
-- Extensões relevantes à Etapa 6
select extname, extversion
from pg_extension
where extname in ('pg_cron', 'pg_net');

-- Jobs de cron ativos hoje (deve mostrar 'whatsapp-campaign-processor', * * * * *)
select jobid, jobname, schedule, active
from cron.job;
```

---

## 6. Confirmação ao vivo (operador, 2026-07-21)

Query do `§5` executada pelo operador diretamente no banco remoto. Resultado:

| Extensão | Versão |
|---|---|
| `pg_cron` | `1.6.4` |
| `pg_net` | `0.20.0` |

| `jobid` | `jobname` | `schedule` | `active` |
|---|---|---|---|
| — | `whatsapp-campaign-processor` | `* * * * *` | `true` |

Confirma, sem margem de dúvida, o achado do `§2.2`: `pg_cron`/`pg_net` estão habilitados
neste projeto (plano Free) e o job legado está ativo, no schedule esperado. A ressalva
estática do `§5` está superada.

**Nota derivada (raciocínio novo, não apenas o resultado da query):** o próprio job
`whatsapp-campaign-processor` roda `net.http_post` contra uma Edge Function a cada minuto,
24/7 — isso **é**, em si, tráfego de API constante contra o projeto. A condição de pausa do
Free ("paused after 1 week of inactivity", `§5`) é sobre **inatividade**; um job que bate na
API todo minuto, para sempre, é o oposto de inatividade. **Enquanto esse job existir e
continuar ativo, ele mitiga por construção o próprio risco de pausa que o `§5` levanta** —
não por decisão ou monitoramento do Kora, mas como efeito colateral da cadência do cron.
Isso não elimina o risco (o job poderia falhar silenciosamente, ser desabilitado, ou a regra
de pausa da Supabase poder não contar tráfego de `pg_net`/`cron` como "atividade" no sentido
que a Supabase mede — isso **não foi verificado**, é inferência, não confirmado em doc oficial)
mas reduz a probabilidade prática do cenário "projeto pausou, cron parou" enquanto o job
atual permanecer de pé.

---

## Fontes

- Plano mestre: [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (`## 2` G4/G5, `## 6` Etapa 6).
- Código: `supabase/functions/*/index.ts`, `supabase/config.toml`, `supabase/migrations/20260602161206_*.sql`,
  `supabase/migrations/20260701220000_batch3_campaign_robustness.sql`, `src/hooks/useFinance.ts`,
  `src/components/whatsapp/campaigns/CampaignSendDialog.tsx`, `src/lib/whatsapp/repositories/whatsappCampaignsRepository.ts`.
- Histórico do recurso: [`SUPABASE-WHATSAPP-CAMPAIGNS-V1.md`](../integrations/SUPABASE-WHATSAPP-CAMPAIGNS-V1.md).
- Risco de plano: [`protocolo-homologacao.md` §0](../qa/protocolo-homologacao.md).
- Externas: [Supabase Docs — Cron](https://supabase.com/docs/guides/cron),
  [Supabase Pricing](https://supabase.com/pricing),
  [GitHub Discussion #37405 — pg_cron and free tier](https://github.com/orgs/supabase/discussions/37405).
