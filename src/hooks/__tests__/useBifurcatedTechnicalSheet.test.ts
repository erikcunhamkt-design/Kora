// Etapa 5 · Flip de Fichas Técnicas, fatia F2 (`etapa-5-flip-fichas-pacote.md`
// §11). Mocka useClients/useSupabaseTechnicalSheet diretamente (já testados
// isoladamente em seus próprios arquivos) — este teste prova só a escolha de
// fonte (seletor por-cliente + opt-in global, ambos pós-G63) e a invariante
// de segurança do G63 (accesses/password nunca voltam de um objeto lido da
// nuvem), mesmo escopo de useBifurcatedTasks.test.ts.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import { useClients, type Client } from "@/hooks/useClients";
import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import {
  setTechnicalSheetExperimentalEnabled,
  setTechnicalSheetDataSource,
} from "@/config/flags";

vi.mock("@/hooks/useClients", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClients")>("@/hooks/useClients");
  return { ...actual, useClients: vi.fn() };
});
vi.mock("@/hooks/useSupabaseTechnicalSheet", () => ({ useSupabaseTechnicalSheet: vi.fn() }));

function makeLocalClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1, name: "Cliente Local", company: "", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", origin: "", status: "Ativo",
    potentialValue: 0, totalRevenue: 0, lastProject: "—", lastInteraction: "—",
    observations: "", projects: [], tasks: [], document: "", city: "", state: "",
    address: "", tags: [], temperature: "Morno", nextAction: "", nextActionDate: "",
    createdAt: "2026-01-01", contacts: [],
    technicalSheet: { branding: { colors: ["#000000"] } },
    ...overrides,
  } as Client;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useClients).mockReturnValue({ clients: [makeLocalClient()] } as never);
  vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({ sheet: null } as never);
});

describe("useBifurcatedTechnicalSheet — seletor local (default pós-G63)", () => {
  it("seletor nunca tocado (ausente) devolve a ficha local — default pós-G63 é \"local\"", () => {
    vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
      sheet: { branding: { colors: ["#ff0000"] } },
    } as never);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#000000"] });
  });

  it("experimental ligado mas seletor do cliente em \"local\" explícito devolve a ficha local", () => {
    setTechnicalSheetExperimentalEnabled(true);
    setTechnicalSheetDataSource(1, "local");
    vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
      sheet: { branding: { colors: ["#ff0000"] } },
    } as never);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#000000"] });
  });
});

describe("useBifurcatedTechnicalSheet — seletor Supabase (explícito, pós-G63)", () => {
  it("experimental ligado + seletor do cliente em \"supabase\" devolve a ficha já mapeada de useSupabaseTechnicalSheet", () => {
    setTechnicalSheetExperimentalEnabled(true);
    setTechnicalSheetDataSource(1, "supabase");
    vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
      sheet: { branding: { colors: ["#ff0000"] }, persona: { targetAudience: "PMEs" } },
    } as never);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#ff0000"] });
    expect(result.current.persona).toEqual({ targetAudience: "PMEs" });
  });

  it("[G63 — invariante] accesses[].password nunca aparece no objeto lido da nuvem, mesmo presente em raw_payload", () => {
    setTechnicalSheetExperimentalEnabled(true);
    setTechnicalSheetDataSource(1, "supabase");
    vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
      sheet: {
        branding: {},
        raw_payload: {
          accesses: [{ id: "a1", platform: "WordPress", login: "admin", password: "s3nh4-secreta" }],
        },
      },
    } as never);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current).not.toHaveProperty("accesses");
    expect(JSON.stringify(result.current)).not.toContain("s3nh4-secreta");
  });
});
