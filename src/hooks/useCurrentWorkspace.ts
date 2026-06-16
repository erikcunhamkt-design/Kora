import { useEffect, useRef, useState } from "react";
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
  const { user, loading: authLoading } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestSeq = useRef(0);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      requestSeq.current += 1;
      lastUserId.current = null;
      setWorkspace(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    if (lastUserId.current !== user.id) {
      lastUserId.current = user.id;
      setWorkspace(null);
      setMembership(null);
    }

    async function fetchWorkspaceData() {
      const seq = ++requestSeq.current;
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

        if (seq !== requestSeq.current) return;

        if (memberData) {
          setMembership(memberData as WorkspaceMember);

          // 2. Fetch the corresponding workspace details
          const { data: wsData, error: wsError } = await supabase
            .from("workspaces")
            .select("*")
            .eq("id", memberData.workspace_id)
            .single();

          if (wsError) throw wsError;
          if (seq !== requestSeq.current) return;
          setWorkspace(wsData as Workspace);
        } else {
          if (seq !== requestSeq.current) return;
          // No workspace member relationship found
          setWorkspace(null);
          setMembership(null);
        }
      } catch (err) {
        console.error("Error loading workspace details:", err);
        if (seq === requestSeq.current) {
          setError(err as Error);
        }
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
        }
      }
    }

    fetchWorkspaceData();
  }, [user, authLoading]);

  return { workspace, membership, loading, error };
}
