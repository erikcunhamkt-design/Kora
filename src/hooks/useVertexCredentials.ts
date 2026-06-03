import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";

export interface VertexCredentialStatus {
  id: string | null;
  hasCredentials: boolean;
  isActive: boolean;
  location: string;
  defaultModel: string;
  projectId: string | null;
  clientEmail: string | null;
  updatedAt: string | null;
}

const empty: VertexCredentialStatus = {
  id: null,
  hasCredentials: false,
  isActive: false,
  location: "us-central1",
  defaultModel: "gemini-2.5-flash",
  projectId: null,
  clientEmail: null,
  updatedAt: null,
};

export function useVertexCredentials() {
  const { workspace } = useCurrentWorkspace();
  const [status, setStatus] = useState<VertexCredentialStatus>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("workspace_ai_credentials")
      .select(
        "id, is_active, location, default_model, credentials_project_id, credentials_client_email, updated_at",
      )
      .eq("workspace_id", workspace.id)
      .eq("provider", "vertex")
      .maybeSingle();
    if (error) {
      console.error("[vertex] load error", error);
      setStatus(empty);
    } else if (!data) {
      setStatus(empty);
    } else {
      setStatus({
        id: data.id,
        hasCredentials: true,
        isActive: !!data.is_active,
        location: data.location || "us-central1",
        defaultModel: data.default_model || "gemini-2.5-flash",
        projectId: (data as { credentials_project_id: string | null }).credentials_project_id ?? null,
        clientEmail: (data as { credentials_client_email: string | null }).credentials_client_email ?? null,
        updatedAt: data.updated_at,
      });
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    if (workspace) refresh();
    else setLoading(false);
  }, [workspace, refresh]);

  const save = useCallback(
    async (jsonText: string, opts?: { location?: string; defaultModel?: string }) => {
      if (!workspace) throw new Error("Workspace não encontrado");
      setBusy(true);
      try {
        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(jsonText);
        } catch {
          throw new Error("O conteúdo não é um JSON válido");
        }
        if (parsed.type !== "service_account" || !parsed.private_key || !parsed.client_email || !parsed.project_id) {
          throw new Error("JSON inválido: precisa ser uma Service Account do Google Cloud com private_key e client_email");
        }
        const payload = {
          workspace_id: workspace.id,
          provider: "vertex",
          credentials_json: parsed as never,
          credentials_project_id: (parsed.project_id as string) ?? null,
          credentials_client_email: (parsed.client_email as string) ?? null,
          location: opts?.location || "us-central1",
          default_model: opts?.defaultModel || "gemini-2.5-flash",
          is_active: true,
        };
        const { error } = await supabase
          .from("workspace_ai_credentials")
          .upsert([payload], { onConflict: "workspace_id,provider" });
        if (error) throw error;
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [workspace, refresh],
  );

  const toggleActive = useCallback(
    async (active: boolean) => {
      if (!workspace || !status.id) return;
      setBusy(true);
      try {
        const { error } = await supabase
          .from("workspace_ai_credentials")
          .update({ is_active: active })
          .eq("id", status.id);
        if (error) throw error;
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [workspace, status.id, refresh],
  );

  const remove = useCallback(async () => {
    if (!workspace || !status.id) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("workspace_ai_credentials")
        .delete()
        .eq("id", status.id);
      if (error) throw error;
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [workspace, status.id, refresh]);

  return { status, loading, busy, refresh, save, toggleActive, remove };
}
