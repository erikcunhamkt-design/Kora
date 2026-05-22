import { useState } from "react";
import {
  Plus, Search, Trophy, Users, Briefcase, LayoutGrid, Target, Calendar,
  DollarSign, AlertTriangle, Clock, ArrowRight, X, Upload, Zap, Send,
  Package, UserPlus,
} from "lucide-react";

type SalesTab = "home" | "prospects" | "servicos" | "clientes" | "ranking" | "demandas";

const prospectStages = ["Prospectar", "Abordar", "Não Respondeu", "Oferta Feita", "Pensando", "Não Quis"];
const demandPipeline = ["Rascunho", "Aprovação Copy", "Copy Aprovado", "Aprovação Post", "Aprovado", "Agendado", "Postado"];

export default function Vendas() {
  const [tab, setTab] = useState<SalesTab>("home");
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newProspectOpen, setNewProspectOpen] = useState(false);
  const [newServiceOpen, setNewServiceOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <div className="min-h-screen -m-6 bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/90 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 font-bold">
              <Target className="h-4 w-4 text-amber-400" />
              Vendas
            </div>
          </div>
          <nav className="flex items-center gap-1">
            <SalesNavButton active={tab === "home"} onClick={() => setTab("home")}><LayoutGrid className="h-4 w-4" />Home</SalesNavButton>
            <SalesNavButton active={tab === "prospects"} onClick={() => setTab("prospects")}><Users className="h-4 w-4" />Prospects</SalesNavButton>
            <SalesNavButton active={tab === "servicos"} onClick={() => setTab("servicos")}><Briefcase className="h-4 w-4" />Serviços</SalesNavButton>
            <SalesNavButton active={tab === "clientes"} onClick={() => setTab("clientes")}><Users className="h-4 w-4" />Clientes</SalesNavButton>
            <SalesNavButton active={tab === "ranking"} onClick={() => setTab("ranking")}><Trophy className="h-4 w-4" />Ranking</SalesNavButton>
            <SalesNavButton active={tab === "demandas"} onClick={() => setTab("demandas")}><Calendar className="h-4 w-4" />Demandas</SalesNavButton>
          </nav>
          <button
            onClick={() => setNewProspectOpen(true)}
            className="rounded-full border border-white px-5 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition"
          >
            + Novo Prospect
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {tab === "home" && <SalesHome />}
        {tab === "prospects" && <ProspectsPage onQuickAdd={() => setQuickAddOpen(true)} onNewProspect={() => setNewProspectOpen(true)} />}
        {tab === "servicos" && <ServicesPage onNewService={() => setNewServiceOpen(true)} />}
        {tab === "clientes" && <ClientsPage onNewClient={() => setNewClientOpen(true)} />}
        {tab === "ranking" && <RankingPage />}
        {tab === "demandas" && <DemandCenter onNewNote={() => setNoteOpen(true)} />}
      </main>

      {quickAddOpen && <ModalShell title="Adicionar Rápido" onClose={() => setQuickAddOpen(false)}><p className="text-blue-200">Em breve.</p></ModalShell>}
      {newProspectOpen && <NewProspectModal onClose={() => setNewProspectOpen(false)} />}
      {newServiceOpen && <NewServiceModal onClose={() => setNewServiceOpen(false)} />}
      {newClientOpen && <NewClientModal onClose={() => setNewClientOpen(false)} />}
      {noteOpen && <NoteModal onClose={() => setNoteOpen(false)} />}
    </div>
  );
}

function SalesNavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition",
        active ? "border border-white text-amber-400" : "text-zinc-500 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SalesCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-[#080808] ${className}`}>{children}</div>;
}

function MetricPill({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
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
          <Target className="h-4 w-4" />
          META DO DIA
        </h2>
        <SalesCard className="border-white p-6">
          <div className="flex items-center gap-5">
            <div className="rounded-2xl border border-white p-4"><Target className="h-5 w-5 text-amber-400" /></div>
            <div className="flex-1">
              <h3 className="font-black">Adicionar prospects (1/5)</h3>
              <p className="text-blue-200">Faltam 4 para bater a meta.</p>
              <div className="mt-5 flex gap-2">
                <button className="rounded-xl border border-white px-5 py-2 font-black text-amber-400 hover:bg-white hover:text-black transition">
                  ADICIONAR →
                </button>
              </div>
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

function ProspectsPage({ onQuickAdd, onNewProspect }: { onQuickAdd: () => void; onNewProspect: () => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">Prospects</h1>
          <p className="text-blue-200">Gerencie seu pipeline de prospecção.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onQuickAdd} className="rounded-xl border border-zinc-800 px-4 py-2 text-sm font-bold text-white hover:border-amber-400 hover:text-amber-400 transition flex items-center gap-2">
            <Zap className="h-4 w-4" /> Rápido
          </button>
          <button onClick={onNewProspect} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo Prospect
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          placeholder="Buscar prospect..."
          className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {prospectStages.map((stage) => (
          <SalesCard key={stage} className="p-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-xs font-black uppercase text-amber-400">{stage}</span>
              <span className="text-xs text-blue-200">0</span>
            </div>
            <div className="mt-4 text-xs text-zinc-500">Sem prospects nesta etapa.</div>
          </SalesCard>
        ))}
      </div>
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
        <button onClick={onNewService} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Serviço
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <SalesCard key={i} className="p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-zinc-800 p-2"><Package className="h-4 w-4 text-amber-400" /></div>
              <div>
                <h3 className="font-black">Serviço {i}</h3>
                <p className="text-xs text-blue-200">A partir de R$ 0,00</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-zinc-400">Descrição curta do serviço.</p>
          </SalesCard>
        ))}
      </div>
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
        <button onClick={onNewClient} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> Novo Cliente
        </button>
      </div>
      <SalesCard className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 text-left text-xs uppercase text-amber-400">
            <tr>
              <th className="px-5 py-3 font-black">Cliente</th>
              <th className="px-5 py-3 font-black">Contato</th>
              <th className="px-5 py-3 font-black">Status</th>
              <th className="px-5 py-3 font-black">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-900">
              <td className="px-5 py-4 text-zinc-500" colSpan={4}>Nenhum cliente cadastrado.</td>
            </tr>
          </tbody>
        </table>
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
        <button onClick={onNewNote} className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2">
          <Plus className="h-4 w-4" /> Nova Nota
        </button>
      </div>
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

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#080808] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-white"><X className="h-4 w-4" /></button>
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

function NewProspectModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Novo Prospect" onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Nome" placeholder="Nome do prospect" />
        <FormField label="Contato" placeholder="@instagram ou telefone" />
        <FormField label="Origem" placeholder="Indicação, anúncio, etc." />
        <button className="w-full rounded-xl border border-white px-4 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition">
          Adicionar Prospect
        </button>
      </div>
    </ModalShell>
  );
}

function NewServiceModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Novo Serviço" onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Nome do Serviço" />
        <FormField label="Preço" type="number" placeholder="0,00" />
        <FormField label="Descrição" />
        <button className="w-full rounded-xl border border-white px-4 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition">
          Criar Serviço
        </button>
      </div>
    </ModalShell>
  );
}

function NewClientModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Novo Cliente" onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Nome" />
        <FormField label="Email" type="email" />
        <FormField label="Telefone" />
        <button className="w-full rounded-xl border border-white px-4 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition">
          Cadastrar Cliente
        </button>
      </div>
    </ModalShell>
  );
}

function NoteModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Nova Nota" onClose={onClose}>
      <div className="space-y-4">
        <FormField label="Título" />
        <textarea
          placeholder="Conteúdo da nota..."
          rows={5}
          className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
        />
        <button className="w-full rounded-xl border border-white px-4 py-2.5 text-sm font-black text-amber-400 hover:bg-white hover:text-black transition flex items-center justify-center gap-2">
          <Upload className="h-4 w-4" /> Salvar Nota
        </button>
      </div>
    </ModalShell>
  );
}
