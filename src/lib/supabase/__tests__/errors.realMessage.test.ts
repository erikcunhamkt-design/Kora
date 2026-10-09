// G95 — getRealErrorMessage: a mensagem que o usuário vê é a REAL (Error ou {message} do
// PostgrestError), nunca o genérico normalizado quando existe uma causa.
import { describe, it, expect } from "vitest";
import { getRealErrorMessage } from "@/lib/supabase/errors";

describe("getRealErrorMessage", () => {
  it("Error: usa a mensagem", () => {
    expect(getRealErrorMessage(new Error("permission denied for table clients"))).toBe("permission denied for table clients");
  });

  it("objeto { message } (PostgrestError não é instância de Error): usa a mensagem", () => {
    expect(getRealErrorMessage({ code: "42501", message: "new row violates row-level security policy" }))
      .toBe("new row violates row-level security policy");
  });

  it("sem mensagem: cai na normalizada (nunca vazio)", () => {
    expect(getRealErrorMessage({ code: "XX000" }).length).toBeGreaterThan(0);
    expect(getRealErrorMessage(undefined).length).toBeGreaterThan(0);
  });
});
