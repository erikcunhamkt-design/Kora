import { cn } from "@/lib/utils";

export type ConvStatus = "new" | "open" | "waiting" | "resolved" | string;

const STYLES: Record<string, { label: string; cls: string }> = {
  new:      { label: "Novo",          cls: "bg-primary/15 text-primary border-primary/30" },
  open:     { label: "Em atendimento", cls: "bg-blue-500/15 text-blue-300 border-blue-500/25" },
  waiting:  { label: "Aguardando",    cls: "bg-amber-500/15 text-amber-300 border-amber-500/25" },
  resolved: { label: "Resolvido",     cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25" },
};

export function WhatsAppStatusBadge({
  status,
  className,
  size = "sm",
}: {
  status: ConvStatus | null | undefined;
  className?: string;
  size?: "xs" | "sm";
}) {
  const key = (status ?? "open").toLowerCase();
  const spec = STYLES[key] ?? STYLES.open;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium leading-none",
        size === "xs" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
        spec.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {spec.label}
    </span>
  );
}
