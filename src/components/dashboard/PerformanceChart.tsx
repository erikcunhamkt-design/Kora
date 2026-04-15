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
    <div className="orbit-card p-5 animate-fade-up">
      <h3 className="text-sm font-semibold text-foreground mb-0.5">Desempenho Mensal</h3>
      <p className="text-[11px] text-muted-foreground mb-5">Faturamento dos últimos 6 meses</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 14% 14%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(240 5% 65%)", fontSize: 11 }} axisLine={false} tickLine={false} width={45} />
            <Tooltip
              cursor={{ fill: "hsl(263 84% 58% / 0.05)" }}
              contentStyle={{
                backgroundColor: "hsl(240 24% 8%)",
                border: "1px solid hsl(240 14% 14%)",
                borderRadius: "10px",
                color: "#fff",
                fontSize: 12,
                boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4)",
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Faturamento"]}
            />
            <Bar dataKey="valor" fill="url(#chartGradient)" radius={[6, 6, 0, 0]} />
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(263 84% 58%)" />
                <stop offset="100%" stopColor="hsl(263 84% 58% / 0.4)" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
