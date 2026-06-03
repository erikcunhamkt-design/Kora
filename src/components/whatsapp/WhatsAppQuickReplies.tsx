import { useEffect, useState } from "react";
import { Plus, Settings, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
}

export function renderQuickReply(
  content: string,
  vars: { nome?: string | null; telefone?: string | null },
) {
  return content
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome ?? "")
    .replace(/\{\{\s*telefone\s*\}\}/gi, vars.telefone ?? "");
}

export function useQuickReplies(workspaceId?: string) {
  const [items, setItems] = useState<QuickReply[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    supabase
      .from("whatsapp_quick_replies")
      .select("id, shortcut, content")
      .eq("workspace_id", workspaceId)
      .order("shortcut")
      .then(({ data }) => {
        if (active) setItems((data ?? []) as QuickReply[]);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const reload = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("whatsapp_quick_replies")
      .select("id, shortcut, content")
      .eq("workspace_id", workspaceId)
      .order("shortcut");
    setItems((data ?? []) as QuickReply[]);
  };

  return { items, reload, setItems };
}

interface PopoverProps {
  workspaceId?: string;
  filter: string; // text after `/`
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (content: string) => void;
  anchor: React.ReactNode;
}

export function QuickRepliesInlinePopover({
  workspaceId,
  filter,
  open,
  onOpenChange,
  onPick,
  anchor,
}: PopoverProps) {
  const { items } = useQuickReplies(workspaceId);
  const f = filter.trim().toLowerCase();
  const filtered = f
    ? items.filter(
        (i) => i.shortcut.toLowerCase().includes(f) || i.content.toLowerCase().includes(f),
      )
    : items;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{anchor}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-[340px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="h-3 w-3" /> Respostas rápidas
          <span className="ml-auto text-[10px] opacity-60">↑↓ navegar · ↵ inserir</span>
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-muted-foreground text-center">
              {items.length === 0
                ? "Nenhuma resposta rápida criada."
                : "Nenhuma correspondência."}
            </p>
          ) : (
            filtered.map((i) => (
              <button
                key={i.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onPick(i.content);
                  onOpenChange(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 border-b border-border/20 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    /{i.shortcut}
                  </span>
                </div>
                <p className="text-xs text-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
                  {i.content}
                </p>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function QuickRepliesManagerButton({ workspaceId }: { workspaceId?: string }) {
  const [open, setOpen] = useState(false);
  const { items, reload } = useQuickReplies(workspaceId);
  const [shortcut, setShortcut] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!workspaceId) return;
    const s = shortcut.trim().toLowerCase().replace(/\s+/g, "-");
    if (!s || !content.trim()) {
      toast.error("Preencha atalho e mensagem");
      return;
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const { error } = await supabase.from("whatsapp_quick_replies").insert({
      workspace_id: workspaceId,
      created_by: userRes.user?.id ?? null,
      shortcut: s,
      content: content.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    setShortcut("");
    setContent("");
    reload();
    toast.success("Resposta rápida criada");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("whatsapp_quick_replies").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    reload();
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Respostas rápidas"
          >
            <Zap className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Respostas rápidas (digite / no chat)</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respostas rápidas</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 border border-border/40 rounded-md p-3 bg-muted/20">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <Input
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                placeholder="atalho"
                className="text-xs"
              />
              <Input
                value=""
                disabled
                placeholder="/atalho aciona no chat"
                className="text-xs opacity-50"
              />
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Mensagem... use {{nome}} e {{telefone}} como variáveis."
              className="min-h-[80px] text-xs"
            />
            <Button size="sm" onClick={handleAdd} disabled={saving} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>

          <div className="max-h-[300px] overflow-y-auto -mx-2">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Nenhuma resposta criada ainda.
              </p>
            ) : (
              <ul className="divide-y divide-border/40">
                {items.map((i) => (
                  <li key={i.id} className="px-3 py-2 flex items-start gap-2 group">
                    <span className="text-[10px] font-mono uppercase text-primary bg-primary/10 px-1.5 py-0.5 rounded mt-0.5">
                      /{i.shortcut}
                    </span>
                    <p className="text-xs text-foreground flex-1 whitespace-pre-wrap line-clamp-3">
                      {i.content}
                    </p>
                    <button
                      onClick={() => handleDelete(i.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
