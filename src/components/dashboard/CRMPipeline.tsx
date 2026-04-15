const columns = [
  {
    title: "Lead", color: "bg-blue-500", items: [
      { name: "Tech Solutions", value: "R$ 3.500" },
      { name: "StartUp X", value: "R$ 2.800" },
    ]
  },
  {
    title: "Proposta", color: "bg-purple-500", items: [
      { name: "Acme Corp", value: "R$ 8.000" },
    ]
  },
  {
    title: "Negociação", color: "bg-amber-500", items: [
      { name: "Studio Zen", value: "R$ 5.200" },
      { name: "Nova Design", value: "R$ 4.100" },
    ]
  },
  {
    title: "Fechado", color: "bg-emerald-500", items: [
      { name: "Brand Co", value: "R$ 12.000" },
    ]
  },
];

export function CRMPipeline() {
  return (
    <div className="orbit-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-1">Pipeline CRM</h3>
      <p className="text-xs text-muted-foreground mb-4">Oportunidades em andamento</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {columns.map((col) => (
          <div key={col.title} className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-2 w-2 rounded-full ${col.color}`} />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.title}</span>
              <span className="text-xs text-muted-foreground ml-auto">{col.items.length}</span>
            </div>
            {col.items.map((item, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                <p className="text-sm font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.value}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
