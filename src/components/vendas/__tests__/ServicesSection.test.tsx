// Achado na homologação de Financeiro (mesma classe do fix do
// NewQuoteWizard, QuotesSection.tsx): campos de preço/custo no catálogo
// comercial (Serviços/Produtos/Planos) tinham `step={50}`/`step={10}` —
// validação nativa do <input type="number"> rejeita qualquer valor que não
// seja múltiplo do step a partir de `min`. Fix: todos passam a usar
// `step="0.01"`, mesmo idioma de Financeiro.tsx.
//
// ServicesSection não precisa de mocks — useServices/useProducts/
// useCommercialPlans/useServiceCategories/useQuotes são hooks locais
// autocontidos (localStorage), sem contexto/provider externo, mesmo padrão
// já usado sem mock em outros testes deste diretório (ex.:
// QuoteToReceivableDialog.test.tsx com useFinance real).
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ServicesSection } from "@/components/vendas/ServicesSection";

function renderCatalog() {
  return render(<ServicesSection />);
}

describe("ServicesSection · step de centavos nos campos monetários (extensão do achado de Vendas)", () => {
  it("Serviços · 'Preço (R$)' aceita R$80 e R$79,90 — sem stepMismatch", () => {
    renderCatalog();
    fireEvent.click(screen.getByText("Novo serviço"));

    // Ordem no modal "Novo serviço": [0] Preço, [1] Prazo (dias).
    const [price] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    fireEvent.change(price, { target: { value: "80" } });
    expect(price.checkValidity()).toBe(true);

    fireEvent.change(price, { target: { value: "79.90" } });
    expect(price.checkValidity()).toBe(true);
  });

  it("Produtos · 'Preço (R$)' e 'Custo (R$)' aceitam R$80/R$79,90 — sem stepMismatch (campo irmão tinha o mesmo vício)", () => {
    renderCatalog();
    fireEvent.click(screen.getByText("Produtos"));
    fireEvent.click(screen.getByText("Novo produto"));

    // Ordem no modal "Novo produto": [0] Preço, [1] Custo, [2] Estoque.
    const [price, cost] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    fireEvent.change(price, { target: { value: "80" } });
    expect(price.checkValidity()).toBe(true);
    fireEvent.change(price, { target: { value: "79.90" } });
    expect(price.checkValidity()).toBe(true);

    fireEvent.change(cost, { target: { value: "79.90" } });
    expect(cost.checkValidity()).toBe(true);
  });

  it("Planos · 'Preço (R$)' aceita R$80 e R$79,90 — sem stepMismatch", () => {
    renderCatalog();
    fireEvent.click(screen.getByText("Planos"));
    fireEvent.click(screen.getByText("Novo plano"));

    // Ordem no modal "Novo plano": [0] Preço (Ciclo/Status são <select>).
    const [price] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    fireEvent.change(price, { target: { value: "80" } });
    expect(price.checkValidity()).toBe(true);
    fireEvent.change(price, { target: { value: "79.90" } });
    expect(price.checkValidity()).toBe(true);
  });

  it("regressão: valores que já funcionavam antes (múltiplos de 50/10) continuam válidos, min={0} preservado", () => {
    renderCatalog();
    fireEvent.click(screen.getByText("Novo serviço"));
    const [price] = screen.getAllByRole("spinbutton") as HTMLInputElement[];

    fireEvent.change(price, { target: { value: "1500" } });
    expect(price.checkValidity()).toBe(true);

    fireEvent.change(price, { target: { value: "-10" } });
    expect(price.validity.rangeUnderflow).toBe(true);
    expect(price.checkValidity()).toBe(false);
  });
});
