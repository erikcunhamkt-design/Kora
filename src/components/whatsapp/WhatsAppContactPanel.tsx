import {
  Briefcase,
  FileText,
  ListChecks,
  Phone,
  Plus,
  StickyNote,
  Tag,
  User,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WhatsAppStatusBadge } from "./WhatsAppStatusBadge";

export interface WhatsAppContactPanelProps {
  contactName: string | null;
  contactPhone: string;
  status?: string | null;
  tags?: string[] | null;
  avatarUrl?: string | null;
  lastActivity?: string | null;
  onClose?: () => void;
}

function initials(name: string | null, phone: string) {
  const base = (name ?? phone).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Section({
  title,
  children,
  icon: Icon,
}: {
  title: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="px-4 py-3 border-b border-border/40">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

function SoonButton({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-block w-full">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="w-full justify-start gap-2 border-border/50 bg-background/40 text-xs h-8"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="left">Em breve</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function WhatsAppContactPanel({
  contactName,
  contactPhone,
  status,
  tags,
  avatarUrl,
  lastActivity,
  onClose,
}: WhatsAppContactPanelProps) {
  return (
    <aside className="w-[320px] flex-shrink-0 border-l border-border/40 bg-card/20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Contato
        </h3>
        {onClose && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Header card */}
        <div className="px-4 py-5 flex flex-col items-center text-center border-b border-border/40">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/5 border border-primary/20 flex items-center justify-center text-base font-semibold overflow-hidden">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={contactName ?? contactPhone}
                className="h-full w-full object-cover"
              />
            ) : (
              initials(contactName, contactPhone)
            )}
          </div>
          <h2 className="mt-3 text-sm font-semibold text-foreground truncate max-w-full">
            {contactName ?? contactPhone}
          </h2>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <Phone className="h-2.5 w-2.5" /> {contactPhone}
          </p>
          {status && <WhatsAppStatusBadge status={status} className="mt-3" />}
        </div>

        <Section title="Detalhes" icon={User}>
          <Field label="Responsável" value={<span className="text-muted-foreground italic">—</span>} />
          <Field label="Origem"      value={<span className="text-muted-foreground italic">WhatsApp</span>} />
          <Field
            label="Última atividade"
            value={lastActivity ? new Date(lastActivity).toLocaleString() : <span className="text-muted-foreground italic">—</span>}
          />
        </Section>

        <Section title="Tags" icon={Tag}>
          <div className="flex flex-wrap gap-1.5">
            {(tags && tags.length > 0)
              ? tags.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] h-5 border-border/60">
                    {t}
                  </Badge>
                ))
              : <span className="text-[11px] text-muted-foreground italic">Sem tags</span>
            }
          </div>
        </Section>

        <Section title="CRM" icon={Briefcase}>
          <Field label="Cliente vinculado"     value={<span className="text-muted-foreground italic">Nenhum</span>} />
          <Field label="Oportunidade vinculada" value={<span className="text-muted-foreground italic">Nenhuma</span>} />
        </Section>

        <Section title="Notas internas" icon={StickyNote}>
          <p className="text-[11px] text-muted-foreground italic">Nenhuma nota ainda.</p>
        </Section>

        <Section title="Ações rápidas" icon={Plus}>
          <div className="grid gap-1.5">
            <SoonButton icon={Briefcase} label="Criar oportunidade" />
            <SoonButton icon={UserPlus}  label="Vincular cliente" />
            <SoonButton icon={StickyNote} label="Adicionar nota" />
            <SoonButton icon={ListChecks} label="Criar tarefa" />
          </div>
        </Section>

        <Section title="Histórico recente" icon={FileText}>
          <p className="text-[11px] text-muted-foreground italic">
            Nenhuma ação registrada ainda.
          </p>
        </Section>
      </div>
    </aside>
  );
}
