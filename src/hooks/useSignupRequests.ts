// Client signup requests — React Query (A2). Public API unchanged.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

export type SignupRequestStatus = "pending" | "approved" | "archived" | "converted" | "lead";

export interface SignupRequest {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  document: string | null;
  project_interest: string | null;
  message: string | null;
  source: string;
  status: SignupRequestStatus;
  consent: boolean;
  converted_client_id: string | null;
  created_at: string;
}

export function useSignupRequests() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["signup-requests", userId],
    queryFn: async (): Promise<SignupRequest[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("client_signup_requests")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw normalizeSupabaseError(error);
      return (data as SignupRequest[]) ?? [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["signup-requests", userId] }),
    [queryClient, userId],
  );

  const updateStatus = useCallback(
    async (id: string, status: SignupRequestStatus) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("client_signup_requests")
        .update({ status })
        .eq("id", id);
      if (!error) await invalidate();
      return !error;
    },
    [invalidate],
  );

  const deleteRequest = useCallback(
    async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("client_signup_requests")
        .delete()
        .eq("id", id);
      if (!error) await invalidate();
      return !error;
    },
    [invalidate],
  );

  const requests = query.data ?? [];
  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return {
    requests,
    loading: query.isLoading || query.isFetching,
    refresh: () => query.refetch(),
    updateStatus,
    deleteRequest,
    pendingCount,
  };
}
