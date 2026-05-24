import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTags: string[];
  onSave: (tags: string[]) => void;
}

export const EditTagsDialog = ({ open, onOpenChange, initialTags, onSave }: Props) => {
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) {
      setTags(initialTags || []);
      setDraft("");
    }
  }, [open, initialTags]);

  const add = () => {
    const c = draft.trim();
    if (!c) return;
    if (!tags.includes(c)) setTags((p) => [...p, c]);
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Editar tags</DialogTitle>
          <DialogDescription>Organize seus leads por marcadores.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
              placeholder="Digite e pressione Enter"
              className="bg-muted/50 border-border"
            />
            <Button onClick={add} size="icon" variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[40px]">
            {tags.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma tag</span>
            )}
            {tags.map((t) => (
              <Badge key={t} variant="outline" className="bg-primary/10 border-primary/30 text-foreground gap-1 pr-1">
                {t}
                <button onClick={() => setTags((p) => p.filter((x) => x !== t))} className="hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" onClick={() => { onSave(tags); onOpenChange(false); }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
