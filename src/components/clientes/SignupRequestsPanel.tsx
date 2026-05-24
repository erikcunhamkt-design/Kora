import { useSignupRequests, type SignupRequest } from "@/hooks/useSignupRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Inbox, Mail, Phone, Briefcase, Check, Archive, UserPlus, RefreshCw } from "lucide-react";

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  archived: "bg-muted text-muted-foreground border-border",
  converted: "bg-primary/10 text-primary border-primary/20",
  lead: "bg-secondary/40 text-foreground border-border",
};

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  archived: "Arquivado",
  converted: "Convertido",
  lead: "Lead",
};

export const SignupRequestsPanel = () => {
  const { requests, loading, updateStatus, refresh } = useSignupRequests();

  if (!loading && requests.length === 0) {
    return (
      <div className="orbit-card p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Inbox className="h-5 w-5 text-primary" />
        </div>
        <p className="text-sm font-medium">Nenhuma solicitação ainda</p>
        <p className="text-xs text-muted-foreground mt-1">
          Compartilhe o link de cadastro para receber novos clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="orbit-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div>
          <p className="text-sm font-semibold">Cadastros recebidos</p>
          <p className="text-xs text-muted-foreground">
            Solicitações enviadas pelo link público
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>
      <div className="divide-y divide-border">
        {requests.map((r) => (
          <RequestRow key={r.id} req={r} onAction={updateStatus} />
        ))}
      </div>
    </div>
  );
};

const RequestRow = ({
  req,
  onAction,
}: {
  req: SignupRequest;
  onAction: (id: string, s: SignupRequest["status"]) => Promise<boolean>;
}) => {
  const handleApprove = async () => {
    const ok = await onAction(req.id, "approved");
    if (ok) toast.success("Solicitação aprovada. Conversão para cliente real depende da migração da base local para Supabase.");
    else toast.error("Falha ao aprovar.");
  };
  const handleLead = async () => {
    const ok = await onAction(req.id, "lead");
    if (ok) toast.success("Marcado como lead.");
  };
  const handleArchive = async () => {
    const ok = await onAction(req.id, "archived");
    if (ok) toast.success("Solicitação arquivada.");
  };

  return (
    <div className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{req.name}</p>
          {req.company && (
            <span className="text-xs text-muted-foreground">· {req.company}</span>
          )}
          <Badge variant="outline" className={statusStyle[req.status]}>
            {statusLabel[req.status]}
          </Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {req.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{req.email}</span>}
          {req.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{req.phone}</span>}
          {req.project_interest && (
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{req.project_interest}</span>
          )}
          <span>{new Date(req.created_at).toLocaleString("pt-BR")}</span>
        </div>
        {req.message && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">"{req.message}"</p>
        )}
      </div>
      {req.status === "pending" && (
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={handleLead} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" /> Lead
          </Button>
          <Button size="sm" variant="outline" onClick={handleArchive} className="gap-1.5">
            <Archive className="h-3.5 w-3.5" /> Arquivar
          </Button>
          <Button size="sm" onClick={handleApprove} className="gap-1.5">
            <Check className="h-3.5 w-3.5" /> Aprovar
          </Button>
        </div>
      )}
    </div>
  );
};
