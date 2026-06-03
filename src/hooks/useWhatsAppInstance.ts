import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";

export type WAInstanceStatus = "disconnected" | "connecting" | "connected";

export interface WhatsAppInstance {
  id: string;
  workspace_id: string;
  status: WAInstanceStatus;
  phone: string | null;
  phone_name: string | null;
  qr_code: string | null;
  connected_at: string | null;
  last_status_at: string | null;
  created_at: string;
  updated_at: string;
}

async function invoke(action: string, workspaceId: string) {
  const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
    body: { action, workspaceId },
  });
  if (error) throw error;
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return (data as { instance: WhatsAppInstance | null }).instance;
}

export function useWhatsAppInstance() {
  const { workspace } = useCurrentWorkspace();
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_instances")
      .select(
        "id, workspace_id, status, phone, phone_name, qr_code, connected_at, last_status_at, created_at, updated_at",
      )
      .eq("workspace_id", workspace.id)
      .maybeSingle();
    setInstance((data as WhatsAppInstance | null) ?? null);
    setLoading(false);
  }, [workspace]);

  useEffect(() => { void load(); }, [load]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (!workspace) return;
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const inst = await invoke("status", workspace.id);
        setInstance(inst);
        if (inst?.status === "connected") stopPolling();
      } catch (e) {
        console.error("wa status poll", e);
      }
    }, 4000);
  }, [workspace, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const connect = useCallback(async () => {
    if (!workspace) return;
    setBusy(true);
    try {
      const inst = await invoke("create", workspace.id);
      setInstance(inst);
      startPolling();
    } finally { setBusy(false); }
  }, [workspace, startPolling]);

  const refreshStatus = useCallback(async () => {
    if (!workspace) return;
    const inst = await invoke("status", workspace.id);
    setInstance(inst);
  }, [workspace]);

  const disconnect = useCallback(async () => {
    if (!workspace) return;
    setBusy(true);
    try {
      const inst = await invoke("disconnect", workspace.id);
      setInstance(inst);
      stopPolling();
    } finally { setBusy(false); }
  }, [workspace, stopPolling]);

  const removeInstance = useCallback(async () => {
    if (!workspace) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "delete", workspaceId: workspace.id },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setInstance(null);
      stopPolling();
    } finally { setBusy(false); }
  }, [workspace, stopPolling]);

  const importInstance = useCallback(
    async (token: string, subdomain?: string) => {
      if (!workspace) return;
      setBusy(true);
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
          body: { action: "import", workspaceId: workspace.id, token, subdomain },
        });
        if (error) throw error;
        if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
        const inst = (data as { instance: WhatsAppInstance | null }).instance;
        setInstance(inst);
        if (inst && inst.status !== "connected") startPolling();
        return inst;
      } finally { setBusy(false); }
    },
    [workspace, startPolling],
  );

  return { instance, loading, busy, connect, disconnect, removeInstance, refreshStatus, reload: load, importInstance };
}
