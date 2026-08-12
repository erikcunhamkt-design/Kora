// Etapa 5 · Flip Projetos (item 4) — espelho best-effort local -> nuvem da
// tela principal (ProjectsSection.tsx/ProjectDetailDrawer.tsx), padrão G22
// (CreateProjectFromQuoteDialog.tsx): LOCAL é sempre autoritativo e grava
// primeiro; este módulo só tenta espelhar DEPOIS, nunca bloqueia nem desfaz
// o local em caso de falha (chamador decide o toast).
//
// Diferente do G22 original (que usa só createProjectFromQuote, sem
// source_local_id — sem link reaproveitável para uma atualização futura),
// este módulo usa o MESMO arbiter de useLocalProjectsImport.ts
// (buildSourceLocalId(installId, localId) + projectsRepository.importProject,
// upsert em (workspace_id, source_local_id)) — o que faz da mesma chamada
// servir tanto de CREATE quanto de UPDATE do espelho (upsert idempotente),
// e mantém o import-map (kora.projects.supabaseImport.v1) consistente com
// a ferramenta de import assistido (nenhuma duplicata se o operador rodar
// as duas vias pro mesmo projeto).
import type { Project } from "@/hooks/useProjects";
import { projectsRepository, type SupabaseProject } from "@/repositories/projectsRepository";
import { mapLocalProjectToSupabase, type ProjectImportMaps } from "@/services/projects/projectsMapper";
import { getInstallId, buildSourceLocalId } from "@/lib/installId";

const IMPORT_META_KEY = "kora.projects.supabaseImport.v1";

type ImportMeta = {
  lastImportedAt: string;
  importedLocalIds: string[];
  skippedLocalIds: string[];
  importedMap: Record<string, string>;
};

function readMeta(): ImportMeta {
  try {
    const raw = localStorage.getItem(IMPORT_META_KEY);
    if (raw) return JSON.parse(raw) as ImportMeta;
  } catch {
    /* ignore — fallback abaixo */
  }
  return { lastImportedAt: "", importedLocalIds: [], skippedLocalIds: [], importedMap: {} };
}

function writeMeta(meta: ImportMeta): void {
  try {
    localStorage.setItem(IMPORT_META_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota / storage desabilitado — espelho já rodou, só a metadata falha */
  }
}

function readMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return (JSON.parse(raw).importedMap ?? {}) as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function readImportMaps(): ProjectImportMaps {
  return {
    clients: readMap("kora.clients.supabaseImport.v1"),
    quotes: readMap("kora.quotes.supabaseImport.v1"),
    opportunities: readMap("kora.crm.supabaseImport.v1"),
  };
}

/**
 * Espelha um projeto local na nuvem (best-effort). Lança em caso de erro —
 * o chamador decide o toast/log (mesmo contrato do G22: falha nunca desfaz
 * nem bloqueia o local, que já foi gravado ANTES desta chamada).
 */
export async function mirrorProjectToSupabase(
  workspaceId: string,
  project: Project,
): Promise<SupabaseProject> {
  const payload = mapLocalProjectToSupabase(project, readImportMaps());
  const sourceLocalId = buildSourceLocalId(getInstallId(), project.id);
  const created = await projectsRepository.importProject(workspaceId, sourceLocalId, payload);

  // Mesma chave que useLocalProjectsImport.ts escreve — mantém os dois
  // caminhos (dual-write nativo e import assistido) consistentes entre si.
  const meta = readMeta();
  meta.importedMap[project.id] = created.id;
  if (!meta.importedLocalIds.includes(project.id)) {
    meta.importedLocalIds = [...meta.importedLocalIds, project.id];
  }
  meta.lastImportedAt = new Date().toISOString();
  writeMeta(meta);

  return created;
}
