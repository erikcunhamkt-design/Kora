import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  bullets?: string[];
}

export const ComingSoonDialog = ({ open, onOpenChange, title, description, bullets }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[480px] bg-card border-border">
      <DialogHeader>
        <DialogTitle className="text-foreground flex items-center gap-2">
          {title}
          <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-[10px]">
            <Sparkles className="h-3 w-3 mr-1" /> Em breve
          </Badge>
        </DialogTitle>
        <DialogDescription className="text-muted-foreground pt-2">{description}</DialogDescription>
      </DialogHeader>
      {bullets && bullets.length > 0 && (
        <ul className="space-y-2 py-2 text-sm text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Integração real será ativada após a migração do CRM para Supabase.
      </p>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Entendi</Button>
        <Button disabled className="orbit-gradient text-white border-0 opacity-60 cursor-not-allowed">
          Ativar (em breve)
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
