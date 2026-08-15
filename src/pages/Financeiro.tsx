import { PageHeader } from "@/components/layout/PageHeader";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Plus, MoreHorizontal,
  ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2, Timer, Ban,
  Wallet, Building2, Tags, QrCode, Repeat, FileBarChart, LayoutGrid,
  PiggyBank, Users2, Pencil, Trash2, Archive, HelpCircle, Download,
  Database, Cloud, RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, PieChart, Pie, Cell, type TooltipContentProps } from "recharts";
import {
  useFinance, useFinanceMetrics, useMonthlySeries,
  formatBRL, formatDateBR,
  type Transaction, type TxType, type TxStatus, type PaymentMethod,
  type FinanceCategory, type Supplier, type RecurringEntry, type CashAccount, type PixSettings, type PixMethod, type RecurFreq, type CashAccountType, type PixKeyType,
} from "@/hooks/useFinance";
import { useFormat } from "@/hooks/useFormat";
import { useClients } from "@/hooks/useClients";
import { useSupabaseFinanceTransactions } from "@/hooks/useSupabaseFinanceTransactions";
import type { SupabaseFinancialTransaction } from "@/repositories/financeRepository";
import { getFinanceDataSource, setFinanceDataSource, type DataSource } from "@/config/flags";
import { useSupabaseFinanceWriteFlag } from "@/hooks/useSupabaseFinanceWriteFlag";
import type { NewTransactionInput } from "@/hooks/useSupabaseFinanceTransactions";
import { toast } from "sonner";

// ============================================================
// Shared label maps
// ============================================================
const statusLabels: Record<TxStatus, string> = { pending: "Pendente", paid: "Pago", overdue: "Vencido", canceled: "Cancelado" };
const statusStyles: Record<TxStatus, string> = {
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  canceled: "bg-muted/40 text-muted-foreground border-border",
};
const statusIcons: Record<TxStatus, LucideIcon> = { paid: CheckCircle2, pending: Timer, overdue: AlertCircle, canceled: Ban };
const methodLabels: Record<PaymentMethod, string> = { pix: "PIX", card: "Cartão", boleto: "Boleto", transfer: "Transferência", cash: "Dinheiro", other: "Outro" };
const cashTypeLabels: Record<CashAccountType, string> = { bank: "Banco", wallet: "Carteira", cash: "Dinheiro", platform: "Plataforma", other: "Outro" };
const freqLabels: Record<RecurFreq, string> = { weekly: "Semanal", monthly: "Mensal", yearly: "Anual" };
const pixKeyLabels: Record<PixKeyType, string> = { cpf: "CPF", cnpj: "CNPJ", email: "Email", phone: "Telefone", random: "Aleatória" };

// ============================================================
// Reusable
// ============================================================
const MetricCard = ({ icon: Icon, label, value, sub, tone = "default" }: {
  icon: LucideIcon; label: string; value: string; sub?: string;
  tone?: "default" | "income" | "expense" | "warning" | "neutral";
}) => {
  const palette = {
    default: { bg: "bg-muted/40", icon: "text-foreground", value: "text-foreground" },
    income: { bg: "bg-emerald-500/10", icon: "text-emerald-400", value: "text-emerald-400" },
    expense: { bg: "bg-destructive/10", icon: "text-destructive", value: "text-destructive" },
    warning: { bg: "bg-amber-500/10", icon: "text-amber-400", value: "text-amber-400" },
    neutral: { bg: "bg-muted/40", icon: "text-muted-foreground", value: "text-foreground" },
  }[tone];
  return (
    <div className="orbit-card p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${palette.bg}`}>
          <Icon className={`h-4 w-4 ${palette.icon}`} />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
      </div>
      <p className={`text-xl font-bold ${palette.value}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, description, action }: {
  icon: LucideIcon; title: string; description?: string; action?: React.ReactNode;
}) => (
  <div className="py-12 px-4 text-center">
    <div className="mx-auto h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
    <p className="text-sm font-semibold text-foreground">{title}</p>
    {description && <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

const ChartTooltip = ({ active, payload, label }: Partial<TooltipContentProps<number, string>>) => {
  if (!active || !payload) return null;
  return (
    <div className="orbit-card p-3 shadow-lg border-border">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? formatBRL(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const StatusBadge = ({ s }: { s: TxStatus }) => {
  const Icon = statusIcons[s];
  return (
    <Badge variant="outline" className={`gap-1 ${statusStyles[s]}`}>
      <Icon className="h-3 w-3" />
      {statusLabels[s]}
    </Badge>
  );
};

// ============================================================
// Page
// ============================================================
type TabKey = "overview" | "receivables" | "payables" | "clients" | "suppliers" | "pix" | "recurring" | "cash" | "reports";

const TAB_DEFS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Visão geral", icon: LayoutGrid },
  { key: "receivables", label: "Receber", icon: ArrowDownLeft },
  { key: "payables", label: "Pagar", icon: ArrowUpRight },
  { key: "clients", label: "Clientes", icon: Users2 },
  { key: "suppliers", label: "Fornecedores", icon: Building2 },
  { key: "pix", label: "PIX", icon: QrCode },
  { key: "recurring", label: "Recorrentes", icon: Repeat },
  { key: "cash", label: "Caixa", icon: PiggyBank },
  { key: "reports", label: "Relatórios", icon: FileBarChart },
];

const Financeiro = () => {
  const fin = useFinance();
  const { clients } = useClients();
  const metrics = useFinanceMetrics(fin.transactions);
  const chartData = useMonthlySeries(fin.transactions);

  // Etapa 5 · Financeiro Fatia N (item 3) — seletor de fonte, default LOCAL
  // (kora.finance.dataSource.v1, config/flags.ts), mesmo padrão de nascimento
  // de quotes/projects (Fatia N deles). UI MÍNIMA e ADITIVA por design: as 8
  // abas existentes (incl. Receber/Pagar) continuam 100% locais e intocadas,
  // qualquer que seja o seletor — zero risco de regressão nos consumidores
  // atuais (fin.updateTransactionStatus/deleteTransaction, chamados direto
  // pelas linhas da tabela local, nunca veriam uma linha vinda da nuvem).
  // Em modo Supabase, um painel SEPARADO (abaixo) mostra as transações da
  // nuvem. Fase B (Pacote do Flip, item 2): esse painel ganha ações reais
  // por linha (marcar pago/cancelar/excluir) e os 2 botões de criação do
  // cabeçalho passam a gravar direto na nuvem — mas só quando
  // `useSupabaseFinanceWriteFlag` (opt-in, nasce OFF) está ligada; com a
  // flag OFF o comportamento é idêntico ao da Fatia N (painel read-only,
  // blockWrite() sempre bloqueia). O flip dos defaults (ligar a flag pra
  // todo mundo) é Fase C, desenho em paralelo.
  const [dataSource, setDataSourceState] = useState<DataSource>(() => getFinanceDataSource());

  const handleSourceChange = (next: DataSource) => {
    setFinanceDataSource(next);
    setDataSourceState(next);
    toast.info(`Fonte do financeiro alterada para ${next === "supabase" ? "Supabase" : "Local"}.`);
  };

  // Etapa 5 · Financeiro Fase B (Pacote do Flip, item 2) — hook único no
  // topo, molde de ProjectsSection.tsx/QuotesSection.tsx: create/update/
  // delete de verdade, threaded pros diálogos (QuickSaleDialog/
  // ExpenseDialog) e pro painel abaixo. Um só cache React Query (mesma
  // queryKey) — sem instância duplicada da mutation.
  const {
    createTransaction: createSupabaseTransaction,
    updateTransaction: updateSupabaseTransaction,
    deleteTransaction: deleteSupabaseTransaction,
    ...supabaseFinance
  } = useSupabaseFinanceTransactions();

  // useSupabaseFinanceWriteFlag (reativo, Fatia N reservou/não consumiu
  // ainda) em vez do leitor imperativo puro: some/reaparece nos 2 diálogos
  // e no painel se a flag mudar em outra aba (mesmo padrão já usado pelas
  // flags de dataSource neste arquivo).
  const { enabled: writeEnabled } = useSupabaseFinanceWriteFlag();

  // G29 (lição aplicada desde o nascimento, não descoberta depois): texto
  // HONESTO desde o dia 1 — nunca promete escrita que não existe, nunca
  // sobrevive além do que o código realmente faz.
  // Fase B, item 2 do desenho: blockWrite() passa a gatear pela flag mestre
  // de escrita (opt-in nesta fase — nasce OFF, `useSupabaseFinanceWriteFlag`,
  // Fatia N). Flag OFF preserva o comportamento anterior byte a byte
  // (sempre bloqueia em modo Supabase) — nenhum teste Fatia N quebra.
  const blockWrite = (): boolean => {
    if (dataSource !== "supabase") return false;
    if (writeEnabled) return false;
    toast.error("Escrita em modo Supabase ainda não existe pra Financeiro — volte para \"Local\" para lançar/editar, ou ative a escrita experimental.");
    return true;
  };

  const cloudWriteMode = dataSource === "supabase" && writeEnabled;

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = ((): TabKey => {
    const t = searchParams.get("tab");
    if (t === "receivables" || t === "payables" || t === "overview" || t === "reports" || t === "clients" || t === "suppliers" || t === "pix" || t === "recurring" || t === "cash") return t;
    return "overview";
  })();
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [highlightEntryId, setHighlightEntryId] = useState<string | null>(searchParams.get("entryId"));
  const [openSale, setOpenSale] = useState(false);
  const [openExpense, setOpenExpense] = useState(false);
  const [openCats, setOpenCats] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  // Clean deep-link params once consumed
  useEffect(() => {
    if (searchParams.get("tab") || searchParams.get("entryId")) {
      const next = new URLSearchParams(searchParams);
      next.delete("tab"); next.delete("entryId");
      setSearchParams(next, { replace: true });
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto clear highlight after a few seconds
  useEffect(() => {
    if (!highlightEntryId) return;
    const t = setTimeout(() => setHighlightEntryId(null), 6000);
    return () => clearTimeout(t);
  }, [highlightEntryId]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        subtitle="Cockpit completo de receitas, despesas, fluxo de caixa e relatórios"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setTutorialOpen(true)} className="gap-1.5">
              <HelpCircle className="h-4 w-4" /> Tutorial
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpenCats(true)} className="gap-1.5">
              <Tags className="h-4 w-4" /> Categorias
            </Button>
            <Button size="sm" variant="outline" onClick={() => { if (blockWrite()) return; setOpenExpense(true); }} className="gap-1.5">
              <TrendingDown className="h-4 w-4" /> Lançar despesa
            </Button>
            <Button size="sm" onClick={() => { if (blockWrite()) return; setOpenSale(true); }} className="gap-1.5">
              <Plus className="h-4 w-4" /> Venda rápida
            </Button>
          </>
        }
      />

      {/* Etapa 5 · Financeiro Fatia N — seletor de fonte, mesmo padrão visual
          de "Fonte dos projetos"/"Fonte dos orçamentos" (ProjectsSection.tsx/
          QuotesSection.tsx). Nenhum botão das 8 abas abaixo desaparece —
          só ficam bloqueados no primeiro passo dos 2 handlers de criação
          (lição O2/O3/O4: guarda sempre ANTES de qualquer toast de sucesso). */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/30">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Fonte do financeiro:</span>
          {dataSource === "supabase" && (
            <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 text-primary border-primary/30 bg-primary/5">
              Modo leitura (Supabase)
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSourceChange("local")}
            className={`text-xs px-3 h-8 rounded-md border transition ${
              dataSource === "local"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground hover:bg-muted/40"
            }`}
          >
            Local
          </button>
          <button
            type="button"
            onClick={() => handleSourceChange("supabase")}
            className={`text-xs px-3 h-8 rounded-md border transition ${
              dataSource === "supabase"
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-foreground hover:bg-muted/40"
            }`}
          >
            Supabase experimental
          </button>
        </div>
      </div>

      {dataSource === "supabase" && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground">
          <Cloud className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
          <div className="flex-1">
            <span className="font-semibold block">
              Transações operacionais (Supabase) — {writeEnabled ? "escrita experimental" : "modo leitura"}
            </span>
            <span className="text-muted-foreground">
              {writeEnabled
                ? "A lista abaixo já vem da nuvem e aceita criar/editar/marcar pago/excluir. Recorrência e fornecedor ainda não têm coluna na nuvem — leia o aviso ao usá-los."
                : "A lista abaixo já vem da nuvem. Escrita (criar, editar, marcar como pago, excluir) ainda não existe nesse modo — as abas locais continuam funcionando normalmente, intocadas, pra você lançar e editar enquanto isso."}
            </span>
          </div>
        </div>
      )}

      {dataSource === "supabase" && (
        <SupabaseTransactionsPanel
          {...supabaseFinance}
          writeEnabled={writeEnabled}
          onUpdate={updateSupabaseTransaction}
          onDelete={deleteSupabaseTransaction}
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="-mx-1 px-1 overflow-x-auto scrollbar-thin">
          <TabsList className="h-10 bg-muted/40 inline-flex w-auto">
            {TAB_DEFS.map((t) => {
              const Icon = t.icon;
              return (
                <TabsTrigger key={t.key} value={t.key} className="h-8 px-3 text-xs gap-1.5 whitespace-nowrap">
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-5">
          <OverviewTab fin={fin} metrics={metrics} onNewSale={() => setOpenSale(true)} onNewExpense={() => setOpenExpense(true)} />
        </TabsContent>
        <TabsContent value="receivables" className="space-y-4">
          <TransactionsTab fin={fin} type="income" onCreate={() => setOpenSale(true)} highlightId={highlightEntryId} />
        </TabsContent>
        <TabsContent value="payables" className="space-y-4">
          <TransactionsTab fin={fin} type="expense" onCreate={() => setOpenExpense(true)} />
        </TabsContent>
        <TabsContent value="clients" className="space-y-4">
          <ClientsTab fin={fin} clients={clients} />
        </TabsContent>
        <TabsContent value="suppliers" className="space-y-4">
          <SuppliersTab fin={fin} />
        </TabsContent>
        <TabsContent value="pix" className="space-y-4">
          <PixTab fin={fin} />
        </TabsContent>
        <TabsContent value="recurring" className="space-y-4">
          <RecurringTab fin={fin} />
        </TabsContent>
        <TabsContent value="cash" className="space-y-4">
          <CashTab fin={fin} />
        </TabsContent>
        <TabsContent value="reports" className="space-y-4">
          <ReportsTab fin={fin} chartData={chartData} metrics={metrics} />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <QuickSaleDialog
        open={openSale} onOpenChange={setOpenSale} fin={fin} clients={clients}
        cloudMode={cloudWriteMode} onCreateCloud={createSupabaseTransaction}
      />
      <ExpenseDialog
        open={openExpense} onOpenChange={setOpenExpense} fin={fin}
        cloudMode={cloudWriteMode} onCreateCloud={createSupabaseTransaction}
      />
      <CategoriesDialog open={openCats} onOpenChange={setOpenCats} fin={fin} />
      <TutorialDialog open={tutorialOpen} onOpenChange={setTutorialOpen} />
    </div>
  );
};

// ============================================================
// SUPABASE TRANSACTIONS (Fatia N item 3 -> Fase B item 2, §2.5 do desenho)
// ============================================================
// Nasceu genuinely read-only (Fatia N). Fase B acrescenta ações por linha
// (marcar pago/cancelar/excluir via updateSupabaseTransaction/
// deleteSupabaseTransaction, G30 por desenho — a própria resposta da
// mutation já atualiza o cache, sem invalidateQueries) — mas SÓ quando
// `writeEnabled` (useSupabaseFinanceWriteFlag) está ligado. Flag OFF
// preserva o painel 100% read-only de antes, byte a byte (mesma condição
// de vazio/erro/loading, mesma tabela sem coluna de ações).
const SupabaseTransactionsPanel = ({
  transactions, loading, error, refresh, writeEnabled, onUpdate, onDelete,
}: {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  writeEnabled: boolean;
  onUpdate: (transactionId: string, patch: Partial<SupabaseFinancialTransaction>) => Promise<unknown>;
  onDelete: (transactionId: string) => Promise<unknown>;
}) => {
  const setStatus = (id: string, status: TxStatus, successMsg: string) => {
    onUpdate(id, { status }).then(() => {
      toast.success(successMsg);
    }).catch((err) => {
      console.error("Falha ao atualizar status da transação (Supabase):", err);
      toast.error("Não foi possível atualizar essa transação na nuvem.");
    });
  };

  const remove = (id: string) => {
    onDelete(id).then(() => {
      toast.success("Excluído");
    }).catch((err) => {
      console.error("Falha ao excluir transação (Supabase):", err);
      toast.error("Não foi possível excluir essa transação na nuvem.");
    });
  };

  return (
    <div className="orbit-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Cloud className="h-4 w-4 text-primary" /> Transações (Supabase{writeEnabled ? "" : " — leitura"})
        </h3>
        <Button variant="ghost" size="sm" onClick={refresh} className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-3 w-3" /> Atualizar
        </Button>
      </div>

      {loading && (
        <p className="text-xs text-muted-foreground">Carregando transações do Supabase...</p>
      )}
      {error && (
        <p className="text-xs text-destructive">Erro ao carregar transações do Supabase: {error}</p>
      )}
      {!loading && !error && transactions.length === 0 && (
        <EmptyState icon={Cloud} title="Nenhuma transação na nuvem ainda" description="Transações criadas em modo Local não aparecem aqui automaticamente — use a importação manual em Configurações → Dados." />
      )}
      {!loading && !error && transactions.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {writeEnabled && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((t) => (
                <TableRow key={t.id} className="border-border hover:bg-muted/40 transition-colors">
                  <TableCell className="font-medium text-foreground">
                    <span className="truncate max-w-[260px] inline-block align-middle">{t.title}</span>
                    {t.clientName && <span className="text-xs text-muted-foreground ml-1.5">· {t.clientName}</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${t.type === "income" ? "border-emerald-500/30 text-emerald-400" : "border-destructive/30 text-destructive"}`}>
                      {t.type === "income" ? "Receita" : "Despesa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateBR(t.dueDate)}</TableCell>
                  <TableCell><StatusBadge s={t.status} /></TableCell>
                  <TableCell className={`text-right font-bold ${t.type === "income" ? "text-emerald-400" : "text-destructive"}`}>
                    {t.type === "income" ? "" : "-"}{formatBRL(t.amount)}
                  </TableCell>
                  {writeEnabled && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ações"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {t.status !== "paid" && (
                            <DropdownMenuItem onClick={() => setStatus(t.id, "paid", t.type === "income" ? "Marcado como recebido" : "Marcado como pago")}>
                              {t.type === "income" ? "Marcar como recebido" : "Marcar como pago"}
                            </DropdownMenuItem>
                          )}
                          {t.status !== "canceled" && (
                            <DropdownMenuItem onClick={() => setStatus(t.id, "canceled", "Cancelado")}>
                              Cancelar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => remove(t.id)}>
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

// ============================================================
// OVERVIEW TAB
// ============================================================
const OverviewTab = ({ fin, metrics, onNewSale, onNewExpense }: {
  fin: ReturnType<typeof useFinance>;
  metrics: ReturnType<typeof useFinanceMetrics>;
  onNewSale: () => void;
  onNewExpense: () => void;
}) => {
  const overdueReceivables = fin.transactions.filter((t: Transaction) => t.type === "income" && t.status === "overdue");
  const overduePayables = fin.transactions.filter((t: Transaction) => t.type === "expense" && t.status === "overdue");
  const latest = [...fin.transactions].sort((a: Transaction, b: Transaction) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="space-y-5">
      {/* Group: Receber */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contas a receber</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Receipt} label="Faturamento do mês" value={formatBRL(metrics.billedMonth)} tone="neutral" />
          <MetricCard icon={Timer} label="Pendente" value={formatBRL(metrics.recPendingTotal)} tone="warning" />
          <MetricCard icon={AlertCircle} label="Vencido" value={formatBRL(metrics.recOverdueTotal)} tone="expense" />
          <MetricCard icon={TrendingUp} label="Recebido no mês" value={formatBRL(metrics.incomeMonth)} tone="income" />
        </div>
      </div>

      {/* Group: Pagar */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contas a pagar</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={CheckCircle2} label="Pago no mês" value={formatBRL(metrics.expenseMonth)} tone="neutral" />
          <MetricCard icon={Timer} label="Pendente" value={formatBRL(metrics.payPendingTotal)} tone="warning" />
          <MetricCard icon={AlertCircle} label="Vencido" value={formatBRL(metrics.payOverdueTotal)} tone="expense" />
          <MetricCard icon={TrendingDown} label="Total de despesas" value={formatBRL(metrics.expensesMonthTotal)} tone="expense" />
        </div>
      </div>

      {/* Group: Lucro */}
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lucro do período</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <MetricCard icon={ArrowDownLeft} label="Receita" value={formatBRL(metrics.incomeMonth)} tone="income" />
          <MetricCard icon={ArrowUpRight} label="Despesa" value={formatBRL(metrics.expenseMonth)} tone="expense" />
          <MetricCard icon={DollarSign} label="Lucro líquido" value={formatBRL(metrics.profit)} tone={metrics.profit >= 0 ? "income" : "expense"} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="orbit-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Recebimentos vencidos</h3>
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">{overdueReceivables.length}</Badge>
          </div>
          {overdueReceivables.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Tudo em dia" description="Nenhum recebimento vencido." />
          ) : (
            <ul className="space-y-2">
              {overdueReceivables.slice(0, 5).map((t: Transaction) => (
                <li key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.clientName || "—"} · venceu {formatDateBR(t.dueDate)}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive shrink-0 ml-2">{formatBRL(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="orbit-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Pagamentos vencidos</h3>
            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">{overduePayables.length}</Badge>
          </div>
          {overduePayables.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Sem pendências" description="Nenhuma despesa vencida." />
          ) : (
            <ul className="space-y-2">
              {overduePayables.slice(0, 5).map((t: Transaction) => (
                <li key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/40">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.category} · venceu {formatDateBR(t.dueDate)}</p>
                  </div>
                  <span className="text-sm font-bold text-destructive shrink-0 ml-2">{formatBRL(t.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="orbit-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Últimas transações</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onNewSale}>+ Venda</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onNewExpense}>+ Despesa</Button>
          </div>
        </div>
        {latest.length === 0 ? (
          <EmptyState icon={Wallet} title="Sem movimentações" description="Lance sua primeira venda ou despesa para começar." />
        ) : (
          <ul className="divide-y divide-border/40">
            {latest.map((t: Transaction) => (
              <li key={t.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-emerald-500/10" : "bg-destructive/10"}`}>
                    {t.type === "income"
                      ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
                      : <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">{t.category} · {formatDateBR(t.dueDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge s={t.status} />
                  <span className={`text-sm font-bold ${t.type === "income" ? "text-emerald-400" : "text-destructive"}`}>
                    {t.type === "expense" ? "-" : ""}{formatBRL(t.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ============================================================
// TRANSACTIONS TAB (Receber / Pagar)
// ============================================================
const TransactionsTab = ({ fin, type, onCreate, highlightId }: { fin: ReturnType<typeof useFinance>; type: TxType; onCreate: () => void; highlightId?: string | null }) => {
  const [status, setStatus] = useState<"all" | TxStatus>("all");
  const [period, setPeriod] = useState<"all" | "month" | "next30" | "overdue">("all");
  const [category, setCategory] = useState<string>("all");
  const [entity, setEntity] = useState<string>("all"); // client or supplier
  const isIncome = type === "income";

  const cats = fin.categories.filter((c) => c.type === type);
  const list = fin.transactions.filter((t) => t.type === type);

  const filtered = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    return list.filter((t) => {
      if (status !== "all" && t.status !== status) return false;
      if (category !== "all" && t.category !== category) return false;
      if (entity !== "all") {
        if (isIncome && t.clientName !== entity) return false;
        if (!isIncome && t.supplierId !== entity) return false;
      }
      if (period === "month" && !t.dueDate.startsWith(ym)) return false;
      if (period === "next30") {
        const d = new Date(t.dueDate);
        if (d < now || d > in30) return false;
      }
      if (period === "overdue" && t.status !== "overdue") return false;
      return true;
    });
  }, [list, status, category, entity, period, isIncome]);

  const total = filtered.reduce((s, t) => s + t.amount, 0);
  const pendingTotal = filtered.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);
  const overdueTotal = filtered.filter((t) => t.status === "overdue").reduce((s, t) => s + t.amount, 0);
  const paidTotal = filtered.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0);

  const entityOptions = useMemo(() => {
    if (isIncome) {
      const set = new Set<string>();
      list.forEach((t) => t.clientName && set.add(t.clientName));
      return Array.from(set);
    }
    return fin.suppliers.filter((s) => !s.archived).map((s) => ({ id: s.id, name: s.name }));
  }, [isIncome, list, fin.suppliers]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Receipt} label="Total" value={formatBRL(total)} tone="neutral" />
        <MetricCard icon={Timer} label="Pendente" value={formatBRL(pendingTotal)} tone="warning" />
        <MetricCard icon={AlertCircle} label="Vencido" value={formatBRL(overdueTotal)} tone="expense" />
        <MetricCard icon={isIncome ? TrendingUp : CheckCircle2} label={isIncome ? "Recebido" : "Pago"} value={formatBRL(paidTotal)} tone={isIncome ? "income" : "neutral"} />
      </div>

      <div className="orbit-card p-3 flex flex-wrap items-center gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as "all" | "month" | "next30" | "overdue")}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos períodos</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
            <SelectItem value="next30">Próximos 30 dias</SelectItem>
            <SelectItem value="overdue">Vencidos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(v as "all" | TxStatus)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(statusLabels) as TxStatus[]).map((s) => <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {cats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder={isIncome ? "Cliente" : "Fornecedor"} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isIncome ? "Todos clientes" : "Todos fornecedores"}</SelectItem>
            {isIncome
              ? (entityOptions as string[]).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)
              : (entityOptions as { id: string; name: string }[]).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => toast.info("Ação em lote disponível em breve")} className="h-9 text-xs">
            {isIncome ? "Recebidos em lote" : "Pagar em lote"}
          </Button>
          <Button size="sm" onClick={onCreate} className="h-9 text-xs gap-1">
            <Plus className="h-3.5 w-3.5" />
            {isIncome ? "Nova conta a receber" : "Lançar despesa"}
          </Button>
        </div>
      </div>

      <div className="orbit-card overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={isIncome ? ArrowDownLeft : ArrowUpRight}
            title={isIncome ? "Sem contas a receber" : "Sem contas a pagar"}
            description={isIncome ? "Crie sua primeira venda para começar a controlar recebimentos." : "Registre suas despesas para acompanhar pagamentos."}
            action={<Button size="sm" onClick={onCreate} className="gap-1.5"><Plus className="h-3.5 w-3.5" />{isIncome ? "Nova conta a receber" : "Lançar despesa"}</Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Descrição</TableHead>
                <TableHead>{isIncome ? "Cliente" : "Fornecedor"}</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow
                  key={t.id}
                  className={`border-border hover:bg-muted/40 transition-colors ${highlightId === t.id ? "bg-primary/10" : ""}`}
                >
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate max-w-[260px]">{t.title}</span>
                      {t.source === "quote" && (
                        <Badge variant="outline" className="text-[10px] bg-primary/20 border-primary/40 text-white font-medium">Orçamento</Badge>
                      )}
                      {t.isDemo && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border text-muted-foreground">demo</Badge>}
                      {t.recurrence !== "none" && <Repeat className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {isIncome ? (t.clientName || "—") : (fin.suppliers.find((s) => s.id === t.supplierId)?.name || "—")}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateBR(t.dueDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[11px] bg-muted/40 border-border text-muted-foreground">{t.category}</Badge>
                  </TableCell>
                  <TableCell><StatusBadge s={t.status} /></TableCell>
                  <TableCell className={`text-right font-bold ${isIncome ? "text-emerald-400" : "text-destructive"}`}>
                    {isIncome ? "" : "-"}{formatBRL(t.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {t.status !== "paid" && (
                          <DropdownMenuItem onClick={() => { fin.updateTransactionStatus(t.id, "paid"); toast.success(isIncome ? "Marcado como recebido" : "Marcado como pago"); }}>
                            {isIncome ? "Marcar como recebido" : "Marcar como pago"}
                          </DropdownMenuItem>
                        )}
                        {t.status !== "canceled" && (
                          <DropdownMenuItem onClick={() => { fin.updateTransactionStatus(t.id, "canceled"); toast.success("Cancelado"); }}>
                            Cancelar
                          </DropdownMenuItem>
                        )}
                        {!t.isDemo && (
                          <DropdownMenuItem className="text-destructive" onClick={() => { fin.deleteTransaction(t.id); toast.success("Excluído"); }}>
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

// ============================================================
// CLIENTS TAB
// ============================================================
const ClientsTab = ({ fin, clients }: { fin: ReturnType<typeof useFinance>; clients: ReturnType<typeof useClients>["clients"] }) => {
  const rows = useMemo(() => {
    const map = new Map<string, { name: string; pending: number; received: number; overdue: number; lastPayment?: string }>();
    fin.transactions.filter((t) => t.type === "income" && t.clientName).forEach((t) => {
      const key = t.clientName!;
      const r = map.get(key) || { name: key, pending: 0, received: 0, overdue: 0, lastPayment: undefined };
      if (t.status === "pending") r.pending += t.amount;
      if (t.status === "overdue") r.overdue += t.amount;
      if (t.status === "paid") {
        r.received += t.amount;
        if (t.paidDate && (!r.lastPayment || t.paidDate > r.lastPayment)) r.lastPayment = t.paidDate;
      }
      map.set(key, r);
    });
    return Array.from(map.values()).sort((a, b) => (b.pending + b.overdue) - (a.pending + a.overdue));
  }, [fin.transactions]);

  if (rows.length === 0) {
    return <div className="orbit-card"><EmptyState icon={Users2} title="Nenhum cliente com contas a receber" description="Os clientes vinculados a recebimentos aparecerão aqui automaticamente." /></div>;
  }

  return (
    <div className="orbit-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Cliente</TableHead>
            <TableHead className="text-right">Pendente</TableHead>
            <TableHead className="text-right">Vencido</TableHead>
            <TableHead className="text-right">Recebido</TableHead>
            <TableHead>Último pagamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const cli = clients.find((c) => c.name === r.name || c.company === r.name);
            return (
              <TableRow key={r.name} className="border-border hover:bg-muted/40">
                <TableCell>
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  {cli && <p className="text-[11px] text-muted-foreground">{cli.company}</p>}
                </TableCell>
                <TableCell className="text-right text-amber-400 font-medium">{formatBRL(r.pending)}</TableCell>
                <TableCell className="text-right text-destructive font-medium">{formatBRL(r.overdue)}</TableCell>
                <TableCell className="text-right text-emerald-400 font-medium">{formatBRL(r.received)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateBR(r.lastPayment)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

// ============================================================
// SUPPLIERS TAB
// ============================================================
const SuppliersTab = ({ fin }: { fin: ReturnType<typeof useFinance> }) => {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  const handleEdit = (s: Supplier) => { setEditing(s); setOpen(true); };
  const handleNew = () => { setEditing(null); setOpen(true); };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={handleNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo fornecedor</Button>
      </div>
      <div className="orbit-card overflow-x-auto">
        {fin.suppliers.length === 0 ? (
          <EmptyState icon={Building2} title="Nenhum fornecedor" description="Cadastre fornecedores para vincular às suas despesas." action={<Button size="sm" onClick={handleNew}>Novo fornecedor</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Nome</TableHead>
                <TableHead>Categoria padrão</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fin.suppliers.map((s) => (
                <TableRow key={s.id} className={`border-border hover:bg-muted/40 ${s.archived ? "opacity-50" : ""}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{s.name}</p>
                      {s.isDemo && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border text-muted-foreground">demo</Badge>}
                    </div>
                    {s.document && <p className="text-[11px] text-muted-foreground">{s.document}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.defaultCategory || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.email || s.phone || "—"}</TableCell>
                  <TableCell>
                    {s.archived
                      ? <Badge variant="outline" className="text-[10px] bg-muted/40 border-border">Arquivado</Badge>
                      : <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Ativo</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(s)}><Pencil className="h-3.5 w-3.5 mr-2" /> Editar</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { fin.archiveSupplier(s.id); toast.success(s.archived ? "Reativado" : "Arquivado"); }}>
                          <Archive className="h-3.5 w-3.5 mr-2" /> {s.archived ? "Reativar" : "Arquivar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <SupplierDialog open={open} onOpenChange={setOpen} fin={fin} editing={editing} />
    </div>
  );
};

const SupplierDialog = ({ open, onOpenChange, fin, editing }: {
  open: boolean; onOpenChange: (v: boolean) => void; fin: ReturnType<typeof useFinance>; editing: Supplier | null;
}) => {
  const [form, setForm] = useState<Omit<Supplier, "id" | "isDemo">>({
    name: "", document: "", email: "", phone: "", defaultCategory: "", notes: "", archived: false,
  });
  const expCats = fin.categories.filter((c) => c.type === "expense");

  // sync when editing changes
  useMemo(() => {
    if (editing) setForm({
      name: editing.name, document: editing.document || "", email: editing.email || "",
      phone: editing.phone || "", defaultCategory: editing.defaultCategory || "",
      notes: editing.notes || "", archived: editing.archived || false,
    });
    else setForm({ name: "", document: "", email: "", phone: "", defaultCategory: "", notes: "", archived: false });
  }, [editing, open]);

  const submit = () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (editing) { fin.updateSupplier(editing.id, form); toast.success("Fornecedor atualizado"); }
    else { fin.addSupplier(form); toast.success("Fornecedor criado"); }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar fornecedor" : "Novo fornecedor"}</DialogTitle>
          <DialogDescription>Cadastre dados básicos do fornecedor.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Documento</Label>
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="CPF/CNPJ" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria padrão</Label>
            <Select value={form.defaultCategory || ""} onValueChange={(v) => setForm({ ...form, defaultCategory: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {expCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>{editing ? "Salvar" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// PIX TAB
// ============================================================
const PixTab = ({ fin }: { fin: ReturnType<typeof useFinance> }) => {
  const [form, setForm] = useState<PixSettings>(fin.pixSettings);

  const save = () => { fin.setPixSettings(form); toast.success("Configurações PIX salvas"); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="orbit-card p-5 lg:col-span-2 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Configuração PIX</h3>
          <p className="text-xs text-muted-foreground">Dados locais usados para gerar instruções de pagamento manuais.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Método</Label>
            <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v as PixMethod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">PIX próprio / QR manual</SelectItem>
                <SelectItem value="future">Integração futura</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de chave</Label>
            <Select value={form.keyType} onValueChange={(v) => setForm({ ...form, keyType: v as PixKeyType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(pixKeyLabels) as PixKeyType[]).map((k) => <SelectItem key={k} value={k}>{pixKeyLabels[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Chave PIX</Label>
            <Input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="ex: contato@orbyt.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do beneficiário</Label>
            <Input value={form.beneficiary} onChange={(e) => setForm({ ...form, beneficiary: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade</Label>
            <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Mensagem personalizada</Label>
            <Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="min-h-[60px]" />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Exibir PIX após orçamento</p>
              <p className="text-[11px] text-muted-foreground">Mostra instruções de pagamento ao final dos orçamentos.</p>
            </div>
            <Switch checked={form.showOnQuote} onCheckedChange={(v) => setForm({ ...form, showOnQuote: v })} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save}>Salvar configurações</Button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="orbit-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">Pré-visualização</h4>
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/40 p-4 text-center">
            <div className="mx-auto h-32 w-32 rounded-md bg-foreground/5 border border-border flex items-center justify-center">
              <QrCode className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">QR Code visual — não funcional</p>
            <p className="text-sm font-medium text-foreground mt-2">{form.beneficiary || "Beneficiário"}</p>
            <p className="text-[11px] text-muted-foreground">{form.key || "chave-pix"}</p>
          </div>
        </div>
        <div className="orbit-card p-4 bg-amber-500/5 border-amber-500/20">
          <div className="flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/80">
              PIX manual não confirma pagamento automaticamente. Confirmação automática exige integração futura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// RECURRING TAB
// ============================================================
const RecurringTab = ({ fin }: { fin: ReturnType<typeof useFinance> }) => {
  const [open, setOpen] = useState(false);
  const active = fin.recurring.filter((r) => r.active);
  const mrr = active.filter((r) => r.type === "income" && r.frequency === "monthly").reduce((s, r) => s + r.amount, 0);
  const fixedCost = active.filter((r) => r.type === "expense" && r.frequency === "monthly").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Repeat} label="Assinaturas ativas" value={String(active.filter((r) => r.type === "income").length)} tone="neutral" />
        <MetricCard icon={TrendingUp} label="MRR interno" value={formatBRL(mrr)} tone="income" />
        <MetricCard icon={TrendingDown} label="Custo fixo mensal" value={formatBRL(fixedCost)} tone="expense" />
        <MetricCard icon={Receipt} label="Total recorrências" value={String(fin.recurring.length)} tone="neutral" />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nova recorrência</Button>
      </div>

      <div className="orbit-card overflow-x-auto">
        {fin.recurring.length === 0 ? (
          <EmptyState icon={Repeat} title="Sem recorrências" description="Cadastre receitas ou despesas que se repetem." action={<Button size="sm" onClick={() => setOpen(true)}>Nova recorrência</Button>} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Próxima cobrança</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fin.recurring.map((r) => (
                <TableRow key={r.id} className="border-border hover:bg-muted/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{r.description}</p>
                      {r.isDemo && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border text-muted-foreground">demo</Badge>}
                      {!r.active && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border text-muted-foreground">pausada</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium ${r.type === "income" ? "text-emerald-400" : "text-destructive"}`}>
                      {r.type === "income" ? "Receita" : "Despesa"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{freqLabels[r.frequency]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateBR(r.nextChargeAt)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[11px] bg-muted/40 border-border text-muted-foreground">{r.category}</Badge></TableCell>
                  <TableCell className={`text-right font-bold ${r.type === "income" ? "text-emerald-400" : "text-destructive"}`}>{formatBRL(r.amount)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => fin.updateRecurring(r.id, { active: !r.active })}>
                          {r.active ? "Pausar" : "Reativar"}
                        </DropdownMenuItem>
                        {!r.isDemo && (
                          <DropdownMenuItem className="text-destructive" onClick={() => { fin.deleteRecurring(r.id); toast.success("Recorrência excluída"); }}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <RecurringDialog open={open} onOpenChange={setOpen} fin={fin} />
    </div>
  );
};

const RecurringDialog = ({ open, onOpenChange, fin }: { open: boolean; onOpenChange: (v: boolean) => void; fin: ReturnType<typeof useFinance> }) => {
  const [form, setForm] = useState<Omit<RecurringEntry, "id" | "isDemo" | "createdAt">>({
    type: "income", description: "", amount: 0, frequency: "monthly",
    nextChargeAt: new Date().toISOString().slice(0, 10), clientName: "", supplierId: "", category: "", active: true,
  });
  const cats = fin.categories.filter((c) => c.type === form.type);

  const submit = () => {
    if (!form.description.trim() || form.amount <= 0 || !form.category) { toast.error("Preencha descrição, valor e categoria"); return; }
    fin.addRecurring(form);
    toast.success("Recorrência criada");
    onOpenChange(false);
    setForm({ ...form, description: "", amount: 0 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader><DialogTitle>Nova recorrência</DialogTitle></DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as TxType, category: "" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frequência</Label>
            <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RecurFreq })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor *</Label>
            <Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Próxima cobrança</Label>
            <Input type="date" value={form.nextChargeAt} onChange={(e) => setForm({ ...form, nextChargeAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {cats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.type === "income" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Opcional" />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">Fornecedor</Label>
              <Select value={form.supplierId || ""} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
                <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                <SelectContent>
                  {fin.suppliers.filter((s) => !s.archived).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Criar recorrência</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// CASH TAB
// ============================================================
const CashTab = ({ fin }: { fin: ReturnType<typeof useFinance> }) => {
  const [open, setOpen] = useState(false);

  const balances = useMemo(() => {
    return fin.cashAccounts.map((a) => {
      const movement = fin.transactions
        .filter((t) => t.cashAccountId === a.id && t.status === "paid")
        .reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
      return { ...a, balance: a.initialBalance + movement };
    });
  }, [fin.cashAccounts, fin.transactions]);

  const total = balances.reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-4">
      <div className="orbit-card p-5">
        <p className="text-xs text-muted-foreground">Saldo consolidado</p>
        <p className="text-3xl font-bold text-foreground">{formatBRL(total)}</p>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Novo caixa</Button>
      </div>

      {fin.cashAccounts.length === 0 ? (
        <div className="orbit-card"><EmptyState icon={PiggyBank} title="Sem caixas cadastrados" description="Cadastre contas para acompanhar saldos por origem." action={<Button size="sm" onClick={() => setOpen(true)}>Novo caixa</Button>} /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {balances.map((a) => (
            <div key={a.id} className="orbit-card p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${a.color}22` }}>
                    <Wallet className="h-4 w-4" style={{ color: a.color }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{a.name}</p>
                    <p className="text-[11px] text-muted-foreground">{cashTypeLabels[a.type]}</p>
                  </div>
                </div>
                {!a.active && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border">Inativo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">Saldo atual</p>
              <p className="text-xl font-bold text-foreground">{formatBRL(a.balance)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Inicial: {formatBRL(a.initialBalance)}</p>
              {!a.isDemo && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive h-7 mt-2 px-2" onClick={() => { fin.deleteCashAccount(a.id); toast.success("Caixa removido"); }}>
                  <Trash2 className="h-3 w-3 mr-1" /> Remover
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="orbit-card p-4 bg-muted/20 border-border/40">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Regras de roteamento automático</span> — em breve. Por enquanto, vincule manualmente a transação ao caixa.
        </p>
      </div>

      <CashDialog open={open} onOpenChange={setOpen} fin={fin} />
    </div>
  );
};

const CashDialog = ({ open, onOpenChange, fin }: { open: boolean; onOpenChange: (v: boolean) => void; fin: ReturnType<typeof useFinance> }) => {
  const [form, setForm] = useState<Omit<CashAccount, "id" | "isDemo">>({
    name: "", type: "bank", initialBalance: 0, color: "#F81040", active: true,
  });
  const submit = () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    fin.addCashAccount(form);
    toast.success("Caixa criado");
    onOpenChange(false);
    setForm({ name: "", type: "bank", initialBalance: 0, color: "#F81040", active: true });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border">
        <DialogHeader><DialogTitle>Novo caixa</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CashAccountType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(cashTypeLabels) as CashAccountType[]).map((k) => <SelectItem key={k} value={k}>{cashTypeLabels[k]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Saldo inicial</Label>
              <Input type="number" step="0.01" value={form.initialBalance || ""} onChange={(e) => setForm({ ...form, initialBalance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cor</Label>
            <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-20 p-1" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Criar caixa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// REPORTS TAB
// ============================================================
const ReportsTab = ({ fin, chartData, metrics }: {
  fin: ReturnType<typeof useFinance>;
  chartData: ReturnType<typeof useMonthlySeries>;
  metrics: ReturnType<typeof useFinanceMetrics>;
}) => {
  const transactions: Transaction[] = fin.transactions;
  const categories: FinanceCategory[] = fin.categories;

  const byCategory = (type: TxType) => {
    const map = new Map<string, number>();
    transactions.filter((t) => t.type === type && t.status === "paid").forEach((t) => {
      map.set(t.category, (map.get(t.category) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => {
      const cat = categories.find((c) => c.name === name);
      return { name, value, color: cat?.color || "#888" };
    }).sort((a, b) => b.value - a.value);
  };

  const incomeByCat = byCategory("income");
  const expByCat = byCategory("expense");

  const topClients = useMemo(() => {
    const map = new Map<string, number>();
    transactions.filter((t) => t.type === "income" && t.status === "paid" && t.clientName).forEach((t) => {
      map.set(t.clientName!, (map.get(t.clientName!) || 0) + t.amount);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [transactions]);

  const grossRevenue = metrics.incomeMonth;
  const taxesEst = grossRevenue * 0.06;
  const netRevenue = grossRevenue - taxesEst;
  const netProfit = netRevenue - metrics.expenseMonth;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Relatórios financeiros</h3>
          <p className="text-xs text-muted-foreground">Análise consolidada dos últimos 6 meses.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info("Exportação PDF disponível em breve")}>
          <Download className="h-3.5 w-3.5" /> Exportar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="orbit-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Receita vs Despesa</h4>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="receita" name="Receita" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(348 94% 52%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="orbit-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Evolução do saldo</h4>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="saldo" name="Saldo" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="orbit-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Receita por categoria</h4>
          {incomeByCat.length === 0
            ? <EmptyState icon={PiggyBank} title="Sem receitas pagas" />
            : (
              <div className="flex gap-4 items-center">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={incomeByCat} dataKey="value" innerRadius={40} outerRadius={70}>
                      {incomeByCat.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex-1 space-y-1.5 text-xs">
                  {incomeByCat.slice(0, 5).map((d) => (
                    <li key={d.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground truncate">{d.name}</span>
                      </span>
                      <span className="font-medium text-foreground">{formatBRL(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        <div className="orbit-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Despesas por categoria</h4>
          {expByCat.length === 0
            ? <EmptyState icon={PiggyBank} title="Sem despesas pagas" />
            : (
              <div className="flex gap-4 items-center">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie data={expByCat} dataKey="value" innerRadius={40} outerRadius={70}>
                      {expByCat.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <ul className="flex-1 space-y-1.5 text-xs">
                  {expByCat.slice(0, 5).map((d) => (
                    <li key={d.name} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 truncate">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-muted-foreground truncate">{d.name}</span>
                      </span>
                      <span className="font-medium text-foreground">{formatBRL(d.value)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="orbit-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">Top clientes por faturamento</h4>
          {topClients.length === 0 ? <EmptyState icon={Users2} title="Sem dados" /> : (
            <ul className="space-y-2">
              {topClients.map((c, i) => (
                <li key={c.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <span className="text-sm text-foreground"><span className="text-muted-foreground mr-2">{i + 1}.</span>{c.name}</span>
                  <span className="text-sm font-bold text-emerald-400">{formatBRL(c.value)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="orbit-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-3">DRE simples (mês atual)</h4>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between py-1.5 border-b border-border/40"><span className="text-muted-foreground">Receita bruta</span><span className="font-medium text-foreground">{formatBRL(grossRevenue)}</span></li>
            <li className="flex justify-between py-1.5 border-b border-border/40"><span className="text-muted-foreground">(-) Deduções/Impostos estimados (6%)</span><span className="font-medium text-destructive">-{formatBRL(taxesEst)}</span></li>
            <li className="flex justify-between py-1.5 border-b border-border/40"><span className="text-muted-foreground">Receita líquida</span><span className="font-medium text-foreground">{formatBRL(netRevenue)}</span></li>
            <li className="flex justify-between py-1.5 border-b border-border/40"><span className="text-muted-foreground">(-) Despesas operacionais</span><span className="font-medium text-destructive">-{formatBRL(metrics.expenseMonth)}</span></li>
            <li className="flex justify-between py-2 mt-1 bg-muted/30 px-2 rounded"><span className="font-semibold text-foreground">Lucro líquido</span><span className={`font-bold ${netProfit >= 0 ? "text-emerald-400" : "text-destructive"}`}>{formatBRL(netProfit)}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// QUICK SALE DIALOG (income)
// ============================================================
const QuickSaleDialog = ({ open, onOpenChange, fin, clients, cloudMode, onCreateCloud }: {
  open: boolean; onOpenChange: (v: boolean) => void; fin: ReturnType<typeof useFinance>; clients: ReturnType<typeof useClients>["clients"];
  /** Etapa 5 · Financeiro Fase B (§2 do desenho) — quando true, submit grava
   * direto na nuvem (createSupabaseTransaction) em vez do addTransaction
   * local; blockWrite() em Financeiro.tsx já garante que este diálogo só
   * abre quando cloudMode reflete o estado real (dataSource=supabase E flag
   * de escrita ligada) ou quando dataSource=local (cloudMode=false). */
  cloudMode: boolean;
  onCreateCloud: (input: NewTransactionInput) => Promise<unknown>;
}) => {
  const { currency } = useFormat();
  const incCats = fin.categories.filter((c) => c.type === "income");
  const [form, setForm] = useState({
    title: "", description: "", amount: "", clientName: "",
    category: "", dueDate: new Date().toISOString().slice(0, 10),
    status: "pending" as TxStatus, paymentMethod: "pix" as PaymentMethod, notes: "",
    mode: "lump" as "lump" | "installment" | "recurring",
  });

  const submit = () => {
    const amount = parseFloat(form.amount);
    if (!form.title.trim() || !amount || amount <= 0 || !form.category) { toast.error("Preencha descrição, valor e categoria"); return; }
    const input = {
      type: "income" as const, title: form.title.trim(), description: form.description.trim() || undefined,
      amount, category: form.category, clientName: form.clientName || undefined,
      dueDate: form.dueDate, status: form.status, paymentMethod: form.paymentMethod,
      recurrence: form.mode === "recurring" ? "monthly" as const : "none" as const,
      source: form.mode === "recurring" ? "recurring" as const : "sale" as const,
      notes: form.notes || undefined,
      paidDate: form.status === "paid" ? new Date().toISOString().slice(0, 10) : undefined,
    };

    if (cloudMode) {
      // §1.2 do desenho — recurrence não tem coluna na nuvem ainda: NUNCA
      // bloqueia a criação (post-flip gap explícito), só avisa que aquele
      // pedaço específico não é gravado, pra não confundir quem escolheu
      // "Recorrente" achando que teria o mesmo efeito do modo Local.
      if (form.mode === "recurring") {
        toast.warning("Recorrência ainda não é gravada em modo Supabase — a venda será criada como avulsa na nuvem.");
      }
      onCreateCloud(input).then(() => {
        toast.success("Venda registrada na nuvem");
        onOpenChange(false);
        setForm({ ...form, title: "", description: "", amount: "", clientName: "", notes: "" });
      }).catch((err) => {
        console.error("Falha ao registrar venda no Supabase:", err);
        toast.error("Não foi possível registrar a venda no Supabase. Tente novamente.");
      });
      return;
    }

    fin.addTransaction(input);
    toast.success("Venda registrada");
    onOpenChange(false);
    setForm({ ...form, title: "", description: "", amount: "", clientName: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Venda rápida</DialogTitle>
          <DialogDescription>Registre uma nova receita ou conta a receber.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Projeto de branding" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor ({currency}) *</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vencimento</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cliente</Label>
            <Select value={form.clientName || "__none__"} onValueChange={(v) => setForm({ ...form, clientName: v === "__none__" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem cliente</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}{c.company ? ` · ${c.company}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {incCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forma</Label>
            <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as "lump" | "installment" | "recurring" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lump">À vista</SelectItem>
                <SelectItem value="installment">Parcelado</SelectItem>
                <SelectItem value="recurring">Recorrente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TxStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
                <SelectItem value="canceled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(methodLabels) as PaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Registrar venda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// EXPENSE DIALOG
// ============================================================
const ExpenseDialog = ({ open, onOpenChange, fin, cloudMode, onCreateCloud }: {
  open: boolean; onOpenChange: (v: boolean) => void; fin: ReturnType<typeof useFinance>;
  /** Etapa 5 · Financeiro Fase B (§2 do desenho) — mesmo contrato de
   * QuickSaleDialog: cloudMode=true grava direto na nuvem. */
  cloudMode: boolean;
  onCreateCloud: (input: NewTransactionInput) => Promise<unknown>;
}) => {
  const { currency } = useFormat();
  const expCats = fin.categories.filter((c) => c.type === "expense");
  const [form, setForm] = useState({
    title: "", description: "", amount: "", supplierId: "",
    category: "", dueDate: new Date().toISOString().slice(0, 10),
    status: "pending" as TxStatus, paymentMethod: "pix" as PaymentMethod, notes: "",
    kind: "one" as "one" | "recurring",
  });

  const submit = () => {
    const amount = parseFloat(form.amount);
    if (!form.title.trim() || !amount || amount <= 0 || !form.category) { toast.error("Preencha descrição, valor e categoria"); return; }
    const input = {
      type: "expense" as const, title: form.title.trim(), description: form.description.trim() || undefined,
      amount, category: form.category, supplierId: form.supplierId || undefined,
      dueDate: form.dueDate, status: form.status, paymentMethod: form.paymentMethod,
      recurrence: form.kind === "recurring" ? "monthly" as const : "none" as const,
      source: form.kind === "recurring" ? "recurring" as const : "manual" as const,
      notes: form.notes || undefined,
      paidDate: form.status === "paid" ? new Date().toISOString().slice(0, 10) : undefined,
    };

    if (cloudMode) {
      // §1.2 do desenho — recurrence e supplierId não têm coluna na nuvem
      // ainda: NUNCA bloqueia a criação, só avisa o que não vai ser gravado
      // (mesmo contrato de QuickSaleDialog acima).
      const gaps: string[] = [];
      if (form.kind === "recurring") gaps.push("recorrência");
      if (form.supplierId) gaps.push("fornecedor");
      if (gaps.length > 0) {
        toast.warning(`${gaps.join(" e ")} ainda não ${gaps.length > 1 ? "são gravados" : "é gravado"} em modo Supabase — a despesa será criada sem ${gaps.length > 1 ? "esses campos" : "esse campo"}.`);
      }
      onCreateCloud(input).then(() => {
        toast.success("Despesa lançada na nuvem");
        onOpenChange(false);
        setForm({ ...form, title: "", description: "", amount: "", supplierId: "", notes: "" });
      }).catch((err) => {
        console.error("Falha ao lançar despesa no Supabase:", err);
        toast.error("Não foi possível lançar a despesa no Supabase. Tente novamente.");
      });
      return;
    }

    fin.addTransaction(input);
    toast.success("Despesa lançada");
    onOpenChange(false);
    setForm({ ...form, title: "", description: "", amount: "", supplierId: "", notes: "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lançar despesa</DialogTitle>
          <DialogDescription>Registre uma nova despesa avulsa ou recorrente.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Descrição *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Valor ({currency}) *</Label>
            <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Vencimento</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fornecedor</Label>
            <Select value={form.supplierId || "__none__"} onValueChange={(v) => {
              const sup = fin.suppliers.find((s) => s.id === v);
              setForm({ ...form, supplierId: v === "__none__" ? "" : v, category: sup?.defaultCategory || form.category });
            }}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sem fornecedor</SelectItem>
                {fin.suppliers.filter((s) => !s.archived).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {expCats.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as "one" | "recurring" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one">Avulsa</SelectItem>
                <SelectItem value="recurring">Recorrente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TxStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="paid">Pago</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v as PaymentMethod })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(methodLabels) as PaymentMethod[]).map((m) => <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="min-h-[60px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit}>Lançar despesa</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// CATEGORIES DIALOG
// ============================================================
const CategoriesDialog = ({ open, onOpenChange, fin }: { open: boolean; onOpenChange: (v: boolean) => void; fin: ReturnType<typeof useFinance> }) => {
  const [tab, setTab] = useState<TxType>("income");
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");
  const list = fin.categories.filter((c) => c.type === tab);

  const add = () => {
    if (!name.trim()) { toast.error("Informe o nome"); return; }
    fin.addCategory({ name: name.trim(), type: tab, color });
    setName("");
    toast.success("Categoria criada");
  };
  const remove = (c: FinanceCategory) => {
    const ok = fin.deleteCategory(c.id, c.name);
    if (!ok) toast.error("Categoria em uso por transações");
    else toast.success("Categoria removida");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-card border-border">
        <DialogHeader><DialogTitle>Categorias financeiras</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as TxType)}>
          <TabsList className="h-9">
            <TabsTrigger value="income" className="h-7 text-xs">Receitas</TabsTrigger>
            <TabsTrigger value="expense" className="h-7 text-xs">Despesas</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Nova categoria</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
              </div>
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-14 p-1" />
              <Button onClick={add} size="sm" className="h-10">Adicionar</Button>
            </div>
            <ul className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {list.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                    <span className="text-sm text-foreground">{c.name}</span>
                    {c.isDemo && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border text-muted-foreground">demo</Badge>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(c)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================
// TUTORIAL
// ============================================================
const TutorialDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[520px] bg-card border-border">
      <DialogHeader>
        <DialogTitle>Como usar o Financeiro</DialogTitle>
        <DialogDescription>Resumo rápido das principais ações.</DialogDescription>
      </DialogHeader>
      <ul className="space-y-2 text-sm py-2">
        <li className="flex gap-2"><span className="text-primary">1.</span> Use <b>Venda rápida</b> para registrar receitas e contas a receber.</li>
        <li className="flex gap-2"><span className="text-primary">2.</span> Use <b>Lançar despesa</b> para custos avulsos ou recorrentes.</li>
        <li className="flex gap-2"><span className="text-primary">3.</span> Acompanhe vencimentos em <b>Receber</b> e <b>Pagar</b>, marque como pago em 1 clique.</li>
        <li className="flex gap-2"><span className="text-primary">4.</span> Configure seu <b>PIX</b> e <b>Caixas</b> para organizar fluxo.</li>
        <li className="flex gap-2"><span className="text-primary">5.</span> Veja análises em <b>Relatórios</b> — incluindo DRE simplificado.</li>
      </ul>
      <DialogFooter><Button onClick={() => onOpenChange(false)}>Entendi</Button></DialogFooter>
    </DialogContent>
  </Dialog>
);

export default Financeiro;
