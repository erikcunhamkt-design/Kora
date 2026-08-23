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
import type { Lead } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import type { Quote } from "@/hooks/useQuotes";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import type { Project } from "@/hooks/useProjects";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import type { Task } from "@/hooks/useTasks";
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import { useClientActivityLogs } from "@/hooks/useClientActivityLogs";
import type { Client, ClientContact, ClientManualActivity } from "@/types/domain";
import type { Transaction } from "@/hooks/useFinance";

vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useBifurcatedProjects", () => ({ useBifurcatedProjects: vi.fn() }));
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
vi.mock("@/hooks/useBifurcatedTechnicalSheet", () => ({ useBifurcatedTechnicalSheet: vi.fn() }));
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

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1, name: "Lead X", company: "", email: "", phone: "", serviceType: "",
    estimatedValue: 0, priority: "média", lastInteraction: "", stage: "lead",
    description: "", history: [], notes: "", createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-1", clientName: "Acme Corp", clientEmail: "", clientWhatsapp: "",
    title: "Orçamento X", description: "", items: [], subtotal: 0, discount: 0,
    total: 0, paymentCondition: "", deliveryDeadline: "", validityDays: 0,
    status: "rascunho", createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1", name: "Projeto X", clientName: "Acme Corp", status: "planning",
    priority: "medium", progress: 0, tags: [], createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, title: "Tarefa X", description: "", client: "", project: "",
    priority: "média" as never, deadline: "", status: "pendente" as never,
    createdAt: "2026-01-01T00:00:00.000Z", tags: [], subtasks: [], comments: [],
    ...overrides,
  };
}

function makeContact(overrides: Partial<ClientContact> = {}): ClientContact {
  return {
    id: "ct-1", name: "Fulano",
    createdAt: "2026-01-05T00:00:00.000Z", updatedAt: "2026-01-05T00:00:00.000Z",
    ...overrides,
  };
}

function makeManualActivity(overrides: Partial<ClientManualActivity> = {}): ClientManualActivity {
  return {
    id: "man-1", clientId: 1, type: "meeting", title: "Reunião inicial",
    date: "2026-01-10T00:00:00.000Z", createdAt: "2026-01-10T00:00:00.000Z",
    updatedAt: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useLeads).mockReturnValue({ leads: [] } as never);
  vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
  vi.mocked(useBifurcatedProjects).mockReturnValue([] as never);
  vi.mocked(useBifurcatedTasks).mockReturnValue([] as never);
  vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);
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
    // dueDate explícito no futuro (não o default do factory, "2026-08-20") —
    // achado desta rodada, fora do escopo de B4: o default cruzou pra
    // "hoje"/passado com o avanço do calendário real, fazendo
    // buildFinanceEvents (today = new Date(), sem fake timer neste arquivo)
    // emitir TAMBÉM um evento "Recebível vencido" (mesma descrição, regex
    // do assert abaixo batia nos 2). Não é a intenção do teste (que só quer
    // provar o casamento por client_id, não o cálculo de vencimento) — fix
    // pontual só neste teste, sem tocar o default do factory nem o assert.
    vi.mocked(useBifurcatedFinance).mockReturnValue([makeCloudReceivable({ dueDate: "2099-01-01" })] as never);
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

// ---------------------------------------------------------------------------
// G54 — testes de caracterização pré-refactor (etapa-5-flip-tarefas-pacote.md
// §4). Trava o comportamento ATUAL de buildInferredEvents/manualToEvent/
// mergeManualAndInferredActivities antes da extração em construtores por
// domínio — escritos e provados verdes contra o código de hoje, e devem
// continuar verdes byte-a-byte (mesmos asserts) depois do refactor, já que
// testam via render (caixa-preta do componente exportado), não os símbolos
// internos que vão mudar de módulo.
// ---------------------------------------------------------------------------

describe("ClientActivitiesTab · G54 caracterização — comercial (leads/quotes/contatos)", () => {
  it("cliente criado e atualizado geram eventos comerciais distintos", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-05T00:00:00.000Z" });

    renderTab(client);

    expect(await screen.findByText("Cliente cadastrado")).toBeInTheDocument();
    expect(screen.getByText("Cliente atualizado")).toBeInTheDocument();
  });

  it("createdAt === updatedAt: NÃO duplica em 'Cliente atualizado'", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const sameStamp = "2026-01-01T00:00:00.000Z";
    const client = makeClient({ createdAt: sameStamp, updatedAt: sameStamp });

    renderTab(client);

    expect(await screen.findByText("Cliente cadastrado")).toBeInTheDocument();
    expect(screen.queryByText("Cliente atualizado")).not.toBeInTheDocument();
  });

  it("contato com createdAt válido aparece como 'Contato adicionado' com nome e cargo", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ contacts: [makeContact({ name: "Maria", role: "Financeiro" })] });

    renderTab(client);

    expect(await screen.findByText("Contato adicionado")).toBeInTheDocument();
    expect(screen.getByText("Maria · Financeiro")).toBeInTheDocument();
  });

  it("contato sem createdAt parseável é omitido (data ausente = evento não gerado)", () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ contacts: [makeContact({ name: "SemData", createdAt: undefined })] });

    renderTab(client);

    expect(screen.queryByText("Contato adicionado")).not.toBeInTheDocument();
  });

  it("lead criado e ganho: 2 eventos comerciais com valores e link pro CRM", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useLeads).mockReturnValue({
      leads: [makeLead({ clientId: 1, name: "Oportunidade Y", estimatedValue: 5000, wonAt: "2026-02-01T00:00:00.000Z" })],
    } as never);

    renderTab(client);

    expect(await screen.findByText("Oportunidade criada")).toBeInTheDocument();
    expect(screen.getByText("Oportunidade ganha")).toBeInTheDocument();
    expect(screen.getByText("Ganho")).toBeInTheDocument();
  });

  it("lead perdido com motivo: evento 'Oportunidade perdida' traz o motivo como descrição", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useLeads).mockReturnValue({
      leads: [makeLead({ clientId: 1, stage: "perdido", lostReason: "Preço alto", updatedAt: "2026-02-01T00:00:00.000Z" })],
    } as never);

    renderTab(client);

    expect(await screen.findByText("Oportunidade perdida")).toBeInTheDocument();
    expect(screen.getByText("Preço alto")).toBeInTheDocument();
    expect(screen.getByText("Perdido")).toBeInTheDocument();
  });

  it("orçamento com todos os carimbos de data gera os 5 eventos do ciclo de vida", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeQuote({
        clientId: 1, status: "vencido",
        sentAt: "2026-01-02T00:00:00.000Z",
        approvedAt: "2026-01-03T00:00:00.000Z",
        rejectedAt: "2026-01-04T00:00:00.000Z",
        updatedAt: "2026-01-05T00:00:00.000Z",
      })],
    } as never);

    renderTab(client);

    expect(await screen.findByText("Orçamento criado")).toBeInTheDocument();
    expect(screen.getByText("Orçamento enviado")).toBeInTheDocument();
    expect(screen.getByText("Orçamento aprovado")).toBeInTheDocument();
    expect(screen.getByText("Orçamento recusado")).toBeInTheDocument();
    expect(screen.getByText("Orçamento vencido")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · G54 caracterização — financeiro (recebível vencido)", () => {
  it("recebível pending com dueDate no passado aparece como 'Recebível vencido'", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([
      makeCloudReceivable({ clientId: 1, status: "pending", dueDate: "2020-01-01" }),
    ] as never);
    const client = makeClient({ id: 1 });

    renderTab(client);

    expect(await screen.findByText("Recebível vencido")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · G54 caracterização — projetos", () => {
  it("projeto criado + em andamento + concluído: 3 eventos (checks independentes, não mutuamente exclusivos)", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useBifurcatedProjects).mockReturnValue([
      makeProject({ clientId: 1, status: "in_progress", startDate: "2026-01-02", completedAt: "2026-01-10T00:00:00.000Z" }),
    ] as never);

    renderTab(client);

    expect(await screen.findByText("Projeto criado")).toBeInTheDocument();
    expect(screen.getByText("Projeto iniciado")).toBeInTheDocument();
    expect(screen.getByText("Projeto concluído")).toBeInTheDocument();
  });

  it("projeto cancelado gera 'Projeto cancelado' com tom danger (status Cancelado)", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useBifurcatedProjects).mockReturnValue([
      makeProject({ clientId: 1, status: "cancelled", updatedAt: "2026-01-10T00:00:00.000Z" }),
    ] as never);

    renderTab(client);

    expect(await screen.findByText("Projeto cancelado")).toBeInTheDocument();
    expect(screen.getByText("Cancelado")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · G54 caracterização — tarefas", () => {
  it("tarefa casada por clientId: criada + concluída", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      makeTask({ clientId: 1, status: "concluido" as never, updatedAt: "2026-01-10T00:00:00.000Z" }),
    ] as never);

    renderTab(client);

    expect(await screen.findByText("Tarefa criada")).toBeInTheDocument();
    expect(screen.getByText("Tarefa concluída")).toBeInTheDocument();
    expect(screen.getByText("Concluída")).toBeInTheDocument();
  });

  it("tarefa sem clientId direto, mas com projectId de um projeto do cliente, ainda casa (fallback via clientProjectIds)", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useBifurcatedProjects).mockReturnValue([
      makeProject({ id: "proj-A", clientId: 1 }),
    ] as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      makeTask({ title: "Tarefa via projeto", projectId: "proj-A" }),
    ] as never);

    renderTab(client);

    expect(await screen.findByText("Tarefa criada")).toBeInTheDocument();
    expect(screen.getByText("Tarefa via projeto")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · B4 — tarefas leem via useBifurcatedTasks (etapa-5-flip-tarefas-pacote.md §7)", () => {
  it("tarefa só-nuvem (existe só na fonte de useBifurcatedTasks, nunca em useTasks local) aparece na timeline", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      makeTask({ id: "cloud-task-uuid" as unknown as number, title: "Tarefa só-nuvem", clientId: 1 }),
    ] as never);

    renderTab(client);

    expect(await screen.findByText("Tarefa criada")).toBeInTheDocument();
    expect(screen.getByText("Tarefa só-nuvem")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · G54 caracterização — materiais (ficha técnica)", () => {
  it("asset da ficha técnica com createdAt aparece como 'Material adicionado'", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient();
    // G74 (etapa-5-flip-fichas-pacote.md §11) — buildMaterialEvents.ts lê o
    // resultado de useBifurcatedTechnicalSheet, não mais client.technicalSheet.
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      assets: [{
        id: "a-1", title: "Manual da marca", type: "briefing", url: "https://x",
        accessStatus: "liberado", createdAt: "2026-01-05T00:00:00.000Z",
      } as never],
    } as never);

    renderTab(client);

    expect(await screen.findByText("Material adicionado")).toBeInTheDocument();
    expect(screen.getByText("Manual da marca")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · G54 caracterização — atividades manuais (merge, título, descrição)", () => {
  it("atividade manual vira evento com título 'Rótulo: título' e descrição composta (descrição · resultado · próximo passo)", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient();
    vi.mocked(useClientActivityLogs).mockReturnValue({
      logs: [makeManualActivity({
        type: "meeting", title: "Kickoff", description: "Alinhamento inicial",
        outcome: "Aprovado escopo", nextStep: "Enviar proposta", nextStepDate: "2026-02-01",
      })],
      addLog: vi.fn(), updateLog: vi.fn(), deleteLog: vi.fn(),
    } as never);

    renderTab(client);

    expect(await screen.findByText("Reunião: Kickoff")).toBeInTheDocument();
    expect(screen.getByText(/Alinhamento inicial · Resultado: Aprovado escopo · Próximo passo: Enviar proposta/)).toBeInTheDocument();
  });

  it("atividade manual sem descrição/resultado/próximo passo: sem parágrafo de descrição", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient();
    vi.mocked(useClientActivityLogs).mockReturnValue({
      logs: [makeManualActivity({ type: "call", title: "Ligação rápida", description: undefined })],
      addLog: vi.fn(), updateLog: vi.fn(), deleteLog: vi.fn(),
    } as never);

    renderTab(client);

    expect(await screen.findByText("Ligação: Ligação rápida")).toBeInTheDocument();
  });
});

describe("ClientActivitiesTab · G54 caracterização — dedup e ordenação", () => {
  it("dois contatos com o mesmo id colidem: só o primeiro sobrevive (dedup por id, mantém 1ª ocorrência)", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({
      contacts: [
        makeContact({ id: "dup-1", name: "Primeiro" }),
        makeContact({ id: "dup-1", name: "Segundo" }),
      ],
    });

    renderTab(client);

    expect(await screen.findByText(/Primeiro/)).toBeInTheDocument();
    expect(screen.queryByText(/Segundo/)).not.toBeInTheDocument();
  });

  it("eventos de domínios diferentes são ordenados por data desc (mais recente primeiro), não por domínio", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
    const client = makeClient({ id: 1 });
    vi.mocked(useBifurcatedProjects).mockReturnValue([
      makeProject({ id: "old-proj", clientId: 1, createdAt: "2020-01-01T00:00:00.000Z" }),
    ] as never);
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeQuote({ id: "new-quote", clientId: 1, createdAt: "2024-06-01T00:00:00.000Z" })],
    } as never);

    const { container } = renderTab(client);

    const titles = Array.from(container.querySelectorAll("li p.text-sm.font-medium")).map((el) => el.textContent);
    const quoteIdx = titles.indexOf("Orçamento criado");
    const projectIdx = titles.indexOf("Projeto criado");
    expect(quoteIdx).toBeGreaterThanOrEqual(0);
    expect(projectIdx).toBeGreaterThanOrEqual(0);
    expect(quoteIdx).toBeLessThan(projectIdx);
  });
});
