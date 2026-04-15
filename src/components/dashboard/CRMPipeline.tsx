const columns = [
  {
    title: "Lead", color: "bg-primary", items: [
      { name: "Tech Solutions", value: "R$ 3.500" },
      { name: "StartUp X", value: "R$ 2.800" },
    ]
  },
  {
    title: "Proposta", color: "bg-accent", items: [
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
    <div className="orbit-card p-6 animate-fade-up">
      <h3 className="text-base font-semibold text-foreground mb-1">Pipeline CRM</h3>
      <p className="text-[0.8125rem] text-muted-foreground mb-5">Oportunidades em andamento</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.title} className="space-y-2.5">
            <div className="flex items-center gap-2 mb-3">
              <div className={`h-2 w-2 rounded-full ${col.color}`} />
              <span className="text-[0.8125rem] font-semibold text-muted-foreground uppercase tracking-wider">{col.title}</span>
              <span className="text-[0.8125rem] text-muted-foreground ml-auto bg-muted/60 px-1.5 py-0.5 rounded">{col.items.length}</span>
            </div>
            {col.items.map((item, i) => (
              <div key={i} className="p-3.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-150 border border-transparent hover:border-border/50">
                <p className="text-[0.9375rem] font-medium text-foreground">{item.name}</p>
                <p className="text-[0.8125rem] text-muted-foreground mt-1 font-medium">{item.value}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
