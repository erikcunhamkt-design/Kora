// Full-screen fallback for the top-level boundary. This renders when the crash
// may have taken out the provider tree itself (router, contexts), so it must
// NOT depend on any of them — no hooks, no context, no router. It reads the
// saved language straight from localStorage (shared resolver) to stay localized.
import { resolveLang, type Lang } from "@/lib/i18n/locale";

const COPY: Record<Lang, { title: string; body: string; reload: string; home: string }> = {
  "pt-BR": {
    title: "Algo deu errado",
    body: "Encontramos um erro inesperado. Recarregue a página para continuar.",
    reload: "Recarregar",
    home: "Ir para o início",
  },
  "pt-PT": {
    title: "Algo correu mal",
    body: "Encontrámos um erro inesperado. Recarregue a página para continuar.",
    reload: "Recarregar",
    home: "Ir para o início",
  },
  en: {
    title: "Something went wrong",
    body: "We hit an unexpected error. Reload the page to continue.",
    reload: "Reload",
    home: "Go to home",
  },
  es: {
    title: "Algo salió mal",
    body: "Encontramos un error inesperado. Recarga la página para continuar.",
    reload: "Recargar",
    home: "Ir al inicio",
  },
};

export function RootErrorFallback({ error }: { error: Error }) {
  const t = COPY[resolveLang()];
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </div>

      <div className="max-w-md space-y-2">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.body}</p>
      </div>

      {import.meta.env.DEV && (
        <pre className="max-w-lg overflow-auto rounded-md bg-card p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t.reload}
        </button>
        <button
          type="button"
          onClick={() => window.location.assign("/")}
          className="inline-flex h-10 items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          {t.home}
        </button>
      </div>
    </div>
  );
}
