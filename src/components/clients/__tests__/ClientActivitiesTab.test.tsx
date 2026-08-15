// Etapa 5 · Financeiro Fase B (Pacote do Flip, §3.2 do desenho) — prova o
// achado do G41 morrendo aqui: um recebível gerado via CreateReceivableDialog
// (CRM) tem client_id real na nuvem (confirmado em CreateReceivableDialog.tsx:114)
// — lido via useBifurcatedFinance() em modo Supabase, o client_id chega
// como uuid smuggled-como-number (mapSupabaseTransactionToLocal, mesmo
// precedente de mapSupabaseProjectToLocal), batendo por
// `t.clientId === client.id` sem precisar do mapa reverso uuid->local que
// o G41 apontou como não-existente. G41 catalogou isso como "consequência
// prática, não corrigida" — este teste prova que o caminho de LEITURA
// bifurcada resolve sozinho, sem precisar desse mapa reverso.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ClientActivitiesTab } from "@/components/clients/ClientActivitiesTab";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useTasks } from "@/hooks/useTasks";
import { useClientActivityLogs } from "@/hooks/useClientActivityLogs";
import type { Client } from "@/types/domain";
import type { Transaction } from "@/hooks/useFinance";

vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useBifurcatedProjects", () => ({ useBifurcatedProjects: vi.fn() }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/hooks/useClientActivityLogs", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClientActivityLogs")>("@/hooks/useClientActivityLogs");
  return { ...actual, useClientActivityLogs: vi.fn() };
});

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    // uuid da nuvem, cast-como-number — mesmo precedente de
    // useClientsDataSource.ts:9 (client em modo Supabase).
    id: "client-uuid-1" as unknown as number,
    name: "Acme Corp", company: "", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", status: "ativo" as never,
    potentialValue: 0, lastProject: "", lastInteraction: "", observations: "",
    projects: [], tasks: [],
    ...overrides,
  };
}

function makeCloudReceivable(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "sft-1", type: "income", title: "Recebível — Orçamento aprovado", amount: 1500,
    category: "Sem categoria (nuvem)", dueDate: "2026-08-20", status: "pending",
    paymentMethod: "other", recurrence: "none", source: "quote", createdAt: "2026-08-10",
    isDemo: false,
    // client_id real, cast-como-number — exatamente o que
    // mapSupabaseTransactionToLocal produz pra uma linha gravada por
    // CreateReceivableDialog.tsx:114 (client_id: clientId ?? null).
    clientId: "client-uuid-1" as unknown as number,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLeads).mockReturnValue({ leads: [] } as never);
  vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
  vi.mocked(useBifurcatedProjects).mockReturnValue([] as never);
  vi.mocked(useTasks).mockReturnValue({ tasks: [] } as never);
  vi.mocked(useClientActivityLogs).mockReturnValue({
    logs: [], addLog: vi.fn(), updateLog: vi.fn(), deleteLog: vi.fn(),
  } as never);
});

function renderTab(client: Client) {
  return render(
    <MemoryRouter>
      <ClientActivitiesTab client={client} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe("ClientActivitiesTab · G41 — recebível CRM (client_id da nuvem) agora aparece na timeline", () => {
  it("recebível lido via useBifurcatedFinance com client_id uuid-cast bate por clientId, aparece no histórico", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([makeCloudReceivable()] as never);
    const client = makeClient();

    renderTab(client);

    expect(await screen.findByText("Conta a receber gerada")).toBeInTheDocument();
    expect(screen.getByText(/Recebível — Orçamento aprovado/)).toBeInTheDocument();
  });

  it("sem client_id nem clientName batendo, o recebível NÃO aparece (prova que o teste acima testa o casamento de verdade, não um passthrough)", () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([
      makeCloudReceivable({ clientId: "client-uuid-OUTRO" as unknown as number, clientName: undefined }),
    ] as never);
    const client = makeClient();

    renderTab(client);

    expect(screen.queryByText("Conta a receber gerada")).not.toBeInTheDocument();
  });

  it("modo local (Transaction.clientId numérico local) continua casando normalmente — zero regressão", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([
      makeCloudReceivable({ id: "tx-local-1", clientId: 42 }),
    ] as never);
    const client = makeClient({ id: 42 });

    renderTab(client);

    expect(await screen.findByText("Conta a receber gerada")).toBeInTheDocument();
  });
});
