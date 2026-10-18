// G94 · M3 — card "Importar Biblioteca de materiais" (Configurações → Dados).
// O hook é simulado: aqui se prova a UI — candidatos, seleção, import,
// relatório, e SOBRETUDO schema pendente (pacote §8-b-catálogo): aviso
// legível e import BLOQUEADO (G29). Molde: LocalCatalogImportCard.test.tsx.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { ClientLibraryImportCard } from "@/components/settings/ClientLibraryImportCard";
import {
  useClientLibraryImport, emptyClientLibraryImportReport, type ClientLibraryImportCandidate,
} from "@/hooks/useClientLibraryImport";

// vi.mock SEM factory auto-mockaria TODOS os exports do módulo, incluindo
// emptyClientLibraryImportReport (viraria undefined) — preserva os reais,
// só o hook em si é mock.
vi.mock("@/hooks/useClientLibraryImport", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClientLibraryImport")>("@/hooks/useClientLibraryImport");
  return { ...actual, useClientLibraryImport: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const CANDIDATES: ClientLibraryImportCandidate[] = [
  { clientId: "87ebd1d2-b17a-46f4-b0eb-70beac445221", clientName: "Cliente A", assetCount: 3 },
];

function mockHook(over: Partial<ReturnType<typeof useClientLibraryImport>> = {}) {
  const importSelected = vi.fn(async () => emptyClientLibraryImportReport());
  vi.mocked(useClientLibraryImport).mockReturnValue({
    candidates: CANDIDATES, loading: false, schemaPending: false, report: null, importSelected, ...over,
  });
  return { importSelected };
}

const open = () => fireEvent.click(screen.getByRole("button", { name: "Abrir importador" }));

beforeEach(() => { vi.clearAllMocks(); });

describe("ClientLibraryImportCard", () => {
  it("lista os candidatos com a contagem de materiais", () => {
    mockHook();
    render(<ClientLibraryImportCard />);
    open();
    expect(screen.getByText("Cliente A")).toBeInTheDocument();
    expect(screen.getByText("3 material(is)")).toBeInTheDocument();
  });

  it("importar sem seleção avisa e não chama o hook", () => {
    const { importSelected } = mockHook();
    render(<ClientLibraryImportCard />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Importar selecionados" }));
    expect(importSelected).not.toHaveBeenCalled();
  });

  it("selecionar todos + importar chama importSelected com os ids certos", async () => {
    const { importSelected } = mockHook();
    render(<ClientLibraryImportCard />);
    open();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todos" }));
    fireEvent.click(screen.getByRole("button", { name: "Importar selecionados" }));
    await waitFor(() => expect(importSelected).toHaveBeenCalledWith(["87ebd1d2-b17a-46f4-b0eb-70beac445221"]));
  });

  it("schema pendente: aviso legível, checkbox e botão de importar desabilitados (G29)", () => {
    mockHook({ schemaPending: true });
    render(<ClientLibraryImportCard />);
    open();
    expect(screen.getByRole("alert")).toHaveTextContent(/schema pendente/i);
    expect(screen.getByRole("checkbox", { name: /Selecionar Cliente A/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Importar selecionados" })).toBeDisabled();
  });

  it("sem candidatos: mensagem honesta de nada a importar", () => {
    mockHook({ candidates: [] });
    render(<ClientLibraryImportCard />);
    open();
    expect(screen.getByText(/Nenhum material salvo só neste dispositivo/)).toBeInTheDocument();
  });
});
