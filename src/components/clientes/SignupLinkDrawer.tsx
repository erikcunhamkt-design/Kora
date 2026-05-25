import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, Sparkles, ShieldCheck, Share2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pendingCount: number;
  onOpenRequests?: () => void;
}



export const SignupLinkDrawer = ({ open, onOpenChange, pendingCount }: Props) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const url = user ? `${window.location.origin}/cadastro/${user.id}` : "";

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-md">
        <SheetHeader>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
            <Share2 className="h-5 w-5 text-primary" />
          </div>
          <SheetTitle>Link de cadastro</SheetTitle>
          <SheetDescription>
            Envie este link para seus clientes preencherem os próprios dados.
            Você recebe a solicitação aqui no painel para aprovar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-border bg-secondary/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Seu link público
              </span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                Ativo
              </Badge>
            </div>
            <Input readOnly value={url} className="bg-background/60 text-xs font-mono" />
            <div className="flex gap-2">
              <Button onClick={copy} className="flex-1 gap-2">
                <Copy className="h-4 w-4" />
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => window.open(url, "_blank", "noopener")}
              >
                <ExternalLink className="h-4 w-4" /> Preview
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-primary" /> Como funciona
            </div>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-4">
              <li>O cliente abre o link e preenche um formulário curto.</li>
              <li>A solicitação chega aqui com status <strong>pendente</strong>.</li>
              <li>Você aprova, converte em lead ou arquiva.</li>
            </ul>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium">Pendentes</p>
              <p className="text-xs text-muted-foreground">Solicitações aguardando análise</p>
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/30 text-base px-3 py-1">
              {pendingCount}
            </Badge>
          </div>

          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Validação no servidor com Supabase + RLS. Visitantes não veem outras solicitações.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
