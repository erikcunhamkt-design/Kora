// Etapa 5 · Fatia 6 (finance) — mapper local Transaction -> Supabase financial_transactions.
//
// F3: fan-out de client_id/quote_id/opportunity_id via os 3 import-maps já provados
// (Fatias 2-4) — mapeado -> UUID; ausente -> null. NUNCA id local cru numa coluna uuid
// (padrão Q4).
// F4: amount quantizado a centavos (roundMoney, reaproveitado de quoteMoney.ts — regra
// dos três: só move para um local compartilhado quando uma TERCEIRA entidade precisar).
// Checagem nova (espírito de Q5): quando a transação é quote-linked, compara amount
// contra o total da quote LOCAL correspondente — reporta divergência > 1 centavo, nunca
// corrige em silêncio. Usa a quote local (já carregada por useQuotes()) em vez de uma
// consulta à nuvem — mesmo dado, sem round-trip extra durante analyze().
//
// Vocabulário de `type`: local usa "income"/"expense" (TxType); a nuvem usa
// "receivable"/"payable" — não é uma tradução nova desta fatia, é a mesma metáfora já
// usada em src/lib/dayCenter.ts (isIncome ? "receivable" : "payable") e nas abas de
// Financeiro.tsx ("receivables"/"payables"), só a primeira vez que o import precisa
// aplicá-la de forma explícita.
import type { Transaction, TxType, TxStatus, TxSource, PaymentMethod } from "@/hooks/useFinance";
import type { Quote } from "@/hooks/useQuotes";
import type { SupabaseFinancialTransaction } from "@/repositories/financeRepository";
import { roundMoney } from "@/services/quotes/quoteMoney";

/**
 * Import-maps local→Supabase usados para resolver as FKs de uma transação financeira.
 * Chaves = `String(idLocal)`; valores = UUID do Supabase.
 *   - clients:       `kora.clients.supabaseImport.v1` (idLocal do cliente → uuid)
 *   - quotes:        `kora.quotes.supabaseImport.v1`   (idLocal do orçamento → uuid)
 *   - opportunities: `kora.crm.supabaseImport.v1`      (idLocal da oportunidade/lead → uuid)
 */
export interface FinanceImportMaps {
  clients: Record<string, string>;
  quotes: Record<string, string>;
  opportunities: Record<string, string>;
}

export const EMPTY_FINANCE_IMPORT_MAPS: FinanceImportMaps = { clients: {}, quotes: {}, opportunities: {} };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map.
 * Regra de segurança (padrão Q4): mapeado → UUID; ausente/não-mapeado → null. NUNCA id
 * local cru.
 *
 * G37 por desenho (`etapa-5-flip-financeiro-pacote.md` §2.2), não por
 * incidente: se `localId` já é um uuid real (ex.: `quoteId` vindo de uma
 * quote já lida da nuvem, não de import — mesmo cenário que pegou o G37 em
 * `projectsMapper.ts`), passa direto — nunca procura no import-map, que só
 * mapeia id LOCAL → uuid e nunca teria essa entrada.
 */
export function resolveFinanceFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  const key = String(localId);
  if (UUID_RE.test(key)) return key;
  return map[key] ?? null;
}

const CLOUD_TYPE: Record<TxType, string> = { income: "receivable", expense: "payable" };

export interface FinanceMoneyReport {
  /** amount local, quantizado a centavos. */
  amount: number;
  /** total da quote local vinculada (quando `quoteId` resolve para uma quote local conhecida). */
  quoteTotal: number | null;
  /** |amount - quoteTotal|, quantizado — só calculado quando `quoteTotal` existe. */
  diff: number | null;
  /** `true` quando `diff` > 0.01 (1 centavo) — reporta, não conserta (espírito de Q5). */
  amountMismatch: boolean;
}

/**
 * Compara o `amount` local com o `total` da quote local vinculada (se `quoteId`
 * apontar para uma quote conhecida). Não altera nenhum dos dois valores — só reporta.
 */
export function inspectFinanceMoney(
  transaction: Pick<Transaction, "amount" | "quoteId">,
  localQuotes: readonly Pick<Quote, "id" | "total">[],
): FinanceMoneyReport {
  const amount = roundMoney(transaction.amount);
  const linkedQuote = transaction.quoteId
    ? localQuotes.find((q) => q.id === transaction.quoteId)
    : undefined;
  if (!linkedQuote) return { amount, quoteTotal: null, diff: null, amountMismatch: false };
  const quoteTotal = roundMoney(linkedQuote.total);
  const diff = roundMoney(Math.abs(amount - quoteTotal));
  return { amount, quoteTotal, diff, amountMismatch: diff > 0.01 };
}

/**
 * Payload de import de uma transação — inclui as FKs resolvidas (UUID ou null) e o
 * `amount` já quantizado. `source_local_id` é adicionado pelo chamador (hook), que
 * conhece o id local e o install id — não é responsabilidade do mapper.
 */
export interface SupabaseTransactionImportPayload extends Partial<SupabaseFinancialTransaction> {
  client_id: string | null;
  quote_id: string | null;
  opportunity_id: string | null;
  type: string;
  status: string;
  title: string;
  amount: number;
  category: string | null;
  payment_method: string | null;
  source: string;
}

/**
 * Converte uma Transaction local no payload de import (FKs resolvidas, type
 * traduzido, amount quantizado). `category`/`payment_method` (Fase B, §1.1/
 * §2.3 do desenho) — payload completo desde o dia 1 (G37, 2ª metade):
 * `supplierId`/`cashAccountId`/`recurrence`/`notes` (pós-flip, sem coluna)
 * NUNCA entram aqui — omitidos, não `null` forçado por engano. `notes` NÃO
 * é fundido em `description` (revisão Lane E, AJUSTE-a — o comentário do
 * mapper reverso, abaixo, afirmava essa fusão por engano; nunca existiu no
 * código: é exclusão documentada, o 4º campo sem coluna cloud, mesmo
 * tratamento de supplierId/cashAccountId/recurrence).
 */
export function mapLocalTransactionToSupabase(
  transaction: Transaction,
  maps: FinanceImportMaps = EMPTY_FINANCE_IMPORT_MAPS,
): SupabaseTransactionImportPayload {
  return {
    // F3: FKs remapeadas para UUID (ou null); NUNCA id local cru em coluna uuid.
    client_id: resolveFinanceFk(transaction.clientId, maps.clients),
    quote_id: resolveFinanceFk(transaction.quoteId, maps.quotes),
    opportunity_id: resolveFinanceFk(transaction.opportunityId, maps.opportunities),
    type: CLOUD_TYPE[transaction.type],
    status: transaction.status,
    title: transaction.title,
    description: transaction.description ?? null,
    // F4: dinheiro quantizado a centavos antes da coluna numeric.
    amount: roundMoney(transaction.amount),
    category: transaction.category ?? null,
    payment_method: transaction.paymentMethod ?? null,
    due_date: transaction.dueDate || null,
    paid_at: transaction.paidDate || null,
    source: transaction.source,
    is_demo: false,
    archived: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Etapa 5 · Financeiro Fatia N — direção nuvem -> local (leitura, item 2).
//
// G37 (projects): o espelho local->nuvem esqueceu `deliverables` do payload
// por meses até a homologação achar — lição "payload completo desde o dia
// 1". Esta é a PRIMEIRA leitura de `financial_transactions` pra tela
// principal (antes só existia `useSupabaseFinancialSummary.ts`, painel de
// QA) — por isso mapeia todo campo com contraparte local de uma vez, em vez
// de crescer aos poucos e reencontrar o mesmo buraco num domínio novo.
// ─────────────────────────────────────────────────────────────────────────

const LOCAL_TYPE: Readonly<Record<string, TxType>> = { receivable: "income", payable: "expense" };
const KNOWN_LOCAL_STATUS: ReadonlySet<string> = new Set<TxStatus>(["pending", "paid", "overdue", "canceled"]);
const KNOWN_LOCAL_SOURCE: ReadonlySet<string> = new Set<TxSource>(["manual", "quote", "sale", "service", "recurring"]);
const KNOWN_PAYMENT_METHOD: ReadonlySet<string> = new Set<PaymentMethod>(["pix", "card", "boleto", "transfer", "cash", "other"]);

/**
 * Traduz `type`/`status` brutos da nuvem pro vocabulário local. Nenhum dos
 * dois tem CHECK constraint (`etapa-5-flip-financeiro-fase-a.md` §3 — "o
 * problema ainda não existe, mas é latente"), então um valor fora do
 * vocabulário conhecido NUNCA quebra a leitura: cai num fallback seguro e o
 * valor bruto fica em `cloudTypeRaw`/`cloudStatusRaw` pra UI decidir o que
 * mostrar — nunca mascarado como um dos valores conhecidos (mesmo padrão de
 * `cloudStatusRaw` em `quotes`/`projects`).
 */
export function translateCloudTransactionVocabulary(
  cloudType: string,
  cloudStatus: string,
): { type: TxType; status: TxStatus; cloudTypeRaw?: string; cloudStatusRaw?: string } {
  const type = LOCAL_TYPE[cloudType];
  const status = KNOWN_LOCAL_STATUS.has(cloudStatus) ? (cloudStatus as TxStatus) : undefined;
  return {
    type: type ?? "expense",
    status: status ?? "pending",
    ...(type ? {} : { cloudTypeRaw: cloudType }),
    ...(status ? {} : { cloudStatusRaw: cloudStatus }),
  };
}

/**
 * Converte um `SupabaseFinancialTransaction` pro formato `Transaction`
 * local.
 *
 * `category`/`paymentMethod` (Fase B, §1.1 do desenho): agora TÊM coluna
 * cloud (migration `20260815000100`) — lidos de `st.category`/
 * `st.payment_method` quando presentes. `paymentMethod` é validado contra
 * o enum fechado local (mesmo se o CHECK da migration já garantir isso no
 * banco — nunca confiar só na constraint remota, a leitura teria que lidar
 * com uma linha pré-migration de qualquer forma). Só cai no placeholder/
 * fallback neutro quando a coluna vier `null` (linha pré-migration, ou
 * nunca preenchida) — "reportar, não inventar" continua valendo pro que
 * ainda não tem dado real.
 *
 * `recurrence`/`supplierId`/`cashAccountId`/`notes` continuam SEM coluna
 * cloud (pós-flip, §1.2 do desenho — domínio relacional novo, fora de
 * escopo desta fase). Mesmo tratamento da Fatia N: enum fechado
 * (`recurrence`) recebe o membro neutro (`"none"`); os 3 opcionais
 * (`supplierId`/`cashAccountId`/`notes`) ficam `undefined`. Correção
 * (revisão Lane E, AJUSTE-a): `notes` NUNCA foi fundido em `description` na
 * escrita — `mapLocalTransactionToSupabase` (acima) já omite `notes` por
 * completo, exclusão documentada como os demais, não "não dá pra desfundir".
 *
 * `quoteTitle` fica `undefined` — mesmo gap não resolvido do G37 (achado
 * #3 daquele fix): a nuvem não denormaliza título de quote, restaurar isso
 * exigiria um join que este mapper não faz (fora de escopo desta fase).
 *
 * `clientName` resolve via `clientNameById` (mesmo padrão de
 * `mapSupabaseProjectToLocal`, `projectsMapper.ts`) — `financial_transactions`
 * não denormaliza nome de cliente na própria linha (diferente de `quotes`).
 */
export function mapSupabaseTransactionToLocal(
  st: SupabaseFinancialTransaction,
  clientNameById: Record<string, string> = {},
): Transaction {
  const { type, status, cloudTypeRaw, cloudStatusRaw } = translateCloudTransactionVocabulary(st.type, st.status);
  const source = KNOWN_LOCAL_SOURCE.has(st.source ?? "") ? (st.source as TxSource) : "manual";
  const paymentMethod: PaymentMethod = st.payment_method && KNOWN_PAYMENT_METHOD.has(st.payment_method)
    ? (st.payment_method as PaymentMethod)
    : "other";

  return {
    id: st.id,
    type,
    title: st.title,
    description: st.description ?? undefined,
    amount: Number(st.amount),
    category: st.category ?? "Sem categoria (nuvem)",
    clientName: st.client_id ? clientNameById[st.client_id] : undefined,
    supplierId: undefined,
    cashAccountId: undefined,
    dueDate: st.due_date ?? st.created_at.slice(0, 10),
    paidDate: st.paid_at ?? undefined,
    status,
    cloudStatusRaw,
    cloudTypeRaw,
    paymentMethod,
    recurrence: "none",
    source,
    notes: undefined,
    createdAt: st.created_at?.slice(0, 10) ?? "",
    isDemo: st.is_demo ?? false,
    // Mesmo precedente de mapSupabaseProjectToLocal: uuid da nuvem smuggled
    // como number via cast, só pra bater com o tipo local
    // (Transaction.clientId/opportunityId: number) — nunca usado
    // aritmeticamente, só como chave de lookup/comparação.
    clientId: st.client_id ? (st.client_id as unknown as number) : undefined,
    quoteId: st.quote_id ?? undefined,
    quoteTitle: undefined,
    opportunityId: st.opportunity_id ? (st.opportunity_id as unknown as number) : undefined,
  };
}
