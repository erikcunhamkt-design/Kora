// G71 — adendo de backlog de UI. Prova o hook isolado: espelha
// is_workspace_admin() do servidor (role IN ('owner','admin')), nunca
// assume admin antes do membership resolver (default seguro pra evitar
// piscar controles habilitados durante o loading).
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));

describe("useWorkspaceRole — espelha is_workspace_admin() (role IN ('owner','admin'))", () => {
  it("role owner: isAdmin true", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      membership: { role: "owner" }, loading: false,
    } as never);

    const { result } = renderHook(() => useWorkspaceRole());

    expect(result.current).toEqual({ role: "owner", isAdmin: true, loading: false });
  });

  it("role admin: isAdmin true", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      membership: { role: "admin" }, loading: false,
    } as never);

    const { result } = renderHook(() => useWorkspaceRole());

    expect(result.current.isAdmin).toBe(true);
  });

  it("role member: isAdmin false", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      membership: { role: "member" }, loading: false,
    } as never);

    const { result } = renderHook(() => useWorkspaceRole());

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.role).toBe("member");
  });

  it("role viewer: isAdmin false", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      membership: { role: "viewer" }, loading: false,
    } as never);

    const { result } = renderHook(() => useWorkspaceRole());

    expect(result.current.isAdmin).toBe(false);
  });

  it("membership null (sem vinculo carregado): role null, isAdmin false", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      membership: null, loading: false,
    } as never);

    const { result } = renderHook(() => useWorkspaceRole());

    expect(result.current).toEqual({ role: null, isAdmin: false, loading: false });
  });

  it("loading=true: isAdmin NUNCA true, mesmo antes do membership resolver (estado default nao pisca habilitado)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      membership: null, loading: true,
    } as never);

    const { result } = renderHook(() => useWorkspaceRole());

    expect(result.current.isAdmin).toBe(false);
    expect(result.current.loading).toBe(true);
  });
});
