import { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "./ErrorBoundary";

function PageErrorFallback({ reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <AlertTriangle className="h-7 w-7" />
      </div>

      <div className="max-w-md space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          {t("error.page.title", "Algo deu errado nesta página")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            "error.page.body",
            "Não foi possível carregar esta seção. Você pode tentar novamente ou voltar ao início.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>
          <RotateCcw />
          {t("error.page.retry", "Tentar novamente")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/")}>
          <Home />
          {t("error.page.home", "Voltar ao início")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Page-scoped error boundary. Lives inside MainLayout so a crash in a single
 * page keeps the sidebar/topbar alive and lets the user navigate away. Auto-
 * recovers when the route changes (resetKeys={[pathname]}).
 */
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKeys={[pathname]} fallback={(args) => <PageErrorFallback {...args} />}>
      {children}
    </ErrorBoundary>
  );
}
