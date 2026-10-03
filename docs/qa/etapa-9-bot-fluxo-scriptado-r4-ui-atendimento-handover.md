# Etapa 9 · Item 4 — R4 (UI de Atendimento do handover)

> **Só front-end. Zero mudança de server, zero DDL.** Fecha o contrato do
> §4 de [`etapa-9-bot-fluxo-scriptado-r4-handover-real.md`](etapa-9-bot-fluxo-scriptado-r4-handover-real.md):
> o atendente passa a VER que uma conversa foi entregue a humano e a
> DEVOLVER ao robô pela tela de Atendimento (`src/pages/WhatsApp.tsx`).
> A coluna que sustenta tudo (`whatsapp_conversations.handover_at`) segue só
> como DRAFT de migration (R4 §2) — **aplicar é do operador (§8-b)**. Esta UI
> foi escrita pra não quebrar nem aparecer enquanto a coluna não existe.

## 1. O que entrou

| Peça | Onde | Comportamento |
|---|---|---|
| Leitura defensiva | `src/lib/whatsapp/handover.ts` → `getHandoverAt()`/`isHandedOver()` | Lê `handover_at` por `unknown` (a coluna não está em `types.ts`/`WAConversation` — migration pendente). Ausente / `null` / não-string → "não entregue". |
| Ação | `endHumanHandover(invoke, workspaceId, conversationId)` (mesmo arquivo) | Chama `whatsapp-instance` `{ action: "end_human_handover", workspaceId, conversationId }` (contrato R4 §4). Nunca lança; devolve `ok` \| `migration_pending` (HTTP 409) \| `error`. |
| Indicador + botão | `src/components/whatsapp/WhatsAppHandoverBanner.tsx`, renderizado em `WhatsApp.tsx` logo abaixo do cabeçalho da conversa | Faixa âmbar "Entregue a atendimento humano desde DD/MM HH:MM — o robô está em silêncio nesta conversa" + botão **Devolver ao robô** (desabilitado enquanto roda, sem duplo clique). `handedOverAt = null` → não renderiza nada. |
| Handler | `handleEndHandover` em `WhatsApp.tsx`, ao lado de `handleAssign` | Sucesso → toast "Conversa devolvida ao robô". **409 → toast "Migration pendente" com mensagem honesta** (o estado "entregue a humano" ainda não existe no banco; operador precisa aplicar a migration; nada foi alterado) — não o "Falha" genérico. Outro erro → "Falha ao devolver ao robô" + mensagem do erro. |
| Badge na lista | `WhatsAppConversationItem.tsx` | Badge âmbar "Humano" (ícone de headset) na linha da conversa entregue. |

## 2. Decisões e por quê

1. **O banner some via realtime, sem atualização otimista** — mesmo caminho do
   `handleAssign`/arquivar. O hook `useWhatsAppConversations` já assina
   `postgres_changes` de `whatsapp_conversations` (UPDATE traz a linha inteira,
   `handover_at: null` incluso) e carrega com `select("*")` — então o campo
   chega SOZINHO assim que a coluna existir, sem tocar no hook nem listar
   colunas (uma lista explícita com `handover_at` quebraria a query inteira
   enquanto a coluna não existir).
2. **Leitura por `unknown`, não por tipo** — `WAConversation` vem de
   `types.ts` gerado (G10: defasado até a regeneração pós-migration). Em vez
   de editar tipo gerado à mão, `WAConvLike` ganhou `handover_at?` opcional (só
   documentação) e toda leitura passa por `getHandoverAt()`. **Depois que o
   operador aplicar a migration e regenerar `types.ts`**, dá pra trocar por
   acesso tipado — é refino, não requisito.
3. **409 não é erro genérico.** É o único sinal que o usuário tem de que a
   migration está pendente; toast genérico ("Edge Function returned a non-2xx
   status code") esconderia a causa. A detecção é por `error.context.status`
   (supabase-js devolve `FunctionsHttpError` com o `Response` em `context`),
   lida estruturalmente — sem importar a classe.
4. **Sem filtro "aguardando humano" na lista (opcional, descartado).** A barra
   de filtros é um `TabsList` de 5 colunas fixas (`grid-cols-5`); um 6º chip
   apertaria os rótulos já curtos, e sem a coluna o chip ficaria sempre vazio.
   Não é "barato e limpo" — o badge "Humano" já dá a visibilidade. Se o volume
   de conversas entregues justificar, vira rodada própria (com contagem no
   chip, só visível quando > 0).
5. **Nenhuma mudança em `supabase/functions`.** A ação `end_human_handover` já
   existe desde a R4 (server). `WhatsAppBotConfig.tsx` (Lane C) não foi tocado.

## 3. Degradação — coluna `handover_at` ausente (migration pendente)

| Situação | Efeito na UI |
|---|---|
| `select("*")`/realtime não trazem o campo | `getHandoverAt()` = `null` → **sem banner, sem badge**; página renderiza exatamente como antes. |
| Atendente chama a ação mesmo assim (ex.: conversa entregue antes de algum rollback) | Server devolve 409 → toast "Migration pendente" honesto. |
| Valor inesperado em `handover_at` (não-string / vazio) | Tratado como "não entregue". |

## 4. Testes (26, 3 arquivos)

- `src/lib/whatsapp/__tests__/handover.test.ts` (12): `getHandoverAt`/
  `isHandedOver` (ISO, coluna ausente, `null`, garbage, entrada não-objeto);
  `endHumanHandover` (sucesso + contrato do body, 409 → `migration_pending`,
  400/403/500 → `error`, erro sem `context`/rede não vira 409, `invoke` que
  lança, erro sem mensagem, texto honesto do 409).
- `src/components/whatsapp/__tests__/WhatsAppHandoverBanner.test.tsx` (6):
  banner com/sem `handedOverAt`, clique dispara `onReturn`, `returning`
  desabilita; badge "Humano" com/sem `handover_at` (incl. coluna ausente).
- `src/pages/__tests__/WhatsApp.handover.test.tsx` (8, **montagem real da
  página**): banner + botão na conversa entregue; badge só na conversa certa;
  **degradação** (linha sem a coluna: nem banner nem badge, página normal);
  `null` → sem banner; ação chama `end_human_handover` com workspace+conversa
  e confirma; **409 → "Migration pendente"** (não "Falha", sem texto
  "non-2xx"); 500 → "Falha ao devolver ao robô"; botão desabilitado durante a
  ação e sem duplo clique. (A página já chama `functions.invoke` por conta
  própria na montagem — `set_webhook` etc.; o teste isola as chamadas
  `end_human_handover`.)

**Prova fail→fix→pass por patch (G65, sem `git stash`):** `git add -N` (2
arquivos novos) → `git diff` dos 4 arquivos de implementação → `git checkout
--` (esvazia os novos, reverte `WhatsApp.tsx`/`WhatsAppConversationItem.tsx`)
→ `vitest run` dos 3 arquivos de teste: **23 falharam, 3 passaram** → `rm` dos
esvaziados + `git apply` do mesmo patch → **26/26 passaram**. **Nuance
registrada por precisão:** os 3 que passam SEM a implementação são as
asserções de AUSÊNCIA da degradação ("coluna ausente → nenhum banner/badge" na
página, `handover_at: null` na página e no item da lista) — valem antes e
depois por desenho: são guardas de "não quebra", não prova de feature. Os 23
que falham cobrem tudo que é comportamento novo.

## 5. Fora de escopo / próximos passos

- Aplicar a migration (R4 §2) e regenerar `types.ts` — operador (§8-b).
- Filtro/contagem "aguardando humano" na lista (§2 decisão 4).
- Mostrar o estado também no `WhatsAppContactPanel` (painel lateral) — hoje o
  indicador está no cabeçalho da conversa e na lista; o painel não foi tocado.
- Rótulo/ajuda do select "Depois de esgotar" no `WhatsAppBotConfig` (decisão
  do operador "reprompt esgotado → humano") — **Lane C**, adendo já enviado.

**PARADO aqui — UI de Atendimento do handover implementada e testada, zero
server, zero DDL, zero push/merge. §18.**
