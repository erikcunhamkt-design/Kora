// G94 / CT4 — cards de toggle do catálogo em Configurações: gravam as chaves certas, mostram o estado e dizem a verdade.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { CatalogSupabaseSourceToggleCard, CatalogSupabaseWriteToggleCard } from "@/components/settings/CatalogSupabaseToggleCards";
import { CATALOG_DATA_SOURCE_KEY, CATALOG_WRITE_FLAG_KEY, getCatalogDataSource, getCatalogWriteEnabled } from "@/config/flags";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

beforeEach(() => { localStorage.clear(); });

describe("flags do catálogo (config/flags.ts)", () => {
  it("padrões: fonte LOCAL, escrita DESLIGADA; só os literais exatos ligam", () => {
    expect(getCatalogDataSource()).toBe("local");
    expect(getCatalogWriteEnabled()).toBe(false);
    for (const v of ["", "local", "true", "Supabase", "1"]) {
      localStorage.setItem(CATALOG_DATA_SOURCE_KEY, v);
      expect(getCatalogDataSource()).toBe("local");
    }
    for (const v of ["", "false", "TRUE", "1", "supabase"]) {
      localStorage.setItem(CATALOG_WRITE_FLAG_KEY, v);
      expect(getCatalogWriteEnabled()).toBe(false);
    }
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(CATALOG_WRITE_FLAG_KEY, "true");
    expect(getCatalogDataSource()).toBe("supabase");
    expect(getCatalogWriteEnabled()).toBe(true);
  });

  it("chaves reservadas pela Fase B", () => {
    expect(CATALOG_DATA_SOURCE_KEY).toBe("kora.catalog.dataSource.v1");
    expect(CATALOG_WRITE_FLAG_KEY).toBe("kora.catalog.supabaseWrite.v1");
  });
});

describe("CatalogSupabaseSourceToggleCard", () => {
  it("padrão Local; 'Usar Supabase' grava a chave e muda o estado; 'Voltar para Local' desfaz", () => {
    render(<CatalogSupabaseSourceToggleCard />);
    expect(screen.getByText("Fonte: Local")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar Supabase" }));
    expect(localStorage.getItem(CATALOG_DATA_SOURCE_KEY)).toBe("supabase");
    expect(screen.getByText("Fonte: Supabase (nuvem)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Local" }));
    expect(localStorage.getItem(CATALOG_DATA_SOURCE_KEY)).toBe("local");
    expect(screen.getByText("Fonte: Local")).toBeInTheDocument();
  });

  it("o texto não promete migração: diz que o catálogo da nuvem começa vazio e cita schema pendente", () => {
    render(<CatalogSupabaseSourceToggleCard />);
    expect(screen.getByText(/começa\s+vazio/)).toBeInTheDocument();
    expect(screen.getByText(/schema pendente/)).toBeInTheDocument();
    expect(screen.getByText(/não migra nenhum dado/)).toBeInTheDocument();
  });
});

describe("CatalogSupabaseWriteToggleCard", () => {
  it("padrão Inativa; 'Ativar' grava 'true'; 'Desativar' grava 'false'", () => {
    render(<CatalogSupabaseWriteToggleCard />);
    expect(screen.getByText("Escrita: Inativa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ativar" }));
    expect(localStorage.getItem(CATALOG_WRITE_FLAG_KEY)).toBe("true");
    expect(screen.getByText("Escrita: Ativa")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Desativar" }));
    expect(localStorage.getItem(CATALOG_WRITE_FLAG_KEY)).toBe("false");
  });

  it("com a fonte em Local avisa que a chave não tem efeito; descreve o bloqueio honesto", () => {
    render(<CatalogSupabaseWriteToggleCard />);
    expect(screen.getByText(/Com a fonte em Local, esta chave não tem efeito/)).toBeInTheDocument();
    expect(screen.getByText(/bloqueia/)).toBeInTheDocument();
  });

  it("os dois cards se sincronizam pelo evento (mesma aba)", () => {
    render(<><CatalogSupabaseSourceToggleCard /><CatalogSupabaseWriteToggleCard /></>);
    expect(screen.getByText(/Com a fonte em Local, esta chave não tem efeito/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar Supabase" }));
    expect(screen.queryByText(/Com a fonte em Local, esta chave não tem efeito/)).toBeNull();
  });
});
