// Etapa 9 · Item 4, R4 (UI de Atendimento) — leitura defensiva de `handover_at`
// e chamada da ação `end_human_handover` (docs/qa/etapa-9-bot-fluxo-scriptado-
// r4-ui-atendimento-handover.md). Lógica pura: o `invoke` é injetado.
import { describe, it, expect, vi } from "vitest";
import {
  END_HANDOVER_BOT_STILL_MUTED_DESCRIPTION,
  END_HANDOVER_BOT_STILL_MUTED_TITLE,
  END_HANDOVER_MIGRATION_PENDING_MESSAGE,
  END_HANDOVER_UNASSIGNED_DESCRIPTION,
  endHumanHandover,
  getHandoverAt,
  isAwaitingHuman,
  isHandedOver,
  type InvokeFn,
} from "@/lib/whatsapp/handover";

describe("getHandoverAt / isHandedOver (indicador + degradação sem coluna)", () => {
  it("string ISO em handover_at -> entregue", () => {
    const conv = { id: "c1", handover_at: "2026-10-02T12:00:00.000Z" };
    expect(getHandoverAt(conv)).toBe("2026-10-02T12:00:00.000Z");
    expect(isHandedOver(conv)).toBe(true);
  });

  it("coluna AUSENTE (migration §8-b pendente: linha sem o campo) -> não entregue, sem lançar", () => {
    const rowSemColuna = { id: "c1", assigned_to: null, unread_count: 0 };
    expect(getHandoverAt(rowSemColuna)).toBeNull();
    expect(isHandedOver(rowSemColuna)).toBe(false);
  });

  it("handover_at null (nunca entregue, ou já devolvida) -> não entregue", () => {
    expect(getHandoverAt({ handover_at: null })).toBeNull();
    expect(isHandedOver({ handover_at: null })).toBe(false);
  });

  it("valor que não é string não-vazia (garbage) -> não entregue", () => {
    for (const bad of ["", true, 123, {}, []]) {
      expect(isHandedOver({ handover_at: bad })).toBe(false);
    }
  });

  it("entrada que nem é objeto (null/undefined/string) -> não entregue, sem lançar", () => {
    expect(getHandoverAt(null)).toBeNull();
    expect(getHandoverAt(undefined)).toBeNull();
    expect(getHandoverAt("conversa")).toBeNull();
  });
});

describe("endHumanHandover (ação 'Devolver ao robô')", () => {
  it("sucesso -> { kind: 'ok' } e chama whatsapp-instance com o contrato da R4 §4", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const result = await endHumanHandover(invoke as unknown as InvokeFn, "ws-1", "conv-1");

    // servidor sem os campos novos (resposta só { ok: true }) => ambos false: comportamento de antes
    expect(result).toEqual({ kind: "ok", unassigned: false, botStillMuted: false });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("whatsapp-instance", {
      body: { action: "end_human_handover", workspaceId: "ws-1", conversationId: "conv-1" },
    });
  });

  it("409 (coluna handover_at ausente) -> { kind: 'migration_pending' }, NÃO um erro genérico", async () => {
    const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
      context: { status: 409 },
    });
    const invoke = vi.fn().mockResolvedValue({ data: null, error });

    const result = await endHumanHandover(invoke as unknown as InvokeFn, "ws-1", "conv-1");

    expect(result).toEqual({ kind: "migration_pending" });
  });

  it("outros não-2xx (403/500) -> { kind: 'error' } com a mensagem do erro", async () => {
    for (const status of [400, 403, 500]) {
      const error = Object.assign(new Error(`falhou com ${status}`), { context: { status } });
      const invoke = vi.fn().mockResolvedValue({ data: null, error });
      const result = await endHumanHandover(invoke as unknown as InvokeFn, "ws-1", "conv-1");
      expect(result).toEqual({ kind: "error", message: `falhou com ${status}` });
    }
  });

  it("erro sem `context` (ex.: falha de rede) -> { kind: 'error' }, não confunde com 409", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: new Error("Failed to fetch") });
    const result = await endHumanHandover(invoke as unknown as InvokeFn, "ws-1", "conv-1");
    expect(result).toEqual({ kind: "error", message: "Failed to fetch" });
  });

  it("invoke que LANÇA -> { kind: 'error' }, nunca propaga a exceção", async () => {
    const invoke = vi.fn().mockRejectedValue(new Error("boom"));
    const result = await endHumanHandover(invoke as unknown as InvokeFn, "ws-1", "conv-1");
    expect(result).toEqual({ kind: "error", message: "boom" });
  });

  it("erro sem mensagem legível -> mensagem padrão em português", async () => {
    const invoke = vi.fn().mockResolvedValue({ data: null, error: {} });
    const result = await endHumanHandover(invoke as unknown as InvokeFn, "ws-1", "conv-1");
    expect(result).toEqual({ kind: "error", message: "Falha ao devolver a conversa ao robô." });
  });

  it("a mensagem honesta do 409 fala em migration pendente e diz que nada foi alterado", () => {
    expect(END_HANDOVER_MIGRATION_PENDING_MESSAGE).toMatch(/migration/i);
    expect(END_HANDOVER_MIGRATION_PENDING_MESSAGE).toMatch(/operador/i);
    expect(END_HANDOVER_MIGRATION_PENDING_MESSAGE).toMatch(/Nada foi alterado/);
  });

  // Os 3 desfechos da devolução (contrato do servidor: { ok, cleared, unassigned, botStillMuted }).
  describe("resultado da devolução nos 3 casos", () => {
    const run = async (data: unknown) =>
      endHumanHandover(vi.fn().mockResolvedValue({ data, error: null }) as unknown as InvokeFn, "ws-1", "conv-1");

    it("atribuição AUTOMÁTICA desfeita -> unassigned: true, robô livre", async () => {
      expect(await run({ ok: true, cleared: {}, unassigned: true, botStillMuted: false })).toEqual({
        kind: "ok",
        unassigned: true,
        botStillMuted: false,
      });
    });

    it("atribuição MANUAL + gatilho em Triagem -> botStillMuted: true (nada desatribuído)", async () => {
      expect(await run({ ok: true, cleared: {}, unassigned: false, botStillMuted: true })).toEqual({
        kind: "ok",
        unassigned: false,
        botStillMuted: true,
      });
    });

    it("SEM atribuição -> nenhum dos dois", async () => {
      expect(await run({ ok: true, cleared: {}, unassigned: false, botStillMuted: false })).toEqual({
        kind: "ok",
        unassigned: false,
        botStillMuted: false,
      });
    });

    it("só `true` literal conta: corpo vazio/null/texto/valores truthy não-booleanos viram false", async () => {
      for (const data of [null, undefined, "ok", 1, [], { unassigned: "true", botStillMuted: 1 }]) {
        expect(await run(data)).toEqual({ kind: "ok", unassigned: false, botStillMuted: false });
      }
    });
  });

  it("os textos usam o vocabulário real da tela e não mandam 'remover atribuição' (não há controle pra isso)", () => {
    expect(END_HANDOVER_UNASSIGNED_DESCRIPTION).toMatch(/Robô de volta e conversa sem atribuição/);
    expect(END_HANDOVER_BOT_STILL_MUTED_TITLE).toMatch(/robô continua em silêncio/);
    expect(END_HANDOVER_BOT_STILL_MUTED_DESCRIPTION).toContain("Apenas Conversas Novas (Triagem)");
    expect(END_HANDOVER_BOT_STILL_MUTED_DESCRIPTION).toContain("Qualquer Conversa (Irrestrito)");
    expect(END_HANDOVER_BOT_STILL_MUTED_DESCRIPTION).toContain("Robô IA");
    expect(END_HANDOVER_BOT_STILL_MUTED_DESCRIPTION).not.toMatch(/remov/i);
  });
});

describe("isAwaitingHuman — badge 'Aguardando humano' (entregue E sem atendente)", () => {
  const HANDED = "2026-10-02T12:00:00.000Z";

  it("entregue e SEM atendente (null / ausente / vazio) -> aguardando", () => {
    expect(isAwaitingHuman({ handover_at: HANDED, assigned_to: null })).toBe(true);
    expect(isAwaitingHuman({ handover_at: HANDED })).toBe(true); // linha sem a chave
    expect(isAwaitingHuman({ handover_at: HANDED, assigned_to: "" })).toBe(true);
  });

  it("entregue e COM atendente -> não é 'aguardando' (é o 'Humano' calmo)", () => {
    expect(isAwaitingHuman({ handover_at: HANDED, assigned_to: "user-1" })).toBe(false);
  });

  it("NÃO entregue -> nunca aguardando, atribuída ou não (inclui coluna handover_at ausente)", () => {
    expect(isAwaitingHuman({ handover_at: null, assigned_to: null })).toBe(false);
    expect(isAwaitingHuman({ assigned_to: null })).toBe(false); // sem a coluna (migration pendente)
    expect(isAwaitingHuman({ handover_at: null, assigned_to: "user-1" })).toBe(false);
  });

  it("entrada que nem é objeto -> false, sem lançar", () => {
    for (const bad of [null, undefined, "c", 7]) expect(isAwaitingHuman(bad)).toBe(false);
  });
});
