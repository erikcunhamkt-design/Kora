import { supabase } from "@/integrations/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

export interface SupabaseClientInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
  city?: string;
  state?: string;
  address?: string;
  document?: string;
  type?: string;
  status?: string;
  source?: string;
  temperature?: string;
  potential_value?: number;
  total_revenue?: number;
  next_action?: string;
  next_action_date?: string;
  notes?: string;
  tags?: string[];
  archived?: boolean;
  is_demo?: boolean;
  avatar_url?: string | null;
}

export interface SupabaseContactInput {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  is_primary?: boolean;
  is_financial?: boolean;
  is_decision_maker?: boolean;
  notes?: string;
}

export const clientsRepository = {
  async listClients(workspaceId: string) {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async createClient(workspaceId: string, input: SupabaseClientInput) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        workspace_id: workspaceId,
        ...input,
      })
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async updateClient(workspaceId: string, clientId: string, patch: Partial<SupabaseClientInput>) {
    const { data, error } = await supabase
      .from("clients")
      .update(patch)
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async archiveClient(workspaceId: string, clientId: string, archived = true) {
    const { data, error } = await supabase
      .from("clients")
      .update({ archived })
      .eq("id", clientId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async deleteClient(workspaceId: string, clientId: string) {
    const { error } = await supabase
      .from("clients")
      .delete()
      .eq("id", clientId)
      .eq("workspace_id", workspaceId);

    if (error) throw normalizeSupabaseError(error);
    return true;
  },

  async listClientContacts(workspaceId: string, clientId: string) {
    const { data, error } = await supabase
      .from("client_contacts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true });

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async createClientContact(workspaceId: string, clientId: string, input: SupabaseContactInput) {
    const { data, error } = await supabase
      .from("client_contacts")
      .insert({
        workspace_id: workspaceId,
        client_id: clientId,
        ...input,
      })
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async updateClientContact(workspaceId: string, contactId: string, patch: Partial<SupabaseContactInput>) {
    const { data, error } = await supabase
      .from("client_contacts")
      .update(patch)
      .eq("id", contactId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async deleteClientContact(workspaceId: string, contactId: string) {
    const { error } = await supabase
      .from("client_contacts")
      .delete()
      .eq("id", contactId)
      .eq("workspace_id", workspaceId);

    if (error) throw normalizeSupabaseError(error);
    return true;
  },
};
