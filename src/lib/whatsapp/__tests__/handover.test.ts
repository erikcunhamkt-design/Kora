// Etapa 9 · Item 4, R4 (UI de Atendimento) — leitura defensiva de `handover_at`
// e chamada da ação `end_human_handover` (docs/qa/etapa-9-bot-fluxo-scriptado-
// r4-ui-atendimento-handover.md). Lógica pura: o `invoke` é injetado.
import { describe, it, expect, vi } from "vitest";
import {
  END_HANDOVER_BOT_STILL_MUTED_TITLE,
  END_HANDOVER_MIGRATION_PENDING_MESSAGE,
  END_HANDOVER_UNASSIGNED_DESCRIPTION,
  endHandoverBotStillMutedDescription,
  endHumanHandover,
  getHandoverAt,
  isAwaitingHuman,
  isHandedOver,
  readServerError,
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

  it("outros não-2xx (400/404/500; o 403 agora é 'forbidden', ver abaixo) -> { kind: 'error' } com a mensagem do erro", async () => {
    for (const status of [400, 404, 500]) {
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

  // Gate de papel do servidor: viewer recebe 403 com a causa no corpo.
  describe("403 (gate de papel) -> { kind: 'forbidden' } com a causa REAL", () => {
    const err403 = (body: unknown) =>
      Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        context: { status: 403, json: async () => body },
      });
    const run = (error: unknown) =>
      endHumanHandover(vi.fn().mockResolvedValue({ data: null, error }) as unknown as InvokeFn, "ws-1", "conv-1");

    it("usa a mensagem do corpo do servidor, não o genérico do supabase-js", async () => {
      const message = "Seu papel no workspace (somente leitura) não permite devolver conversas ao robô.";
      expect(await run(err403({ error: message, reason: "role-cannot-return" }))).toEqual({ kind: "forbidden", message });
    });

    it("corpo ilegível ou sem {error}: continua 'forbidden' (o status manda), com a mensagem do próprio erro", async () => {
      for (const error of [
        Object.assign(new Error("sem corpo"), { context: { status: 403 } }),
        Object.assign(new Error("sem corpo"), { context: { status: 403, json: async () => { throw new Error("não é json"); } } }),
        Object.assign(new Error("sem corpo"), { context: { status: 403, json: async () => ({ outra: "coisa" }) } }),
      ]) {
        expect(await run(error)).toEqual({ kind: "forbidden", message: "sem corpo" });
      }
    });

    it("sem mensagem nenhuma: usa o texto próprio sobre o papel", async () => {
      expect(await run({ context: { status: 403 } })).toEqual({
        kind: "forbidden",
        message: "Seu papel no workspace não permite devolver conversas ao robô.",
      });
    });

    it("NÃO confunde com 409 (migration pendente) nem com erro genérico (500)", async () => {
      expect(await run(Object.assign(new Error("x"), { context: { status: 409 } }))).toEqual({ kind: "migration_pending" });
      expect((await run(Object.assign(new Error("x"), { context: { status: 500 } }))).kind).toBe("error");
    });
  });

  describe("readServerError — a causa do corpo, com fallback", () => {
    it("corpo {error} vence; sem corpo usa a mensagem do erro; sem nada usa o fallback; nunca lança", async () => {
      const withBody = Object.assign(new Error("genérico"), { context: { json: async () => ({ error: "causa real" }) } });
      expect(await readServerError(withBody, "fb")).toBe("causa real");
      expect(await readServerError(new Error("só a mensagem"), "fb")).toBe("só a mensagem");
      expect(await readServerError({}, "fb")).toBe("fb");
      expect(await readServerError(null, "fb")).toBe("fb");
      expect(await readServerError(undefined)).toBe("Falha ao concluir a ação.");
      const badBody = Object.assign(new Error("genérico"), { context: { json: async () => { throw new Error("x"); } } });
      expect(await readServerError(badBody, "fb")).toBe("genérico");
      const emptyError = Object.assign(new Error("genérico"), { context: { json: async () => ({ error: "" }) } });
      expect(await readServerError(emptyError, "fb")).toBe("genérico");
    });
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

  it("o aviso usa o vocabulário real da tela e o NOME de quem segue atribuído (G29), não um genérico", () => {
    expect(END_HANDOVER_UNASSIGNED_DESCRIPTION).toMatch(/Robô de volta e conversa sem atribuição/);
    expect(END_HANDOVER_BOT_STILL_MUTED_TITLE).toMatch(/robô continua em silêncio/);

    const text = endHandoverBotStillMutedDescription("Ana Lima");
    expect(text).toContain("atribuída a Ana Lima");
    expect(text).toContain("Apenas Conversas Novas (Triagem)");
    expect(text).toContain("Qualquer Conversa (Irrestrito)");
    expect(text).toContain("Robô IA");
    // as duas saídas existem na tela (G101 trouxe "Remover atribuição") e são de administrador
    expect(text).toMatch(/administrador pode remover a atribuição/);
    // sem placeholder esquecido
    expect(text).not.toMatch(/<nome>|undefined|null/);
  });

  it("sem nome conhecido o chamador passa 'um atendente' e a frase continua inteira", () => {
    expect(endHandoverBotStillMutedDescription("um atendente")).toContain("atribuída a um atendente e o gatilho");
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
