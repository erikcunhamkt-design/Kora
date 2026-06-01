import { cn } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t border-border/10 py-6 px-6 bg-card/5 backdrop-blur-xs mt-auto">
      <div className="mx-auto w-full max-w-[1600px] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground/60 font-medium">
        <div>
          <span>© {new Date().getFullYear()} KORA Hub. Todos os direitos reservados.</span>
        </div>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-foreground transition-colors">Termos</a>
          <a href="#" className="hover:text-foreground transition-colors">Privacidade</a>
          <a href="#" className="hover:text-foreground transition-colors">Suporte</a>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Todos os sistemas ativos
          </span>
        </div>
      </div>
    </footer>
  );
}
