import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Briefcase, Package, Layers, ShoppingCart, Plus, Search, X, Pencil, Copy, Trash2,
  Tag, Star, DollarSign, TrendingUp, Sparkles, Link2, Archive,
} from "lucide-react";
import { useServices, type BillingType, type Service } from "@/hooks/useServices";
import { useServiceCategories, type ServiceCategory } from "@/hooks/useServiceCategories";
import { useProducts, type Product, type ProductType, type ProductStatus } from "@/hooks/useProducts";
import { useCommercialPlans, type CommercialPlan, type BillingCycle, type PlanItem } from "@/hooks/useCommercialPlans";
import { useCheckoutSettings } from "@/hooks/useCheckoutSettings";
import { useQuotes } from "@/hooks/useQuotes";
import { formatCurrency as intlCurrency } from "@/lib/format";

const BRL = (n: number) =>
  intlCurrency(n, { maximumFractionDigits: 0 });

const BILLING_OPTIONS: BillingType[] = ["único", "mensal", "recorrente", "pacote", "personalizado"];
const PRODUCT_TYPES: ProductType[] = ["digital", "physical", "addon", "template", "consulting"];
const CYCLE_OPTIONS: BillingCycle[] = ["one_time", "monthly", "quarterly", "yearly"];
const CYCLE_LABEL: Record<BillingCycle, string> = {
  one_time: "Único",
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};
const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  digital: "Digital",
  physical: "Físico",
  addon: "Add-on",
  template: "Template",
  consulting: "Consultoria",
};

type CatalogTab = "servicos" | "produtos" | "planos" | "checkout";

const TABS: { id: CatalogTab; label: string; icon: typeof Briefcase }[] = [
  { id: "servicos", label: "Serviços", icon: Briefcase },
  { id: "produtos", label: "Produtos", icon: Package },
  { id: "planos", label: "Planos", icon: Layers },
  { id: "checkout", label: "Checkout", icon: ShoppingCart },
];

/* ============================ Shell ============================ */

export function ServicesSection() {
  const [tab, setTab] = useState<CatalogTab>("servicos");

  return (
    <div className="space-y-6">
      <style>{koraInputStyle}</style>
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Catálogo Comercial
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Organize suas ofertas, pacotes e links comerciais
        </h1>
        <p className="text-sm text-muted-foreground">
          Serviços, produtos, planos e checkout em um único lugar.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={[
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              tab === id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "servicos" && <ServicesTab />}
      {tab === "produtos" && <ProductsTab />}
      {tab === "planos" && <PlansTab />}
      {tab === "checkout" && <CheckoutTab />}
    </div>
  );
}

/* ============================ UI helpers ============================ */

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card text-card-foreground ${className}`}>
      {children}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Panel className="p-4 flex items-center gap-3">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:h-4 [&_svg]:w-4">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
        <div className="text-lg font-bold text-foreground truncate">{value}</div>
      </div>
    </Panel>
  );
}

function EmptyState({
  icon, title, description, action,
}: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <Panel className="p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Panel>
  );
}

function PrimaryBtn({
  onClick, children, type = "button",
}: { onClick?: () => void; children: ReactNode; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-premium"
    >
      {children}
    </button>
  );
}

function GhostBtn({
  onClick, children, type = "button",
}: { onClick?: () => void; children: ReactNode; type?: "button" | "submit" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-transparent px-4 py-2 text-sm font-medium text-foreground hover:border-primary/60 hover:text-primary transition"
    >
      {children}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

function CategoryPill({ cat }: { cat?: ServiceCategory }) {
  if (!cat) return <span className="text-[11px] text-muted-foreground">Sem categoria</span>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-foreground">
      <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
      {cat.name}
    </span>
  );
}

/* ============================ TAB: Serviços ============================ */

function ServicesTab() {
  const { services, addService, updateService, duplicateService, toggleActive, removeService } = useServices();
  const { categories, addCategory, removeCategory } = useServiceCategories();
  const { quotes } = useQuotes();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [billingFilter, setBillingFilter] = useState<"all" | BillingType>("all");
  const [serviceModal, setServiceModal] = useState<{ open: boolean; service?: Service }>({ open: false });
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filtered = services.filter((s) => {
    const q = query.trim().toLowerCase();
    const matchQ =
      !q ||
      s.name.toLowerCase().includes(q) ||
      (s.description || "").toLowerCase().includes(q) ||
      (s.category || "").toLowerCase().includes(q);
    const matchCat = categoryFilter === "all" || s.categoryId === categoryFilter || s.category === categoryFilter;
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    const matchBilling = billingFilter === "all" || s.billingType === billingFilter;
    return matchQ && matchCat && matchStatus && matchBilling;
  });

  const active = services.filter((s) => s.active);
  const monthly = active
    .filter((s) => s.billingType === "mensal" || s.billingType === "recorrente")
    .reduce((sum, s) => sum + s.price, 0);
  const ticket = active.length ? active.reduce((sum, s) => sum + s.price, 0) / active.length : 0;

  const usageMap = useMemo(() => {
    const m = new Map<string, number>();
    quotes.forEach((q) =>
      q.items.forEach((it) => {
        if (it.serviceId) m.set(it.serviceId, (m.get(it.serviceId) || 0) + 1);
      })
    );
    return m;
  }, [quotes]);
  const mostUsed = useMemo<{ name: string; count: number } | null>(() => {
    let best: { name: string; count: number } | null = null;
    usageMap.forEach((count, id) => {
      const s = services.find((x) => x.id === id);
      if (s && (!best || count > best.count)) best = { name: s.name, count };
    });
    return best;
  }, [usageMap, services]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Briefcase />} label="Serviços ativos" value={String(active.length)} />
        <Metric icon={<DollarSign />} label="Receita potencial / mês" value={BRL(monthly)} />
        <Metric icon={<TrendingUp />} label="Ticket médio" value={BRL(ticket)} />
        <Metric icon={<Star />} label="Mais usado em orçamentos" value={mostUsed ? mostUsed.name : "—"} />
      </div>

      <Panel className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar serviço..."
              className="kora-input pl-10"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="kora-input">
            <option value="all">Todas as categorias</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={billingFilter} onChange={(e) => setBillingFilter(e.target.value as typeof billingFilter)} className="kora-input">
            <option value="all">Cobrança</option>
            {BILLING_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="kora-input">
            <option value="all">Todos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
          <div className="flex gap-2">
            <GhostBtn onClick={() => setCategoriesOpen(true)}><Tag className="h-4 w-4" /> Categorias</GhostBtn>
            <PrimaryBtn onClick={() => setServiceModal({ open: true })}><Plus className="h-4 w-4" /> Novo serviço</PrimaryBtn>
          </div>
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase />}
          title="Nenhum serviço encontrado"
          description="Ajuste os filtros ou crie um novo serviço para o catálogo."
          action={<PrimaryBtn onClick={() => setServiceModal({ open: true })}><Plus className="h-4 w-4" /> Criar serviço</PrimaryBtn>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              category={catById.get(s.categoryId || "")}
              usageCount={usageMap.get(s.id) || 0}
              onEdit={() => setServiceModal({ open: true, service: s })}
              onDuplicate={() => { duplicateService(s.id); toast.success("Serviço duplicado"); }}
              onToggle={() => toggleActive(s.id)}
              onRemove={() => {
                if (s.isDemo) return toast.info("Serviços demo não podem ser excluídos");
                if (confirm(`Excluir "${s.name}"?`)) {
                  removeService(s.id);
                  toast.success("Serviço excluído");
                }
              }}
            />
          ))}
        </div>
      )}

      {serviceModal.open && (
        <ServiceModal
          service={serviceModal.service}
          categories={categories}
          onClose={() => setServiceModal({ open: false })}
          onSave={(data) => {
            if (serviceModal.service) {
              updateService(serviceModal.service.id, data);
              toast.success("Serviço atualizado");
            } else {
              addService(data);
              toast.success("Serviço criado");
            }
            setServiceModal({ open: false });
          }}
        />
      )}

      {categoriesOpen && (
        <CategoriesModal
          categories={categories}
          services={services}
          onClose={() => setCategoriesOpen(false)}
          onAdd={addCategory}
          onRemove={(id) => {
            const inUse = services.some((s) => s.categoryId === id);
            if (inUse) return toast.error("Categoria em uso por um serviço");
            removeCategory(id);
          }}
        />
      )}

      <style>{koraInputStyle}</style>
    </div>
  );
}

function ServiceCard({
  service, category, usageCount, onEdit, onDuplicate, onToggle, onRemove,
}: {
  service: Service;
  category?: ServiceCategory;
  usageCount: number;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  return (
    <Panel className="p-5 flex flex-col gap-3 hover:border-primary/40 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-foreground truncate">{service.name}</div>
          <div className="mt-1"><CategoryPill cat={category} /></div>
        </div>
        <StatusPill active={service.active} />
      </div>

      {service.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{service.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {service.availableInQuotes && (
          <Badge>Orçamento</Badge>
        )}
        {service.showInPublicCatalog && <Badge>Portfólio</Badge>}
        <Badge muted>Checkout em breve</Badge>
        {usageCount > 0 && <Badge>{usageCount}× em orçamentos</Badge>}
      </div>

      <div className="flex items-end justify-between pt-3 border-t border-border/60">
        <div>
          <div className="text-lg font-bold text-foreground">{BRL(service.price)}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {service.billingType} · {service.deliveryDays}d
          </div>
        </div>
        <div className="flex gap-1">
          <IconBtn label="Editar" onClick={onEdit}><Pencil className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn label="Duplicar" onClick={onDuplicate}><Copy className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn label={service.active ? "Desativar" : "Ativar"} onClick={onToggle}>
            <Archive className="h-3.5 w-3.5" />
          </IconBtn>
          {!service.isDemo && (
            <IconBtn label="Excluir" onClick={onRemove} danger><Trash2 className="h-3.5 w-3.5" /></IconBtn>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Badge({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium",
        muted ? "bg-muted/60 text-muted-foreground" : "bg-primary/10 text-primary",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function IconBtn({
  children, onClick, label, danger = false,
}: { children: ReactNode; onClick: () => void; label: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        "grid h-7 w-7 place-items-center rounded-md border border-border/60 transition",
        danger
          ? "text-muted-foreground hover:border-destructive/60 hover:text-destructive"
          : "text-muted-foreground hover:border-primary/60 hover:text-primary",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ============================ Modal: Service ============================ */

function ServiceModal({
  service, categories, onClose, onSave,
}: {
  service?: Service;
  categories: ServiceCategory[];
  onClose: () => void;
  onSave: (data: Omit<Service, "id" | "isDemo">) => void;
}) {
  const [name, setName] = useState(service?.name || "");
  const [description, setDescription] = useState(service?.description || "");
  const [categoryId, setCategoryId] = useState(service?.categoryId || categories[0]?.id || "");
  const [price, setPrice] = useState(String(service?.price || ""));
  const [billingType, setBillingType] = useState<BillingType>(service?.billingType || "único");
  const [deliveryDays, setDeliveryDays] = useState(String(service?.deliveryDays ?? 15));
  const [tags, setTags] = useState((service?.tags || []).join(", "));
  const [availableInQuotes, setAvailableInQuotes] = useState(service?.availableInQuotes ?? true);
  const [showInPublicCatalog, setShowInPublicCatalog] = useState(service?.showInPublicCatalog ?? false);
  const [notes, setNotes] = useState(service?.notes || "");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome do serviço");
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) return toast.error("Informe um preço maior que zero");
    const cat = categories.find((c) => c.id === categoryId);
    onSave({
      name: name.trim(),
      description: description.trim(),
      category: cat?.name || "",
      categoryId: cat?.id,
      price: priceNum,
      billingType,
      deliveryDays: Number(deliveryDays) || 0,
      active: service?.active ?? true,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      availableInQuotes,
      showInPublicCatalog,
      notes: notes.trim(),
    });
  }

  return (
    <Modal title={service ? "Editar serviço" : "Novo serviço"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome*">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex: Landing Page" className="kora-input" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Categoria">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="kora-input">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Preço (R$)*">
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1500" className="kora-input" />
          </Field>
        </div>
        <Field label="Descrição">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} className="kora-input resize-none" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cobrança">
            <select value={billingType} onChange={(e) => setBillingType(e.target.value as BillingType)} className="kora-input">
              {BILLING_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Prazo (dias)">
            <input type="number" min={0} value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} className="kora-input" />
          </Field>
        </div>
        <Field label="Tags (separe por vírgula)">
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ex: rebrand, premium" className="kora-input" />
        </Field>
        <div className="space-y-2">
          <Toggle checked={availableInQuotes} onChange={setAvailableInQuotes} label="Disponível em orçamentos" />
          <Toggle checked={showInPublicCatalog} onChange={setShowInPublicCatalog} label="Mostrar no catálogo público (em breve)" />
        </div>
        <Field label="Observações internas">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={300} className="kora-input resize-none" />
        </Field>
        <div className="flex gap-3 pt-2">
          <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
          <div className="flex-1" />
          <PrimaryBtn type="submit">Salvar serviço</PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}

function CategoriesModal({
  categories, services, onClose, onAdd, onRemove,
}: {
  categories: ServiceCategory[];
  services: Service[];
  onClose: () => void;
  onAdd: (data: Omit<ServiceCategory, "id" | "isDemo">) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#F81040");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome");
    onAdd({ name: name.trim(), color });
    setName("");
    toast.success("Categoria criada");
  }

  return (
    <Modal title="Categorias" onClose={onClose}>
      <form onSubmit={submit} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nova categoria" className="kora-input flex-1" maxLength={40} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="kora-color" />
        <PrimaryBtn type="submit"><Plus className="h-4 w-4" /></PrimaryBtn>
      </form>
      <div className="mt-4 space-y-2">
        {categories.map((c) => {
          const inUse = services.some((s) => s.categoryId === c.id);
          return (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                <span className="text-sm text-foreground">{c.name}</span>
                {c.isDemo && <Badge muted>demo</Badge>}
                {inUse && <Badge muted>em uso</Badge>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(c.id)}
                className="text-muted-foreground hover:text-destructive transition"
                aria-label="Remover"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/* ============================ TAB: Produtos ============================ */

function ProductsTab() {
  const { products, addProduct, updateProduct, removeProduct } = useProducts();
  const { categories } = useServiceCategories();
  const [modal, setModal] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [query, setQuery] = useState("");

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const active = products.filter((p) => p.status === "active");
  const potentialRevenue = active.reduce((s, p) => s + p.price, 0);
  const totalCost = active.reduce((s, p) => s + (p.cost || 0), 0);
  const margin = potentialRevenue - totalCost;

  const filtered = products.filter((p) =>
    !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Package />} label="Produtos cadastrados" value={String(products.length)} />
        <Metric icon={<Star />} label="Ativos" value={String(active.length)} />
        <Metric icon={<DollarSign />} label="Receita potencial" value={BRL(potentialRevenue)} />
        <Metric icon={<TrendingUp />} label="Margem estimada" value={BRL(margin)} />
      </div>

      <Panel className="p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar produto..." className="kora-input pl-10" />
        </div>
        <PrimaryBtn onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" /> Novo produto</PrimaryBtn>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Package />}
          title="Sem produtos no catálogo"
          description="Cadastre seu primeiro produto digital, template ou add-on."
          action={<PrimaryBtn onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" /> Criar produto</PrimaryBtn>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <Panel key={p.id} className="p-5 flex flex-col gap-3 hover:border-primary/40 transition">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{p.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <CategoryPill cat={catById.get(p.categoryId || "")} />
                    <Badge muted>{PRODUCT_TYPE_LABEL[p.type]}</Badge>
                  </div>
                </div>
                <StatusPill active={p.status === "active"} />
              </div>
              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
              <div className="flex items-end justify-between pt-3 border-t border-border/60">
                <div>
                  <div className="text-lg font-bold text-foreground">{BRL(p.price)}</div>
                  {typeof p.cost === "number" && p.cost > 0 && (
                    <div className="text-[10px] uppercase text-muted-foreground">
                      custo {BRL(p.cost)} · margem {BRL(p.price - p.cost)}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <IconBtn label="Editar" onClick={() => setModal({ open: true, product: p })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                  <IconBtn label={p.status === "active" ? "Desativar" : "Ativar"} onClick={() => updateProduct(p.id, { status: p.status === "active" ? "inactive" : "active" })}>
                    <Archive className="h-3.5 w-3.5" />
                  </IconBtn>
                  {!p.isDemo && (
                    <IconBtn label="Excluir" danger onClick={() => { if (confirm(`Excluir "${p.name}"?`)) { removeProduct(p.id); toast.success("Produto excluído"); } }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {modal.open && (
        <ProductModal
          product={modal.product}
          categories={categories}
          onClose={() => setModal({ open: false })}
          onSave={(data) => {
            if (modal.product) {
              updateProduct(modal.product.id, data);
              toast.success("Produto atualizado");
            } else {
              addProduct(data);
              toast.success("Produto criado");
            }
            setModal({ open: false });
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product, categories, onClose, onSave,
}: {
  product?: Product;
  categories: ServiceCategory[];
  onClose: () => void;
  onSave: (data: Omit<Product, "id" | "isDemo" | "createdAt" | "updatedAt">) => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [description, setDescription] = useState(product?.description || "");
  const [categoryId, setCategoryId] = useState(product?.categoryId || categories[0]?.id || "");
  const [price, setPrice] = useState(String(product?.price || ""));
  const [cost, setCost] = useState(String(product?.cost ?? ""));
  const [stock, setStock] = useState(String(product?.stock ?? ""));
  const [type, setType] = useState<ProductType>(product?.type || "digital");
  const [status, setStatus] = useState<ProductStatus>(product?.status || "active");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome");
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) return toast.error("Informe um preço válido");
    onSave({
      name: name.trim(),
      description: description.trim(),
      categoryId,
      price: priceNum,
      cost: cost ? Number(cost) : undefined,
      stock: stock ? Number(stock) : undefined,
      type,
      status,
    });
  }

  return (
    <Modal title={product ? "Editar produto" : "Novo produto"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome*">
          <input value={name} onChange={(e) => setName(e.target.value)} className="kora-input" maxLength={80} />
        </Field>
        <Field label="Descrição">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="kora-input resize-none" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Tipo">
            <select value={type} onChange={(e) => setType(e.target.value as ProductType)} className="kora-input">
              {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{PRODUCT_TYPE_LABEL[t]}</option>)}
            </select>
          </Field>
          <Field label="Categoria">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="kora-input">
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Preço (R$)*">
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="kora-input" />
          </Field>
          <Field label="Custo (R$)">
            <input type="number" min={0} step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="kora-input" />
          </Field>
          <Field label="Estoque">
            <input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className="kora-input" />
          </Field>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as ProductStatus)} className="kora-input">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </Field>
        <div className="flex gap-3 pt-2">
          <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
          <div className="flex-1" />
          <PrimaryBtn type="submit">Salvar produto</PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}

/* ============================ TAB: Planos ============================ */

function PlansTab() {
  const { plans, addPlan, updatePlan, removePlan, duplicatePlan } = useCommercialPlans();
  const { services } = useServices();
  const { products } = useProducts();
  const [modal, setModal] = useState<{ open: boolean; plan?: CommercialPlan }>({ open: false });

  const active = plans.filter((p) => p.status === "active");
  const mrr = active
    .filter((p) => p.billingCycle === "monthly")
    .reduce((s, p) => s + p.price, 0);
  const ticket = active.length ? active.reduce((s, p) => s + p.price, 0) / active.length : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Layers />} label="Planos ativos" value={String(active.length)} />
        <Metric icon={<DollarSign />} label="MRR potencial" value={BRL(mrr)} />
        <Metric icon={<TrendingUp />} label="Ticket médio" value={BRL(ticket)} />
      </div>

      <Panel className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Crie pacotes e planos recorrentes para clientes recorrentes.
        </div>
        <div className="flex gap-2">
          <GhostBtn onClick={() => toast.info("Página pública de planos será ativada futuramente.")}>
            <Link2 className="h-4 w-4" /> Apresentação pública
          </GhostBtn>
          <PrimaryBtn onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" /> Novo plano</PrimaryBtn>
        </div>
      </Panel>

      {plans.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="Sem planos cadastrados"
          description="Combine serviços e produtos em pacotes para fechar mais negócios."
          action={<PrimaryBtn onClick={() => setModal({ open: true })}><Plus className="h-4 w-4" /> Criar plano</PrimaryBtn>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <Panel
              key={p.id}
              className={[
                "p-6 flex flex-col gap-4 transition",
                p.highlight ? "border-primary/60 ring-1 ring-primary/30" : "hover:border-primary/40",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    {p.highlight && <Badge>Popular</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                </div>
                <StatusPill active={p.status === "active"} />
              </div>
              <div>
                <div className="text-3xl font-bold text-foreground">{BRL(p.price)}</div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {CYCLE_LABEL[p.billingCycle]}
                </div>
              </div>
              <ul className="space-y-1 text-sm text-foreground">
                {p.items.length === 0 ? (
                  <li className="text-xs text-muted-foreground">Sem itens incluídos</li>
                ) : (
                  p.items.map((it) => (
                    <li key={it.refId + it.kind} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {it.name}
                    </li>
                  ))
                )}
              </ul>
              <div className="flex gap-1 pt-2 border-t border-border/60 mt-auto">
                <IconBtn label="Editar" onClick={() => setModal({ open: true, plan: p })}><Pencil className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn label="Duplicar" onClick={() => { duplicatePlan(p.id); toast.success("Plano duplicado"); }}><Copy className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn label={p.status === "active" ? "Arquivar" : "Ativar"} onClick={() => updatePlan(p.id, { status: p.status === "active" ? "inactive" : "active" })}>
                  <Archive className="h-3.5 w-3.5" />
                </IconBtn>
                {!p.isDemo && (
                  <IconBtn label="Excluir" danger onClick={() => { if (confirm(`Excluir "${p.name}"?`)) { removePlan(p.id); toast.success("Plano excluído"); } }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </IconBtn>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {modal.open && (
        <PlanModal
          plan={modal.plan}
          services={services}
          products={products}
          onClose={() => setModal({ open: false })}
          onSave={(data) => {
            if (modal.plan) {
              updatePlan(modal.plan.id, data);
              toast.success("Plano atualizado");
            } else {
              addPlan(data);
              toast.success("Plano criado");
            }
            setModal({ open: false });
          }}
        />
      )}
    </div>
  );
}

function PlanModal({
  plan, services, products, onClose, onSave,
}: {
  plan?: CommercialPlan;
  services: Service[];
  products: Product[];
  onClose: () => void;
  onSave: (data: Omit<CommercialPlan, "id" | "isDemo" | "createdAt" | "updatedAt">) => void;
}) {
  const [name, setName] = useState(plan?.name || "");
  const [description, setDescription] = useState(plan?.description || "");
  const [price, setPrice] = useState(String(plan?.price || ""));
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(plan?.billingCycle || "monthly");
  const [items, setItems] = useState<PlanItem[]>(plan?.items || []);
  const [highlight, setHighlight] = useState(plan?.highlight ?? false);
  const [status, setStatus] = useState(plan?.status || "active");

  function toggleItem(kind: "service" | "product", refId: string, name: string) {
    setItems((p) =>
      p.some((i) => i.refId === refId && i.kind === kind)
        ? p.filter((i) => !(i.refId === refId && i.kind === kind))
        : [...p, { refId, kind, name }]
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast.error("Informe o nome do plano");
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) return toast.error("Informe um preço válido");
    onSave({
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      billingCycle,
      items,
      highlight,
      status,
    });
  }

  return (
    <Modal title={plan ? "Editar plano" : "Novo plano"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nome*">
          <input value={name} onChange={(e) => setName(e.target.value)} className="kora-input" maxLength={60} />
        </Field>
        <Field label="Descrição">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="kora-input resize-none" />
        </Field>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Preço (R$)*">
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="kora-input" />
          </Field>
          <Field label="Ciclo">
            <select value={billingCycle} onChange={(e) => setBillingCycle(e.target.value as BillingCycle)} className="kora-input">
              {CYCLE_OPTIONS.map((c) => <option key={c} value={c}>{CYCLE_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as PlanStatus)} className="kora-input">
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </Field>
        </div>
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Itens incluídos</div>
          <div className="grid gap-3 md:grid-cols-2">
            <ItemPickerBox title="Serviços">
              {services.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem serviços cadastrados</p>
              ) : (
                services.map((s) => (
                  <CheckRow
                    key={s.id}
                    checked={items.some((i) => i.refId === s.id && i.kind === "service")}
                    onToggle={() => toggleItem("service", s.id, s.name)}
                    label={s.name}
                    hint={BRL(s.price)}
                  />
                ))
              )}
            </ItemPickerBox>
            <ItemPickerBox title="Produtos">
              {products.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem produtos cadastrados</p>
              ) : (
                products.map((p) => (
                  <CheckRow
                    key={p.id}
                    checked={items.some((i) => i.refId === p.id && i.kind === "product")}
                    onToggle={() => toggleItem("product", p.id, p.name)}
                    label={p.name}
                    hint={BRL(p.price)}
                  />
                ))
              )}
            </ItemPickerBox>
          </div>
        </div>
        <Toggle checked={highlight} onChange={setHighlight} label="Destacar como recomendado (Popular)" />
        <div className="flex gap-3 pt-2">
          <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
          <div className="flex-1" />
          <PrimaryBtn type="submit">Salvar plano</PrimaryBtn>
        </div>
      </form>
    </Modal>
  );
}

type PlanStatus = "active" | "inactive";

function ItemPickerBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3 max-h-48 overflow-y-auto space-y-1">
      <div className="text-[11px] font-semibold uppercase text-primary mb-1">{title}</div>
      {children}
    </div>
  );
}

function CheckRow({ checked, onToggle, label, hint }: { checked: boolean; onToggle: () => void; label: string; hint?: string }) {
  return (
    <label className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 cursor-pointer">
      <span className="flex items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-primary" />
        {label}
      </span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/* ============================ TAB: Checkout ============================ */

function CheckoutTab() {
  const { settings, update } = useCheckoutSettings();
  const { services } = useServices();
  const { products } = useProducts();
  const { plans } = useCommercialPlans();

  const eligible = [
    ...services.filter((s) => s.active).map((s) => ({ id: s.id, kind: "Serviço", name: s.name, price: s.price })),
    ...products.filter((p) => p.status === "active").map((p) => ({ id: p.id, kind: "Produto", name: p.name, price: p.price })),
    ...plans.filter((p) => p.status === "active").map((p) => ({ id: p.id, kind: "Plano", name: p.name, price: p.price })),
  ];

  return (
    <div className="space-y-5">
      <Panel className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-foreground">Checkout</h2>
              <Badge muted>Em breve</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Links de checkout serão ativados quando o provedor de pagamento estiver conectado.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Panel className="p-5">
          <h3 className="font-semibold text-foreground mb-3">Itens elegíveis</h3>
          {eligible.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ative serviços, produtos ou planos para aparecerem aqui.</p>
          ) : (
            <div className="space-y-2">
              {eligible.map((item) => (
                <div key={item.kind + item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-4 py-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                    <div className="text-[11px] uppercase text-muted-foreground">{item.kind} · {BRL(item.price)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.info("Checkout real será conectado futuramente.")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/60 hover:text-primary transition"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Gerar link
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="p-5 space-y-4 h-fit">
          <h3 className="font-semibold text-foreground">Personalizar checkout</h3>
          <Field label="Cor principal">
            <div className="flex items-center gap-2">
              <input type="color" value={settings.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="kora-color" />
              <input value={settings.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="kora-input flex-1" />
            </div>
          </Field>
          <Field label="Logo/Imagem (URL)">
            <input value={settings.logoUrl} onChange={(e) => update({ logoUrl: e.target.value })} placeholder="https://..." className="kora-input" />
          </Field>
          <Field label="Texto do botão">
            <input value={settings.buttonLabel} onChange={(e) => update({ buttonLabel: e.target.value })} maxLength={40} className="kora-input" />
          </Field>
          <Field label="Mensagem de confirmação">
            <textarea value={settings.confirmationMessage} onChange={(e) => update({ confirmationMessage: e.target.value })} rows={2} maxLength={200} className="kora-input resize-none" />
          </Field>
          <Field label="Termos (curto)">
            <textarea value={settings.terms} onChange={(e) => update({ terms: e.target.value })} rows={2} maxLength={200} className="kora-input resize-none" />
          </Field>
          <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Configurações salvas localmente. Nenhum pagamento real será processado.
          </div>
        </Panel>
      </div>
    </div>
  );
}

/* ============================ Generic modal & inputs ============================ */

function Modal({
  title, onClose, children, wide = false,
}: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className={`relative max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-xl"} overflow-auto rounded-2xl border border-border/60 bg-card p-6 shadow-premium`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-muted-foreground hover:text-foreground transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        <style>{koraInputStyle}</style>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
}

const koraInputStyle = `
  .kora-input {
    width: 100%;
    border-radius: 10px;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    padding: 9px 12px;
    font-size: 0.875rem;
    color: hsl(var(--foreground));
    outline: none;
    transition: border-color .15s, box-shadow .15s;
    appearance: none;
    -webkit-appearance: none;
  }
  .kora-input:focus, .kora-input:focus-visible {
    border-color: hsl(var(--primary));
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.25);
  }
  .kora-input::placeholder { color: hsl(var(--muted-foreground)); }
  select.kora-input {
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
  }
  select.kora-input option { background: hsl(var(--card)); color: hsl(var(--foreground)); }
  .kora-color {
    width: 44px;
    height: 40px;
    padding: 2px;
    border-radius: 10px;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    cursor: pointer;
  }
  .kora-color::-webkit-color-swatch-wrapper { padding: 0; }
  .kora-color::-webkit-color-swatch { border: none; border-radius: 6px; }
  .kora-color::-moz-color-swatch { border: none; border-radius: 6px; }
`;

