import { PageHeader } from "@/components/layout/PageHeader";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DollarSign, TrendingUp, TrendingDown, Target, Receipt,
  Plus, Search, MoreHorizontal,
  ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2, Timer, Ban
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  useFinance,
  useFinanceMetrics,
  useMonthlySeries,
  formatBRL,
  formatDateBR,
  FINANCE_CATEGORIES,
  type Transaction,
  type TxType,
  type TxStatus,
  type PaymentMethod,
  type Recurrence,
  type TxSource,
} from "@/hooks/useFinance";
import { toast } from "sonner";

const statusLabels: Record<TxStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  overdue: "Atrasado",
  canceled: "Cancelado",
};
const statusStyles: Record<TxStatus, string> = {
  paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  canceled: "bg-muted/40 text-muted-foreground border-border",
};
const statusIcons: Record<TxStatus, any> = {
  paid: CheckCircle2,
  pending: Timer,
  overdue: AlertCircle,
  canceled: Ban,
};
const methodLabels: Record<PaymentMethod, string> = {
  pix: "Pix", card: "Cartão", boleto: "Boleto", transfer: "Transferência", cash: "Dinheiro", other: "Outro",
};

const SummaryCard = ({ icon: Icon, label, value, sub, accent, valueColor }: {
  icon: any; label: string; value: string; sub?: string; accent?: string; valueColor?: string;
}) => (
  <div className="orbit-card p-5 flex items-center gap-4">
    <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10"}`}>
      <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold truncate ${valueColor || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="orbit-card p-3 shadow-lg border-border">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: {formatBRL(p.value)}
        </p>
      ))}
    </div>
  );
};

const Financeiro = () => {
  const { transactions, addTransaction, updateTransactionStatus, deleteTransaction } = useFinance();
  const metrics = useFinanceMetrics(transactions);
  const chartData = useMonthlySeries(transactions);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TxType>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | TxStatus>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<"all" | "month" | "next30" | "overdue">("all");
  const [newTxOpen, setNewTxOpen] = useState(false);

  const filtered = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
    return transactions.filter((t) => {
      const q = search.toLowerCase().trim();
      if (q) {
        const hay = `${t.title} ${t.category} ${t.clientName || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterPeriod === "month" && !t.dueDate.startsWith(ym)) return false;
      if (filterPeriod === "next30") {
        const d = new Date(t.dueDate);
        if (d < now || d > in30) return false;
      }
      if (filterPeriod === "overdue" && t.status !== "overdue") return false;
      return true;
    });
  }, [transactions, search, filterType, filterStatus, filterCategory, filterPeriod]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        subtitle="Controle receitas, despesas e acompanhe a saúde financeira do seu negócio"
        actions={
          <Button onClick={() => setNewTxOpen(true)} className="orbit-gradient text-white border-0 gap-2 shrink-0">
            <Plus className="h-4 w-4" /> Nova transação
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard icon={TrendingUp} label="Receita do mês" value={formatBRL(metrics.incomeMonth)} accent="bg-emerald-500/15" valueColor="text-emerald-400" />
        <SummaryCard icon={TrendingDown} label="Despesas do mês" value={formatBRL(metrics.expenseMonth)} accent="bg-destructive/15" valueColor="text-destructive" />
        <SummaryCard icon={DollarSign} label="Lucro líquido" value={formatBRL(metrics.profit)} valueColor={metrics.profit >= 0 ? "text-foreground" : "text-destructive"} />
        <SummaryCard icon={AlertCircle} label="Valores pendentes" value={formatBRL(metrics.pending)} accent="bg-amber-500/15" />
        <SummaryCard icon={Receipt} label="Contas atrasadas" value={String(metrics.overdueCount)} accent="bg-destructive/15" valueColor="text-destructive" />
        <SummaryCard icon={Target} label="Meta mensal" value={`${metrics.goalPct}%`} sub={`de ${formatBRL(metrics.monthlyGoal)}`} />
      </div>

      <div className="orbit-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 14% 18%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(230 14% 18% / 0.5)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215 20% 55%)" }} />
            <Bar dataKey="receita" name="Receita" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Bar dataKey="despesas" name="Despesas" fill="hsl(263 70% 58%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="orbit-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por título, categoria ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted/50 border-border" />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="income">Receita</SelectItem>
            <SelectItem value="expense">Despesa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {(Object.keys(statusLabels) as TxStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {FINANCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as any)}>
          <SelectTrigger className="w-[170px] bg-muted/50 border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos períodos</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
            <SelectItem value="next30">Próximos 30 dias</SelectItem>
            <SelectItem value="overdue">Atrasados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="orbit-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Título</TableHead>
              <TableHead className="text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-muted-foreground">Tipo</TableHead>
              <TableHead className="text-muted-foreground">Vencimento</TableHead>
              <TableHead className="text-muted-foreground">Método</TableHead>
              <TableHead className="text-muted-foreground">Cliente/Origem</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Valor</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((t) => {
              const StatusIcon = statusIcons[t.status];
              return (
                <TableRow key={t.id} className="border-border hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <span className="truncate">{t.title}</span>
                      {t.isDemo && <Badge variant="outline" className="text-[10px] bg-muted/40 border-border text-muted-foreground">demo</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-muted/50 border-border text-muted-foreground">{t.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-medium flex items-center gap-1 ${t.type === "income" ? "text-emerald-400" : "text-destructive"}`}>
                      {t.type === "income" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                      {t.type === "income" ? "Receita" : "Despesa"}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDateBR(t.dueDate)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{methodLabels[t.paymentMethod]}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.clientName || (t.source !== "manual" ? t.source : "—")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 ${statusStyles[t.status]}`}>
                      <StatusIcon className="h-3 w-3" />
                      {statusLabels[t.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-bold ${t.type === "income" ? "text-emerald-400" : "text-destructive"}`}>
                    {t.type === "expense" ? "-" : ""}{formatBRL(t.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {t.status !== "paid" && (
                          <DropdownMenuItem onClick={() => { updateTransactionStatus(t.id, "paid"); toast.success("Transação marcada como paga"); }}>
                            Marcar como pago
                          </DropdownMenuItem>
                        )}
                        {t.status !== "canceled" && (
                          <DropdownMenuItem onClick={() => { updateTransactionStatus(t.id, "canceled"); toast.success("Transação cancelada"); }}>
                            Cancelar
                          </DropdownMenuItem>
                        )}
                        {!t.isDemo && (
                          <DropdownMenuItem className="text-destructive" onClick={() => { deleteTransaction(t.id); toast.success("Transação excluída"); }}>
                            Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma transação encontrada.</div>
        )}
      </div>

      <NewTransactionDialog
        open={newTxOpen}
        onOpenChange={setNewTxOpen}
        onSave={(data) => {
          addTransaction(data);
          toast.success("Transação criada");
          setNewTxOpen(false);
        }}
      />
    </div>
  );
};

interface NewTxFormState {
  type: TxType;
  title: string;
  description: string;
  amount: string;
  category: string;
  clientName: string;
  dueDate: string;
  status: TxStatus;
  paymentMethod: PaymentMethod;
  recurrence: Recurrence;
  source: TxSource;
}

const blankForm: NewTxFormState = {
  type: "income",
  title: "",
  description: "",
  amount: "",
  category: "",
  clientName: "",
  dueDate: new Date().toISOString().slice(0, 10),
  status: "pending",
  paymentMethod: "pix",
  recurrence: "none",
  source: "manual",
};

const NewTransactionDialog = ({
  open, onOpenChange, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; onSave: (data: Omit<Transaction, "id" | "isDemo" | "createdAt">) => void }) => {
  const [form, setForm] = useState<NewTxFormState>(blankForm);
  const [errors, setErrors] = useState<Partial<Record<keyof NewTxFormState, string>>>({});

  const set = <K extends keyof NewTxFormState>(k: K, v: NewTxFormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = () => {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = "Informe o título";
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) errs.amount = "Informe um valor maior que zero";
    if (!form.category) errs.category = "Selecione uma categoria";
    if (!form.dueDate) errs.dueDate = "Informe o vencimento";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSave({
      type: form.type,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      amount,
      category: form.category,
      clientName: form.clientName.trim() || undefined,
      dueDate: form.dueDate,
      status: form.status,
      paymentMethod: form.paymentMethod,
      recurrence: form.recurrence,
      source: form.source,
      paidDate: form.status === "paid" ? new Date().toISOString().slice(0, 10) : undefined,
    });
    setForm(blankForm);
    setErrors({});
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setForm(blankForm); setErrors({}); } }}>
      <DialogContent className="sm:max-w-[620px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova transação</DialogTitle>
          <DialogDescription className="text-muted-foreground">Registre uma nova entrada ou saída financeira.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Tipo *</Label>
            <Select value={form.type} onValueChange={(v) => set("type", v as TxType)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Valor (R$) *</Label>
            <Input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" className="bg-muted/50 border-border" />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Título *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex: Projeto de branding" className="bg-muted/50 border-border" />
            {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm text-muted-foreground">Descrição</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Notas adicionais..." className="bg-muted/50 border-border min-h-[70px]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {FINANCE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Cliente (opcional)</Label>
            <Input value={form.clientName} onChange={(e) => set("clientName", e.target.value)} placeholder="Nome do cliente" className="bg-muted/50 border-border" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Vencimento *</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="bg-muted/50 border-border" />
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as TxStatus)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(statusLabels) as TxStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{statusLabels[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Método de pagamento</Label>
            <Select value={form.paymentMethod} onValueChange={(v) => set("paymentMethod", v as PaymentMethod)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(methodLabels) as PaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{methodLabels[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Recorrência</Label>
            <Select value={form.recurrence} onValueChange={(v) => set("recurrence", v as Recurrence)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Origem</Label>
            <Select value={form.source} onValueChange={(v) => set("source", v as TxSource)}>
              <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="quote">Orçamento</SelectItem>
                <SelectItem value="sale">Venda</SelectItem>
                <SelectItem value="service">Serviço</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSubmit}>Salvar transação</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default Financeiro;
