import { useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/auth-context-value";
import { useOnboarding } from "@/contexts/onboarding-context-value";

export default function AuthCallback() {
  const { user, loading } = useAuth();
  const { completed } = useOnboarding();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    navigate(completed ? "/" : "/onboarding", { replace: true });
  }, [loading, user, completed, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
