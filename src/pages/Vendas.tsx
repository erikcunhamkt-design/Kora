import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingBag, FileText, Target } from "lucide-react";
import { ServicesSection } from "@/components/vendas/ServicesSection";
import { QuotesSection } from "@/components/vendas/QuotesSection";

type SalesTab = "catalogo" | "orcamentos";

const tabAliases: Record<string, SalesTab> = {
  catalogo: "catalogo",
  servicos: "catalogo",
  produtos: "catalogo",
  planos: "catalogo",
  checkout: "catalogo",
  orcamentos: "orcamentos",
};

const tabs: { id: SalesTab; label: string; icon: typeof ShoppingBag }[] = [
  { id: "catalogo", label: "Catálogo Comercial", icon: ShoppingBag },
  { id: "orcamentos", label: "Orçamentos", icon: FileText },
];

export default function Vendas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = (tabAliases[searchParams.get("tab") ?? ""] ?? "catalogo") as SalesTab;
  const [activeTab, setActiveTab] = useState<SalesTab>(initial);

  useEffect(() => {
    const t = tabAliases[searchParams.get("tab") ?? ""];
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeTab = (id: SalesTab) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    // Preserve "servicos" as default tab keyword if user already had a catalog sub-tab
    if (id === "catalogo") {
      const current = searchParams.get("tab") ?? "";
      if (!["servicos", "produtos", "planos", "checkout", "catalogo"].includes(current)) {
        next.set("tab", "servicos");
      }
    } else {
      next.set("tab", id);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-full -m-6 bg-background text-foreground overflow-x-hidden">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-col gap-3 px-6 py-4">
          <div className="min-w-0">
            <div className="text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground/60">
              Comercial / Vendas & Catálogo
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Target className="h-4 w-4 text-primary" />
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                Vendas & Catálogo
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Serviços, produtos, planos, orçamentos e checkout.
            </p>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto -mx-1 px-1">
            {tabs.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => changeTab(id)}
                  className={[
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition whitespace-nowrap",
                    active
                      ? "bg-primary/10 text-primary border border-primary/30"
                      : "border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        {activeTab === "catalogo" ? <ServicesSection /> : <QuotesSection />}
      </main>
    </div>
  );
}
