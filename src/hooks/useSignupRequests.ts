import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
  const [requests, setRequests] = useState<SignupRequest[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setRequests([]); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("client_signup_requests")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setRequests(data as SignupRequest[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const updateStatus = useCallback(async (id: string, status: SignupRequestStatus) => {
    const { error } = await (supabase as any)
      .from("client_signup_requests")
      .update({ status })
      .eq("id", id);
    if (!error) {
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    }
    return !error;
  }, []);

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return { requests, loading, refresh, updateStatus, pendingCount };
}
