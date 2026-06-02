import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Upload, ClipboardList, Pencil, Download, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  createAudience,
  importAudienceContacts,
  type RawContactInput,
} from "@/lib/whatsapp/repositories/whatsappAudiencesRepository";
import { parseCsv, parsePastedPhones, CSV_TEMPLATE } from "@/lib/whatsapp/csvParser";
import { validateBrazilianPhone, formatPhoneBR } from "@/lib/whatsapp/phone";

interface Props {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}

type ImportMethod = "paste" | "csv" | "manual";

export function ImportAudienceWizard({ open, workspaceId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<ImportMethod>("paste");
  const [pasted, setPasted] = useState("");
  const [csvText, setCsvText] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualList, setManualList] = useState<RawContactInput[]>([]);
  const [optInDefault, setOptInDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
    setMethod("paste");
    setPasted("");
    setCsvText("");
    setManualName("");
    setManualPhone("");
    setManualList([]);
    setOptInDefault(false);
  };

  const getContacts = (): RawContactInput[] => {
    if (method === "paste") {
      return parsePastedPhones(pasted).map((c) => ({ ...c, hasOptIn: optInDefault }));
    }
    if (method === "csv") return parseCsv(csvText);
    return manualList;
  };

  const preview = getContacts().slice(0, 10);
  const previewValidation = preview.map((p) => ({
    phone: p.phone,
    formatted: formatPhoneBR(p.phone),
    ...validateBrazilianPhone(p.phone),
  }));

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Dê um nome para a audiência");
      return;
    }
    const contacts = getContacts();
    if (contacts.length === 0) {
      toast.error("Adicione pelo menos um contato");
      return;
    }
    setSubmitting(true);
    try {
      const aud = await createAudience(workspaceId, {
        name: name.trim(),
        description: description.trim() || null,
        source: method,
      });
      const summary = await importAudienceContacts(workspaceId, aud.id, contacts);
      toast.success(`Audiência criada com ${summary.valid} contatos válidos`, {
        description: `${summary.invalid} inválidos, ${summary.duplicates} duplicados, ${summary.optOut} opt-out`,
      });
      reset();
      onCreated();
    } catch (e) {
      toast.error("Falha ao criar audiência", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-audiencia.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova audiência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Nome*</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Leads BlackFriday 2026"
                maxLength={100}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
                maxLength={200}
              />
            </div>
          </div>

          <Tabs value={method} onValueChange={(v) => setMethod(v as ImportMethod)}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="paste" className="gap-1.5 text-xs">
                <ClipboardList className="h-3.5 w-3.5" /> Colar
              </TabsTrigger>
              <TabsTrigger value="csv" className="gap-1.5 text-xs">
                <Upload className="h-3.5 w-3.5" /> CSV
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paste" className="space-y-2 mt-3">
              <Label className="text-xs">Cole números (um por linha ou separados por vírgula)</Label>
              <Textarea
                rows={6}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="11987654321&#10;11912345678"
                className="font-mono text-xs"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={optInDefault}
                  onChange={(e) => setOptInDefault(e.target.checked)}
                />
                Marcar todos como tendo opt-in (declaro responsabilidade)
              </label>
            </TabsContent>

            <TabsContent value="csv" className="space-y-2 mt-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Conteúdo CSV</Label>
                <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={downloadTemplate}>
                  <Download className="h-3 w-3" /> Modelo
                </Button>
              </div>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const text = await f.text();
                  setCsvText(text);
                }}
                className="text-xs file:bg-card file:border file:border-border file:rounded file:px-2 file:py-1 file:text-xs file:mr-2"
              />
              <Textarea
                rows={5}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="nome,telefone,empresa,tag,origem,observacao,opt_in"
                className="font-mono text-[11px]"
              />
              <p className="text-[11px] text-muted-foreground">
                XLSX em breve. Por enquanto, use CSV (vírgula ou ponto e vírgula).
              </p>
            </TabsContent>

            <TabsContent value="manual" className="space-y-2 mt-3">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input
                  placeholder="Nome"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
                <Input
                  placeholder="Telefone"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (!manualPhone.trim()) return;
                    setManualList((l) => [
                      ...l,
                      { name: manualName.trim(), phone: manualPhone.trim(), hasOptIn: true },
                    ]);
                    setManualName("");
                    setManualPhone("");
                  }}
                >
                  Adicionar
                </Button>
              </div>
              <div className="text-xs space-y-1 max-h-40 overflow-y-auto">
                {manualList.map((c, i) => (
                  <div
                    key={i}
                    className="flex justify-between bg-background/40 rounded px-2 py-1"
                  >
                    <span>{c.name || "—"}</span>
                    <span className="font-mono">{c.phone}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {preview.length > 0 && (
            <div className="rounded-md border border-border/50 bg-card/40 p-3">
              <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                <FileText className="h-3 w-3" /> Preview ({getContacts().length} contatos)
              </p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {previewValidation.map((v, i) => (
                  <div key={i} className="flex items-center justify-between text-[11px]">
                    <span className="font-mono">{v.formatted}</span>
                    {v.valid ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px]">
                        ok
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                        {v.reason}
                      </Badge>
                    )}
                  </div>
                ))}
                {getContacts().length > 10 && (
                  <p className="text-[10px] text-muted-foreground pt-1">
                    +{getContacts().length - 10} contatos restantes
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => (reset(), onClose())} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
            Criar e importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
