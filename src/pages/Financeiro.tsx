import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const summaryCards = [
  { title: "Receita Total", value: "R$ 12.450", change: "+12% vs mês anterior", changeType: "positive" as const, icon: TrendingUp },
  { title: "Despesas", value: "R$ 3.200", change: "+5% vs mês anterior", changeType: "negative" as const, icon: TrendingDown },
  { title: "Lucro Líquido", value: "R$ 9.250", change: "+15% vs mês anterior", changeType: "positive" as const, icon: DollarSign },
];

const transactions = [
  { desc: "Pagamento - Acme Corp", date: "15 Jun", type: "Receita", value: "R$ 8.000", status: "Recebido" },
  { desc: "Assinatura Adobe CC", date: "12 Jun", type: "Despesa", value: "-R$ 250", status: "Pago" },
  { desc: "Pagamento - FitTrack", date: "10 Jun", type: "Receita", value: "R$ 4.000", status: "Recebido" },
  { desc: "Domínio & Hosting", date: "08 Jun", type: "Despesa", value: "-R$ 150", status: "Pago" },
  { desc: "Pagamento - Studio Zen", date: "05 Jun", type: "Receita", value: "R$ 5.200", status: "Pendente" },
  { desc: "Figma Pro", date: "01 Jun", type: "Despesa", value: "-R$ 75", status: "Pago" },
];

const typeStyle: Record<string, string> = {
  Receita: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  Despesa: "bg-red-400/10 text-red-400 border-red-400/20",
};

const Financeiro = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {summaryCards.map((c) => <MetricCard key={c.title} {...c} />)}
    </div>
    <div className="orbit-card overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Transações Recentes</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Descrição</TableHead>
            <TableHead className="text-muted-foreground">Data</TableHead>
            <TableHead className="text-muted-foreground">Tipo</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t, i) => (
            <TableRow key={i} className="border-border hover:bg-muted/50">
              <TableCell className="font-medium text-foreground">{t.desc}</TableCell>
              <TableCell className="text-muted-foreground">{t.date}</TableCell>
              <TableCell><Badge variant="outline" className={typeStyle[t.type]}>{t.type}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{t.status}</TableCell>
              <TableCell className={`text-right font-semibold ${t.type === "Receita" ? "text-emerald-400" : "text-red-400"}`}>{t.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export default Financeiro;
