// G92/B4 (kora-hub-auditoria-e-plano.md) — prova o hook compartilhado pelos
// consumidores fora da tela principal de Vendas. Mocka useQuotes/
// useSupabaseQuotes diretamente (já testados isoladamente em seus próprios
// arquivos) — este teste prova só a escolha de fonte, mesmo escopo de
// useBifurcatedFinance.test.ts/useBifurcatedProjects.test.ts.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedQuotes } from "@/hooks/useBifurcatedQuotes";
import { useQuotes, type Quote } from "@/hooks/useQuotes";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { QUOTES_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useQuotes", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useQuotes")>("@/hooks/useQuotes");
  return { ...actual, useQuotes: vi.fn() };
});
vi.mock("@/hooks/useSupabaseQuotes", () => ({ useSupabaseQuotes: vi.fn() }));

function makeLocalQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-local-1", clientName: "Acme Local", clientEmail: "", clientWhatsapp: "",
    title: "Orçamento Local", description: "", items: [],
    subtotal: 100, discount: 0, total: 100, paymentCondition: "",
    deliveryDeadline: "", validityDays: 15, status: "rascunho",
    createdAt: "2026-07-01", isDemo: false,
    ...overrides,
  };
}

function makeCloudQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-cloud-1", clientName: "Acme Nuvem", clientEmail: "", clientWhatsapp: "",
    title: "Orçamento Nuvem", description: "", items: [],
    subtotal: 200, discount: 0, total: 200, paymentCondition: "",
    deliveryDeadline: "", validityDays: 15, status: "aprovado",
    createdAt: "2026-08-01", isDemo: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useBifurcatedQuotes — modo local (explícito)", () => {
  it('"local" explícito devolve os orçamentos locais', () => {
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "local");
    vi.mocked(useQuotes).mockReturnValue({ quotes: [makeLocalQuote()] } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [makeCloudQuote()] } as never);

    const { result } = renderHook(() => useBifurcatedQuotes());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Orçamento Local");
  });
});

describe("useBifurcatedQuotes — modo Supabase", () => {
  it("devolve os orçamentos da nuvem quando o seletor nunca foi tocado (default pós-flip)", () => {
    vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [makeCloudQuote()] } as never);

    const { result } = renderHook(() => useBifurcatedQuotes());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Orçamento Nuvem");
  });

  it("devolve os orçamentos já mapeados de useSupabaseQuotes quando o seletor está em 'supabase' (explícito)", () => {
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useQuotes).mockReturnValue({ quotes: [makeLocalQuote()] } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [makeCloudQuote()] } as never);

    const { result } = renderHook(() => useBifurcatedQuotes());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Orçamento Nuvem");
  });
});
