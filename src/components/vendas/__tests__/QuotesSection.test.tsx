// Etapa 5 · Fatia 9 (quotes — fundação + cutover de leitura) — item 4.
// Prova: (1) modo local (default) mostra os dados locais, intocado; (2) modo
// Supabase mostra os dados da nuvem, com status traduzido (Q9) e campos Q8
// visíveis; (3) TODA ação de escrita fica bloqueada em modo Supabase — nunca
// chama a função local, nunca mostra toast de sucesso (lição O2/O3/O4).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import { QuotesSection } from "@/components/vendas/QuotesSection";
import { useQuotes, type Quote } from "@/hooks/useQuotes";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useClients } from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useLeads } from "@/hooks/useLeads";
import { financeRepository } from "@/repositories/financeRepository";
import { QUOTES_DATA_SOURCE_KEY } from "@/config/flags";
import { QUOTES_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseQuotesWriteFlag";

vi.mock("@/hooks/useQuotes", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useQuotes")>("@/hooks/useQuotes");
  return { ...actual, useQuotes: vi.fn() };
});
vi.mock("@/hooks/useSupabaseQuotes", () => ({ useSupabaseQuotes: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
// G44 — NewQuoteWizard passou a ler useClientsDataSource() (bifurcado, mesmo
// hook já mockado em ProjectsSection.test.tsx) em vez de useClients() (só
// local) pro seletor de cliente existente. Sem este mock, o hook real
// dispara useSupabaseClients() -> useQuery() sem QueryClientProvider na
// árvore de teste e quebra qualquer teste que abra o wizard.
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
// Etapa 5 · Pacote do Flip (projects) — QuoteToProjectDialog (renderizado
// como filho de QuotesSection) passou a chamar useCurrentWorkspace() pro
// espelho G22 (mirrorCreateToSupabase). Sem o mock, useAuth() (de dentro de
// useCurrentWorkspace) quebra por falta de AuthProvider no teste.
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
// G56 — QuoteToReceivableDialog (filho de QuotesSection) chama
// financeRepository.createReceivableFromQuote no espelho; sem mock, o teste
// de ponta a ponta (menu -> diálogo -> confirmar -> espelho) bateria no
// client Supabase real. useFinance() NÃO é mockado de propósito — é a
// mesma implementação real (localStorage) que G33/G55 já exercitam
// implicitamente ao renderizar QuoteToProjectDialog/QuoteToReceivableDialog.
vi.mock("@/repositories/financeRepository", () => ({
  financeRepository: { createReceivableFromQuote: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfill de teste, jsdom não implementa PointerEvent.
  window.PointerEvent = PointerEventPolyfill;
}

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

// Achado (retomada pós-formatação, item 0.5): fixture de data absoluta é uma
// bomba-relógio — `isQuoteExpired` (useQuotes.ts) compara `createdAt +
// validityDays` contra `new Date()` real. Datas fixas no passado do "hoje" da
// execução viram "vencido" e mascaram o status que o teste quer exercitar
// (ex.: "rascunho"). `todayIso()` mantém o fixture sempre válido, qualquer
// que seja o dia em que a suíte rodar.
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeLocalQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-local-1",
    clientName: "Cliente Local",
    clientEmail: "local@teste.com",
    clientWhatsapp: "",
    title: "Orçamento Local",
    description: "",
    items: [],
    subtotal: 1000,
    discount: 0,
    total: 1000,
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 15,
    status: "rascunho",
    createdAt: todayIso(),
    ...overrides,
  };
}

function makeSupabaseMappedQuote(overrides: Partial<Quote> = {}): Quote {
  // Já passou pelo mapper (mapSupabaseQuoteToLocalQuote) — é o formato que
  // useSupabaseQuotes() de fato devolve.
  return {
    id: "q-cloud-1",
    clientName: "Cliente Nuvem",
    clientEmail: "nuvem@teste.com",
    clientWhatsapp: "(11) 99999-9999",
    title: "Orçamento Nuvem",
    description: "",
    items: [{ id: "i1", name: "Item Nuvem", quantity: 1, unitPrice: 500 }],
    subtotal: 500,
    discount: 0,
    total: 500,
    paymentCondition: "À vista",
    deliveryDeadline: "10 dias",
    validityDays: 20,
    status: "aprovado", // já traduzido (Q9) — veio de "approved" na nuvem
    company: "Empresa Nuvem Ltda",
    createdAt: todayIso(),
    ...overrides,
  };
}

function setupCommonMocks() {
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [], source: "local" } as never);
  vi.mocked(useLeads).mockReturnValue({ leads: [], updateLead: vi.fn() } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setupCommonMocks();
});

function renderSection() {
  return render(
    <MemoryRouter>
      <QuotesSection />
    </MemoryRouter>,
  );
}

async function openQuoteMenu(title: string) {
  const titleEl = await screen.findByText(title);
  const row = titleEl.closest("tr") as HTMLElement;
  const trigger = row.querySelector('button[aria-label="Mais ações"]') as HTMLElement;
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(trigger);
  return screen.findByText("Excluir");
}

// Pacote do Flip (Fase C) — `getQuotesDataSource()` default virou "supabase"
// (só "local" explícito escolhe local, mesmo formato do CRM). Este describe
// passou de "default" pra "explícito": os 2 testes agora gravam "local" no
// seletor antes de renderizar, provando que a escolha explícita continua
// funcionando (o "Espelho Reversível" preservado) — não mais o cenário de
// "seletor nunca tocado", que agora mostra nuvem (novo describe abaixo).
describe("QuotesSection · modo local (explícito)", () => {
  it("mostra os dados locais quando o seletor está explicitamente em \"local\"", async () => {
    const localUpdateStatus = vi.fn();
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "local");
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(),
      updateStatus: localUpdateStatus,
      updateQuote: vi.fn(),
      duplicateQuote: vi.fn(),
      deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null,
    } as never);

    renderSection();

    expect(await screen.findByText("Orçamento Local")).toBeInTheDocument();
    expect(screen.queryByText("Orçamento Nuvem")).not.toBeInTheDocument();
  });

  it("aprovar em modo local chama updateStatus normalmente (comportamento preservado)", async () => {
    const localUpdateStatus = vi.fn();
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "local");
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(),
      updateStatus: localUpdateStatus,
      updateQuote: vi.fn(),
      duplicateQuote: vi.fn(),
      deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);

    renderSection();
    await openQuoteMenu("Orçamento Local");
    fireEvent.click(screen.getByText("Marcar como aprovado"));

    expect(localUpdateStatus).toHaveBeenCalledWith("q-local-1", "aprovado");
    expect(toast.success).toHaveBeenCalledWith("Orçamento aprovado");
  });
});

describe("QuotesSection · pós Pacote do Flip — nuvem é o default", () => {
  it("mostra os dados da nuvem quando o seletor nunca foi tocado (default flipado)", async () => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);
    expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBeNull();

    renderSection();

    expect(await screen.findByText("Orçamento Nuvem")).toBeInTheDocument();
    expect(screen.queryByText("Orçamento Local")).not.toBeInTheDocument();
  });
});

describe("QuotesSection · modo Supabase (leitura)", () => {
  it("mostra os dados da nuvem após o flip, com status traduzido e campos Q8 visíveis", async () => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    const titleEl = await screen.findByText("Orçamento Nuvem");
    expect(screen.queryByText("Orçamento Local")).not.toBeInTheDocument();
    // Q9: status já chega traduzido ("aprovado", não "approved") — a badge
    // da LINHA mostra o rótulo local (há também um botão de filtro com o
    // mesmo texto na página, por isso o escopo é a linha).
    const row = titleEl.closest("tr") as HTMLElement;
    expect(within(row).getByText("Aprovado")).toBeInTheDocument();
    // Q8: company aparece na tabela (mesmo lugar que já mostrava pro local).
    expect(screen.getByText("Empresa Nuvem Ltda")).toBeInTheDocument();
  });

  it("persiste o seletor no localStorage e mostra o banner de modo leitura", async () => {
    // Pacote do Flip — master flag virou opt-out (default ON); pra provar o
    // banner de "modo leitura" precisa desligar explicitamente agora.
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    await waitFor(() => expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBe("supabase"));
    expect(await screen.findByText("Orçamentos em modo leitura (Supabase)")).toBeInTheDocument();
  });

  // Fatia 10 — incidente pós-Fase-D (runbook parado no passo 11): o operador
  // reportou que a badge/banner não refletia o master flag ligado. Prova
  // por reprodução: o componente lê a flag a cada render via
  // isSupabaseQuotesWriteEnabled() (import direto, sem memoização) — este
  // teste trava esse contrato. Causa raiz real do incidente (confirmada por
  // diagnóstico separado): o navegador do operador apontava pro dev server
  // do worktree `main` (sem o código desta fatia), não pro worktree da
  // branch `fatia-10-quotes-write` — não uma regressão de código.
  it("com o master flag ligado, badge e banner mostram 'operacional', não 'leitura'", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    expect(await screen.findByText("Orçamentos operacionais (Supabase)")).toBeInTheDocument();
    expect(screen.getByText("Modo operacional")).toBeInTheDocument();
    expect(screen.queryByText("Orçamentos em modo leitura (Supabase)")).not.toBeInTheDocument();
    expect(screen.queryByText("Modo leitura")).not.toBeInTheDocument();
  });
});

// G33 (Fase D, Caso 5.2) — "Gerar projeto" caía no blockWrite() fóssil de
// quotes mesmo com QuoteToProjectDialog.tsx já resolvendo R5 (grava local +
// espelho best-effort G22, independente do dataSource de quotes). O gate
// bloqueava a ABERTURA do diálogo por dataSource de QUOTES — um domínio
// diferente do que a ação realmente escreve (`projects`).
//
// G55 (Fase D, Caso 4.3 — irmão exato do G33) — "Gerar conta a receber"
// continuava no MESMO blockWrite() fóssil, de propósito, enquanto `finance`
// não tinha cutover: QuoteToReceivableDialog.tsx só gravava local. O Pacote
// do Flip de Financeiro (Fase C, main) religou o diálogo — grava local
// sempre + espelho best-effort G22, independente do dataSource de quotes,
// mesmo contrato que liberou "Gerar projeto". `blockWrite()` não tinha mais
// nenhum chamador depois desse fix — removido inteiro (gate vazio).
describe("QuotesSection · G33/G55 — nem 'Gerar projeto' nem 'Gerar conta a receber' são mais bloqueados por blockWrite() em modo Supabase", () => {
  async function renderApprovedQuoteInSupabaseMode() {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote({ status: "aprovado" })], loading: false, error: null,
    } as never);
    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.error).mockClear();
  }

  it("atalho do menu ⋯ abre o diálogo de verdade — sem toast de bloqueio", async () => {
    await renderApprovedQuoteInSupabaseMode();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Gerar projeto"));

    expect(await screen.findByText(
      "Transforme este orçamento aprovado em um projeto local com entregáveis e tarefas iniciais.",
    )).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("Edição de orçamentos"));
  });

  it("dentro do 'Ver' (preview) — onGenerateProject também abre o diálogo, sem bloqueio", async () => {
    await renderApprovedQuoteInSupabaseMode();

    fireEvent.click(screen.getByText("Ver"));
    const generateBtn = await screen.findByRole("button", { name: /Gerar projeto/ });
    fireEvent.click(generateBtn);

    expect(await screen.findByText(
      "Transforme este orçamento aprovado em um projeto local com entregáveis e tarefas iniciais.",
    )).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("Edição de orçamentos"));
  });

  // G55 — antes do fix, este clique disparava o toast fóssil de blockWrite()
  // ("Edição de orçamentos no modo Supabase chega numa próxima fatia") e o
  // diálogo nunca abria — mesmo com QuoteToReceivableDialog.tsx (Fase C de
  // Financeiro) já sabendo gravar local + espelhar pra nuvem.
  it("atalho do menu ⋯ 'Gerar conta a receber' abre o diálogo de verdade — sem toast de bloqueio (G55)", async () => {
    await renderApprovedQuoteInSupabaseMode();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Gerar conta a receber"));

    expect(await screen.findByRole("button", { name: /Gerar conta a receber/ })).toBeInTheDocument();
    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("Edição de orçamentos"));
  });

  it("dentro do 'Ver' (preview) — onGenerateReceivable também abre o diálogo, sem bloqueio (G55)", async () => {
    await renderApprovedQuoteInSupabaseMode();

    fireEvent.click(screen.getByText("Ver"));
    const generateBtn = await screen.findByRole("button", { name: /Gerar conta a receber/ });
    fireEvent.click(generateBtn);

    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(expect.stringContaining("Edição de orçamentos"));
  });

  // G56 — o G55 só provava que o diálogo ABRE; nunca completava o fluxo até
  // o espelho de verdade disparar. Essa era a lacuna real de teste: clicar
  // o item REAL do menu (não um handler direto) até confirmar no diálogo e
  // confirmar que financeRepository.createReceivableFromQuote é chamado —
  // ponta a ponta, não só reachability.
  it("atalho do menu ⋯ 'Gerar conta a receber': depois de confirmar no diálogo, o espelho dispara de verdade (G56)", async () => {
    vi.mocked(financeRepository.createReceivableFromQuote).mockImplementation(
      async (_ws, input) => ({ id: "ft-new", ...input }) as never,
    );
    await renderApprovedQuoteInSupabaseMode();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Gerar conta a receber"));

    const submitBtn = await screen.findByRole("button", { name: /Gerar conta a receber/ });
    fireEvent.click(submitBtn);

    await waitFor(() => expect(financeRepository.createReceivableFromQuote).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ quote_id: "q-cloud-1" }),
    ));
  });
});

describe("QuotesSection · 3º caso (§9a) — status desconhecido nunca mascarado de rascunho", () => {
  it("quote com cloudStatusRaw mostra a badge de aviso na linha e é contada à parte", async () => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote({ status: "rascunho", cloudStatusRaw: "xyz" })],
      loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    const titleEl = await screen.findByText("Orçamento Nuvem");
    const row = titleEl.closest("tr") as HTMLElement;
    // Nunca mascarado: a badge normal de "Rascunho" continua, MAIS a badge de
    // aviso com o valor bruto ao lado — a presença das duas é o que prova que
    // não ficou indistinguível de um rascunho de verdade.
    expect(within(row).getByText("Rascunho")).toBeInTheDocument();
    expect(within(row).getByText('⚠ status bruto: "xyz"')).toBeInTheDocument();
    // Contado à parte: banner aditivo com a contagem, mesmo espírito do
    // totalClientOrphan (Configuracoes.tsx) — não substitui nenhum KPI existente.
    expect(screen.getByText(/1 orçamento\(s\) com status vindo da nuvem/)).toBeInTheDocument();
  });

  it("quote com status conhecido NÃO mostra a badge de aviso nem soma no contador", async () => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote({ status: "aprovado", cloudStatusRaw: undefined })],
      loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    await screen.findByText("Orçamento Nuvem");
    expect(screen.queryByText(/status bruto/)).not.toBeInTheDocument();
    expect(screen.queryByText(/com status vindo da nuvem/)).not.toBeInTheDocument();
  });
});

describe("QuotesSection · escrita bloqueada em modo Supabase (lição O2/O3/O4)", () => {
  async function renderInSupabaseMode(localFns: {
    updateStatus?: ReturnType<typeof vi.fn>;
    duplicateQuote?: ReturnType<typeof vi.fn>;
    deleteQuote?: ReturnType<typeof vi.fn>;
  } = {}) {
    // Pacote do Flip — master flag virou opt-out (default ON); este describe
    // testa especificamente o estado BLOQUEADO, que agora exige desligar
    // explicitamente (antes bastava não tocar na flag).
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [],
      addQuote: vi.fn(),
      updateStatus: localFns.updateStatus ?? vi.fn(),
      updateQuote: vi.fn(),
      duplicateQuote: localFns.duplicateQuote ?? vi.fn(),
      deleteQuote: localFns.deleteQuote ?? vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);
    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    // Limpa o histórico do toast informativo do próprio flip de fonte, pra
    // não contaminar as asserções de "nunca mostra toast de sucesso" abaixo.
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  }

  it("aprovar: nunca chama updateStatus, nunca mostra toast de sucesso", async () => {
    const localUpdateStatus = vi.fn();
    await renderInSupabaseMode({ updateStatus: localUpdateStatus });

    await openQuoteMenu("Orçamento Nuvem");
    // "Aprovado" já é o status atual da quote sintética — usa "Marcar como
    // recusado" pra ter uma ação disponível independente do status inicial.
    fireEvent.click(screen.getByText("Marcar como recusado"));

    expect(localUpdateStatus).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Escrita de orçamentos no Supabase"),
    );
  });

  it("duplicar: nunca chama duplicateQuote, nunca mostra toast de sucesso", async () => {
    const localDuplicateQuote = vi.fn();
    await renderInSupabaseMode({ duplicateQuote: localDuplicateQuote });

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Duplicar"));

    expect(localDuplicateQuote).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("excluir: o diálogo de confirmação abre, mas confirmar nunca chama deleteQuote", async () => {
    const localDeleteQuote = vi.fn();
    await renderInSupabaseMode({ deleteQuote: localDeleteQuote });

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Excluir"));

    const confirmBtn = await screen.findByRole("button", { name: "Excluir" });
    fireEvent.click(confirmBtn);

    expect(localDeleteQuote).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("criar (Novo orçamento): abre o wizard mas não bloqueia a UI — só bloqueia ao salvar (via handleSave)", async () => {
    // O botão "Novo orçamento" permanece clicável (lição: nenhum botão
    // desaparece) — o bloqueio real é dentro de handleSave, já cobrido pelo
    // guard `if (blockWrite()) return` antes de addQuote. Prova indireta:
    // o botão está habilitado mesmo em modo Supabase.
    await renderInSupabaseMode();
    const newQuoteBtn = screen.getByText("Novo orçamento");
    expect(newQuoteBtn).toBeEnabled();
  });
});

describe("QuotesSection · item 3 (Fatia 10) — exclusão real quando o master flag está ON", () => {
  it("excluir com o master flag ligado chama o soft-delete real, nunca deleteQuote local", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const localDeleteQuote = vi.fn();
    const softDeleteSupabaseQuote = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: localDeleteQuote,
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
      softDeleteQuote: softDeleteSupabaseQuote,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Excluir"));
    const confirmBtn = await screen.findByRole("button", { name: "Excluir" });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(softDeleteSupabaseQuote).toHaveBeenCalledWith("q-cloud-1"));
    expect(localDeleteQuote).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Orçamento excluído");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("excluir com o master flag ligado, mas a chamada falha: toast de erro, nunca toast de sucesso", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const softDeleteSupabaseQuote = vi.fn().mockRejectedValue(new Error("falhou"));

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
      softDeleteQuote: softDeleteSupabaseQuote,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Excluir"));
    const confirmBtn = await screen.findByRole("button", { name: "Excluir" });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(softDeleteSupabaseQuote).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Erro ao excluir orçamento no Supabase.");
  });
});

describe("QuotesSection · item 4 (Fatia 10) — duplicar via RPC compartilhada quando o master flag está ON", () => {
  it("duplicar chama createQuoteWithItems com título sufixado e status rascunho, nunca duplicateQuote local", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const localDuplicateQuote = vi.fn();
    const createSupabaseQuoteWithItems = vi.fn().mockResolvedValue(makeSupabaseMappedQuote());

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: localDuplicateQuote, deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
      createQuoteWithItems: createSupabaseQuoteWithItems,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Duplicar"));

    await waitFor(() => expect(createSupabaseQuoteWithItems).toHaveBeenCalledTimes(1));
    expect(localDuplicateQuote).not.toHaveBeenCalled();
    const [quoteArg, itemsArg] = createSupabaseQuoteWithItems.mock.calls[0];
    expect(quoteArg).toMatchObject({ title: "Orçamento Nuvem (cópia)", status: "rascunho" });
    expect(itemsArg).toEqual(makeSupabaseMappedQuote().items);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Orçamento duplicado"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("duplicar com a chamada falhando: toast de erro, nunca toast de sucesso", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const createSupabaseQuoteWithItems = vi.fn().mockRejectedValue(new Error("falhou"));

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
      createQuoteWithItems: createSupabaseQuoteWithItems,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Duplicar"));

    await waitFor(() => expect(createSupabaseQuoteWithItems).toHaveBeenCalled());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao duplicar orçamento no Supabase."));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe("QuotesSection · item 8 (Fatia 10) — status/criação sob o master flag", () => {
  it("aprovar com o master flag ligado chama updateStatus real, nunca updateStatus local", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const localUpdateStatus = vi.fn();
    const updateSupabaseQuoteStatus = vi.fn().mockResolvedValue(undefined);

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: localUpdateStatus, updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote({ status: "rascunho" })], loading: false, error: null,
      updateStatus: updateSupabaseQuoteStatus,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Marcar como aprovado"));

    await waitFor(() => expect(updateSupabaseQuoteStatus).toHaveBeenCalledWith("q-cloud-1", "aprovado"));
    expect(localUpdateStatus).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Orçamento aprovado"));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("mudança de status falhando: toast de erro, nunca de sucesso", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const updateSupabaseQuoteStatus = vi.fn().mockRejectedValue(new Error("falhou"));

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote({ status: "rascunho" })], loading: false, error: null,
      updateStatus: updateSupabaseQuoteStatus,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Marcar como aprovado"));

    await waitFor(() => expect(updateSupabaseQuoteStatus).toHaveBeenCalled());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao atualizar status do orçamento no Supabase."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("com o master flag explicitamente OFF: aprovar continua bloqueado (nunca chama updateStatus real)", async () => {
    // Pacote do Flip — master flag virou opt-out (default ON); precisa
    // desligar explicitamente pra testar o estado bloqueado.
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    const updateSupabaseQuoteStatus = vi.fn();
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote({ status: "rascunho" })], loading: false, error: null,
      updateStatus: updateSupabaseQuoteStatus,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Marcar como aprovado"));

    expect(updateSupabaseQuoteStatus).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("criar (handleSave) com o master flag ligado chama createQuoteWithItems, nunca addQuote local", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const localAddQuote = vi.fn();
    const createSupabaseQuoteWithItems = vi.fn().mockResolvedValue(makeSupabaseMappedQuote({ id: "q-new" }));

    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: localAddQuote, updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null,
      createQuoteWithItems: createSupabaseQuoteWithItems,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();

    fireEvent.click(screen.getByText("Novo orçamento"));
    fireEvent.change(screen.getByPlaceholderText("Nome do cliente"), { target: { value: "Cliente Novo" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Rebranding 2026"), { target: { value: "Orçamento Novo" } });
    fireEvent.click(screen.getByText("Continuar")); // passo 1 -> 2

    fireEvent.click(screen.getByText("+ Item manual"));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Item X" } });
    // Spinbuttons na ordem do JSX: [0] quantidade do item, [1] preço unitário
    // do item, [2] desconto da página — só o preço precisa de valor > 0 pra
    // passar da validação do passo 2 (quantidade já nasce em 1, válida).
    const spinbuttons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinbuttons[1], { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuar")); // passo 2 -> 3

    fireEvent.click(screen.getByText("Continuar")); // passo 3 -> 4
    fireEvent.click(screen.getByText("Salvar orçamento"));

    await waitFor(() => expect(createSupabaseQuoteWithItems).toHaveBeenCalledTimes(1));
    expect(localAddQuote).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Orçamento salvo"));
    expect(toast.error).not.toHaveBeenCalled();
  });
});

// Achado catalogado na homologação de Financeiro (Fase D, Vendas): o campo
// de valor do item no wizard de orçamento tinha `step={50}` — a validação
// nativa do <input type="number"> rejeita qualquer valor que não seja
// múltiplo de 50 a partir de `min` (R$80 recusado; workaround do operador
// foi R$100). "Desconto (R$)" não tinha `step` nenhum — default implícito
// do HTML é 1, mesmo vício (rejeita centavos, ex. R$79,90). Fix: os dois
// passam a usar `step="0.01"`, mesmo idioma que TODOS os inputs monetários
// de Financeiro.tsx já usam (`step="0.01"`, 4 ocorrências — QuickSaleDialog/
// ExpenseDialog/SupplierDialog/CashAccountDialog).
describe("QuotesSection · NewQuoteWizard — step de centavos nos campos monetários (achado de homologação, Vendas)", () => {
  function openWizardToStep2() {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn().mockReturnValue(makeSupabaseMappedQuote({ id: "q-new" })),
      updateStatus: vi.fn(), updateQuote: vi.fn(), duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);
    renderSection();

    fireEvent.click(screen.getByText("Novo orçamento"));
    fireEvent.change(screen.getByPlaceholderText("Nome do cliente"), { target: { value: "Cliente Novo" } });
    fireEvent.change(screen.getByPlaceholderText("Ex: Rebranding 2026"), { target: { value: "Orçamento Novo" } });
    fireEvent.click(screen.getByText("Continuar")); // passo 1 -> 2

    fireEvent.click(screen.getByText("+ Item manual"));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Item X" } });
    // Spinbuttons na ordem do JSX: [0] quantidade do item, [1] preço
    // unitário do item, [2] desconto da página.
    return screen.getAllByRole("spinbutton") as HTMLInputElement[];
  }

  it("preço do item aceita R$80 (não múltiplo de 50) — sem stepMismatch da validação nativa (falha pré-fix)", () => {
    const spinbuttons = openWizardToStep2();
    fireEvent.change(spinbuttons[1], { target: { value: "80" } });

    expect(spinbuttons[1].validity.stepMismatch).toBe(false);
    expect(spinbuttons[1].checkValidity()).toBe(true);
  });

  it("preço do item aceita centavos (R$79,90)", () => {
    const spinbuttons = openWizardToStep2();
    fireEvent.change(spinbuttons[1], { target: { value: "79.90" } });

    expect(spinbuttons[1].validity.stepMismatch).toBe(false);
    expect(spinbuttons[1].checkValidity()).toBe(true);
  });

  it("desconto aceita centavos (R$79,90) — mesmo vício do preço do item, sem step nenhum antes do fix", () => {
    const spinbuttons = openWizardToStep2();
    fireEvent.change(spinbuttons[2], { target: { value: "79.90" } });

    expect(spinbuttons[2].validity.stepMismatch).toBe(false);
    expect(spinbuttons[2].checkValidity()).toBe(true);
  });

  it("regressão: valores múltiplos de 50 que já funcionavam antes continuam válidos (100, 1500)", () => {
    const spinbuttons = openWizardToStep2();
    fireEvent.change(spinbuttons[1], { target: { value: "100" } });
    expect(spinbuttons[1].checkValidity()).toBe(true);

    fireEvent.change(spinbuttons[1], { target: { value: "1500" } });
    expect(spinbuttons[1].checkValidity()).toBe(true);
  });

  it("valor negativo continua rejeitado (min={0} preservado, não regrediu junto com o fix de step)", () => {
    const spinbuttons = openWizardToStep2();
    fireEvent.change(spinbuttons[1], { target: { value: "-10" } });

    expect(spinbuttons[1].validity.rangeUnderflow).toBe(true);
    expect(spinbuttons[1].checkValidity()).toBe(false);
  });
});

// G44 — achado da Fase D de Projetos: NewQuoteWizard só aceitava nome livre
// de cliente, nunca vinculava clientId a um cliente cadastrado — quote sem
// clientId gerava projeto sem clientId (ficha do cliente cega, contornado só
// por SQL na homologação; gap catalogado no G37/G41). Fix: useClients()
// (sempre local) virou useClientsDataSource() (bifurcado, mesmo hook já
// usado em Financeiro/CRM/Clientes/ProjectsSection) + um <Select> aditivo de
// "cliente existente" ao lado do campo de texto livre já existente (que
// segue 100% intacto, ver 2º teste abaixo).
describe("QuotesSection · G44 — seletor de cliente existente no wizard", () => {
  async function openWizardWithClient(client: { id: string; name: string; company?: string; email?: string; whatsapp?: string }) {
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "local");
    const localAddQuote = vi.fn(() => ({ id: "q-new" }));
    vi.mocked(useClientsDataSource).mockReturnValue({ clients: [client], source: "supabase" } as never);
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: localAddQuote, updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);

    renderSection();
    fireEvent.click(screen.getByText("Novo orçamento"));
    return localAddQuote;
  }

  function fillMinimalQuoteAndSave() {
    fireEvent.change(screen.getByPlaceholderText("Ex: Rebranding 2026"), { target: { value: "Orçamento G44" } });
    fireEvent.click(screen.getByText("Continuar")); // passo 1 -> 2

    fireEvent.click(screen.getByText("+ Item manual"));
    fireEvent.change(screen.getByPlaceholderText("Nome do item"), { target: { value: "Item X" } });
    const spinbuttons = screen.getAllByRole("spinbutton");
    fireEvent.change(spinbuttons[1], { target: { value: "100" } });
    fireEvent.click(screen.getByText("Continuar")); // passo 2 -> 3

    fireEvent.click(screen.getByText("Continuar")); // passo 3 -> 4
    fireEvent.click(screen.getByText("Salvar orçamento"));
  }

  it("selecionar cliente existente no dropdown grava clientId real (uuid da nuvem), não um id inventado", async () => {
    const localAddQuote = await openWizardWithClient({
      id: "client-uuid-1", name: "Cliente Cadastrado", company: "Acme", email: "acme@x.com", whatsapp: "11999999999",
    });

    // O <Select> de cliente existente é o 1º combobox do passo 1 (renderizado
    // antes do <input list> de nome livre, que também tem role="combobox"
    // via mapeamento ARIA nativo de <input list>). Radix Select abre via
    // pointerdown, não click puro — mesma sequência já usada em
    // openQuoteMenu() acima pro DropdownMenu.
    const clientTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.pointerDown(clientTrigger, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(clientTrigger);
    // Radix também renderiza um <select> nativo escondido (autofill/forms)
    // com o mesmo texto em <option> — getAllByText pra descartar o nó
    // OPTION e clicar só na opção customizada de verdade (role="option").
    const options = await screen.findAllByText(/Cliente Cadastrado/);
    const realOption = options.find((el) => el.tagName !== "OPTION") ?? options[0];
    fireEvent.pointerUp(realOption, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(realOption);

    fillMinimalQuoteAndSave();

    await waitFor(() => expect(localAddQuote).toHaveBeenCalledTimes(1));
    expect(localAddQuote).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-uuid-1", clientName: "Cliente Cadastrado", company: "Acme" }),
    );
  });

  it("nome livre (nenhuma seleção no dropdown) continua salvando com clientId indefinido — regressão zero", async () => {
    const localAddQuote = await openWizardWithClient({ id: "client-uuid-1", name: "Cliente Cadastrado" });

    fireEvent.change(screen.getByPlaceholderText("Nome do cliente"), { target: { value: "Cliente Digitado Na Mão" } });
    fillMinimalQuoteAndSave();

    await waitFor(() => expect(localAddQuote).toHaveBeenCalledTimes(1));
    expect(localAddQuote).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: undefined, clientName: "Cliente Digitado Na Mão" }),
    );
  });
});

function renderSectionAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QuotesSection />
    </MemoryRouter>,
  );
}

// G67 — o <Select> de cliente existente do wizard (G44, describe acima) já lê
// a fonte certa (useClientsDataSource), mas o EFEITO DE DEEP LINK que ABRE o
// wizard vindo de outra tela (?newQuote=1&clientId=X, disparado por
// Clientes.tsx "Criar orçamento") ainda lia useClients() (sempre local) e
// comparava o id via Number(). Em modo Supabase o id do cliente é um uuid
// "contrabandeado" como number (useClientsDataSource.ts:9): Number(uuid) vira
// NaN, o bloco de seed inteiro é pulado em silêncio e o wizard abre em
// branco — o operador digita o nome na mão, sem clientId, e o gap trafega
// orçamento -> projeto -> recebível (client_id nulo nos três).
describe("QuotesSection · G67 — deep link ?newQuote=1&clientId=X preenche o wizard", () => {
  beforeEach(() => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);
  });

  it("clientId uuid (cliente só na fonte bifurcada, nunca em useClients local) preenche nome/clientId do wizard", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{ id: "client-uuid-9", name: "Cliente Uuid Nuvem", company: "", email: "", whatsapp: "" }],
      source: "supabase",
    } as never);

    renderSectionAt("/vendas?tab=orcamentos&newQuote=1&clientId=client-uuid-9");

    const nameInput = (await screen.findByPlaceholderText("Nome do cliente")) as HTMLInputElement;
    expect(nameInput.value).toBe("Cliente Uuid Nuvem");
  });

  it("regressão: clientId numérico local antigo continua vinculando (mesmo cliente nos dois hooks — cenário real de modo local, onde useClients() e useClientsDataSource() leem a mesma fonte)", async () => {
    const localClient = { id: 42, name: "Cliente Local Antigo", company: "", email: "", whatsapp: "" };
    vi.mocked(useClients).mockReturnValue({ clients: [localClient] } as never);
    vi.mocked(useClientsDataSource).mockReturnValue({ clients: [localClient], source: "local" } as never);

    renderSectionAt("/vendas?tab=orcamentos&newQuote=1&clientId=42");

    const nameInput = (await screen.findByPlaceholderText("Nome do cliente")) as HTMLInputElement;
    expect(nameInput.value).toBe("Cliente Local Antigo");
  });

  it("sem clientId na URL, wizard abre em branco — comportamento correto preservado", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{ id: "client-uuid-9", name: "Cliente Uuid Nuvem", company: "", email: "", whatsapp: "" }],
      source: "supabase",
    } as never);

    renderSectionAt("/vendas?tab=orcamentos&newQuote=1");

    const nameInput = (await screen.findByPlaceholderText("Nome do cliente")) as HTMLInputElement;
    expect(nameInput.value).toBe("");
  });
});
