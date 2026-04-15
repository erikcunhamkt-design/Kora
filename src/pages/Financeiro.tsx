import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Target, Receipt,
  Plus, Search, ArrowUpDown, Calendar, Clock, MoreHorizontal,
  ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2, Timer,
  CalendarClock
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ---------- Types ----------
type TxStatus = "Pago" | "Pendente" | "Atrasado" | "Agendado";
type TxType = "Entrada" | "Saída";

interface Transaction {
  id: number;
  description: string;
  client: string;
  category: string;
  type: TxType;
  value: number;
  dueDate: string;
  paymentDate: string;
  status: TxStatus;
}

// ---------- Constants ----------
const categories = ["Projeto", "Identidade Visual", "Social Media", "Web Design", "Assinatura", "Ferramenta", "Marketing", "Impostos", "Outros"];
const statusList: TxStatus[] = ["Pago", "Pendente", "Atrasado", "Agendado"];
const typeList: TxType[] = ["Entrada", "Saída"];

const statusStyles: Record<TxStatus, string> = {
  Pago: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Pendente: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Atrasado: "bg-destructive/10 text-destructive border-destructive/20",
  Agendado: "bg-primary/10 text-primary border-primary/20",
};

const statusIcons: Record<TxStatus, any> = {
  Pago: CheckCircle2,
  Pendente: Timer,
  Atrasado: AlertCircle,
  Agendado: CalendarClock,
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

// ---------- Mock Data ----------
const initialTransactions: Transaction[] = [
  { id: 1, description: "Rebranding completo", client: "Acme Corp", category: "Identidade Visual", type: "Entrada", value: 8500, dueDate: "15 Abr 2025", paymentDate: "14 Abr 2025", status: "Pago" },
  { id: 2, description: "Landing page institucional", client: "Studio Zen", category: "Web Design", type: "Entrada", value: 5200, dueDate: "20 Abr 2025", paymentDate: "—", status: "Pendente" },
  { id: 3, description: "Pacote social media mensal", client: "FitTrack", category: "Social Media", type: "Entrada", value: 3800, dueDate: "10 Abr 2025", paymentDate: "10 Abr 2025", status: "Pago" },
  { id: 4, description: "Assinatura Adobe Creative Cloud", client: "—", category: "Assinatura", type: "Saída", value: 290, dueDate: "01 Abr 2025", paymentDate: "01 Abr 2025", status: "Pago" },
  { id: 5, description: "Assinatura Figma Professional", client: "—", category: "Ferramenta", type: "Saída", value: 75, dueDate: "01 Abr 2025", paymentDate: "01 Abr 2025", status: "Pago" },
  { id: 6, description: "Catálogo digital B2B", client: "Nova Design", category: "Projeto", type: "Entrada", value: 4500, dueDate: "05 Abr 2025", paymentDate: "—", status: "Atrasado" },
  { id: 7, description: "UI Kit aplicativo", client: "FitTrack", category: "Web Design", type: "Entrada", value: 6000, dueDate: "25 Abr 2025", paymentDate: "—", status: "Agendado" },
  { id: 8, description: "Identidade visual cafeteria", client: "Café & Arte", category: "Identidade Visual", type: "Entrada", value: 5200, dueDate: "12 Abr 2025", paymentDate: "11 Abr 2025", status: "Pago" },
  { id: 9, description: "Domínio e hospedagem anual", client: "—", category: "Ferramenta", type: "Saída", value: 420, dueDate: "15 Abr 2025", paymentDate: "15 Abr 2025", status: "Pago" },
  { id: 10, description: "Google Ads campanha", client: "—", category: "Marketing", type: "Saída", value: 800, dueDate: "20 Abr 2025", paymentDate: "—", status: "Pendente" },
  { id: 11, description: "Impostos trimestrais DAS", client: "—", category: "Impostos", type: "Saída", value: 1250, dueDate: "20 Abr 2025", paymentDate: "—", status: "Agendado" },
  { id: 12, description: "Social media Q2", client: "Brand Co", category: "Social Media", type: "Entrada", value: 4200, dueDate: "30 Abr 2025", paymentDate: "—", status: "Agendado" },
];

const chartData = [
  { month: "Nov", receita: 18200, despesas: 3800 },
  { month: "Dez", receita: 22500, despesas: 4200 },
  { month: "Jan", receita: 19800, despesas: 3500 },
  { month: "Fev", receita: 24100, despesas: 4600 },
  { month: "Mar", receita: 28400, despesas: 5100 },
  { month: "Abr", receita: 33200, despesas: 2835 },
];

// ---------- Summary Card ----------
const SummaryCard = ({ icon: Icon, label, value, sub, accent, valueColor }: {
  icon: any; label: string; value: string; sub?: string; accent?: string; valueColor?: string;
}) => (
  <div className="orbit-card p-5 flex items-center gap-4">
    <div className={`h-11 w-11 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10"}`}>
      <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`} />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${valueColor || "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  </div>
);

// ---------- Custom Tooltip ----------
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null;
  return (
    <div className="orbit-card p-3 shadow-lg border-border">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
};

// ---------- Main Component ----------
const Financeiro = () => {
  const [transactions] = useState<Transaction[]>(initialTransactions);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [newTxOpen, setNewTxOpen] = useState(false);

  const filtered = transactions
    .filter(t => {
      const q = search.toLowerCase();
      const matchSearch = !q || t.description.toLowerCase().includes(q) || t.client.toLowerCase().includes(q);
      const matchStatus = filterStatus === "all" || t.status === filterStatus;
      const matchType = filterType === "all" || t.type === filterType;
      const matchCat = filterCategory === "all" || t.category === filterCategory;
      return matchSearch && matchStatus && matchType && matchCat;
    })
    .sort((a, b) => sortAsc ? a.id - b.id : b.id - a.id);

  const totalReceita = transactions.filter(t => t.type === "Entrada" && t.status === "Pago").reduce((s, t) => s + t.value, 0);
  const totalDespesas = transactions.filter(t => t.type === "Saída" && t.status === "Pago").reduce((s, t) => s + t.value, 0);
  const lucro = totalReceita - totalDespesas;
  const pendentes = transactions.filter(t => ["Pendente", "Atrasado"].includes(t.status) && t.type === "Entrada").reduce((s, t) => s + t.value, 0);
  const ticketMedio = Math.round(totalReceita / Math.max(transactions.filter(t => t.type === "Entrada" && t.status === "Pago").length, 1));
  const metaMensal = 35000;
  const metaPercent = Math.min(Math.round(((totalReceita + pendentes) / metaMensal) * 100), 100);

  const receivables = transactions.filter(t => t.type === "Entrada" && ["Pendente", "Atrasado", "Agendado"].includes(t.status));
  const payables = transactions.filter(t => t.type === "Saída" && ["Pendente", "Agendado"].includes(t.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Controle receitas, despesas e acompanhe a saúde financeira do seu negócio</p>
        </div>
        <Button onClick={() => setNewTxOpen(true)} className="orbit-gradient text-white border-0 gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nova transação
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <SummaryCard icon={TrendingUp} label="Receita do mês" value={fmt(totalReceita)} sub="+18% vs anterior" accent="bg-emerald-500/15" valueColor="text-emerald-400" />
        <SummaryCard icon={TrendingDown} label="Despesas do mês" value={fmt(totalDespesas)} sub="-8% vs anterior" accent="bg-destructive/15" valueColor="text-destructive" />
        <SummaryCard icon={DollarSign} label="Lucro líquido" value={fmt(lucro)} />
        <SummaryCard icon={AlertCircle} label="Valores pendentes" value={fmt(pendentes)} accent="bg-amber-500/15" />
        <SummaryCard icon={Receipt} label="Ticket médio" value={fmt(ticketMedio)} />
        <SummaryCard icon={Target} label="Meta mensal" value={`${metaPercent}%`} sub={`de ${fmt(metaMensal)}`} />
      </div>

      {/* Chart + Goals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="orbit-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 14% 18%)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(230 14% 18% / 0.5)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "hsl(215 20% 55%)" }} />
              <Bar dataKey="receita" name="Receita" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="despesas" name="Despesas" fill="hsl(263 70% 58%)" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Financial Goal */}
        <div className="orbit-card p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-foreground mb-4">Meta do mês</h3>
          <div className="flex-1 flex flex-col justify-center items-center text-center gap-4">
            <div className="relative h-28 w-28">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(230 14% 18%)" strokeWidth="8" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="url(#goalGrad)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${metaPercent * 2.64} ${264 - metaPercent * 2.64}`} />
                <defs>
                  <linearGradient id="goalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(217 91% 60%)" />
                    <stop offset="100%" stopColor="hsl(263 70% 58%)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-foreground">{metaPercent}%</span>
              </div>
            </div>
            <div>
              <p className="text-sm text-foreground font-medium">{fmt(totalReceita + pendentes)} <span className="text-muted-foreground font-normal">de</span> {fmt(metaMensal)}</p>
              <p className="text-xs text-muted-foreground mt-1">Faltam {fmt(Math.max(metaMensal - totalReceita - pendentes, 0))}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Receivables & Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="orbit-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowDownLeft className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-foreground">Contas a receber</h3>
            <Badge variant="outline" className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{receivables.length}</Badge>
          </div>
          <div className="space-y-2">
            {receivables.map(t => {
              const StatusIcon = statusIcons[t.status];
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon className={`h-4 w-4 shrink-0 ${t.status === "Atrasado" ? "text-destructive" : t.status === "Pendente" ? "text-amber-400" : "text-primary"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.client} · Venc. {t.dueDate}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-emerald-400">{fmt(t.value)}</p>
                    <Badge variant="outline" className={`text-[10px] ${statusStyles[t.status]}`}>{t.status}</Badge>
                  </div>
                </div>
              );
            })}
            {receivables.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta a receber.</p>}
          </div>
        </div>

        <div className="orbit-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpRight className="h-4 w-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Contas a pagar</h3>
            <Badge variant="outline" className="ml-auto text-xs bg-destructive/10 text-destructive border-destructive/20">{payables.length}</Badge>
          </div>
          <div className="space-y-2">
            {payables.map(t => {
              const StatusIcon = statusIcons[t.status];
              return (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon className={`h-4 w-4 shrink-0 ${t.status === "Pendente" ? "text-amber-400" : "text-primary"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.description}</p>
                      <p className="text-xs text-muted-foreground">{t.category} · Venc. {t.dueDate}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-destructive">{fmt(t.value)}</p>
                    <Badge variant="outline" className={`text-[10px] ${statusStyles[t.status]}`}>{t.status}</Badge>
                  </div>
                </div>
              );
            })}
            {payables.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma conta a pagar.</p>}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="orbit-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por descrição ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/50 border-border" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {statusList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            {typeList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px] bg-muted/50 border-border"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortAsc(!sortAsc)} className="border-border">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Transactions table */}
      <div className="orbit-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Descrição</TableHead>
              <TableHead className="text-muted-foreground">Cliente</TableHead>
              <TableHead className="text-muted-foreground">Categoria</TableHead>
              <TableHead className="text-muted-foreground">Tipo</TableHead>
              <TableHead className="text-muted-foreground">Vencimento</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground text-right">Valor</TableHead>
              <TableHead className="text-muted-foreground text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(t => (
              <TableRow key={t.id} className="border-border hover:bg-muted/50">
                <TableCell className="font-medium text-foreground">{t.description}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{t.client}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs bg-muted/50 border-border text-muted-foreground">{t.category}</Badge>
                </TableCell>
                <TableCell>
                  <span className={`text-xs font-medium flex items-center gap-1 ${t.type === "Entrada" ? "text-emerald-400" : "text-destructive"}`}>
                    {t.type === "Entrada" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {t.type}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{t.dueDate}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusStyles[t.status]}>{t.status}</Badge>
                </TableCell>
                <TableCell className={`text-right font-bold ${t.type === "Entrada" ? "text-emerald-400" : "text-destructive"}`}>
                  {t.type === "Saída" ? "-" : ""}{fmt(t.value)}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Marcar como pago</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma transação encontrada.</div>
        )}
      </div>

      {/* New Transaction Modal */}
      <NewTransactionDialog open={newTxOpen} onOpenChange={setNewTxOpen} />
    </div>
  );
};

// ---------- New Transaction Dialog ----------
const NewTransactionDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[580px] bg-card border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-foreground">Nova transação</DialogTitle>
        <DialogDescription className="text-muted-foreground">Registre uma nova entrada ou saída financeira.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground">Descrição</Label>
          <Input placeholder="Ex: Projeto de branding" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Cliente vinculado</Label>
          <Select>
            <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {["Acme Corp", "Studio Zen", "Nova Design", "FitTrack", "Café & Arte", "Brand Co", "Nenhum"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Categoria</Label>
          <Select>
            <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Tipo</Label>
          <Select>
            <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {typeList.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Valor (R$)</Label>
          <Input type="number" placeholder="5000" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Data de vencimento</Label>
          <Input type="date" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Data de pagamento</Label>
          <Input type="date" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Status</Label>
          <Select>
            <SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {statusList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch id="recorrente" />
          <Label htmlFor="recorrente" className="text-sm text-muted-foreground">Recorrente</Label>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground">Observações</Label>
          <Textarea placeholder="Notas adicionais..." className="bg-muted/50 border-border min-h-[70px]" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button className="orbit-gradient text-white border-0" onClick={() => onOpenChange(false)}>Salvar transação</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default Financeiro;
