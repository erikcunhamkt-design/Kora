// Etapa 9 · Item 4, R4 (UI de Atendimento) — leitura defensiva de `handover_at`
// e chamada da ação `end_human_handover` (docs/qa/etapa-9-bot-fluxo-scriptado-
// r4-ui-atendimento-handover.md). Lógica pura: o `invoke` é injetado.
import { describe, it, expect, vi } from "vitest";
import {
  END_HANDOVER_MIGRATION_PENDING_MESSAGE,
  endHumanHandover,
  getHandoverAt,
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

    expect(result).toEqual({ kind: "ok" });
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
});
