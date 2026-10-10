// Etapa 5 · Fichas Técnicas — leitura bifurcada por CLIENTE
// (`etapa-5-flip-fichas-pacote.md` §11, F2; reescrito no F4/flip). Mocka
// useClients/useSupabaseTechnicalSheet/useCurrentWorkspace — este teste prova a
// escolha de fonte pós-flip (default NUVEM, só "local" explícito escolhe local,
// nuvem só quando ALCANÇÁVEL: workspace + vínculo resolvido), os acessos
// só-locais (FP2) e a invariante G63 (accesses/password nunca vêm da nuvem).
// Fixtures com uuid REAL na classe G82/G67.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import { useClients, type Client } from "@/hooks/useClients";
import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  setTechnicalSheetExperimentalEnabled,
  setTechnicalSheetDataSource,
} from "@/config/flags";
import { writeLocalAccesses } from "@/services/technicalSheets/accessesLocalStore";

vi.mock("@/hooks/useClients", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClients")>("@/hooks/useClients");
  return { ...actual, useClients: vi.fn() };
});
vi.mock("@/hooks/useSupabaseTechnicalSheet", () => ({ useSupabaseTechnicalSheet: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

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

/** Nuvem alcançável: o vínculo resolve e há workspace. */
function cloud(sheet: unknown, supabaseClientId: string | null = UUID) {
  vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({ sheet, supabaseClientId } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useClients).mockReturnValue({ clients: [makeLocalClient()] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  cloud(null, null);
});

describe("useBifurcatedTechnicalSheet — defaults pós-flip (F4)", () => {
  it("cliente local COM vínculo e workspace, flags/seletor nunca tocados: lê a NUVEM (default pós-flip)", () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "1": UUID } }));
    cloud({ branding: { colors: ["#ff0000"] } });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#ff0000"] });
  });

  it("[usuário 100% local] sem vínculo (nuvem inalcançável): devolve a ficha LOCAL, nunca 'vazia', mesmo com os defaults na nuvem", () => {
    cloud(null, null);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#000000"] });
  });

  it("[usuário 100% local] sem workspace: devolve a ficha LOCAL", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);
    cloud({ branding: { colors: ["#ff0000"] } });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#000000"] });
  });

  it("seletor do cliente em \"local\" explícito (rollback por cliente): devolve a ficha local", () => {
    setTechnicalSheetDataSource(1, "local");
    cloud({ branding: { colors: ["#ff0000"] } });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#000000"] });
  });

  it("experimental desligado (rollback nível 1: \"false\"): devolve a ficha local", () => {
    setTechnicalSheetExperimentalEnabled(false);
    cloud({ branding: { colors: ["#ff0000"] } });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current.branding).toEqual({ colors: ["#000000"] });
  });

  it("nuvem ligada mas sem ficha na nuvem ainda ⇒ objeto vazio (a ficha local aparece pelo aviso/import da página)", () => {
    cloud(null);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current).toEqual({});
  });

  it("[G63 — invariante] accesses[].password nunca aparece no objeto lido da nuvem, mesmo presente em raw_payload", () => {
    cloud({
      branding: {},
      raw_payload: { accesses: [{ id: "a1", platform: "WordPress", login: "admin", password: "s3nh4-secreta" }] },
    });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(1));

    expect(result.current).not.toHaveProperty("accesses");
    expect(JSON.stringify(result.current)).not.toContain("s3nh4-secreta");
  });
});

describe("useBifurcatedTechnicalSheet — acessos só-locais (FP2)", () => {
  it("fonte nuvem: os acessos vêm do armazenamento LOCAL deste dispositivo (chave = id da rota), nunca da nuvem", () => {
    vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
    writeLocalAccesses(UUID, [{ id: "a1", platform: "Instagram", login: "x@y.z", password: "local-only" } as never]);
    cloud({
      branding: { colors: ["#00ff00"] },
      raw_payload: { accesses: [{ id: "nuvem", platform: "NUVEM", login: "n", password: "da-nuvem" }] },
    });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(UUID));

    expect(result.current.accesses?.map((a) => a.id)).toEqual(["a1"]);
    expect(JSON.stringify(result.current)).not.toContain("da-nuvem");
  });

  it("cliente legado (cópia local com acessos) em fonte nuvem sem entrada no armazenamento: usa os acessos da cópia local", () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "7": UUID } }));
    vi.mocked(useClients).mockReturnValue({
      clients: [makeLocalClient({
        id: 7,
        technicalSheet: { accesses: [{ id: "legacy", platform: "WP", login: "a", password: "p" } as never] },
      })],
    } as never);
    cloud({ branding: {} });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(UUID));

    expect(result.current.accesses?.map((a) => a.id)).toEqual(["legacy"]);
  });
});

// G82 — a lista de Clientes em nuvem entrega ids UUID. Fixtures com uuid REAL.
describe("useBifurcatedTechnicalSheet — G82 (id uuid vindo da lista em nuvem)", () => {
  it("cliente só-nuvem (uuid, sem cliente local): lê da nuvem com todos os flags no default", () => {
    vi.mocked(useClients).mockReturnValue({ clients: [makeLocalClient()] } as never);
    cloud({ branding: { colors: ["#00ff00"] } });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(UUID));

    expect(vi.mocked(useSupabaseTechnicalSheet)).toHaveBeenCalledWith(UUID);
    expect(result.current.branding).toEqual({ colors: ["#00ff00"] });
  });

  it("cliente só-nuvem sem ficha na nuvem ⇒ objeto vazio (sem lançar)", () => {
    vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
    cloud(null);

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(UUID));

    expect(result.current).toEqual({});
  });

  it("cliente legado importado (local id 7 ↔ uuid) com seletor \"local\" explícito: devolve a ficha LOCAL do cliente 7", () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "7": UUID } }));
    setTechnicalSheetDataSource(UUID, "local");
    vi.mocked(useClients).mockReturnValue({
      clients: [makeLocalClient({ id: 7, technicalSheet: { branding: { colors: ["#123456"] } } })],
    } as never);
    cloud({ branding: { colors: ["#ff0000"] } });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(UUID));

    expect(result.current.branding).toEqual({ colors: ["#123456"] });
  });

  it("[G63 — invariante] ficha só-nuvem por uuid também nunca devolve accesses/password da nuvem", () => {
    vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
    cloud({
      branding: {},
      raw_payload: { accesses: [{ id: "a1", platform: "WP", login: "admin", password: "s3nh4-secreta" }] },
    });

    const { result } = renderHook(() => useBifurcatedTechnicalSheet(UUID));

    expect(JSON.stringify(result.current)).not.toContain("s3nh4-secreta");
  });
});
