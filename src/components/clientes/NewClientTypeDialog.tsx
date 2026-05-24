import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useClientTypes } from "@/hooks/useClientTypes";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (name: string) => void;
  initialName?: string;
}

export function NewClientTypeDialog({ open, onOpenChange, onCreated, initialName = "" }: Props) {
  const { addType, MAX_NAME } = useClientTypes();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const handleSave = () => {
    const result = addType(name);
    if (result.ok === false) {
      toast.error(result.error);
      return;
    }
    toast.success("Tipo criado");
    onCreated?.(result.type.name);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Novo tipo de cliente
          </DialogTitle>
          <DialogDescription>
            Crie um segmento personalizado (ex.: Consultoria, UX Research, Vídeo).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-sm text-muted-foreground">Nome do tipo</Label>
          <Input
            autoFocus
            value={name}
            maxLength={MAX_NAME}
            placeholder="Ex.: Consultoria"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            className="bg-muted/50 border-border"
          />
          <p className="text-[11px] text-muted-foreground/70 text-right">
            {name.trim().length}/{MAX_NAME}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={handleSave}>Criar tipo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
