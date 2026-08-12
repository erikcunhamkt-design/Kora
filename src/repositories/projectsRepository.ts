// Repository for Projects (Supabase)
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { ProjectDeliverable } from "@/hooks/useProjects";

type ProjectUpsert = Database["public"]["Tables"]["projects"]["Insert"];

export interface SupabaseProject {
  id: string;
  workspace_id: string;
  client_id?: string | null;
  quote_id?: string | null;
  opportunity_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  start_date?: string | null;
  due_date?: string | null;
  budget?: number;
  source?: string | null;
  is_demo: boolean;
  archived: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Etapa 5 · Fatia 7 (F1): chave de idempotência do import geral. NULL para linhas
   * legadas ou criadas nativamente na nuvem (ex.: via CreateProjectFromQuoteDialog
   * antes de F1, ou por outro fluxo que não passe pelo import). */
  source_local_id?: string | null;
  /** Etapa 5 · Flip Projetos (item 3-b): coluna pendente da migration
   * 20260811000100 (ESCRITA, AINDA NÃO APLICADA). Até a aplicação, o
   * PostgREST simplesmente não devolve este campo (`undefined`) — o mapper
   * (projectsMapper.ts) trata isso com o mesmo fallback de `?? []`. */
  deliverables?: ProjectDeliverable[] | null;
}

export const projectsRepository = {
  async findProjectByQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("quote_id", quoteId)
      .eq("source", "quote")
      .is("deleted_at", null);

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject[];
  },

  async createProjectFromQuote(workspaceId: string, input: Partial<SupabaseProject>) {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        status: "active",
        source: "quote",
        ...input,
      } as unknown as ProjectUpsert)
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation do índice ux_projects_from_quote (Etapa 3 S5).
      // Corrida perdedora: o projeto deste orçamento já existe -> idempotente,
      // devolve o existente em vez de propagar o erro.
      if (error.code === "23505" && input.quote_id) {
        const existing = await projectsRepository.findProjectByQuote(workspaceId, input.quote_id);
        if (existing[0]) return existing[0];
      }
      throw normalizeSupabaseError(error);
    }
    return data as SupabaseProject;
  },

  async softDeleteProject(workspaceId: string, projectId: string) {
    const { data, error } = await supabase
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject;
  },

  async listProjects(workspaceId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject[];
  },

  // Etapa 5 · Fatia 7 (F2) — import geral, com a árvore de decisão do §7.2 do doc da
  // fatia: dois arbiters de idempotência coexistem sobre a mesma tabela (o novo
  // source_local_id geral, e o ux_projects_from_quote já existente da Etapa 3), cada
  // um cobrindo um caso diferente, nunca a mesma operação de escrita.
  async importProject(
    workspaceId: string,
    sourceLocalId: string,
    input: Partial<SupabaseProject>,
  ) {
    // Guarda (mesma disciplina do NULL guard de financeRepository.importTransaction,
    // Fatia 6): sem source_local_id não-vazio, o upsert abaixo não tem arbiter de
    // idempotência nenhum — falha explícita aqui é melhor que descobrir o bug em
    // produção.
    if (!sourceLocalId || !sourceLocalId.trim()) {
      throw new Error("importProject: source_local_id é obrigatório (arbiter da idempotência)");
    }

    // Projeto quote-linked usa o contrato de negócio já existente da Etapa 3 (no
    // máximo 1 projeto vivo por orçamento) em vez do upsert geral — os dois índices
    // nunca competem pela mesma operação. `input.source` aqui já chega traduzido
    // (mapper resolveCloudProjectSource, §7.2) — só é 'quote' quando quote_id também
    // resolveu, nunca os dois fora de sincronia.
    const isQuoteLinkedProject = input.source === "quote" && !!input.quote_id;

    if (isQuoteLinkedProject) {
      const existing = await projectsRepository.findProjectByQuote(workspaceId, input.quote_id as string);
      if (existing[0]) {
        // Backfill: a linha já existia (criada antes desta fatia, ou nativamente via
        // CreateProjectFromQuoteDialog) e ainda não tem source_local_id — grava agora
        // para que um 2º import da MESMA transação local seja reconhecido pelo
        // arbiter geral também, não só pelo de quote.
        if (!existing[0].source_local_id) {
          const { data, error } = await supabase
            .from("projects")
            .update({ source_local_id: sourceLocalId })
            .eq("id", existing[0].id)
            .eq("workspace_id", workspaceId)
            .select()
            .single();
          if (error) throw normalizeSupabaseError(error);
          return data as SupabaseProject;
        }
        return existing[0];
      }
      return projectsRepository.createProjectFromQuote(workspaceId, {
        ...input,
        source_local_id: sourceLocalId,
      });
    }

    // Caminho geral: qualquer outro source — arbiter é o índice novo, não-parcial
    // (ux_projects_source_local), que nem se aplica à linha quote-linked acima.
    const { data, error } = await supabase
      .from("projects")
      .upsert(
        { workspace_id: workspaceId, source_local_id: sourceLocalId, ...input } as unknown as ProjectUpsert,
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject;
  },
};