import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { month: "Jan", valor: 8200 },
  { month: "Fev", valor: 9100 },
  { month: "Mar", valor: 7800 },
  { month: "Abr", valor: 11200 },
  { month: "Mai", valor: 10500 },
  { month: "Jun", valor: 12450 },
];

export function PerformanceChart() {
  return (
    <div className="orbit-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Desempenho Mensal</h3>
      <p className="text-xs text-muted-foreground mb-4">Faturamento dos últimos 6 meses</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(230 14% 18%)" />
            <XAxis dataKey="month" tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215 20% 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(230 16% 12%)",
                border: "1px solid hsl(230 14% 18%)",
                borderRadius: "8px",
                color: "hsl(210 40% 95%)",
                fontSize: 12,
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Faturamento"]}
            />
            <Bar dataKey="valor" fill="url(#gradient)" radius={[6, 6, 0, 0]} />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(217 91% 60%)" />
                <stop offset="100%" stopColor="hsl(263 70% 58%)" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
