// G92 (docs/architecture/kora-hub-auditoria-e-plano.md) — leitura bifurcada de
// oportunidades/leads para os consumidores FORA do CRM, mesmo padrão de
// `useBifurcatedTasks.ts` (B4 de Tarefas) / `useBifurcatedFinance.ts`.
//
// Antes: dayCenter (Central do Dia), a timeline/aba Comercial do cliente, o
// diálogo de atividade manual, o onboarding e o seed do wizard de orçamento
// liam `useLeads()` (localStorage) enquanto o CRM em modo Supabase (o default
// pós-flip) lista as oportunidades da NUVEM — um lead criado/editado na nuvem
// não gerava evento fora do CRM e um link `?lead=<id>` nascido de um lead
// local não achava nada na lista da nuvem.
//
// Escolha da fonte: a MESMA do CRM (`CRM.tsx`: `workspace ? getCrmDataSource()
// : "local"`). O id devolvido é o que o CRM usa em modo Supabase — o hash
// numérico estável do uuid (`mapSupabaseOpportunityToLocalLead`, mapper real) —
// então `/crm?lead=${lead.id}` abre o lead certo.
//
// Read-only por desenho (consumidores só exibem/referenciam; a escrita de
// lead fora do CRM, ex.: `updateLead` do QuotesSection, segue local e é outro
// assunto). G32: o fetch da nuvem fica em `useSupabaseOpportunities`
// (`enabled: !!workspaceId`) e dispara mesmo em modo local — design da casa,
// mesma chave de cache do CRM (`includeArchived: true`), sem fetch duplicado.
// G30: nada de `setQueryData` aqui — não há mutation.
import { useMemo } from "react";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { getCrmDataSource } from "@/config/flags";
import { mapSupabaseOpportunityToLocalLead } from "@/services/crm/crmOpportunityMapper";

export function useBifurcatedOpportunities(): Lead[] {
  const { leads: localLeads } = useLeads();
  const { workspace } = useCurrentWorkspace();
  const { opportunities } = useSupabaseOpportunities({ includeArchived: true });

  const useCloud = !!workspace && getCrmDataSource() === "supabase";

  return useMemo(() => {
    if (useCloud) {
      return opportunities.map((opp) => mapSupabaseOpportunityToLocalLead(opp));
    }
    return localLeads;
  }, [useCloud, opportunities, localLeads]);
}
