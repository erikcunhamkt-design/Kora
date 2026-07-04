# Etapa 2 — Endurecimento de segurança

**Objetivo:** primeira etapa que toca código de backend. Dividida em duas fases com
parada obrigatória entre elas. **Fase A** = diagnóstico read-only; **Fase B** =
correção só dos itens aprovados, um commit isolado por item, mexendo **apenas na
borda de validação** — nunca na lógica de negócio dos webhooks.

**Data:** 2026-07-04 · **Branch:** `main`

**Commits da Fase B (isolados):**

| Commit | Escopo |
|--------|--------|
| `cceaa3d` | S1 — Meta webhook: rejeita assinatura inválida com **401** + compare **constant-time** |
| `f5fa125` | S1 — uazapi webhook: compara `?secret=` em **tempo constante** |
| _(este doc)_ | relatório da Etapa 2 |

**Decisão de escopo:** o item **S3 (CORS)** foi **adiado** a pedido do dono do repo —
ainda não há domínios de produção definidos, e `Access-Control-Allow-Origin: *` é
aceitável por ora (JWT + verificação de membership já guardam as funções). Registrado
como pendência abaixo.

---

## Fase A — Diagnóstico (estado real de cada item)

Investigação somente-leitura das 8 Edge Functions, `config.toml`, `src/` e do hook de
credenciais de IA. Nenhum arquivo foi alterado nesta fase.

### Inventário das Edge Functions

| Função | `verify_jwt` | Tipo | Barreira de autenticação própria |
|---|---|---|---|
| `whatsapp-official-webhook` | **`false`** (única no config.toml) | Webhook Meta (server→server) | HMAC-SHA256 por entry + handshake GET `verify_token` |
| `whatsapp-webhook` | `true` (default, ausente do config) | Webhook uazapi (server→server) | Segredo compartilhado `?secret=` → 401 |
| `whatsapp-official-send` | `true` (default) | Browser | Bearer JWT (`getClaims`) + checa `workspace_members` |
| `whatsapp-official-credentials` | `true` (default) | Browser | Gateway JWT |
| `whatsapp-instance` | `true` (default) | Browser | Gateway JWT |
| `whatsapp-campaign-v2-sender` | `true` (default) | Browser/cron | Gateway JWT |
| `whatsapp-campaign-processor` | `true` (default) | Cron/interno | Gateway JWT |
| `whatsapp-bot-reply` | `true` (default) | Interno (chamado pelo webhook com service_role) | Gateway JWT |

### S1 — Validação de assinatura de webhooks
- **`whatsapp-official-webhook` (Meta):** ✅ já validava HMAC-SHA256 (`verifySignature`)
  e o handshake GET (`hub.mode`/`hub.verify_token`/`hub.challenge`). Fail-closed (sem
  `app_secret` → não processa). `app_secret` vem do banco por workspace (não hardcoded).
  Fraquezas: assinatura inválida respondia **200** (só `continue`) e a comparação
  `hex === expected` **não era constant-time**. → corrigido na Fase B.
- **`whatsapp-webhook` (uazapi):** ✅ autentica via segredo compartilhado
  (`?secret=` == `UAZAPI_WEBHOOK_SECRET`, via `Deno.env`), 401 antes de processar.
  uazapi não oferece HMAC de corpo → segredo compartilhado é o padrão adequado.
  Fraqueza: comparação `!==` **não era constant-time**. → corrigido na Fase B.
- **Asaas (pagamento):** ✅ confirmado que **não existe**. Nada a criar; pendência futura.

### S2 — `verify_jwt` por função
`config.toml` declara **apenas** `whatsapp-official-webhook = false`; as outras 7 herdam
`true`. A única função pública é o webhook da Meta, que **faz sua própria autenticação**
(HMAC). ✅ Nenhuma função sensível exposta sem auth própria.

### S3 — CORS
Não há `_shared/cors.ts` nem import map; todas as funções importam um `corsHeaders`
permissivo (`Access-Control-Allow-Origin: *`). Webhooks: CORS irrelevante (server→server).
Browser-called: hoje aceitam qualquer origem. **Adiado por decisão** (ver pendências).

### S4 — `service_role` no frontend
✅ **Limpo.** Zero ocorrências de `service_role`/`SERVICE_ROLE` em `src/`. O `client.ts`
usa **só a publishable/anon key** (`"role":"anon"`, protegida por RLS).

### S6 — `credentials_json` de IA
✅ **Não vaza.** `useVertexCredentials.refresh()` seleciona **apenas metadados**
(`id, is_active, location, default_model, credentials_project_id,
credentials_client_email, updated_at`) — nunca `credentials_json`. O `credentials_json`
só é **escrito** (upload do usuário), nunca lido no browser.

---

## Fase B — Correções aplicadas (apenas o S1-hardening aprovado)

### Commit `cceaa3d` — Meta webhook (`whatsapp-official-webhook/index.ts`)

**1. Comparação constant-time.** A verificação HMAC-SHA256 deixou de comparar strings
hexadecimais com `===` e passou a comparar **bytes em tempo constante**.

_Antes:_
```ts
const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
return hex === expected;
```
_Depois:_ `hexToBytes()` faz o parse do header e `timingSafeEqual()` compara os bytes
(mesmo tamanho, XOR acumulado, sem early-exit):
```ts
const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
return timingSafeEqual(new Uint8Array(sig), expected);
```

**2. Rejeição 200 → 401 (somente no caminho de rejeição).**

_Antes:_
```ts
if (!ok) { console.warn("invalid signature", phoneNumberId); continue; }
```
_Depois:_
```ts
if (!ok) {
  console.warn("invalid signature", phoneNumberId);
  return new Response("Unauthorized", { status: 401 });
}
```

### Commit `f5fa125` — uazapi webhook (`whatsapp-webhook/index.ts`)

**Comparação do `?secret=` em tempo constante.** O 401 em segredo inválido/ausente já
existia e permanece.

_Antes:_
```ts
if (!secret || secret !== WEBHOOK_SECRET) { /* 401 */ }
```
_Depois:_
```ts
if (!secret || !timingSafeEqualStr(secret, WEBHOOK_SECRET)) { /* 401 */ }
```
`timingSafeEqualStr` codifica ambos em bytes, faz short-circuit em tamanhos diferentes e
compara byte-a-byte sem early-exit.

### Confirmação de invariantes (comportamento inalterado)
- ✅ **Caminho de assinatura VÁLIDA (Meta):** inalterado — o HMAC é calculado do mesmo
  modo; assinatura correta → `true` → segue para o processamento exatamente como antes.
- ✅ **Handshake GET da Meta** (`hub.mode`/`hub.verify_token`/`hub.challenge`):
  **não tocado** — nenhuma linha do bloco `if (req.method === "GET")` foi alterada.
- ✅ **Fail-closed:** sem `app_secret` (ou sem credencial) → continua não processando.
- ✅ **uazapi segredo válido:** segue idêntico; apenas a comparação virou constant-time.
- ✅ Nenhum secret hardcoded; tudo via `Deno.env` / banco. Nenhuma lógica de negócio
  (parsing de payload, upsert de conversas/mensagens, ack de campanha) foi tocada.

### Testes automatizados — por que não foram adicionados
Os dois handlers são Edge Functions Deno: importam `npm:@supabase/supabase-js@2` e
chamam `Deno.serve`/`Deno.env.get` no escopo do módulo, então **não podem ser importados
no harness Node + Vitest** (sem resolução de `npm:` e sem o global `Deno`), e os caminhos
válido/inválido dependem de acesso ao banco via `service_role`. Torná-los testáveis
exigiria extrair a cripto para um módulo `_shared/` — mas **nenhuma função do repo usa
essa convenção de import relativo hoje** (`_shared/vertex.ts` está órfão), então não é
possível verificar o deploy no CI, e isso ampliaria a mudança para além da borda de
rejeição. Conforme a diretriz "não force", optou-se por **não** adicionar um teste-cópia
de baixo valor. A correção da cripto (`crypto.subtle.sign` HMAC-SHA256) e do 401
permanece uma mudança pequena e revisável na borda.

---

## Resultado de tsc / lint / test (por commit, sem regressão)

| Métrica | Baseline | Após `cceaa3d` | Após `f5fa125` |
|---|---|---|---|
| `npx tsc --noEmit` | 0 | **0** | **0** |
| ESLint — erros | 89 | **89** | **89** |
| ESLint — `no-explicit-any` | 68 | **68** | **68** |
| `npm run test` | 7 arq / 48 | **7 / 48** | **7 / 48** |

Nota de tooling: `tsconfig.app.json` tem `include: ["src"]` → as funções Deno **não** são
type-checadas por `tsc`. O `eslint .` **lint**a as funções, mas os helpers adicionados
usam só globals tipados do browser (`crypto`, `TextEncoder`, `Uint8Array`, `Number`),
sem novos `any` — por isso o gate 89/68 não moveu.

---

## Pendências registradas

- **S3 — CORS (adiado por decisão):** quando os domínios de produção do Kora existirem,
  criar `supabase/functions/_shared/cors.ts` com allowlist de origens via env
  (ex.: `ALLOWED_ORIGINS`, fallback seguro), ecoando `Origin` só se permitido e
  preservando o preflight `OPTIONS`; repontar as funções chamadas pelo browser
  (`whatsapp-official-send`, `-official-credentials`, `-instance`, `-campaign-v2-sender`).
  Não mexer nos 2 webhooks. Defense-in-depth (JWT+membership já guardam as funções).
- **DB — `REVOKE SELECT (credentials_json)`:** embora o frontend só leia metadados, o
  anon/authenticated pode, via query manual + RLS row-level, ler o `credentials_json`
  **do próprio workspace**. Mitigar com grant de coluna / mover leitura para Edge
  Function numa etapa de banco (fora do escopo desta etapa, que não altera migrations).
- **Asaas:** implementar validação de assinatura do webhook de pagamento quando a
  integração entrar (hoje inexistente).
- **S1 — nota operacional:** `whatsapp-webhook` herda `verify_jwt=true` (não está no
  config.toml); para o provedor uazapi alcançá-lo, o gateway exige a anon key. Isso é
  mais restritivo, não uma falha — apenas registrado.

---

## Critérios de aceite da Etapa 2

- [x] Fase A entregue: estado real de S1–S6 documentado com trechos e caminhos.
- [x] Fase B aplicada **somente** nos itens aprovados (S1-hardening dos 2 webhooks).
- [x] Meta webhook: assinatura inválida → **401**; comparação HMAC **constant-time**.
- [x] Meta webhook: caminho de assinatura **válida** e **handshake GET** inalterados.
- [x] Meta webhook: fail-closed preservado; nenhum secret hardcoded.
- [x] uazapi webhook: comparação do `?secret=` **constant-time**; 401 preservado.
- [x] Um commit isolado por webhook (2 commits); `git add` por caminho explícito.
- [x] `npx tsc --noEmit` = 0 e lint sem regressão (89/68) em cada commit.
- [x] `npm run test` verde (7/48) em cada commit.
- [x] Nenhuma lógica de negócio dos webhooks/functions alterada.
- [~] **S3 (CORS) adiado por decisão** do dono do repo (aguardando domínios de produção)
  — registrado como pendência, não como falha.
