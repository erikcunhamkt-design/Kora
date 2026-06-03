import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export function WhatsAppImageLightbox({
  src,
  alt,
  open,
  onOpenChange,
}: {
  src: string | null;
  alt?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!src) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-[80vw] p-0 bg-background/95 border-border/40 overflow-hidden">
        <div className="relative flex items-center justify-center bg-black/60">
          <img
            src={src}
            alt={alt ?? "imagem"}
            className="max-h-[85vh] w-auto object-contain"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Button asChild size="icon" variant="secondary" className="h-9 w-9 rounded-full">
              <a href={src} download target="_blank" rel="noreferrer" aria-label="Baixar">
                <Download className="h-4 w-4" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-9 w-9 rounded-full"
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
