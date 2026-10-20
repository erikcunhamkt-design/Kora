// Etapa 9 · Item 4 (G103, decisão 2) — `get` das credenciais oficiais é admin no servidor: o hook NÃO o chama
// para não-admin (seria um 403) e termina o carregamento com `credentials = null`; admin chama `get` como antes.
// O papel ainda carregando segura o `loading` (não decide nada até saber).
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  useWorkspaceRoleMock: vi.fn(),
  // identidade ESTÁVEL (como o estado real): `workspace` novo a cada render re-dispararia o efeito em loop
  workspaceState: { workspace: { id: "ws-1" } },
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => mocks.workspaceState }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: mocks.useWorkspaceRoleMock }));

import { useWhatsAppOfficial } from "@/hooks/useWhatsAppOfficial";

const credentials = { id: "off-1", workspace_id: "ws-1", phone_number_id: "123", waba_id: "456", verify_token: "tok", status: "configured" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.invoke.mockResolvedValue({ data: { credentials }, error: null });
});

const role = (r: string | null, loading = false) =>
  mocks.useWorkspaceRoleMock.mockReturnValue({ role: r, isAdmin: r === "owner" || r === "admin", loading });

describe("useWhatsAppOfficial — get só para admin", () => {
  it.each(["owner", "admin"])("%s: chama `get` e entrega as credenciais", async (r) => {
    role(r);
    const { result } = renderHook(() => useWhatsAppOfficial());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.invoke).toHaveBeenCalledWith("whatsapp-official-credentials", { body: { action: "get", workspaceId: "ws-1" } });
    expect(result.current.credentials).toMatchObject({ id: "off-1" });
  });

  it.each(["member", "viewer"])("%s: NÃO chama o servidor (evita o 403) e fecha o loading com credentials=null", async (r) => {
    role(r);
    const { result } = renderHook(() => useWhatsAppOfficial());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.credentials).toBeNull();
  });

  it("papel ainda carregando: não chama nada e segura o loading até saber", async () => {
    role(null, true);
    const { result } = renderHook(() => useWhatsAppOfficial());

    await new Promise((r) => setTimeout(r, 30));
    expect(mocks.invoke).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("quando o papel resolve para admin, aí sim carrega", async () => {
    role(null, true);
    const { result, rerender } = renderHook(() => useWhatsAppOfficial());
    expect(mocks.invoke).not.toHaveBeenCalled();

    role("admin");
    rerender();

    await waitFor(() => expect(result.current.credentials).toMatchObject({ id: "off-1" }));
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
});
