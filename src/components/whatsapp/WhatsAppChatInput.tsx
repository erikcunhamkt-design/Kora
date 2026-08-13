import { useRef, useState } from "react";
import { Loader2, Paperclip, Send, Mic, Square, X, Image as ImageIcon, FileText, Sticker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WhatsAppStickerPicker } from "./WhatsAppStickerPicker";
import {
  QuickRepliesInlinePopover,
  QuickRepliesManagerButton,
} from "./WhatsAppQuickReplies";
import { renderQuickReply } from "./quick-replies-helpers";
import { toast } from "sonner";


const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export type MediaPayload = {
  kind: "image" | "video" | "audio" | "document" | "sticker";
  base64: string;
  mimeType: string;
  fileName?: string;
  caption?: string;
};

export type StickerPickPayload = {
  kind: "sticker";
  stickerUrl: string;
  mimeType?: string | null;
};

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export function WhatsAppChatInput({
  disabled,
  sending,
  onSend,
  onSendMedia,
  onSendStickerUrl,
  workspaceId,
  contactName,
  contactPhone,
  placeholder,
}: {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => Promise<void> | void;
  onSendMedia?: (payload: MediaPayload) => Promise<void> | void;
  onSendStickerUrl?: (stickerUrl: string, mimeType?: string | null) => Promise<void> | void;
  workspaceId?: string;
  contactName?: string | null;
  contactPhone?: string | null;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const stickerInputRef = useRef<HTMLInputElement | null>(null);


  const submit = async () => {
    const t = value.trim();
    if (!t) return;
    setValue("");
    await onSend(t);
  };

  const handleFile = async (file: File, kind: MediaPayload["kind"]) => {
    if (!onSendMedia) return;
    if (file.size > MAX_BYTES) {
      toast.error("Arquivo muito grande", { description: "Limite de 10 MB." });
      return;
    }
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      await onSendMedia({
        kind,
        base64,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
        caption: value.trim() || undefined,
      });
      setValue("");
    } catch (e) {
      toast.error("Falha ao enviar arquivo", { description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        setRecording(false);
        if (blob.size === 0 || !onSendMedia) return;
        if (blob.size > MAX_BYTES) {
          toast.error("Áudio muito longo", { description: "Limite de 10 MB." });
          return;
        }
        setUploading(true);
        try {
          const file = new File([blob], "audio.webm", { type: blob.type });
          const base64 = await fileToBase64(file);
          await onSendMedia({
            kind: "audio",
            base64,
            mimeType: blob.type || "audio/webm",
            fileName: "audio.webm",
          });
        } catch (e) {
          toast.error("Falha ao enviar áudio", { description: (e as Error).message });
        } finally {
          setUploading(false);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      toast.error("Microfone indisponível", { description: (e as Error).message });
    }
  };

  const stopRecording = (cancel = false) => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (cancel) {
      chunksRef.current = [];
      rec.onstop = () => {
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        setRecording(false);
      };
    }
    if (rec.state !== "inactive") rec.stop();
  };

  const busy = disabled || sending || uploading;

  return (
    <div className="px-5 py-3 border-t border-border/40 bg-card/30 backdrop-blur-sm">
      {/* Hidden inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f, "image");
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f, "video");
          e.target.value = "";
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f, "document");
          e.target.value = "";
        }}
      />
      <input
        ref={stickerInputRef}
        type="file"
        accept="image/webp,image/png,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f, "sticker");
          e.target.value = "";
        }}
      />

      {recording ? (
        <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
          <span className="text-sm text-foreground flex-1">Gravando áudio…</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => stopRecording(true)}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" /> Cancelar
          </Button>
          <Button
            size="sm"
            onClick={() => stopRecording(false)}
            className="bg-primary hover:bg-primary/90"
          >
            <Square className="h-4 w-4 mr-1" /> Enviar
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-background/60 px-2 py-1.5 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] transition">
          <TooltipProvider delayDuration={150}>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      aria-label="Anexar"
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Anexar</TooltipContent>
              </Tooltip>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Foto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" /> Vídeo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => docInputRef.current?.click()}>
                  <FileText className="h-4 w-4 mr-2" /> Documento
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => stickerInputRef.current?.click()}>
                  <Sticker className="h-4 w-4 mr-2" /> Enviar figurinha (.webp)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <WhatsAppStickerPicker
              workspaceId={workspaceId}
              disabled={busy}
              onPick={async (url, mt) => {
                if (onSendStickerUrl) await onSendStickerUrl(url, mt);
              }}
            />

            <QuickRepliesManagerButton workspaceId={workspaceId} />
          </TooltipProvider>

          <QuickRepliesInlinePopover
            workspaceId={workspaceId}
            filter={quickFilter}
            open={quickOpen}
            onOpenChange={setQuickOpen}
            onPick={(content) => {
              const rendered = renderQuickReply(content, {
                nome: contactName,
                telefone: contactPhone,
              });
              setValue((v) => {
                // strip the trailing /filter token if any, then insert
                const stripped = v.replace(/(^|\s)\/[^\s]*$/, (m, pre) => pre);
                return (stripped ? stripped + " " : "") + rendered;
              });
              setQuickFilter("");
            }}
            anchor={
              <Textarea
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  setValue(v);
                  // detect `/foo` token at end (start of line or after space)
                  const m = v.match(/(?:^|\s)\/([^\s]*)$/);
                  if (m) {
                    setQuickFilter(m[1]);
                    setQuickOpen(true);
                  } else {
                    setQuickOpen(false);
                  }
                }}
                placeholder={placeholder ?? "Escreva uma mensagem... (/ para snippets)"}
                disabled={busy}
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Escape" && quickOpen) {
                    setQuickOpen(false);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey && !quickOpen) {
                    e.preventDefault();
                    void submit();
                  }
                }}
                className="flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] max-h-32 py-2 text-sm leading-relaxed"
              />
            }
          />


          {value.trim() ? (
            <Button
              onClick={submit}
              disabled={busy}
              size="icon"
              className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 shadow-[0_0_18px_hsl(var(--primary)/0.35)]"
              aria-label="Enviar"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          ) : (
            <Button
              onClick={startRecording}
              disabled={busy}
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground"
              aria-label="Gravar áudio"
              title="Gravar áudio"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1.5 px-2">
        Enter para enviar · Shift+Enter para nova linha · Limite 10 MB por arquivo
      </p>
    </div>
  );
}
