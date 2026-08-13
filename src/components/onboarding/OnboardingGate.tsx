import { Navigate, useLocation } from "react-router-dom";
import { useOnboarding } from "@/contexts/onboarding-context-value";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { completed } = useOnboarding();
  const location = useLocation();
  if (!completed && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
