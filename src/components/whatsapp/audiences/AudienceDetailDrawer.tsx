import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, ShieldAlert, UserPlus, Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  listAudienceContacts,
  removeAudienceContacts,
  type WhatsAppAudience,
  type WhatsAppAudienceContact,
} from "@/lib/whatsapp/repositories/whatsappAudiencesRepository";
import { formatPhoneBR } from "@/lib/whatsapp/phone";

interface Props {
  audience: WhatsAppAudience;
  workspaceId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function AudienceDetailDrawer({ audience, workspaceId, onClose, onChanged }: Props) {
  const [contacts, setContacts] = useState<WhatsAppAudienceContact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listAudienceContacts(workspaceId, audience.id);
      setContacts(list);
    } catch (e) {
      toast.error("Falha ao carregar contatos", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience.id]);

  const stats = {
    total: contacts.length,
    valid: contacts.filter((c) => c.is_valid && !c.is_duplicate && !c.opt_out).length,
    invalid: contacts.filter((c) => !c.is_valid).length,
    duplicates: contacts.filter((c) => c.is_duplicate).length,
    optOut: contacts.filter((c) => c.opt_out).length,
    matchedClients: contacts.filter((c) => c.matched_client_id).length,
    matchedConvos: contacts.filter((c) => c.matched_conversation_id).length,
    noOptIn: contacts.filter((c) => !c.has_opt_in).length,
  };

  const handleRemove = async (filter: Parameters<typeof removeAudienceContacts>[2]) => {
    const removed = await removeAudienceContacts(workspaceId, audience.id, filter);
    toast.success(`${removed} contato(s) removido(s)`);
    await load();
    onChanged();
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col">
        <SheetHeader className="px-6 py-4 border-b border-border/40">
          <SheetTitle className="text-base">{audience.name}</SheetTitle>
          {audience.description && (
            <p className="text-xs text-muted-foreground">{audience.description}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Resumo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <StatBox label="Total" value={stats.total} />
            <StatBox label="Válidos" value={stats.valid} tone="success" />
            <StatBox label="Inválidos" value={stats.invalid} tone="destructive" />
            <StatBox label="Duplicados" value={stats.duplicates} tone="warning" />
            <StatBox label="Já clientes" value={stats.matchedClients} tone="primary" />
            <StatBox label="Já conversaram" value={stats.matchedConvos} tone="primary" />
            <StatBox label="Sem opt-in" value={stats.noOptIn} tone="warning" />
            <StatBox label="Opt-out" value={stats.optOut} tone="destructive" />
          </div>

          <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs flex gap-2">
            <ShieldAlert className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              Contatos importados não viram clientes automaticamente. Use as ações abaixo (em breve)
              para vincular, converter ou criar oportunidade quando responder.
            </p>
          </div>

          {/* Ações em massa */}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => handleRemove({ invalid: true })}
              disabled={stats.invalid === 0}
            >
              <Trash2 className="h-3 w-3" /> Remover inválidos ({stats.invalid})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => handleRemove({ duplicate: true })}
              disabled={stats.duplicates === 0}
            >
              <Trash2 className="h-3 w-3" /> Remover duplicados ({stats.duplicates})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5"
              onClick={() => handleRemove({ optOut: true })}
              disabled={stats.optOut === 0}
            >
              <Trash2 className="h-3 w-3" /> Remover opt-out ({stats.optOut})
            </Button>
          </div>

          {/* Tabela */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <div className="border border-border/50 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-card/60 text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Nome</th>
                    <th className="text-left px-3 py-2 font-medium">Telefone</th>
                    <th className="text-left px-3 py-2 font-medium">Status</th>
                    <th className="text-left px-3 py-2 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.slice(0, 200).map((c) => (
                    <tr key={c.id} className="border-t border-border/40 hover:bg-card/30">
                      <td className="px-3 py-2 truncate max-w-[140px]">{c.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{formatPhoneBR(c.phone)}</td>
                      <td className="px-3 py-2 space-x-1">
                        {!c.is_valid && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            inválido
                          </Badge>
                        )}
                        {c.is_duplicate && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                            dup
                          </Badge>
                        )}
                        {c.opt_out && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                            opt-out
                          </Badge>
                        )}
                        {!c.has_opt_in && !c.opt_out && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px]">
                            sem opt-in
                          </Badge>
                        )}
                        {c.matched_client_id && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                            cliente
                          </Badge>
                        )}
                        {c.matched_conversation_id && !c.matched_client_id && (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                            convo
                          </Badge>
                        )}
                        {c.is_valid && !c.is_duplicate && !c.opt_out && c.has_opt_in && (
                          <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                            ok
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" disabled title="Converter em cliente (em breve)">
                            <UserPlus className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" disabled title="Vincular a cliente (em breve)">
                            <Link2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {contacts.length > 200 && (
                <p className="text-[10px] text-muted-foreground p-2 text-center">
                  Exibindo 200 de {contacts.length} contatos.
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatBox({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "destructive" | "primary";
}) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    primary: "text-primary",
  };
  return (
    <div className="rounded-md bg-card/40 border border-border/40 p-2 text-center">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={`text-base font-semibold ${colors[tone]}`}>{value}</div>
    </div>
  );
}
