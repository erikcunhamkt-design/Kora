import { useState, useMemo, useRef } from "react";
import { useSignupRequests, type SignupRequest } from "@/hooks/useSignupRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Inbox, Mail, Phone, Briefcase, Check, Archive, UserPlus, RefreshCw,
  Trash2, MapPin, MessageSquare,
} from "lucide-react";
import { formatDateTime as intlDateTime } from "@/lib/format";

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-muted text-muted-foreground border-border",
  converted: "bg-primary/10 text-primary border-primary/20",
  lead: "bg-sky-500/10 text-sky-400 border-sky-500/20",
};

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  archived: "Arquivado",
  converted: "Convertido",
  lead: "Convertido em lead",
};

type Filter = "pending" | "all" | "archived";

interface Props {
  /** Hook em Clientes para criar cliente real a partir da solicitação. */
  /** Devolve `false` quando o cliente NÃO foi criado — o painel não confirma sucesso nem muda o status. */
  onApproveAsClient?: (req: SignupRequest) => void | boolean | Promise<void | boolean>;
  /** Hook em Clientes/CRM para criar lead/oportunidade. */
  /** Devolve `false` quando a oportunidade NÃO foi criada — o painel não confirma sucesso nem muda o status. */
  onConvertLead?: (req: SignupRequest) => void | boolean | Promise<void | boolean>;
}

export const SignupRequestsPanel = ({ onApproveAsClient, onConvertLead }: Props) => {
  const { requests, loading, updateStatus, deleteRequest, refresh } = useSignupRequests();
  const [filter, setFilter] = useState<Filter>("pending");
  const [deleteTarget, setDeleteTarget] = useState<SignupRequest | null>(null);

  const filtered = useMemo(() => {
    if (filter === "pending") return requests.filter((r) => r.status === "pending");
    if (filter === "archived") return requests.filter((r) => r.status === "archived");
    return requests;
  }, [requests, filter]);

  const counts = useMemo(() => ({
    pending: requests.filter((r) => r.status === "pending").length,
    archived: requests.filter((r) => r.status === "archived").length,
    all: requests.length,
  }), [requests]);

  // G99 — guarda de duplo clique: aprovar/converter são assíncronos (criam cliente/oportunidade
  // antes de mudar o status); um 2º clique durante a escrita criaria outro registro.
  const busyIds = useRef<Set<string>>(new Set());
  const runOnce = async (req: SignupRequest, action: () => Promise<void>) => {
    if (busyIds.current.has(req.id)) return;
    busyIds.current.add(req.id);
    try {
      await action();
    } finally {
      busyIds.current.delete(req.id);
    }
  };

  const handleApprove = (req: SignupRequest) =>
    runOnce(req, async () => {
      if (onApproveAsClient) {
        const created = await onApproveAsClient(req);
        if (created === false) return; // o erro (real) ou o paywall já foi mostrado por quem criou
      }
      const ok = await updateStatus(req.id, "approved");
      if (ok) toast.success(`${req.name} aprovado como cliente.`);
      else toast.error("O cliente foi criado, mas não foi possível marcar a solicitação como aprovada.");
    });

  const handleLead = (req: SignupRequest) =>
    runOnce(req, async () => {
      if (onConvertLead) {
        const created = await onConvertLead(req);
        if (created === false) return; // o erro (real) já foi mostrado por quem criou
      }
      const ok = await updateStatus(req.id, "lead");
      if (ok) toast.success(`${req.name} convertido em lead no CRM.`);
      else toast.error("A oportunidade foi criada, mas não foi possível marcar a solicitação como convertida.");
    });

  const handleArchive = async (req: SignupRequest) => {
    const ok = await updateStatus(req.id, "archived");
    if (ok) toast.success("Solicitação arquivada.");
    else toast.error("Falha ao arquivar a solicitação.");
  };

  const handleRestore = async (req: SignupRequest) => {
    const ok = await updateStatus(req.id, "pending");
    if (ok) toast.success("Solicitação restaurada para pendente.");
    else toast.error("Falha ao restaurar a solicitação.");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const ok = await deleteRequest(deleteTarget.id);
    if (ok) toast.success("Solicitação excluída.");
    else toast.error("Falha ao excluir.");
    setDeleteTarget(null);
  };

  return (
    <div className="orbit-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Solicitações recebidas</p>
          <p className="text-xs text-muted-foreground">
            Revise os cadastros enviados pelo seu link público.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <FilterChip active={filter === "pending"} onClick={() => setFilter("pending")}>
            Pendentes <span className="ml-1 text-[10px] opacity-70">{counts.pending}</span>
          </FilterChip>
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            Todas <span className="ml-1 text-[10px] opacity-70">{counts.all}</span>
          </FilterChip>
          <FilterChip active={filter === "archived"} onClick={() => setFilter("archived")}>
            Arquivadas <span className="ml-1 text-[10px] opacity-70">{counts.archived}</span>
          </FilterChip>
          <Button variant="ghost" size="sm" onClick={refresh} className="gap-2 ml-1">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {filter === "pending" ? "Nenhuma solicitação pendente." : "Nada por aqui."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Compartilhe o link de cadastro para receber novos clientes.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((r) => (
            <RequestRow
              key={r.id}
              req={r}
              onApprove={() => handleApprove(r)}
              onLead={() => handleLead(r)}
              onArchive={() => handleArchive(r)}
              onRestore={() => handleRestore(r)}
              onDelete={() => setDeleteTarget(r)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir solicitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. {deleteTarget?.name} e os dados enviados serão removidos.
              Se quiser manter o histórico, prefira arquivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const FilterChip = ({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`text-xs px-2.5 h-7 rounded-md border transition-colors ${
      active
        ? "bg-secondary/80 border-border text-foreground"
        : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
    }`}
  >
    {children}
  </button>
);

const RequestRow = ({
  req, onApprove, onLead, onArchive, onRestore, onDelete,
}: {
  req: SignupRequest;
  onApprove: () => void;
  onLead: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) => {
  const isPending = req.status === "pending";
  const isArchived = req.status === "archived";
  return (
    <div className="px-5 py-4 flex flex-col md:flex-row md:items-start gap-3 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{req.name}</p>
          {req.company && (
            <span className="text-xs text-muted-foreground">· {req.company}</span>
          )}
          <Badge variant="outline" className={statusStyle[req.status]}>
            {statusLabel[req.status]}
          </Badge>
          <Badge variant="outline" className="bg-muted/30 text-muted-foreground border-border/60 text-[10px]">
            Link de cadastro
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {req.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{req.email}</span>}
          {req.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{req.phone}</span>}
          {req.project_interest && (
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{req.project_interest}</span>
          )}
          {req.document && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{req.document}</span>
          )}
          <span>{intlDateTime(req.created_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
        </div>
        {req.message && (
          <p className="mt-2 text-xs text-muted-foreground line-clamp-3 flex gap-1.5">
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span>"{req.message}"</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 shrink-0">
        {isPending && (
          <>
            <Button size="sm" onClick={onApprove} className="gap-1.5">
              <Check className="h-3.5 w-3.5" /> Aprovar como cliente
            </Button>
            <Button size="sm" variant="outline" onClick={onLead} className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" /> Converter em lead
            </Button>
            <Button size="sm" variant="ghost" onClick={onArchive} className="gap-1.5">
              <Archive className="h-3.5 w-3.5" /> Arquivar
            </Button>
          </>
        )}
        {isArchived && (
          <Button size="sm" variant="outline" onClick={onRestore} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Restaurar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          title="Excluir"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};
