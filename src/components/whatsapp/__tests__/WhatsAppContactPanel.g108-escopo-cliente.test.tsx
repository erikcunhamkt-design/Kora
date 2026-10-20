// G108 — o painel do contato mostrava, sob o cliente vinculado, os 5 orçamentos mais recentes do
// WORKSPACE (a consulta de `quotes` filtrava só `workspace_id`) — título e valor de OUTROS clientes.
// As consultas irmãs (projetos, financeiro) já filtravam `client_id`. Junto, a varredura da classe
// achou estado de outra conversa/cliente sobrevivendo na tela (o painel NÃO remonta ao trocar de
// conversa): cliente "sugerido" herdado e listas do cliente anterior.
//
// O banco aqui é um FAKE FUNCIONAL (aplica `.eq`/`.neq`/`.or(ilike)`/`.order`/`.limit` sobre linhas
// reais de 2 clientes com ids uuid — G82) e registra cada consulta: o teste prova o que aparece NA
// TELA e o que foi (ou NÃO foi) consultado.
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const CLIENT_X = "11111111-1111-4111-8111-111111111111";
const CLIENT_Y = "22222222-2222-4222-8222-222222222222";
const CLIENT_Z = "33333333-3333-4333-8333-333333333333";
const WS = "ws-1";

type Row = Record<string, unknown>;

const h = vi.hoisted(() => {
  const state = {
    db: {} as Record<string, Array<Record<string, unknown>>>,
    calls: [] as Array<{ table: string; filters: Array<[string, string, unknown]> }>,
    /** tabelas cuja resposta fica retida até `release()` — pra olhar o estado DURANTE o carregamento */
    held: new Set<string>(),
    waiters: [] as Array<() => void>,
  };
  return state;
});

function release() {
  h.held.clear();
  h.waiters.splice(0).forEach((w) => w());
}

vi.mock("@/integrations/supabase/client", () => {
  function from(table: string) {
    const filters: Array<[string, string, unknown]> = [];
    let orClause: string | null = null;
    let orderBy: { col: string; asc: boolean } | null = null;
    let max: number | null = null;
    let single = false;

    const run = async () => {
      if (h.held.has(table)) await new Promise<void>((r) => h.waiters.push(r));
      h.calls.push({ table, filters: [...filters] });
      let rows = (h.db[table] ?? []).filter((r) =>
        filters.every(([op, col, val]) => (op === "eq" ? r[col] === val : r[col] !== val)),
      );
      if (orClause) {
        const digits = [...orClause.matchAll(/ilike\.%(\d+)%/g)][0]?.[1];
        if (digits) {
          rows = rows.filter((r) => [r.phone, r.whatsapp].some((v) => typeof v === "string" && v.replace(/\D/g, "").includes(digits)));
        }
      }
      if (orderBy) {
        const { col, asc } = orderBy;
        rows = [...rows].sort((a, b) => String(a[col] ?? "").localeCompare(String(b[col] ?? "")) * (asc ? 1 : -1));
      }
      if (max !== null) rows = rows.slice(0, max);
      return { data: single ? (rows[0] ?? null) : rows, error: null };
    };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => (filters.push(["eq", col, val]), builder),
      neq: (col: string, val: unknown) => (filters.push(["neq", col, val]), builder),
      or: (clause: string) => ((orClause = clause), builder),
      order: (col: string, o?: { ascending?: boolean }) => ((orderBy = { col, asc: o?.ascending !== false }), builder),
      limit: (n: number) => ((max = n), builder),
      maybeSingle: () => ((single = true), builder),
      single: () => ((single = true), builder),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => run().then(resolve, reject),
    };
    return builder;
  }
  return { supabase: { from, functions: { invoke: vi.fn() }, auth: { getUser: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { WhatsAppContactPanel, type WhatsAppContactPanelProps } from "@/components/whatsapp/WhatsAppContactPanel";

const clientRow = (id: string, name: string, phone: string): Row => ({
  id, workspace_id: WS, name, email: null, phone, whatsapp: phone, company: `${name} Ltda`,
});
const quoteRow = (id: string, clientId: string, title: string, total: number, createdAt: string, ws = WS): Row => ({
  id, workspace_id: ws, client_id: clientId, title, total, status: "sent", created_at: createdAt,
});

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  h.calls.length = 0;
  h.held.clear();
  h.waiters.length = 0;
  h.db = {
    whatsapp_internal_notes: [],
    clients: [
      clientRow(CLIENT_X, "Cliente Xavier", "5511911110000"),
      clientRow(CLIENT_Y, "Cliente Yara", "5511922220000"),
      clientRow(CLIENT_Z, "Cliente Zélia", "5511933330000"),
    ],
    // Y tem os orçamentos MAIS RECENTES do workspace — é exatamente o que vazava sob o cliente X
    quotes: [
      quoteRow("q-x1", CLIENT_X, "Site do Xavier", 4000, "2026-09-01T10:00:00Z"),
      quoteRow("q-x2", CLIENT_X, "Logo do Xavier", 1500, "2026-09-02T10:00:00Z"),
      quoteRow("q-y1", CLIENT_Y, "Loja da Yara", 99999, "2026-10-10T10:00:00Z"),
      quoteRow("q-y2", CLIENT_Y, "App da Yara", 88888, "2026-10-11T10:00:00Z"),
      quoteRow("q-z1", CLIENT_Z, "Campanha da Zélia", 7777, "2026-10-12T10:00:00Z"),
      // de OUTRO workspace (RLS cobriria; o filtro explícito também)
      quoteRow("q-w2", CLIENT_X, "Orçamento de outro workspace", 1, "2026-10-13T10:00:00Z", "ws-2"),
    ],
    projects: [
      { id: "p-x", workspace_id: WS, client_id: CLIENT_X, title: "Projeto do Xavier", status: "in_progress", created_at: "2026-09-03T10:00:00Z" },
      { id: "p-y", workspace_id: WS, client_id: CLIENT_Y, title: "Projeto da Yara", status: "planning", created_at: "2026-10-03T10:00:00Z" },
    ],
    financial_transactions: [
      { id: "f-x", workspace_id: WS, client_id: CLIENT_X, title: "Parcela do Xavier", amount: 500, status: "pending", due_date: "2026-11-01" },
      { id: "f-y", workspace_id: WS, client_id: CLIENT_Y, title: "Parcela da Yara", amount: 600, status: "pending", due_date: "2026-11-02" },
    ],
  };
});

const baseProps: WhatsAppContactPanelProps = {
  conversationId: "conv-1",
  workspaceId: WS,
  contactName: "Contato",
  contactPhone: "5511900009999", // não bate com nenhum cadastro: nada de sugestão por telefone
  status: "open",
};

function renderPanel(over: Partial<WhatsAppContactPanelProps> = {}) {
  const ui = (props: Partial<WhatsAppContactPanelProps>) => (
    <MemoryRouter>
      <WhatsAppContactPanel {...baseProps} {...props} />
    </MemoryRouter>
  );
  const utils = render(ui(over));
  return { ...utils, rerenderWith: (props: Partial<WhatsAppContactPanelProps>) => utils.rerender(ui(props)) };
}

const tablesQueried = () => h.calls.map((c) => c.table);
const OTHER_CLIENTS_TEXT = [/Loja da Yara/, /App da Yara/, /Campanha da Zélia/, /99\.999/, /88\.888/, /7\.777/];

describe("G108 — orçamentos do painel do contato: só os do CLIENTE VINCULADO", () => {
  it("painel aberto no cliente X: aparecem SÓ os orçamentos de X (título e valor); nenhum de Y/Z nem de outro workspace", async () => {
    renderPanel({ clientId: CLIENT_X });

    expect(await screen.findByText("Site do Xavier")).toBeInTheDocument();
    expect(screen.getByText("Logo do Xavier")).toBeInTheDocument();
    for (const other of OTHER_CLIENTS_TEXT) expect(screen.queryByText(other)).not.toBeInTheDocument();
    expect(screen.queryByText("Orçamento de outro workspace")).not.toBeInTheDocument();
    // contagem exata: 2 orçamentos de X, nada além
    expect(screen.getAllByRole("link", { name: /do Xavier$/ }).filter((a) => a.getAttribute("href")?.startsWith("/orcamentos/"))).toHaveLength(2);
  });

  it("a consulta de quotes leva `client_id` E `workspace_id` (o filtro está na QUERY, não só na tela)", async () => {
    renderPanel({ clientId: CLIENT_X });
    await screen.findByText("Site do Xavier");

    const q = h.calls.find((c) => c.table === "quotes");
    expect(q).toBeDefined();
    expect(q!.filters).toEqual(
      expect.arrayContaining([["eq", "workspace_id", WS], ["eq", "client_id", CLIENT_X]]),
    );
  });

  it("cliente SEM orçamentos (enquanto Y tem os mais recentes do workspace): 'Nenhum orçamento.' — vazio de verdade, sem emprestar os de Y", async () => {
    // Z (vinculada) não tem nenhum orçamento; Y e os demais têm os mais recentes do workspace
    h.db.quotes = h.db.quotes.filter((r) => r.client_id !== CLIENT_Z);
    renderPanel({ clientId: CLIENT_Z, contactPhone: "5511933330000" });
    expect(await screen.findByText("Nenhum orçamento.")).toBeInTheDocument();
    for (const other of [/Site do Xavier/, /Loja da Yara/, /App da Yara/, /99\.999/, /88\.888/]) {
      expect(screen.queryByText(other)).not.toBeInTheDocument();
    }
  });

  it("projetos e financeiro (já escopados) continuam só do cliente vinculado — guarda de regressão da classe", async () => {
    renderPanel({ clientId: CLIENT_X });
    expect(await screen.findByText("Projeto do Xavier")).toBeInTheDocument();
    expect(screen.getByText("Parcela do Xavier")).toBeInTheDocument();
    expect(screen.queryByText("Projeto da Yara")).not.toBeInTheDocument();
    expect(screen.queryByText("Parcela da Yara")).not.toBeInTheDocument();
    for (const table of ["projects", "financial_transactions"]) {
      const c = h.calls.find((x) => x.table === table)!;
      expect(c.filters).toEqual(expect.arrayContaining([["eq", "client_id", CLIENT_X]]));
    }
  });
});

describe("G108/G75 — SEM vínculo: nenhuma consulta de dado de cliente e texto honesto", () => {
  it("sem clientId: ZERO consulta a quotes/projects/financial_transactions", async () => {
    renderPanel({ clientId: null });
    await waitFor(() => expect(tablesQueried()).toContain("whatsapp_internal_notes")); // o painel carregou
    // dá tempo de qualquer consulta indevida acontecer
    await new Promise((r) => setTimeout(r, 30));
    expect(tablesQueried()).not.toContain("quotes");
    expect(tablesQueried()).not.toContain("projects");
    expect(tablesQueried()).not.toContain("financial_transactions");
  });

  it("sem vínculo: 'Orçamentos recentes' diz 'Nenhum cliente vinculado.' (a frase que o painel já usa) e NUNCA 'Nenhum orçamento.'", async () => {
    renderPanel({ clientId: null });
    await waitFor(() => expect(tablesQueried()).toContain("whatsapp_internal_notes"));

    // a frase aparece na seção "Cliente" E na de orçamentos
    expect(screen.getAllByText("Nenhum cliente vinculado.")).toHaveLength(2);
    expect(screen.queryByText("Nenhum orçamento.")).not.toBeInTheDocument();
    for (const other of [/Site do Xavier/, ...OTHER_CLIENTS_TEXT]) expect(screen.queryByText(other)).not.toBeInTheDocument();
  });

  it("desvincular (clientId vira null): lista de orçamentos e cliente somem; nada fica na tela", async () => {
    const { rerenderWith } = renderPanel({ clientId: CLIENT_X });
    expect(await screen.findByText("Site do Xavier")).toBeInTheDocument();

    rerenderWith({ clientId: null });
    await waitFor(() => expect(screen.queryByText("Site do Xavier")).not.toBeInTheDocument());
    expect(screen.queryByText("Cliente Xavier")).not.toBeInTheDocument();
    expect(screen.getAllByText("Nenhum cliente vinculado.")).toHaveLength(2);
  });
});

describe("G108 (classe) — o painel NÃO remonta ao trocar de conversa: nada do cliente ANTERIOR pode sobrar", () => {
  it("X → Y: DURANTE o carregamento nada de X na tela (nem cliente, nem orçamentos, nem projetos); depois só o de Y", async () => {
    const { rerenderWith } = renderPanel({ conversationId: "conv-x", clientId: CLIENT_X });
    expect(await screen.findByText("Site do Xavier")).toBeInTheDocument();

    h.held.add("clients");
    h.held.add("quotes");
    h.held.add("projects");
    h.held.add("financial_transactions");
    rerenderWith({ conversationId: "conv-y", clientId: CLIENT_Y });

    // carregando Y: o que era de X já saiu
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByText("Site do Xavier")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente Xavier")).not.toBeInTheDocument();
    expect(screen.queryByText("Projeto do Xavier")).not.toBeInTheDocument();
    expect(screen.queryByText("Parcela do Xavier")).not.toBeInTheDocument();

    release();
    expect(await screen.findByText("Loja da Yara")).toBeInTheDocument();
    expect(screen.getByText("Cliente Yara")).toBeInTheDocument();
    expect(screen.queryByText("Site do Xavier")).not.toBeInTheDocument();
    expect(screen.queryByText("Logo do Xavier")).not.toBeInTheDocument();
  });

  it("X → vínculo para cliente que NÃO existe: o cliente X não fica no lugar (antes: `if (c.data)` deixava o anterior)", async () => {
    const { rerenderWith } = renderPanel({ conversationId: "conv-x", clientId: CLIENT_X });
    expect(await screen.findByText("Cliente Xavier")).toBeInTheDocument();

    rerenderWith({ conversationId: "conv-gone", clientId: "99999999-9999-4999-8999-999999999999" });
    await waitFor(() => expect(screen.queryByText("Cliente Xavier")).not.toBeInTheDocument());
    expect(screen.queryByText("Site do Xavier")).not.toBeInTheDocument();
  });

  it("X (vinculada) → conversa SEM vínculo: o cliente X NÃO vira a 'sugestão por telefone' (e o botão não liga a conversa nova a X)", async () => {
    const { rerenderWith } = renderPanel({ conversationId: "conv-x", clientId: CLIENT_X });
    expect(await screen.findByText("Cliente Xavier")).toBeInTheDocument();

    rerenderWith({ conversationId: "conv-novo", clientId: null, contactPhone: "5511900009999" });
    await waitFor(() => expect(screen.getAllByText("Nenhum cliente vinculado.")).toHaveLength(2));
    expect(screen.queryByText(/Encontramos um cliente com este telefone/)).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente Xavier")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Vincular a esta conversa" })).not.toBeInTheDocument();
  });

  it("conversa sem vínculo cujo telefone BATE com um cadastro: a sugestão por telefone continua funcionando (comportamento preservado)", async () => {
    renderPanel({ clientId: null, contactPhone: "5511933330000" });
    expect(await screen.findByText(/Encontramos um cliente com este telefone/)).toBeInTheDocument();
    expect(screen.getByText("Cliente Zélia")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vincular a esta conversa" })).toBeInTheDocument();
    // sugestão NÃO é vínculo: nenhuma lista de cliente é consultada/mostrada
    expect(tablesQueried()).not.toContain("quotes");
  });
});
