import { describe, expect, it } from "vitest";
import { authorizeIsTestCaller } from "../isTestAuth";

describe("authorizeIsTestCaller (G5/G18 regression)", () => {
  it("anonimo (sem Authorization) -> 401 missing_auth", () => {
    const result = authorizeIsTestCaller(null, null, false);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("missing_auth");
  });

  it("header presente mas nao 'Bearer ' -> 401 missing_auth", () => {
    const result = authorizeIsTestCaller("Basic abc123", null, false);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("missing_auth");
  });

  it("Bearer presente mas JWT invalido (getUser falhou, sem user) -> 401 unauthorized", () => {
    const result = authorizeIsTestCaller("Bearer anon-key-publica", null, false);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("unauthorized");
  });

  it("autenticado mas nao membro do workspace -> 403 forbidden", () => {
    const result = authorizeIsTestCaller("Bearer valid-jwt", { id: "user-1" }, false);
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toBe("forbidden");
  });

  it("autenticado e membro -> ok, sem status/error", () => {
    const result = authorizeIsTestCaller("Bearer valid-jwt", { id: "user-1" }, true);
    expect(result.ok).toBe(true);
    expect(result.status).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
});
