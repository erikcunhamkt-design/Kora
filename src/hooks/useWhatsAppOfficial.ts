import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";

export type WAOfficialStatus = "not_configured" | "configured" | "verified";

export interface WAOfficialCredentials {
  id: string;
  workspace_id: string;
  phone_number_id: string;
  waba_id: string;
  display_phone_number: string | null;
  verified_name: string | null;
  verify_token: string;
  status: WAOfficialStatus;
  last_verified_at: string | null;
  has_app_secret: boolean;
  created_at: string;
  updated_at: string;
}

async function call<T = unknown>(action: string, workspaceId: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("whatsapp-official-credentials", {
    body: { action, workspaceId, ...extra },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

export function useWhatsAppOfficial() {
  const { workspace } = useCurrentWorkspace();
  const [credentials, setCredentials] = useState<WAOfficialCredentials | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const data = await call<{ credentials: WAOfficialCredentials | null }>("get", workspace.id);
      setCredentials(data.credentials);
    } catch (e) {
      console.error("wa-official load", e);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => { void load(); }, [load]);

  const save = useCallback(async (input: {
    phone_number_id: string;
    waba_id: string;
    access_token?: string;
    app_secret?: string | null;
  }) => {
    if (!workspace) return;
    setBusy(true);
    try {
      const data = await call<{ credentials: WAOfficialCredentials }>("upsert", workspace.id, input);
      setCredentials(data.credentials);
      return data.credentials;
    } finally { setBusy(false); }
  }, [workspace]);

  const verify = useCallback(async () => {
    if (!workspace) return;
    setBusy(true);
    try {
      const data = await call<{ credentials: WAOfficialCredentials }>("verify", workspace.id);
      setCredentials(data.credentials);
      return data.credentials;
    } finally { setBusy(false); }
  }, [workspace]);

  const remove = useCallback(async () => {
    if (!workspace) return;
    setBusy(true);
    try {
      await call("delete", workspace.id);
      setCredentials(null);
    } finally { setBusy(false); }
  }, [workspace]);

  const setActive = useCallback(async () => {
    if (!workspace) return;
    await call("set_active", workspace.id);
  }, [workspace]);

  return { credentials, loading, busy, save, verify, remove, setActive, reload: load };
}
