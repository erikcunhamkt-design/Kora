import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Plus, Search, Trophy, Users, Briefcase, LayoutGrid, Target, Calendar,
  DollarSign, AlertTriangle, Clock, X, Upload, Zap, Send, Package, UserPlus,
  StickyNote, ClipboardList, FileText,
} from "lucide-react";
import { ServicesSection } from "@/components/vendas/ServicesSection";
import { QuotesSection } from "@/components/vendas/QuotesSection";


export type ProspectStage =
  | "Prospectar" | "Abordar" | "Não Respondeu" | "Oferta Feita" | "Pensando" | "Não Quis";

export type Prospect = {
  id: string;
  createdAt: string;
  name: string;
  company?: string;
  whatsapp?: string;
  niche?: string;
  service?: string;
  status: ProspectStage;
};

type QuickAddProspectPayload = Omit<Prospect, "id" | "createdAt">;

type SalesTab = "home" | "prospects" | "servicos" | "orcamentos" | "clientes" | "ranking" | "demandas";

const prospectStages = ["Prospectar", "Abordar", "Não Respondeu", "Oferta Feita", "Pensando", "Não Quis"];
const demandPipeline = ["Rascunho", "Aprovação Copy", "Copy Aprovado", "Aprovação Post", "Aprovado", "Agendado", "Postado"];

const tabs: { id: SalesTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "home", label: "Home", icon: LayoutGrid },
  { id: "prospects", label: "Prospects", icon: Users },
  { id: "servicos", label: "Catálogo", icon: Briefcase },
  { id: "orcamentos", label: "Orçamentos", icon: FileText },
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "ranking", label: "Ranking", icon: Trophy },
  { id: "demandas", label: "Demandas", icon: Calendar },
];

const tabAliases: Record<string, SalesTab> = {
  catalogo: "servicos",
  servicos: "servicos",
  produtos: "servicos",
  planos: "servicos",
  checkout: "servicos",
  orcamentos: "orcamentos",
  prospects: "prospects",
  clientes: "clientes",
  ranking: "ranking",
  demandas: "demandas",
  home: "home",
};

export default function Vendas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (tabAliases[searchParams.get("tab") ?? ""] ?? "home") as SalesTab;
  const [activeTab, setActiveTab] = useState<SalesTab>(initialTab);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newProspectOpen, setNewProspectOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);

  useEffect(() => {
    const t = tabAliases[searchParams.get("tab") ?? ""];
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeTab = (id: SalesTab) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === "home") next.delete("tab");
    else next.set("tab", id);
    setSearchParams(next, { replace: true });
  };


  const addProspect = (prospect: QuickAddProspectPayload) => {
    const newProspect: Prospect = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...prospect,
    };
    setProspects((current) => [newProspect, ...current]);
    toast.success(`${newProspect.name} adicionado`);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "home": return <SalesHome />;
      case "prospects": return <ProspectsPage prospects={prospects} onQuickAdd={() => setQuickAddOpen(true)} onNewProspect={() => setNewProspectOpen(true)} />;
      case "servicos": return <ServicesSection />;
      case "orcamentos": return <QuotesSection />;
      case "clientes": return <ClientsPage onNewClient={() => setNewClientOpen(true)} />;
      case "ranking": return <RankingPage />;
      case "demandas": return <DemandCenter onNewNote={() => setNoteOpen(true)} />;
      default: return <SalesHome />;
    }
  };

  return (
    <div className="min-h-full -m-6 bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="flex flex-col gap-3 px-6 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground/60">
                Comercial / Vendas & Catálogo
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Target className="h-4 w-4 text-primary" />
                <h1 className="text-base font-bold text-foreground">Vendas & Catálogo Comercial</h1>
              </div>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Prospects, serviços, produtos, planos, checkout e orçamentos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewProspectOpen(true)}
              className="rounded-full border border-primary/60 bg-primary/10 px-5 py-2 text-sm font-bold text-primary hover:bg-primary/20 transition shrink-0"
            >
              + Novo Prospect
            </button>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => changeTab(id)}
                className={[
                  "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition whitespace-nowrap",
                  activeTab === id
                    ? "border border-primary/60 bg-primary/10 text-primary"
                    : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">{renderActiveTab()}</main>



      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} onAddProspect={addProspect} />}
      {newProspectOpen && <NewProspectModal onClose={() => setNewProspectOpen(false)} />}
      {newServiceOpen && <NewServiceModal onClose={() => setNewServiceOpen(false)} />}
      {newClientOpen && <NewClientModal onClose={() => setNewClientOpen(false)} />}
      {noteOpen && <NoteModal onClose={() => setNoteOpen(false)} />}
    </div>
  );
}

function SalesCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-[#080808] ${className}`}>{children}</div>;
}

function MetricPill({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black px-4 py-3">
      <div className="text-amber-400 [&_svg]:h-4 [&_svg]:w-4">{icon}</div>
      <div>
        <div className="text-xl font-black">{value}</div>
        <div className="text-xs text-blue-200">{label}</div>
      </div>
    </div>
  );
}

function SalesHome() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <SalesCard className="border-white p-8">
        <h1 className="text-3xl font-black">Boa tarde, Erik!</h1>
        <p className="mt-2 text-lg text-blue-200">Você tem 1 missão para hoje.</p>
        <div className="mt-6 flex flex-wrap gap-4">
          <MetricPill icon={<UserPlus />} value="1" label="prospects" />
          <MetricPill icon={<Send />} value="0" label="mensagens" />
          <MetricPill icon={<Target />} value="1" label="ativos" />
        </div>
      </SalesCard>

      <div className="flex items-center gap-4">
        <div className="h-3 flex-1 rounded-full bg-zinc-900">
          <div className="h-3 w-1/6 rounded-full bg-amber-400" />
        </div>
        <span className="text-blue-200">0/1 completas</span>
      </div>

      <section>
        <h2 className="mb-4 flex items-center gap-2 font-black text-amber-400">
          <Target className="h-4 w-4" /> META DO DIA
        </h2>
        <SalesCard className="border-white p-6">
          <div className="flex items-center gap-5">
            <div className="rounded-2xl border border-white p-4"><Target className="h-5 w-5 text-amber-400" /></div>
            <div className="flex-1">
              <h3 className="font-black">Adicionar prospects (1/5)</h3>
              <p className="text-blue-200">Faltam 4 para bater a meta.</p>
            </div>
          </div>
        </SalesCard>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <SalesCard className="p-5">
          <div className="flex items-center gap-2 text-amber-400"><Zap className="h-4 w-4" /><span className="font-black text-xs uppercase">Ações rápidas</span></div>
          <p className="mt-3 text-sm text-blue-200">Crie um prospect em 5 segundos.</p>
        </SalesCard>
        <SalesCard className="p-5">
          <div className="flex items-center gap-2 text-amber-400"><Clock className="h-4 w-4" /><span className="font-black text-xs uppercase">Follow-ups</span></div>
          <p className="mt-3 text-sm text-blue-200">Nenhum pendente.</p>
        </SalesCard>
        <SalesCard className="p-5">
          <div className="flex items-center gap-2 text-amber-400"><DollarSign className="h-4 w-4" /><span className="font-black text-xs uppercase">Pipeline</span></div>
          <p className="mt-3 text-sm text-blue-200">R$ 0,00 em negociação.</p>
        </SalesCard>
      </section>
    </div>
  );
}

function ProspectsPage({ prospects, onQuickAdd, onNewProspect }: { prospects: Prospect[]; onQuickAdd: () => void; onNewProspect: () => void }) {
  const [view, setView] = useState<"pipeline" | "lista">("pipeline");
  const [query, setQuery] = useState("");

  const filtered = prospects.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [p.name, p.company, p.niche, p.whatsapp].filter(Boolean).some((v) => v!.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Prospects</h1>
          <p className="text-blue-200">Gerencie seu pipeline de prospecção.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView(view === "pipeline" ? "lista" : "pipeline")}
            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-bold text-white hover:border-amber-400 hover:text-amber-400 transition flex items-center gap-2"
          >
            <LayoutGrid className="h-4 w-4" /> {view === "pipeline" ? "Ver lista" : "Pipeline"}
          </button>
          <button type="button" onClick={onQuickAdd} className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-bold text-white hover:border-amber-400 hover:text-amber-400 transition flex items-center gap-2">
            <Zap className="h-4 w-4" /> Adição rápida
          </button>
          <button type="button" onClick={onNewProspect} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar prospect..."
          className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {view === "pipeline" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {prospectStages.map((stage) => {
            const items = filtered.filter((p) => p.status === stage);
            return (
              <SalesCard key={stage} className="p-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <span className="text-xs font-black uppercase text-amber-400">{stage}</span>
                  <span className="text-xs text-blue-200">{items.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-xs text-zinc-500">Sem prospects nesta etapa.</div>
                  ) : (
                    items.map((p) => (
                      <div key={p.id} className="rounded-xl border border-zinc-800 bg-black p-3">
                        <div className="text-sm font-bold text-white">{p.name}</div>
                        {p.company && <div className="text-xs text-blue-200">{p.company}</div>}
                        {p.whatsapp && <div className="mt-1 text-xs text-zinc-500">{p.whatsapp}</div>}
                      </div>
                    ))
                  )}
                </div>
              </SalesCard>
            );
          })}
        </div>
      ) : filtered.length === 0 ? (
        <SalesCard className="p-6 text-sm text-zinc-500">Nenhum prospect cadastrado.</SalesCard>
      ) : (
        <SalesCard className="divide-y divide-zinc-800">
          {filtered.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-blue-200">{[p.company, p.niche].filter(Boolean).join(" · ")}</div>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                {p.whatsapp && <span>{p.whatsapp}</span>}
                <span className="rounded-full border border-zinc-800 px-3 py-1 text-amber-400">{p.status}</span>
              </div>
            </div>
          ))}
        </SalesCard>
      )}
    </div>
  );
}


function ServicesPage({ onNewService }: { onNewService: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Serviços</h1>
          <p className="text-blue-200">Catálogo de ofertas e pacotes.</p>
        </div>
        <button type="button" onClick={onNewService} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Serviço
        </button>
      </div>
      <SalesCard className="p-10 text-center">
        <Package className="mx-auto h-10 w-10 text-amber-400" />
        <h2 className="mt-4 text-xl font-black">Nenhum serviço cadastrado</h2>
        <p className="mt-1 text-sm text-blue-200">Comece criando seu primeiro serviço para vender.</p>
        <button
          type="button"
          onClick={onNewService}
          className="mt-6 rounded-xl border border-white px-5 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition"
        >
          Criar primeiro serviço
        </button>
      </SalesCard>
    </div>
  );
}

function ClientsPage({ onNewClient }: { onNewClient: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Clientes</h1>
          <p className="text-blue-200">Base ativa de clientes.</p>
        </div>
        <button type="button" onClick={onNewClient} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Cliente
        </button>
      </div>
      <SalesCard className="p-10 text-center">
        <Users className="mx-auto h-10 w-10 text-amber-400" />
        <h2 className="mt-4 text-xl font-black">Nenhum cliente cadastrado</h2>
        <p className="mt-1 text-sm text-blue-200">Cadastre seu primeiro cliente para começar.</p>
        <button
          type="button"
          onClick={onNewClient}
          className="mt-6 rounded-xl border border-white px-5 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition"
        >
          Cadastrar primeiro cliente
        </button>
      </SalesCard>
    </div>
  );
}

function RankingPage() {
  const players = [
    { name: "Erik", points: 1240 },
    { name: "Marina", points: 980 },
    { name: "Lucas", points: 760 },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Ranking</h1>
        <p className="text-blue-200">Pontuação da equipe no mês.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {players.map((p, i) => (
          <SalesCard key={p.name} className={i === 0 ? "border-amber-400 p-6" : "p-6"}>
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${i === 0 ? "border-amber-400 text-amber-400" : "border-zinc-800 text-blue-200"}`}>
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase text-blue-200">#{i + 1}</div>
                <div className="font-black">{p.name}</div>
                <div className="text-sm text-amber-400">{p.points} pts</div>
              </div>
            </div>
          </SalesCard>
        ))}
      </div>
    </div>
  );
}

function DemandCenter({ onNewNote }: { onNewNote: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Central de Demandas</h1>
          <p className="text-blue-200">Pipeline de entregáveis e aprovações.</p>
        </div>
        <button type="button" onClick={onNewNote} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nova Nota
        </button>
      </div>

      <button
        type="button"
        onClick={onNewNote}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 bg-transparent px-4 py-6 text-sm font-bold text-blue-200 hover:border-amber-400 hover:text-amber-400 transition"
      >
        <StickyNote className="h-4 w-4" /> Adicionar nota
      </button>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {demandPipeline.map((stage) => (
          <SalesCard key={stage} className="w-64 shrink-0 p-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-black uppercase text-amber-400">{stage}</span>
              <span className="text-xs text-blue-200">0</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
              <AlertTriangle className="h-3 w-3" /> Sem demandas
            </div>
          </SalesCard>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Modals ---------------- */

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-xl overflow-auto rounded-[28px] border border-zinc-800 bg-[#101012] p-8 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase text-amber-400">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
      />
    </div>
  );
}

function ModalActions({ onClose, submitLabel }: { onClose: () => void; submitLabel: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm font-bold text-white hover:border-amber-400 hover:text-amber-400 transition"
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="flex-1 rounded-xl border border-white px-4 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function useSubmit(onClose: () => void, message: string) {
  return (event: FormEvent) => {
    event.preventDefault();
    toast.success(message);
    onClose();
  };
}

function QuickAddModal({
  onClose,
  onAddProspect,
}: {
  onClose: () => void;
  onAddProspect: (prospect: QuickAddProspectPayload) => void;
}) {
  const [mode, setMode] = useState<"single" | "paste">("single");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [niche, setNiche] = useState("");
  const [service, setService] = useState("Artes para Redes Sociais");
  const [listText, setListText] = useState("");

  function resetSingleForm() {
    setName("");
    setCompany("");
    setWhatsapp("");
    setNiche("");
    setService("Artes para Redes Sociais");
  }

  function handleSingleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    onAddProspect({
      name: name.trim(),
      company: company.trim(),
      whatsapp: whatsapp.trim(),
      niche: niche.trim(),
      service: service.trim() || "Artes para Redes Sociais",
      status: "Prospectar",
    });
    resetSingleForm();
  }

  function parseLineToProspect(line: string): QuickAddProspectPayload | null {
    const cleanLine = line.trim();
    if (!cleanLine) return null;
    const parts = cleanLine.split(/[-–—,;]/).map((p) => p.trim()).filter(Boolean);
    const firstPart = parts[0] || cleanLine;
    const phoneMatch = cleanLine.match(/(\+?\d[\d\s().-]{7,}\d)/);
    return {
      name: firstPart,
      company: parts[1] || "",
      whatsapp: phoneMatch?.[0] || "",
      niche: parts[2] || "",
      service: service.trim() || "Artes para Redes Sociais",
      status: "Prospectar",
    };
  }

  function handlePasteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prospects = listText
      .split("\n")
      .map(parseLineToProspect)
      .filter(Boolean) as QuickAddProspectPayload[];
    prospects.forEach(onAddProspect);
    setListText("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="relative w-full max-w-[520px] rounded-[28px] border border-zinc-800 bg-[#101012] p-7 text-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white text-amber-400">
              <Zap className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-black">Adição Rápida</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-900 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl border border-zinc-800 bg-[#141416] p-1">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={[
              "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition",
              mode === "single" ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            <Zap className="h-4 w-4" />
            Um por um
          </button>
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={[
              "flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold transition",
              mode === "paste" ? "text-amber-400" : "text-zinc-500 hover:text-zinc-300",
            ].join(" ")}
          >
            <ClipboardList className="h-4 w-4" />
            Colar lista
          </button>
        </div>

        {mode === "single" ? (
          <form onSubmit={handleSingleSubmit} className="space-y-5">
            <QuickField label="Nome *">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                className="h-11 w-full rounded-xl border border-amber-500 bg-[#1a1a1d] px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
              />
            </QuickField>
            <QuickField label="Empresa">
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Ex: Barbearia do João"
                className="h-11 w-full rounded-xl border border-zinc-700 bg-[#1a1a1d] px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
              />
            </QuickField>
            <div className="grid grid-cols-2 gap-3">
              <QuickField label="WhatsApp">
                <input
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="55 11 999999999"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-[#1a1a1d] px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
                />
              </QuickField>
              <QuickField label="Nicho">
                <input
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  placeholder="Barbearia"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-[#1a1a1d] px-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
                />
              </QuickField>
            </div>
            <QuickField label="O que vai ofertar?">
              <input
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="Artes para Redes Sociais"
                className="h-11 w-full rounded-xl border border-zinc-700 bg-[#1a1a1d] px-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
              />
            </QuickField>
            <button
              type="submit"
              disabled={!name.trim()}
              className="mt-2 h-12 w-full rounded-xl bg-[#805209] text-sm font-black text-white transition hover:bg-amber-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Adicionar e próximo ↵
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasteSubmit} className="space-y-5">
            <QuickField label="Cole sua lista aqui (qualquer formato)">
              <textarea
                autoFocus
                value={listText}
                onChange={(e) => setListText(e.target.value)}
                placeholder={"João Silva - 11999887766 - Barbearia do João\nMaria, estética, 11988776655\nPedro — restaurante — 11977665544"}
                className="min-h-[150px] w-full resize-none rounded-xl border border-zinc-700 bg-[#1a1a1d] px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-400"
              />
            </QuickField>
            <button
              type="submit"
              disabled={!listText.trim()}
              className="h-12 w-full rounded-xl bg-[#805209] text-sm font-black text-white transition hover:bg-amber-500 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Importar lista
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function QuickField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase text-zinc-500">{label}</span>
      {children}
    </label>
  );
}


function NewProspectModal({ onClose }: { onClose: () => void }) {
  const handleSubmit = useSubmit(onClose, "Prospect criado");
  const [origem, setOrigem] = useState<"Local" | "Internet" | "Indicação">("Local");
  const [temperatura, setTemperatura] = useState<"Frio" | "Morno" | "Quente">("Frio");

  const segBtn = (active: boolean) =>
    [
      "rounded-xl px-5 py-2 text-xs font-black uppercase transition",
      active ? "border border-white text-amber-400" : "border border-zinc-800 text-zinc-400 hover:text-white",
    ].join(" ");

  return (
    <ModalShell title="Novo Prospect" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <FormField label="Primeiro Nome *" placeholder="Ex: João" />

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-amber-400">Origem *</label>
          <div className="flex gap-2">
            {(["Local", "Internet", "Indicação"] as const).map((o) => (
              <button key={o} type="button" onClick={() => setOrigem(o)} className={segBtn(origem === o)}>
                {o}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-amber-400">Tipo de Serviço a Ofertar *</label>
          <select className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none">
            <option>Artes para Redes Sociais</option>
            <option>Identidade Visual</option>
            <option>Landing Page</option>
            <option>Gestão de Tráfego</option>
            <option>Outro</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Empresa" placeholder="Ex: Barbearia X" />
          <FormField label="Nicho" placeholder="Ex: Estética" />
        </div>

        <FormField label="Cidade" placeholder="Ex: Campinas" />

        <div className="grid grid-cols-2 gap-4">
          <FormField label="WhatsApp" placeholder="55 11 999999999" />
          <FormField label="Instagram" placeholder="sem o @" />
        </div>

        <FormField label="E-mail" type="email" placeholder="email@exemplo.com" />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-amber-400">Nível do Cliente</label>
            <select className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none">
              <option>Pequeno</option>
              <option>Médio</option>
              <option>Grande</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-amber-400">Temperatura</label>
            <div className="flex gap-2">
              {(["Frio", "Morno", "Quente"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTemperatura(t)} className={segBtn(temperatura === t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase text-amber-400">Serviço de Interesse</label>
            <select className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none">
              <option>Nenhum</option>
              <option>Artes para Redes Sociais</option>
              <option>Identidade Visual</option>
              <option>Landing Page</option>
            </select>
          </div>
          <FormField label="Valor Estimado (R$)" type="number" placeholder="0.00" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase text-amber-400">Anotações</label>
          <textarea
            rows={3}
            placeholder="Notas sobre esse prospect..."
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm font-bold text-white hover:border-amber-400 hover:text-amber-400 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-black uppercase text-black hover:bg-amber-400 transition"
          >
            Adicionar
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function NewServiceModal({ onClose }: { onClose: () => void }) {
  const handleSubmit = useSubmit(onClose, "Serviço criado");
  return (
    <ModalShell title="Novo Serviço" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome do Serviço" />
        <FormField label="Preço" type="number" placeholder="0,00" />
        <FormField label="Descrição" />
        <ModalActions onClose={onClose} submitLabel="Criar Serviço" />
      </form>
    </ModalShell>
  );
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  const handleSubmit = useSubmit(onClose, "Cliente cadastrado");
  return (
    <ModalShell title="Novo Cliente" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Nome" />
        <FormField label="Email" type="email" />
        <FormField label="Telefone" />
        <ModalActions onClose={onClose} submitLabel="Cadastrar Cliente" />
      </form>
    </ModalShell>
  );
}

function NoteModal({ onClose }: { onClose: () => void }) {
  const handleSubmit = useSubmit(onClose, "Nota salva");
  return (
    <ModalShell title="Nova Nota" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormField label="Título" />
        <textarea
          placeholder="Conteúdo da nota..."
          rows={5}
          className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
        />
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm font-bold text-white hover:border-amber-400 hover:text-amber-400 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white px-4 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition"
          >
            <Upload className="h-4 w-4" /> Salvar Nota
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
