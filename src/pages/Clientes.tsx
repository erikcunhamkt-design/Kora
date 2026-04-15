import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const clients = [
  { name: "Acme Corp", email: "contato@acme.com", status: "Ativo", projects: 3, total: "R$ 24.500" },
  { name: "Studio Zen", email: "hello@studiozen.com", status: "Ativo", projects: 2, total: "R$ 15.200" },
  { name: "Nova Design", email: "info@novadesign.com", status: "Ativo", projects: 1, total: "R$ 8.000" },
  { name: "Tech Solutions", email: "contato@techsol.com", status: "Lead", projects: 0, total: "R$ 0" },
  { name: "Brand Co", email: "hi@brandco.com", status: "Inativo", projects: 4, total: "R$ 32.000" },
  { name: "StartUp X", email: "team@startupx.io", status: "Lead", projects: 0, total: "R$ 0" },
  { name: "FitTrack", email: "dev@fittrack.app", status: "Ativo", projects: 1, total: "R$ 12.000" },
];

const statusStyle: Record<string, string> = {
  Ativo: "bg-emerald-400/10 text-emerald-400 border-emerald-400/20",
  Inativo: "bg-red-400/10 text-red-400 border-red-400/20",
  Lead: "bg-amber-400/10 text-amber-400 border-amber-400/20",
};

const Clientes = () => (
  <div className="space-y-6">
    <div className="orbit-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">Nome</TableHead>
            <TableHead className="text-muted-foreground">Email</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Projetos</TableHead>
            <TableHead className="text-muted-foreground text-right">Valor Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((c, i) => (
            <TableRow key={i} className="border-border hover:bg-muted/50">
              <TableCell className="font-medium text-foreground">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">{c.email}</TableCell>
              <TableCell>
                <Badge variant="outline" className={statusStyle[c.status]}>{c.status}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">{c.projects}</TableCell>
              <TableCell className="text-right font-medium text-foreground">{c.total}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

export default Clientes;
