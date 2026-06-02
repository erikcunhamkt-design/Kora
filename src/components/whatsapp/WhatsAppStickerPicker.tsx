import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sticker, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Favorite = {
  id: string;
  sticker_url: string;
  mime_type: string | null;
};

export function WhatsAppStickerPicker({
  workspaceId,
  disabled,
  onPick,
}: {
  workspaceId?: string;
  disabled?: boolean;
  onPick: (stickerUrl: string, mimeType?: string | null) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "list_favorite_stickers", workspaceId },
      });
      if (error) throw error;
      setList(((data as { stickers?: Favorite[] })?.stickers) ?? []);
    } catch (e) {
      toast.error("Não foi possível carregar figurinhas", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const remove = async (url: string) => {
    if (!workspaceId) return;
    await supabase.functions.invoke("whatsapp-instance", {
      body: { action: "toggle_favorite_sticker", workspaceId, stickerUrl: url, op: "remove" },
    });
    setList((prev) => prev.filter((s) => s.sticker_url !== url));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          disabled={disabled}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Figurinhas favoritas"
        >
          <Sticker className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-2">
        <div className="px-1 pb-2 text-xs font-medium text-muted-foreground">
          Figurinhas favoritas
        </div>
        <ScrollArea className="h-56">
          {loading ? (
            <div className="text-xs text-muted-foreground px-2 py-6 text-center">Carregando…</div>
          ) : list.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-6 text-center">
              Nenhuma figurinha favorita ainda. Favorite figurinhas recebidas no chat para usá-las aqui.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {list.map((s) => (
                <div key={s.id} className="relative group">
                  <button
                    type="button"
                    onClick={async () => {
                      await onPick(s.sticker_url, s.mime_type);
                      setOpen(false);
                    }}
                    className="block w-full aspect-square rounded-md bg-background/40 border border-border/40 hover:border-primary/40 overflow-hidden transition"
                  >
                    <img
                      src={s.sticker_url}
                      alt="sticker"
                      className="h-full w-full object-contain"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(s.sticker_url)}
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition flex items-center justify-center"
                    aria-label="Remover dos favoritos"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
