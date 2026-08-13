// Testes do módulo de feature flags centralizado (Etapa 4a).
// Provam que cada acessor preserva chave, default e formato gravado das
// leituras/escritas soltas que ele substitui.
import { describe, it, expect, beforeEach } from "vitest";

import {
  BOOLEAN_FLAG_KEYS,
  CRM_DATA_SOURCE_KEY,
  TECHNICAL_SHEETS_DATA_SOURCE_KEY,
  TECHNICAL_SHEETS_EXPERIMENTAL_KEY,
  TECHNICAL_SHEETS_AUTOSAVE_KEY,
  getBooleanFlag,
  setBooleanFlag,
  getTechnicalSheetExperimentalEnabled,
  setTechnicalSheetExperimentalEnabled,
  getTechnicalSheetAutoSaveEnabled,
  setTechnicalSheetAutoSaveEnabled,
  getCrmDataSource,
  setCrmDataSource,
  getTechnicalSheetDataSource,
  setTechnicalSheetDataSource,
  QUOTES_DATA_SOURCE_KEY,
  getQuotesDataSource,
  setQuotesDataSource,
  PROJECTS_DATA_SOURCE_KEY,
  getProjectsDataSource,
  setProjectsDataSource,
} from "@/config/flags";

beforeEach(() => {
  localStorage.clear();
});

describe("flags · booleanas opt-in", () => {
  it("default é false quando a chave não existe", () => {
    expect(getBooleanFlag("quotesSupabaseApproval")).toBe(false);
    expect(getBooleanFlag("supabaseOperationalDashboard")).toBe(false);
  });

  it("lê true apenas para o literal \"true\"", () => {
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "true");
    expect(getBooleanFlag("quotesSupabaseApproval")).toBe(true);
  });

  it("lê false para \"false\", string vazia ou lixo", () => {
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "false");
    expect(getBooleanFlag("quotesSupabaseApproval")).toBe(false);
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "");
    expect(getBooleanFlag("quotesSupabaseApproval")).toBe(false);
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "1");
    expect(getBooleanFlag("quotesSupabaseApproval")).toBe(false);
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "TRUE");
    expect(getBooleanFlag("quotesSupabaseApproval")).toBe(false);
  });

  it("grava exatamente \"true\"/\"false\" na chave certa", () => {
    setBooleanFlag("crmSupabaseCreateQuote", true);
    expect(localStorage.getItem(BOOLEAN_FLAG_KEYS.crmSupabaseCreateQuote)).toBe("true");
    setBooleanFlag("crmSupabaseCreateQuote", false);
    expect(localStorage.getItem(BOOLEAN_FLAG_KEYS.crmSupabaseCreateQuote)).toBe("false");
  });

  it("round-trip: o que grava é o que lê", () => {
    setBooleanFlag("tasksSupabaseStatusTransition", true);
    expect(getBooleanFlag("tasksSupabaseStatusTransition")).toBe(true);
    setBooleanFlag("tasksSupabaseStatusTransition", false);
    expect(getBooleanFlag("tasksSupabaseStatusTransition")).toBe(false);
  });

  it("cada nome mapeia para a chave kora.*.enabled esperada", () => {
    // trava anti-regressão: qualquer renomeio de chave quebra aqui.
    // (as flags da ficha técnica NÃO estão aqui — ver bloco opt-out abaixo.)
    expect(BOOLEAN_FLAG_KEYS.quotesSupabaseExperimental).toBe("kora.quotes.supabaseExperimental.enabled");
    expect(BOOLEAN_FLAG_KEYS.quotesSupabaseCreateProject).toBe("kora.quotes.supabaseCreateProject.enabled");
    expect(BOOLEAN_FLAG_KEYS.quotesSupabaseCreateReceivable).toBe("kora.quotes.supabaseCreateReceivable.enabled");
    expect(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval).toBe("kora.quotes.supabaseApproval.enabled");
    expect(BOOLEAN_FLAG_KEYS.crmSupabaseCreateQuote).toBe("kora.crm.supabaseCreateQuote.enabled");
    expect(BOOLEAN_FLAG_KEYS.projectsSupabaseCreateBaseTasks).toBe("kora.projects.supabaseCreateBaseTasks.enabled");
    expect(BOOLEAN_FLAG_KEYS.tasksSupabaseStatusTransition).toBe("kora.tasks.supabaseStatusTransition.enabled");
    expect(BOOLEAN_FLAG_KEYS.supabaseOperationalDashboard).toBe("kora.supabase.operationalDashboard.enabled");
  });
});

describe("flags · ficha técnica · experimental (opt-OUT, default LIGADO)", () => {
  it("default é true quando a chave não existe", () => {
    expect(getTechnicalSheetExperimentalEnabled()).toBe(true);
  });

  it("só o literal \"false\" desliga; qualquer outro valor ⇒ true", () => {
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "false");
    expect(getTechnicalSheetExperimentalEnabled()).toBe(false);
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "true");
    expect(getTechnicalSheetExperimentalEnabled()).toBe(true);
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "");
    expect(getTechnicalSheetExperimentalEnabled()).toBe(true);
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "xpto");
    expect(getTechnicalSheetExperimentalEnabled()).toBe(true);
  });

  it("grava \"true\"/\"false\" na chave certa (round-trip)", () => {
    setTechnicalSheetExperimentalEnabled(false);
    expect(localStorage.getItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY)).toBe("false");
    expect(getTechnicalSheetExperimentalEnabled()).toBe(false);
    setTechnicalSheetExperimentalEnabled(true);
    expect(localStorage.getItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY)).toBe("true");
    expect(getTechnicalSheetExperimentalEnabled()).toBe(true);
  });

  it("chaves catalogadas da ficha técnica batem com as strings reais", () => {
    expect(TECHNICAL_SHEETS_EXPERIMENTAL_KEY).toBe("kora.technicalSheets.supabaseExperimental.enabled");
    expect(TECHNICAL_SHEETS_AUTOSAVE_KEY).toBe("kora.technicalSheets.supabaseAutoSave.enabled");
  });
});

describe("flags · ficha técnica · autosave (opt-OUT, default LIGADO)", () => {
  it("default é true quando a chave não existe", () => {
    expect(getTechnicalSheetAutoSaveEnabled()).toBe(true);
  });

  it("só o literal \"false\" desliga; qualquer outro valor ⇒ true", () => {
    localStorage.setItem(TECHNICAL_SHEETS_AUTOSAVE_KEY, "false");
    expect(getTechnicalSheetAutoSaveEnabled()).toBe(false);
    localStorage.setItem(TECHNICAL_SHEETS_AUTOSAVE_KEY, "true");
    expect(getTechnicalSheetAutoSaveEnabled()).toBe(true);
    localStorage.setItem(TECHNICAL_SHEETS_AUTOSAVE_KEY, "xpto");
    expect(getTechnicalSheetAutoSaveEnabled()).toBe(true);
  });

  it("grava \"true\"/\"false\" na chave certa (round-trip)", () => {
    setTechnicalSheetAutoSaveEnabled(false);
    expect(localStorage.getItem(TECHNICAL_SHEETS_AUTOSAVE_KEY)).toBe("false");
    expect(getTechnicalSheetAutoSaveEnabled()).toBe(false);
    setTechnicalSheetAutoSaveEnabled(true);
    expect(localStorage.getItem(TECHNICAL_SHEETS_AUTOSAVE_KEY)).toBe("true");
    expect(getTechnicalSheetAutoSaveEnabled()).toBe(true);
  });
});

describe("flags · seletor de fonte do CRM (string plana, default supabase)", () => {
  it("default é \"supabase\" quando ausente", () => {
    expect(getCrmDataSource()).toBe("supabase");
  });

  it("só o literal \"local\" seleciona local", () => {
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");
    expect(getCrmDataSource()).toBe("local");
  });

  it("\"supabase\" e qualquer lixo resolvem para \"supabase\"", () => {
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");
    expect(getCrmDataSource()).toBe("supabase");
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "xpto");
    expect(getCrmDataSource()).toBe("supabase");
  });

  it("grava a string plana crua na chave certa", () => {
    setCrmDataSource("local");
    expect(localStorage.getItem(CRM_DATA_SOURCE_KEY)).toBe("local");
    setCrmDataSource("supabase");
    expect(localStorage.getItem(CRM_DATA_SOURCE_KEY)).toBe("supabase");
  });
});

// Etapa 5 · Pacote do Flip (Fase C) — default flipado de "local" pra
// "supabase" (mesmo formato do CRM: só "local" explícito escolhe local).
// Nasceu INVERSO na Fatia 9 (§8.3), sem histórico de homologação de escrita
// ainda — este pacote resolve isso. Lição da Fatia 8 (O2/O3/O4): valor
// explícito já persistido pelo usuário nunca deve ser pisado por um flip de
// default de código — os 2 últimos testes provam isso nos dois sentidos
// (quem já tinha "local" OU "supabase" gravado continua exatamente onde
// estava, mesmo com o novo default).
describe("flags · seletor de fonte de quotes (string plana, default SUPABASE desde o Pacote do Flip)", () => {
  it("default é \"supabase\" quando ausente (mesmo formato do CRM/ficha técnica desde o flip)", () => {
    expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBeNull();
    expect(getQuotesDataSource()).toBe("supabase");
  });

  it("só o literal \"local\" seleciona local", () => {
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "local");
    expect(getQuotesDataSource()).toBe("local");
  });

  it("\"supabase\" e qualquer lixo resolvem para \"supabase\"", () => {
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "supabase");
    expect(getQuotesDataSource()).toBe("supabase");
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "xpto");
    expect(getQuotesDataSource()).toBe("supabase");
    localStorage.setItem(QUOTES_DATA_SOURCE_KEY, "");
    expect(getQuotesDataSource()).toBe("supabase");
  });

  it("grava a string plana crua na chave certa", () => {
    setQuotesDataSource("supabase");
    expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBe("supabase");
    setQuotesDataSource("local");
    expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBe("local");
  });

  it("valor explícito \"local\" já persistido sobrevive (não é o caso ambíguo, mas confirma round-trip)", () => {
    setQuotesDataSource("local");
    expect(getQuotesDataSource()).toBe("local");
  });

  it("valor explícito \"supabase\" já persistido nunca é sobrescrito por uma leitura", () => {
    setQuotesDataSource("supabase");
    // Ler o valor várias vezes (simula múltiplos componentes montando) nunca
    // grava nada de volta — getQuotesDataSource é read-only.
    getQuotesDataSource();
    getQuotesDataSource();
    expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBe("supabase");
    expect(getQuotesDataSource()).toBe("supabase");
  });
});

// Etapa 5 · Fatia N (`projects`) — nasce INVERSO do CRM/ficha técnica, mesmo
// formato de NASCIMENTO de `quotes` na Fatia 9 (antes do Pacote do Flip):
// default "local", só "supabase" explícito escolhe nuvem. Nenhuma
// homologação de escrita existe ainda para `projects` — não herda o default
// "supabase" às cegas.
// Etapa 5 · Pacote do Flip (Fase C) — default flipado de "local" pra
// "supabase" (mesmo formato do CRM/quotes: só "local" explícito escolhe
// local). Nasceu INVERSO na fatia N, sem histórico de homologação de
// escrita ainda — este pacote resolve isso. Lição da Fatia 8 (O2/O3/O4):
// valor explícito já persistido pelo usuário nunca deve ser pisado por um
// flip de default de código — os 2 últimos testes provam isso nos dois
// sentidos.
describe("flags · seletor de fonte de projects (string plana, default SUPABASE desde o Pacote do Flip)", () => {
  it("default é \"supabase\" quando ausente (mesmo formato do CRM/quotes desde o flip)", () => {
    expect(localStorage.getItem(PROJECTS_DATA_SOURCE_KEY)).toBeNull();
    expect(getProjectsDataSource()).toBe("supabase");
  });

  it("só o literal \"local\" seleciona local", () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    expect(getProjectsDataSource()).toBe("local");
  });

  it("\"supabase\" e qualquer lixo resolvem para \"supabase\"", () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "supabase");
    expect(getProjectsDataSource()).toBe("supabase");
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "xpto");
    expect(getProjectsDataSource()).toBe("supabase");
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "");
    expect(getProjectsDataSource()).toBe("supabase");
  });

  it("grava a string plana crua na chave certa", () => {
    setProjectsDataSource("supabase");
    expect(localStorage.getItem(PROJECTS_DATA_SOURCE_KEY)).toBe("supabase");
    setProjectsDataSource("local");
    expect(localStorage.getItem(PROJECTS_DATA_SOURCE_KEY)).toBe("local");
  });

  it("valor explícito \"local\" já persistido sobrevive (não é o caso ambíguo, mas confirma round-trip)", () => {
    setProjectsDataSource("local");
    expect(getProjectsDataSource()).toBe("local");
  });

  it("valor explícito \"supabase\" já persistido nunca é sobrescrito por uma leitura", () => {
    setProjectsDataSource("supabase");
    getProjectsDataSource();
    getProjectsDataSource();
    expect(localStorage.getItem(PROJECTS_DATA_SOURCE_KEY)).toBe("supabase");
    expect(getProjectsDataSource()).toBe("supabase");
  });
});

describe("flags · seletor de fonte da ficha técnica (mapa JSON por cliente, default supabase)", () => {
  it("default é \"supabase\" para qualquer cliente quando ausente", () => {
    expect(getTechnicalSheetDataSource("c1")).toBe("supabase");
    expect(getTechnicalSheetDataSource(42)).toBe("supabase");
  });

  it("resolve \"local\" só quando o mapa marca aquele cliente como \"local\"", () => {
    localStorage.setItem(TECHNICAL_SHEETS_DATA_SOURCE_KEY, JSON.stringify({ c1: "local", c2: "supabase" }));
    expect(getTechnicalSheetDataSource("c1")).toBe("local");
    expect(getTechnicalSheetDataSource("c2")).toBe("supabase");
    // cliente ausente do mapa ⇒ default supabase, mesmo com outros em "local"
    expect(getTechnicalSheetDataSource("c3")).toBe("supabase");
  });

  it("JSON malformado ⇒ default \"supabase\"", () => {
    localStorage.setItem(TECHNICAL_SHEETS_DATA_SOURCE_KEY, "{not json");
    expect(getTechnicalSheetDataSource("c1")).toBe("supabase");
  });

  it("grava por cliente PRESERVANDO os demais", () => {
    localStorage.setItem(TECHNICAL_SHEETS_DATA_SOURCE_KEY, JSON.stringify({ c1: "local" }));
    setTechnicalSheetDataSource("c2", "supabase");
    const stored = JSON.parse(localStorage.getItem(TECHNICAL_SHEETS_DATA_SOURCE_KEY) as string);
    expect(stored.c1).toBe("local"); // preservado
    expect(stored.c2).toBe("supabase");
  });

  it("normaliza a chave do cliente para string (número e string coincidem)", () => {
    setTechnicalSheetDataSource(7, "local");
    expect(getTechnicalSheetDataSource("7")).toBe("local");
    expect(getTechnicalSheetDataSource(7)).toBe("local");
  });
});
