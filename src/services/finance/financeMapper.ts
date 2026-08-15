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
import type { Transaction, TxType, TxStatus, TxSource } from "@/hooks/useFinance";
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

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map.
 * Regra de segurança (padrão Q4): mapeado → UUID; ausente/não-mapeado → null. NUNCA id
 * local cru.
 */
export function resolveFinanceFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  return map[String(localId)] ?? null;
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
  source: string;
}

/** Converte uma Transaction local no payload de import (FKs resolvidas, type traduzido, amount quantizado). */
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
 * Campos com contraparte local mas SEM coluna cloud (`category`,
 * `paymentMethod`, `recurrence`, `supplierId`, `cashAccountId`) — gap
 * catalogado em `etapa-5-flip-financeiro-fase-a.md` §3, ainda sem decisão
 * de schema (Caso 5 do doc). "Reportar, não inventar": os 2 campos de
 * vocabulário FECHADO (`paymentMethod`/`recurrence`, union type — não
 * aceitam string livre) recebem o membro mais neutro já existente no
 * próprio enum (`"other"`/`"none"`) — não é um valor real vindo da nuvem, é
 * a ausência representada pelo membro menos presunçoso. `category` (string
 * livre) usa um placeholder claramente rotulado, nunca um nome de
 * categoria inventado. `supplierId`/`cashAccountId` (opcionais) ficam
 * `undefined` — a forma mais honesta de "não sei", sem precisar de
 * placeholder nenhum. `notes` também fica `undefined` — a nuvem funde
 * notes dentro de `description` na ESCRITA (`mapLocalTransactionToSupabase`
 * acima), não dá pra desfundir na leitura.
 *
 * `quoteTitle` fica `undefined` — mesmo gap não resolvido do G37 (achado
 * #3 daquele fix): a nuvem não denormaliza título de quote, restaurar isso
 * exigiria um join que este mapper não faz (fora de escopo desta fatia).
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

  return {
    id: st.id,
    type,
    title: st.title,
    description: st.description ?? undefined,
    amount: Number(st.amount),
    category: "Sem categoria (nuvem)",
    clientName: st.client_id ? clientNameById[st.client_id] : undefined,
    supplierId: undefined,
    cashAccountId: undefined,
    dueDate: st.due_date ?? st.created_at.slice(0, 10),
    paidDate: st.paid_at ?? undefined,
    status,
    cloudStatusRaw,
    cloudTypeRaw,
    paymentMethod: "other",
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
