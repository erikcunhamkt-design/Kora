// Etapa 5 · G64 (funis customizados) — moveOpportunityStage derivava
// won/lost comparando o `stage` (string) contra os literais "fechado"/
// "perdido" do pipeline PADRÃO — um funil customizado ("Gerenciar funis")
// com estágio de fechamento de id diferente nunca disparava status won/lost
// por este caminho, mesmo a UI já tendo o PipelineStage.type disponível no
// chamador (CRM.tsx:handleMoveToStage). Fix: moveOpportunityStage recebe um
// 4º parâmetro opcional `stageType` (o chamador passa `stage.type`) e deriva
// por ele, não pela string.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eqWorkspace = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorkspace }));
  const update = vi.fn((_patch: Record<string, unknown>) => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return { single, select, eqWorkspace, eqId, update, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { crmOpportunitiesRepository } from "@/repositories/crmOpportunitiesRepository";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.single.mockResolvedValue({ data: { id: "opp-1" }, error: null });
});

describe("crmOpportunitiesRepository.moveOpportunityStage — deriva won/lost por PipelineStage.type, não por string literal", () => {
  it("estágio customizado (id arbitrário) com type='won' grava status='won' + won_at preenchido", async () => {
    await crmOpportunitiesRepository.moveOpportunityStage("ws1", "opp-1", "s_ganhamos_custom", "won");

    expect(mocks.update).toHaveBeenCalledTimes(1);
    const patch = mocks.update.mock.calls[0][0];
    expect(patch.stage).toBe("s_ganhamos_custom");
    expect(patch.status).toBe("won");
    expect(patch.won_at).toEqual(expect.any(String));
    expect(patch.lost_at).toBeNull();
  });

  it("estágio customizado com type='lost' grava status='lost' + lost_at preenchido", async () => {
    await crmOpportunitiesRepository.moveOpportunityStage("ws1", "opp-1", "s_perdemos_custom", "lost");

    const patch = mocks.update.mock.calls[0][0];
    expect(patch.stage).toBe("s_perdemos_custom");
    expect(patch.status).toBe("lost");
    expect(patch.lost_at).toEqual(expect.any(String));
    expect(patch.won_at).toBeNull();
  });

  it("estágio customizado com type='open' (ou sem type) grava status='open', mesmo se o id parecer 'fechado'/'perdido' por coincidência", async () => {
    // Prova que a derivação NÃO volta a comparar string: um id que bate
    // literalmente com o pipeline padrão, mas cujo type real é 'open'
    // (ex.: usuário renomeou o significado do estágio), não vira won/lost.
    await crmOpportunitiesRepository.moveOpportunityStage("ws1", "opp-1", "fechado", "open");

    const patch = mocks.update.mock.calls[0][0];
    expect(patch.status).toBe("open");
    expect(patch.won_at).toBeNull();
    expect(patch.lost_at).toBeNull();
  });

  it("sem stageType (chamador antigo, retrocompatibilidade) cai em 'open' — mesmo comportamento do else de antes", async () => {
    await crmOpportunitiesRepository.moveOpportunityStage("ws1", "opp-1", "qualquer-estagio");

    const patch = mocks.update.mock.calls[0][0];
    expect(patch.status).toBe("open");
  });

  it("pipeline padrão: 'fechado' com type='won' continua funcionando (zero regressão)", async () => {
    await crmOpportunitiesRepository.moveOpportunityStage("ws1", "opp-1", "fechado", "won");

    const patch = mocks.update.mock.calls[0][0];
    expect(patch.stage).toBe("fechado");
    expect(patch.status).toBe("won");
  });
});
