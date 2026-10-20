// Etapa 9 · Item 4 (G101) — controle de atribuição no painel de contato: Select de atendente
// (só quem atende, §3.5), "Remover atribuição", gate de papel (não-admin só lê) e
// degradação (lista de atendentes vazia). O painel é controlado pelas props: o dono vem de
// `assignedTo`, a chamada é `onAssign` (a página faz o assign_conversation).
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// Qualquer cadeia do query builder resolve vazio — o painel faz vários SELECTs ao montar
// (notas, cliente...) e nenhum é o alvo destes testes. `fromMock` registra as tabelas lidas.
vi.mock("@/integrations/supabase/client", () => {
  const makeChain = () => {
    let last = "";
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) =>
              resolve({ data: last === "maybeSingle" || last === "single" ? null : [], error: null });
          }
          return () => {
            last = prop;
            return proxy;
          };
        },
      },
    );
    return proxy;
  };
  fromMock.mockImplementation(() => makeChain());
  return { supabase: { from: fromMock, functions: { invoke: vi.fn() }, auth: { getUser: vi.fn() } } };
});
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { WhatsAppContactPanel, type WhatsAppContactPanelProps } from "@/components/whatsapp/WhatsAppContactPanel";
import type { WorkspaceAttendant } from "@/lib/whatsapp/assignment";

// Radix Select precisa destes polyfills em jsdom (mesmo setup de QuotesSection.test.tsx).
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

const TEAM: WorkspaceAttendant[] = [
  { id: "u-ana", name: "Ana Lima", role: "member" },
  { id: "u-bia", name: "Bia Souza", role: "admin" },
  { id: "u-caio", name: "Caio Reis", role: "viewer" },
  { id: "u-dora", name: "Dora Dona", role: "owner" },
];

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  fromMock.mockClear();
});

function renderPanel(overrides: Partial<WhatsAppContactPanelProps> = {}) {
  return render(
    <MemoryRouter>
      <WhatsAppContactPanel
        conversationId="conv-1"
        workspaceId="ws-1"
        contactName="Maria Cliente"
        contactPhone="5511999990000"
        status="open"
        attendants={TEAM}
        canAssign
        onAssign={vi.fn()}
        {...overrides}
      />
    </MemoryRouter>,
  );
}

const trigger = () => screen.queryByRole("combobox", { name: "Atribuir conversa a um atendente" });
const removeButton = () => screen.queryByRole("button", { name: "Remover atribuição" });
const label = () => screen.getByLabelText("Atribuição da conversa");

function openSelect() {
  const t = trigger();
  expect(t).toBeInTheDocument();
  fireEvent.pointerDown(t as HTMLElement, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(t as HTMLElement);
}

describe("WhatsAppContactPanel — controle de atribuição (G101)", () => {
  it("admin: o Select oferece SÓ quem atende (owner/admin/member) — o viewer não aparece", async () => {
    renderPanel();
    openSelect();

    const options = await screen.findAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual(["Ana Lima", "Bia Souza", "Dora Dona"]);
    expect(screen.queryByRole("option", { name: "Caio Reis" })).not.toBeInTheDocument();
  });

  it("escolher um atendente chama onAssign com o id dele", async () => {
    const onAssign = vi.fn();
    renderPanel({ onAssign });
    openSelect();

    fireEvent.click(await screen.findByRole("option", { name: "Bia Souza" }));

    await waitFor(() => expect(onAssign).toHaveBeenCalledTimes(1));
    expect(onAssign).toHaveBeenCalledWith("u-bia");
  });

  it("'Remover atribuição' só existe com dono e chama onAssign(null)", () => {
    const onAssign = vi.fn();
    const { unmount } = renderPanel({ assignedTo: null, onAssign });
    expect(removeButton()).not.toBeInTheDocument();
    unmount();

    renderPanel({ assignedTo: "u-ana", onAssign });
    fireEvent.click(removeButton() as HTMLElement);
    expect(onAssign).toHaveBeenCalledWith(null);
  });

  it("mostra o NOME de quem é o dono e como nasceu a atribuição", () => {
    renderPanel({ assignedTo: "u-ana", assignmentOrigin: "auto" });
    expect(label()).toHaveTextContent("Atribuída a Ana Lima (automática)");
  });

  it("sem dono: 'Sem atendente atribuído' e o Select ainda oferece escolher", () => {
    renderPanel({ assignedTo: null });
    expect(label()).toHaveTextContent("Sem atendente atribuído");
    expect(trigger()).toBeInTheDocument();
    expect(trigger()).toHaveTextContent("Atribuir a…");
  });

  it("dono atual aparece selecionado no Select quando é elegível", () => {
    renderPanel({ assignedTo: "u-bia" });
    expect(trigger()).toHaveTextContent("Bia Souza");
  });

  it("dono que virou viewer: o nome ainda resolve no rótulo, mas ele não é opção (Select no placeholder)", () => {
    renderPanel({ assignedTo: "u-caio" });
    expect(label()).toHaveTextContent("Atribuída a Caio Reis");
    expect(trigger()).toHaveTextContent("Atribuir a…");
  });

  it("enquanto a atribuição roda o controle fica travado (sem duplo clique) e destrava depois", async () => {
    let resolveAssign: (v: unknown) => void = () => {};
    const onAssign = vi.fn(() => new Promise((res) => { resolveAssign = res; }));
    renderPanel({ assignedTo: "u-ana", onAssign });

    fireEvent.click(removeButton() as HTMLElement);
    await waitFor(() => expect(removeButton()).toBeDisabled());
    expect(trigger()).toBeDisabled();

    fireEvent.click(removeButton() as HTMLElement); // 2º clique ignorado
    expect(onAssign).toHaveBeenCalledTimes(1);

    await act(async () => { resolveAssign(true); });
    await waitFor(() => expect(removeButton()).toBeEnabled());
  });
});

describe("WhatsAppContactPanel — gate de papel (não-admin)", () => {
  it("canAssign false/ausente: a atribuição aparece SÓ como texto — sem Select e sem 'Remover atribuição'", () => {
    for (const canAssign of [false, undefined]) {
      const { unmount } = renderPanel({ canAssign, assignedTo: "u-ana", assignmentOrigin: "manual" });
      expect(label()).toHaveTextContent("Atribuída a Ana Lima (manual)");
      expect(trigger()).not.toBeInTheDocument();
      expect(removeButton()).not.toBeInTheDocument();
      unmount();
    }
  });

  it("sem onAssign (chamador antigo) o controle não aparece nem para admin", () => {
    renderPanel({ onAssign: undefined, assignedTo: "u-ana" });
    expect(trigger()).not.toBeInTheDocument();
    expect(label()).toHaveTextContent("Atribuída a Ana Lima");
  });
});

describe("WhatsAppContactPanel — degradação", () => {
  it("lista de atendentes vazia/ausente (falha ao carregar): Select DESABILITADO com aviso, rótulo genérico honesto, remover continua possível", () => {
    for (const attendants of [[], undefined]) {
      const { unmount } = renderPanel({ attendants, assignedTo: "u-ana" });
      expect(trigger()).toBeDisabled();
      expect(trigger()).toHaveTextContent("Nenhum atendente disponível");
      expect(label()).toHaveTextContent("Atribuída a um atendente");
      expect(removeButton()).toBeEnabled();
      unmount();
    }
  });

  it("origem desconhecida (coluna assignment_origin ausente): o rótulo não afirma 'manual'/'automática'", () => {
    renderPanel({ assignedTo: "u-ana", assignmentOrigin: null });
    expect(label()).toHaveTextContent(/^Atribuída a Ana Lima$/);
  });

  it("a leitura de membros do painel (relação inexistente) saiu: nenhuma consulta a workspace_members", () => {
    renderPanel();
    const tables = fromMock.mock.calls.map(([t]) => t);
    expect(tables).not.toContain("workspace_members");
  });
});

describe("WhatsAppContactPanel — o que 'Devolver ao robô' faz com esta atribuição", () => {
  const hint = () => screen.queryByText(/Devolver ao robô/);

  it("entregue + automática: diz que a devolução REMOVE; entregue + manual: diz que NÃO desfaz", () => {
    const { unmount } = renderPanel({ handoverAt: "2026-10-02T12:00:00.000Z", assignedTo: "u-ana", assignmentOrigin: "auto" });
    expect(hint()).toHaveTextContent("remove esta atribuição automática");
    unmount();

    renderPanel({ handoverAt: "2026-10-02T12:00:00.000Z", assignedTo: "u-ana", assignmentOrigin: "manual" });
    expect(hint()).toHaveTextContent("não desfaz uma atribuição manual");
  });

  it("não entregue ou origem desconhecida: sem dica (não afirma o que não sabe)", () => {
    const { unmount } = renderPanel({ handoverAt: null, assignedTo: "u-ana", assignmentOrigin: "manual" });
    expect(hint()).not.toBeInTheDocument();
    unmount();

    renderPanel({ handoverAt: "2026-10-02T12:00:00.000Z", assignedTo: "u-ana", assignmentOrigin: null });
    expect(hint()).not.toBeInTheDocument();
  });
});

// G103 (fatia 2): papel `viewer` = somente leitura — as tags aparecem, mas sem "×" e sem campo de nova tag
// (`update_conversation_tags` dá 403 para esse papel; a tela não oferece o que o servidor nega).
describe("WhatsAppContactPanel — tags e somente leitura (G103)", () => {
  it("padrão (canEditTags ausente): a tag tem '×' e há o campo 'Nova tag...'", () => {
    const onUpdateTags = vi.fn();
    renderPanel({ tags: ["vip"], onUpdateTags });

    fireEvent.click(screen.getByText("vip ×"));
    expect(onUpdateTags).toHaveBeenCalledWith([]);
    expect(screen.getByPlaceholderText("Nova tag...")).toBeInTheDocument();
  });

  it("canEditTags=false: a tag aparece SEM '×', não é clicável e não há campo de nova tag", () => {
    const onUpdateTags = vi.fn();
    renderPanel({ tags: ["vip"], canEditTags: false, onUpdateTags });

    expect(screen.getByText("vip")).toBeInTheDocument();
    expect(screen.queryByText("vip ×")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Nova tag...")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("vip"));
    expect(onUpdateTags).not.toHaveBeenCalled();
  });

  it("canEditTags=false sem tags: 'Sem tags' e nenhum campo", () => {
    renderPanel({ tags: [], canEditTags: false });

    expect(screen.getByText("Sem tags")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Nova tag...")).not.toBeInTheDocument();
  });
});
