const stages = [
  {
    title: "Lead", color: "border-blue-500",
    items: [
      { name: "Tech Solutions", value: "R$ 3.500", date: "10 Jun", chance: "30%" },
      { name: "StartUp X", value: "R$ 2.800", date: "08 Jun", chance: "20%" },
      { name: "Digital Labs", value: "R$ 6.000", date: "05 Jun", chance: "40%" },
    ]
  },
  {
    title: "Proposta Enviada", color: "border-purple-500",
    items: [
      { name: "Acme Corp", value: "R$ 8.000", date: "12 Jun", chance: "60%" },
      { name: "Creative Hub", value: "R$ 4.500", date: "09 Jun", chance: "50%" },
    ]
  },
  {
    title: "Negociação", color: "border-amber-500",
    items: [
      { name: "Studio Zen", value: "R$ 5.200", date: "14 Jun", chance: "75%" },
      { name: "Nova Design", value: "R$ 4.100", date: "11 Jun", chance: "70%" },
    ]
  },
  {
    title: "Fechado ✓", color: "border-emerald-500",
    items: [
      { name: "Brand Co", value: "R$ 12.000", date: "15 Jun", chance: "100%" },
    ]
  },
];

const CRM = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {stages.map((stage) => (
        <div key={stage.title} className="space-y-3">
          <div className={`orbit-card p-3 border-t-2 ${stage.color}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{stage.title}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{stage.items.length}</span>
            </div>
          </div>
          {stage.items.map((item, i) => (
            <div key={i} className="orbit-card p-4 hover:orbit-glow transition-all duration-300 cursor-pointer">
              <p className="text-sm font-semibold text-foreground">{item.name}</p>
              <p className="text-lg font-bold text-foreground mt-1">{item.value}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">{item.date}</span>
                <span className="text-xs text-primary font-medium">{item.chance}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export default CRM;
