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
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground mb-1">Desempenho Mensal</h3>
      <p className="text-[0.8125rem] text-muted-foreground mb-6">Faturamento dos últimos 6 meses</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="25%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 14% 12%)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "hsl(240 5% 65%)", fontSize: 13, fontWeight: 500 }} axisLine={false} tickLine={false} dy={8} />
            <YAxis tick={{ fill: "hsl(240 5% 65%)", fontSize: 12 }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              cursor={{ fill: "hsl(263 84% 58% / 0.04)", radius: 8 }}
              contentStyle={{
                backgroundColor: "hsl(240 24% 8% / 0.95)",
                backdropFilter: "blur(16px)",
                border: "1px solid hsl(240 14% 18% / 0.6)",
                borderRadius: "12px",
                color: "#fff",
                fontSize: 14,
                boxShadow: "0 8px 32px hsl(0 0% 0% / 0.4), inset 0 1px 0 hsl(0 0% 100% / 0.03)",
                padding: "12px 16px",
              }}
              formatter={(value: number) => [`R$ ${value.toLocaleString("pt-BR")}`, "Faturamento"]}
            />
            <Bar dataKey="valor" fill="url(#chartGradientPremium)" radius={[8, 8, 0, 0]} />
            <defs>
              <linearGradient id="chartGradientPremium" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(263 84% 58%)" />
                <stop offset="100%" stopColor="hsl(263 84% 58% / 0.3)" />
              </linearGradient>
            </defs>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
