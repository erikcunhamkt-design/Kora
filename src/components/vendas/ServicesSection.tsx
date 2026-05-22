import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Briefcase, DollarSign, Plus, Search, X, Package } from "lucide-react";
import { useServices, type BillingType, type Service } from "@/hooks/useServices";

const BRL = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const BILLING_OPTIONS: BillingType[] = ["único", "mensal", "recorrente", "personalizado"];

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-zinc-800 bg-[#080808] ${className}`}>{children}</div>;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="text-amber-400 [&_svg]:h-5 [&_svg]:w-5">{icon}</div>
      <div>
        <div className="text-xs uppercase tracking-wide text-blue-200">{label}</div>
        <div className="text-xl font-black text-white">{value}</div>
      </div>
    </Card>
  );
}

export function ServicesSection() {
  const { services, addService, toggleActive } = useServices();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modalOpen, setModalOpen] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(services.map((s) => s.category).filter(Boolean))),
    [services]
  );

  const filtered = services.filter((s) => {
    const q = query.trim().toLowerCase();
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || s.category === categoryFilter;
    const matchStatus =
      statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchQ && matchCat && matchStatus;
  });

  const active = services.filter((s) => s.active);
  const monthlyRevenue = active
    .filter((s) => s.billingType === "mensal" || s.billingType === "recorrente")
    .reduce((sum, s) => sum + s.price, 0);
  const ticket = active.length ? active.reduce((sum, s) => sum + s.price, 0) / active.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Serviços</h1>
          <p className="text-blue-200">Catálogo de ofertas e pacotes do seu estúdio.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl border border-white px-4 py-2 text-sm font-bold text-amber-400 hover:bg-white hover:text-black transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Novo serviço
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Briefcase />} label="Cadastrados" value={String(services.length)} />
        <Metric icon={<Package />} label="Ativos" value={String(active.length)} />
        <Metric icon={<DollarSign />} label="Receita potencial mensal" value={BRL(monthlyRevenue)} />
        <Metric icon={<DollarSign />} label="Ticket médio" value={BRL(ticket)} />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou categoria..."
              className="w-full rounded-xl border border-zinc-800 bg-black py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
          >
            <option value="all">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-xl border border-zinc-800 bg-black px-3 py-2.5 text-sm text-white focus:border-amber-400 focus:outline-none"
          >
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-zinc-500">Nenhum serviço encontrado.</Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard key={s.id} service={s} onToggle={() => toggleActive(s.id)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <NewServiceModal
          onClose={() => setModalOpen(false)}
          onSave={(data) => {
            addService(data);
            toast.success("Serviço criado");
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ServiceCard({ service, onToggle }: { service: Service; onToggle: () => void }) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-black text-white">{service.name}</div>
          <div className="text-xs text-blue-200">{service.category || "Sem categoria"}</div>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            service.active ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-800 text-zinc-400"
          }`}
        >
          {service.active ? "Ativo" : "Inativo"}
        </span>
      </div>
      {service.description && (
        <p className="text-xs text-zinc-400 line-clamp-2">{service.description}</p>
      )}
      <div className="flex items-end justify-between pt-2 border-t border-zinc-800">
        <div>
          <div className="text-lg font-black text-amber-400">{BRL(service.price)}</div>
          <div className="text-[10px] uppercase text-blue-200">
            {service.billingType} · {service.deliveryDays}d
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-bold text-white hover:border-amber-400 hover:text-amber-400 transition"
        >
          {service.active ? "Desativar" : "Ativar"}
        </button>
      </div>
    </Card>
  );
}

function NewServiceModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: Omit<Service, "id" | "isDemo">) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [billingType, setBillingType] = useState<BillingType>("único");
  const [deliveryDays, setDeliveryDays] = useState("15");
  const [active, setActive] = useState(true);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome do serviço");
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) return toast.error("Informe um preço maior que zero");
    onSave({
      name: name.trim(),
      category: category.trim(),
      description: description.trim(),
      price: priceNum,
      billingType,
      deliveryDays: Number(deliveryDays) || 0,
      active,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-xl overflow-auto rounded-[28px] border border-zinc-800 bg-[#101012] p-8 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black">Novo serviço</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-zinc-500 hover:text-white" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nome*">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Landing Page"
              maxLength={80}
              className="modal-input"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Categoria">
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Branding, Web, Vídeo..."
                maxLength={40}
                className="modal-input"
              />
            </Field>
            <Field label="Preço (R$)*">
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                type="number"
                min={0}
                step={50}
                placeholder="1500"
                className="modal-input"
              />
            </Field>
          </div>
          <Field label="Descrição">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={300}
              placeholder="O que está incluso no serviço..."
              className="modal-input resize-none"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tipo de cobrança">
              <select
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as BillingType)}
                className="modal-input"
              >
                {BILLING_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </Field>
            <Field label="Prazo (dias)">
              <input
                value={deliveryDays}
                onChange={(e) => setDeliveryDays(e.target.value)}
                type="number"
                min={0}
                className="modal-input"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-blue-200">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 accent-amber-400"
            />
            Serviço ativo no catálogo
          </label>
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
              Salvar serviço
            </button>
          </div>
        </form>
        <style>{`
          .modal-input {
            width: 100%;
            border-radius: 12px;
            border: 1px solid hsl(0 0% 15%);
            background: #000;
            padding: 10px 14px;
            font-size: 0.875rem;
            color: white;
            outline: none;
          }
          .modal-input:focus { border-color: #fbbf24; }
          .modal-input::placeholder { color: #71717a; }
        `}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase text-amber-400">{label}</label>
      {children}
    </div>
  );
}
