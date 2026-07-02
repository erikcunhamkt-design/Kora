// Workspace localization settings (Batch 4c). Bridges the DB workspace row and
// the client-side LanguageContext used by the format layer.
//
// Sync direction:
//   • currency + timezone are NEW columns (defaults BRL / null) → safe to
//     hydrate FROM the workspace on load, making the DB the source of truth.
//   • language is deliberately NOT hydrated from workspace.locale: every existing
//     workspace defaults to 'pt-BR', so hydrating would reset a user who picked
//     English. The language selector keeps its own persistence; instead we write
//     the chosen language back into workspace.locale on save.
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useTranslation, type Language } from "@/contexts/LanguageContext";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

const SUPPORTED_LANGS: Language[] = ["pt-BR", "pt-PT", "en", "es"];

export interface WorkspaceSettingsPatch {
  currency?: string;
  locale?: string;
  timezone?: string | null;
}

export function useWorkspaceSettings() {
  const { workspace, loading } = useCurrentWorkspace();
  const { setLanguage, setCurrency, setTimeZone } = useTranslation();
  const [saving, setSaving] = useState(false);
  const hydratedFor = useRef<string | null>(null);

  // Hydrate client formatting context from the workspace row, once per workspace.
  useEffect(() => {
    if (!workspace || hydratedFor.current === workspace.id) return;
    hydratedFor.current = workspace.id;
    if (workspace.currency) setCurrency(workspace.currency);
    setTimeZone(workspace.timezone ?? undefined);
  }, [workspace, setCurrency, setTimeZone]);

  async function save(next: WorkspaceSettingsPatch): Promise<boolean> {
    if (!workspace) return false;
    setSaving(true);
    try {
      const patch: WorkspaceSettingsPatch = {};
      if (next.currency !== undefined) patch.currency = next.currency;
      if (next.locale !== undefined) patch.locale = next.locale;
      if (next.timezone !== undefined) patch.timezone = next.timezone;

      const { error } = await supabase.from("workspaces").update(patch).eq("id", workspace.id);
      if (error) throw normalizeSupabaseError(error);

      // Reflect immediately in the client formatting context.
      if (next.currency !== undefined) setCurrency(next.currency);
      if (next.timezone !== undefined) setTimeZone(next.timezone ?? undefined);
      if (next.locale !== undefined && SUPPORTED_LANGS.includes(next.locale as Language)) {
        setLanguage(next.locale as Language);
      }
      return true;
    } finally {
      setSaving(false);
    }
  }

  return {
    workspace,
    loading,
    saving,
    currency: workspace?.currency ?? "BRL",
    timezone: workspace?.timezone ?? null,
    save,
  };
}
