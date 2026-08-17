// G71 — WhatsAppBotConfig.handleSaveSettings duplicava geminiApiKey/
// gcpServiceAccount dentro de flow_data (nó "ai") sem redação, mesmo padrão
// raiz do G63 (raw_payload). Fix: flow_data salvo com esses 2 campos
// sempre vazios no nó "ai" — a fonte real continua sendo as colunas
// dedicadas (gemini_api_key/gcp_service_account), gravadas no MESMO
// payload. loadSettings faz o backfill inverso: mesmo quando flow_data é um
// array salvo (sem credenciais), o nó "ai" volta a ficar preenchido no
// formulário a partir das colunas dedicadas — sem isso, reabrir a tela
// mostraria os campos de senha em branco mesmo com credencial gravada.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const loadSelect = vi.fn(() => ({ eq }));
  const single = vi.fn().mockResolvedValue({ data: { id: "bot-1" }, error: null });
  const insertSelect = vi.fn(() => ({ single }));
  const insert = vi.fn((_payload: unknown) => ({ select: insertSelect }));
  const from = vi.fn(() => ({ select: loadSelect, insert }));
  return { maybeSingle, eq, loadSelect, single, insertSelect, insert, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

describe("WhatsAppBotConfig · G71 — flow_data nao duplica credenciais do no 'ai'", () => {
  it("salvar com API key preenchida: coluna dedicada tem a chave real, flow_data (no 'ai') NAO tem", async () => {
    render(<WhatsAppBotConfig workspaceId="ws-1" />);

    await screen.findByText("Apenas Conversas Novas (Triagem)"); // load concluido

    // Seleciona o no "ai" (inspector muda pra ele)
    fireEvent.click(screen.getByText("Agente IA (Gemini)"));

    // Digita a API key real no campo de senha
    const apiKeyInput = screen.getByPlaceholderText("AIzaSy...");
    fireEvent.change(apiKeyInput, { target: { value: "REAL-GEMINI-KEY-1234" } });

    // Salva o fluxo
    fireEvent.click(screen.getByText("Salvar Fluxo"));

    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1));

    const payload = mocks.insert.mock.calls[0][0] as {
      gemini_api_key: string | null;
      flow_data: Array<{ type: string; properties: Record<string, unknown> }>;
    };

    // Coluna dedicada: continua com a chave real (fonte de verdade).
    expect(payload.gemini_api_key).toBe("REAL-GEMINI-KEY-1234");

    // flow_data: o no "ai" NUNCA carrega a credencial (G71).
    const aiNodeSaved = payload.flow_data.find((n) => n.type === "ai");
    expect(aiNodeSaved).toBeDefined();
    expect(aiNodeSaved!.properties.geminiApiKey).toBe("");
    expect(JSON.stringify(payload.flow_data)).not.toContain("REAL-GEMINI-KEY-1234");
  });

  it("carregar settings com flow_data (array) salvo sem credencial: formulario reidrata a partir da coluna dedicada", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "bot-1",
        is_active: true,
        system_instruction: "instrucao salva",
        provider: "gemini_api_key",
        model_name: "gemini-3.6-flash",
        gemini_api_key: "ROW-REAL-KEY-5678",
        gcp_project_id: null,
        gcp_region: "us-central1",
        gcp_service_account: null,
        respond_all: true,
        flow_data: [
          { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
          {
            id: "node-ai",
            type: "ai",
            title: "Agente IA (Gemini)",
            enabled: true,
            properties: {
              instruction: "instrucao salva",
              model: "gemini-3.6-flash",
              provider: "gemini_api_key",
              geminiApiKey: "", // G71: flow_data nunca carrega a credencial
              gcpProjectId: "",
              gcpRegion: "us-central1",
              gcpServiceAccount: "",
              customModelName: "",
            },
          },
          { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
          { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: false, properties: { assignTo: "" } },
        ],
      },
      error: null,
    });

    render(<WhatsAppBotConfig workspaceId="ws-2" />);

    await screen.findByText("Agente IA (Gemini)");
    fireEvent.click(screen.getByText("Agente IA (Gemini)"));

    const apiKeyInput = (await screen.findByPlaceholderText("AIzaSy...")) as HTMLInputElement;
    expect(apiKeyInput.value).toBe("ROW-REAL-KEY-5678");
  });
});
