// G94 / CT3 — card "Importar catálogo comercial" (Configurações → Dados). O hook é simulado: aqui se prova
// a UI — 4 etapas na ordem, dependência visível/bloqueada, import com a seleção certa, relatório honesto de
// descartes e, sobretudo, SCHEMA PENDENTE (pacote §8-b): aviso legível e import BLOQUEADO (G29).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { LocalCatalogImportCard } from "@/components/settings/LocalCatalogImportCard";
import { useLocalCatalogImport } from "@/hooks/useLocalCatalogImport";
import { emptyCatalogImportReport, type CatalogCandidate, type CatalogImportReport } from "@/services/catalog/catalogImport";

vi.mock("@/hooks/useLocalCatalogImport");
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const CANDIDATES: CatalogCandidate[] = [
  { kind: "category", localId: "cat-1", label: "Branding", status: "new", needs: [] },
  { kind: "service", localId: "svc-1", label: "Logo", status: "new", needs: [{ kind: "category", localId: "cat-1" }] },
  { kind: "product", localId: "prod-1", label: "Pack", status: "imported", needs: [] },
  {
    kind: "plan", localId: "plan-1", label: "Studio", status: "new", needs: [{ kind: "service", localId: "svc-1" }],
    willDiscard: 1, warning: "1 item(ns) sem tradução (serviço/produto demo ou inexistente) serão DESCARTADOS",
  },
];

function mockHook(over: Partial<ReturnType<typeof useLocalCatalogImport>> = {}) {
  const importSelected = vi.fn(async (): Promise<CatalogImportReport> => emptyCatalogImportReport());
  const analyze = vi.fn(async () => {});
  vi.mocked(useLocalCatalogImport).mockReturnValue({
    candidates: CANDIDATES, loading: false, error: null, schemaPending: null, report: null, analyze, importSelected, ...over,
  });
  return { importSelected, analyze };
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Abrir importador" }));

beforeEach(() => { vi.clearAllMocks(); });

describe("LocalCatalogImportCard", () => {
  it("abrir o diálogo analisa; lista as 4 etapas em ordem com 'nova' / 'já importada'", () => {
    const { analyze } = mockHook();
    render(<LocalCatalogImportCard />);
    open();
    expect(analyze).toHaveBeenCalledTimes(1);
    const headings = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(headings).toEqual(["Etapa 1 · Categorias", "Etapa 2 · Serviços", "Etapa 3 · Produtos", "Etapa 4 · Planos"]);
    expect(screen.getByText("já importada")).toBeInTheDocument();
    expect(screen.getAllByText("nova")).toHaveLength(3);
  });

  it("dependente fica travado até a dependência ser marcada; desmarcar a dependência desmarca o dependente", () => {
    mockHook();
    render(<LocalCatalogImportCard />);
    open();
    const cat = screen.getByRole("checkbox", { name: "Selecionar Branding" });
    const svc = screen.getByRole("checkbox", { name: "Selecionar Logo" });
    expect(svc).toBeDisabled();
    expect(screen.getAllByText(/depende de 1 item\(ns\) ainda não importado\(s\)/).length).toBeGreaterThan(0);

    fireEvent.click(cat);
    expect(svc).not.toBeDisabled();
    fireEvent.click(svc);
    expect(svc).toHaveAttribute("aria-checked", "true");

    fireEvent.click(cat); // desmarca a categoria ⇒ o serviço cai junto
    expect(svc).toHaveAttribute("aria-checked", "false");
    expect(svc).toBeDisabled();
  });

  it("plano mostra o aviso de itens que serão DESCARTADOS antes de importar", () => {
    mockHook();
    render(<LocalCatalogImportCard />);
    open();
    expect(screen.getByText(/serão DESCARTADOS/)).toBeInTheDocument();
  });

  it("'Selecionar todas as novas' + 'Importar selecionados' chama o import com TODAS as chaves novas (nenhuma importada)", async () => {
    const { importSelected } = mockHook();
    render(<LocalCatalogImportCard />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todas as novas" }));
    fireEvent.click(screen.getByRole("button", { name: "Importar selecionados" }));
    await waitFor(() => expect(importSelected).toHaveBeenCalledTimes(1));
    const arg = (importSelected.mock.calls[0] as unknown as [string[]])[0];
    expect([...arg].sort()).toEqual(["category:cat-1", "plan:plan-1", "service:svc-1"]);
  });

  it("sem seleção o botão de importar fica desabilitado", () => {
    mockHook();
    render(<LocalCatalogImportCard />);
    open();
    expect(screen.getByRole("button", { name: "Importar selecionados" })).toBeDisabled();
  });

  it("relatório do último import: contagens por etapa e itens de plano DESCARTADOS (honesto)", () => {
    const report = emptyCatalogImportReport();
    report.created.category = ["cat-1"];
    report.created.plan = ["plan-1"];
    report.failed.service = ["svc-1"];
    report.discardedPlanItems = [{ planId: "plan-1", planName: "Studio", items: [{ refId: "svc-ghost", kind: "service", name: "Fantasma" }] }];
    mockHook({ report });
    render(<LocalCatalogImportCard />);
    open();
    const status = screen.getByRole("status", { name: "Relatório do último import" });
    expect(status).toHaveTextContent("Categorias: 1 importado(s)");
    expect(status).toHaveTextContent("Serviços: 0 importado(s), 1 com falha");
    expect(status).toHaveTextContent("Planos: 1 importado(s)");
    expect(status).toHaveTextContent("1 item(ns) de plano DESCARTADO(S)");
    expect(status).toHaveTextContent("Studio: Fantasma");
  });

  describe("schema pendente (pacote §8-b) — G29", () => {
    it("mostra o aviso com as tabelas ausentes e BLOQUEIA o import (checkboxes e botões desabilitados)", async () => {
      const { importSelected } = mockHook({ schemaPending: { tables: ["products", "commercial_plans"] } });
      render(<LocalCatalogImportCard />);
      open();
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent(/schema pendente \(pacote §8-b\)/i);
      expect(alert).toHaveTextContent(/importação desabilitada/i);
      expect(alert).toHaveTextContent("products, commercial_plans");

      expect(screen.getByRole("checkbox", { name: "Selecionar Branding" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Importar selecionados" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Selecionar todas as novas" })).toBeDisabled();

      fireEvent.click(screen.getByRole("button", { name: "Importar selecionados" }));
      expect(importSelected).not.toHaveBeenCalled();
    });

    it("sem schema pendente, o aviso não aparece", () => {
      mockHook();
      render(<LocalCatalogImportCard />);
      open();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});
