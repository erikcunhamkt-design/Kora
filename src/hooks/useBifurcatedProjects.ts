// Etapa 5 · Pacote do Flip (projects) — Fase B, item 2. Hook compartilhado
// pra leitura bifurcada nos consumidores FORA da tela principal (Central do
// Dia, ficha do cliente, timeline de atividades, dialog de log manual) —
// mesmo padrão já usado em ProjectsSection.tsx (item 2, fatia N), extraído
// pra não repetir o combo (useProjects + useSupabaseProjectsSummary +
// useClientsDataSource + mapSupabaseProjectToLocal + getProjectsDataSource)
// em 4 arquivos diferentes.
//
// Read-only por design — estes consumidores só EXIBEM/REFERENCIAM projetos,
// nunca criam/editam um. Escrita continua exclusiva da tela principal
// (ProjectsSection.tsx/ProjectDetailDrawer.tsx, useSupabaseProjects.ts).
//
// `dataSource` é lido uma vez por MONTAGEM do componente que chama este
// hook (getProjectsDataSource(), sem state próprio) — mesmo comportamento
// não-reativo-entre-componentes que a tela principal já tem (nenhum
// seletor de dataSource do app tem sync ao vivo entre instâncias distintas
// hoje, só as FLAGS de escrita têm esse mecanismo). Na prática isso não é
// problema: estes 4 consumidores vivem em páginas diferentes da tela
// principal — trocar de rota já remonta o componente com o valor atual.
import { useMemo } from "react";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useSupabaseProjectsSummary } from "@/hooks/useSupabaseProjectsSummary";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { getProjectsDataSource } from "@/config/flags";
import { mapSupabaseProjectToLocal } from "@/services/projects/projectsMapper";

export function useBifurcatedProjects(): Project[] {
  const { projects: localProjects } = useProjects();
  const { projects: supabaseProjectsRaw } = useSupabaseProjectsSummary();
  const { clients: dsClients } = useClientsDataSource();

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    dsClients.forEach((c) => { map[String(c.id)] = c.name; });
    return map;
  }, [dsClients]);

  const supabaseProjects = useMemo(
    () => supabaseProjectsRaw.map((sp) => mapSupabaseProjectToLocal(sp, clientNameById)),
    [supabaseProjectsRaw, clientNameById],
  );

  return getProjectsDataSource() === "supabase" ? supabaseProjects : localProjects;
}
