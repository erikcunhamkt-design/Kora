// G31 (item 1/3) — loadSettings (useCallback, dep array [workspaceId]) lia
// `nodes` diretamente no fallback legado (sem flow_data salvo). O lint exigia
// `nodes` no dep array, mas isso recriaria loadSettings a cada edição do
// fluxo — e o useEffect de carga (linha ~183, dep [workspaceId, loadSettings])
// re-disparia o fetch ao Supabase a cada edição, não só na montagem. Fix:
// padrão "latest ref" (mesmo molde de useTaskReminders.ts:22-23) — loadSettings
// lê nodesRef.current, nodes sai do dep array, o warning some sem mudar quando
// o fetch dispara. Este teste prova exatamente essa garantia: editar o fluxo
// (clicar numa opção do node de gatilho) NÃO dispara um segundo fetch.
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { maybeSingle, eq, select, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

describe("WhatsAppBotConfig · G31 (useRef latest-ref) — editar o fluxo não re-dispara fetch", () => {
  it("clicar numa opção do node de gatilho muda o estado mas não chama supabase.from() de novo", async () => {
    render(<WhatsAppBotConfig workspaceId="ws-1" />);

    // Aguarda o loading terminar (loadSettings resolvido) — 1 fetch inicial.
    const triageOption = await screen.findByText("Apenas Conversas Novas (Triagem)");
    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("whatsapp_bot_settings");

    // Edita o fluxo: alterna respondAll do node de gatilho (setNodes real).
    fireEvent.click(triageOption);

    // A opção clicada deve refletir a mudança de estado (prova de que a edição
    // realmente aconteceu, não um clique sem efeito).
    expect(triageOption.parentElement).toHaveClass("border-violet-500");

    // O ponto central do achado: nenhum fetch novo — loadSettings não foi
    // recriado/re-disparado pela edição do fluxo.
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
});
