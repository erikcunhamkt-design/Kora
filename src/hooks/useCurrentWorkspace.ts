import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  created_at: string;
}

export function useCurrentWorkspace() {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setWorkspace(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    async function fetchWorkspaceData() {
      setLoading(true);
      setError(null);
      try {
        // 1. Get first membership where current user is active
        const { data: memberData, error: memberError } = await supabase
          .from("workspace_members")
          .select("*")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (memberError) throw memberError;

        if (memberData) {
          setMembership(memberData as WorkspaceMember);

          // 2. Fetch the corresponding workspace details
          const { data: wsData, error: wsError } = await supabase
            .from("workspaces")
            .select("*")
            .eq("id", memberData.workspace_id)
            .single();

          if (wsError) throw wsError;
          setWorkspace(wsData as Workspace);
        } else {
          // No workspace member relationship found
          setWorkspace(null);
          setMembership(null);
        }
      } catch (err) {
        console.error("Error loading workspace details:", err);
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaceData();
  }, [user]);

  return { workspace, membership, loading, error };
}
