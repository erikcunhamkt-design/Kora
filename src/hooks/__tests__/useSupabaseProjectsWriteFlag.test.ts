// Etapa 5 · Pacote do Flip (projects) — Fase C: flag mestre virou opt-out
// (default ON), mesmo padrão do CRM (Fatia 8) e de quotes (Pacote do Flip).
// Substitui o arquivo da fatia N (que testava o default OFF original) —
// nenhum teste do estado antigo fica pra trás passando por acidente
// (precisão 1 do revisor, mesmo critério já aplicado ao flip de quotes).
import { describe, it, expect, beforeEach } from "vitest";

// Hook reativo removido na rodada G85 (órfão, sem consumidor fora de teste) —
// só o leitor imperativo sobrevive.
import {
  PROJECTS_SUPABASE_WRITE_FLAG_KEY,
  isSupabaseProjectsWriteEnabled,
} from "@/hooks/useSupabaseProjectsWriteFlag";

beforeEach(() => {
  localStorage.clear();
});

describe("useSupabaseProjectsWriteFlag · leitor imperativo (isSupabaseProjectsWriteEnabled)", () => {
  it("default é TRUE quando a chave nunca foi tocada (opt-out desde o Pacote do Flip)", () => {
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);
  });

  it("os 3 estados de override — ausente (novo default), \"true\" explícito, \"false\" explícito", () => {
    // Ausente ⇒ novo default (ON).
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    // "true" explícito ⇒ ON (sem mudança, já era o comportamento esperado).
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    // "false" explícito ⇒ OFF — usuário que desligou ANTES do flip (quando o
    // default ainda era OFF, então "false" não fazia diferença observável)
    // continua desligado depois do flip, sem precisar tocar em nada de novo.
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseProjectsWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém ligado — só o literal \"false\" desliga", () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);
  });
});
