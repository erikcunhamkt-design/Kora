// Fase D (homologação) — achado ao vivo: arquivar um cliente em modo Supabase gravava
// `archived=true` no banco (toast confirmou, contador "Ativos" caiu pra 0), mas a lista
// sob o filtro "Ativos" continuou mostrando o cliente arquivado. Causa: `Clientes.tsx`
// filtra corretamente por `c.archived` (`:344-345`), mas `mapSupabaseClientToLocalClient`
// nunca lia a coluna `archived` da linha do Supabase — o campo (opcional no tipo `Client`)
// ficava sempre `undefined`, então o filtro nunca via a tarefa como arquivada, não
// importa o valor real no banco.
import { describe, it, expect } from "vitest";
import { mapSupabaseClientToLocalClient } from "@/hooks/useClientsDataSource";

describe("mapSupabaseClientToLocalClient — Fase D (filtro Ativos ignorava archived do Supabase)", () => {
  it("mapeia archived: true da linha do Supabase pro Client local", () => {
    const supabaseRow = {
      id: "uuid-1",
      name: "Cliente Arquivado",
      company: "Empresa X",
      email: "x@teste.com",
      archived: true,
    };

    const mapped = mapSupabaseClientToLocalClient(supabaseRow);

    expect(mapped.archived).toBe(true);
  });

  it("mapeia archived: false (cliente ativo) corretamente, não fica undefined", () => {
    const supabaseRow = {
      id: "uuid-2",
      name: "Cliente Ativo",
      company: "Empresa Y",
      email: "y@teste.com",
      archived: false,
    };

    const mapped = mapSupabaseClientToLocalClient(supabaseRow);

    expect(mapped.archived).toBe(false);
  });
});
