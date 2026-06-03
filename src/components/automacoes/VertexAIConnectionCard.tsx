import { useState } from "react";
import { Check, Loader2, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useVertexCredentials } from "@/hooks/useVertexCredentials";

const MODELS = [
  { value: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash — rápido e barato (recomendado)" },
  { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash — balanceado" },
  { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro — máxima qualidade" },
  { value: "gemini-1.5-flash-002", label: "Gemini 1.5 Flash — legado" },
  { value: "gemini-1.5-pro-002", label: "Gemini 1.5 Pro — legado" },
];

export function VertexAIConnectionCard() {
  const { status, loading, busy, save, toggleActive, remove } = useVertexCredentials();
  const [jsonText, setJsonText] = useState("");
  const [location, setLocation] = useState("us-central1");
  const [model, setModel] = useState("gemini-2.0-flash-001");
  const [showForm, setShowForm] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setJsonText((ev.target?.result as string) || "");
    reader.readAsText(file);
  };

  const handleSave = async () => {
    if (!jsonText.trim()) {
      toast.error("Cole o JSON da Service Account ou selecione o arquivo.");
      return;
    }
    try {
      await save(jsonText, { location, defaultModel: model });
      toast.success("Vertex AI conectada! As IAs do app agora usam sua chave.");
      setJsonText("");
      setShowForm(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleRemove = async () => {
    try {
      await remove();
      toast.success("Credencial removida. Voltando aos créditos do app.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Card className="p-5 space-y-4 border-primary/30 bg-gradient-to-br from-card to-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold flex items-center gap-2">
              Google Vertex AI
              <Badge variant="secondary" className="text-[10px]">BYOK</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Use sua própria chave do Google Cloud. Quando ativa, substitui o uso dos créditos de IA do app.
            </p>
          </div>
        </div>
        {status.hasCredentials && status.isActive && (
          <Badge className="bg-success/15 text-success border-success/30 shrink-0">
            <Check className="h-3 w-3" /> Ativa
          </Badge>
        )}
        {status.hasCredentials && !status.isActive && (
          <Badge variant="outline" className="shrink-0">Desativada</Badge>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : status.hasCredentials ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Projeto GCP</span>
              <div className="font-mono truncate">{status.projectId ?? "—"}</div>
            </div>
            <div className="space-y-0.5">
              <span className="text-muted-foreground">Região</span>
              <div className="font-mono">{status.location}</div>
            </div>
            <div className="space-y-0.5 col-span-2">
              <span className="text-muted-foreground">Service Account</span>
              <div className="font-mono truncate text-[11px]">{status.clientEmail ?? "—"}</div>
            </div>
            <div className="space-y-0.5 col-span-2">
              <span className="text-muted-foreground">Modelo padrão</span>
              <div className="font-mono">{status.defaultModel}</div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Switch
                checked={status.isActive}
                disabled={busy}
                onCheckedChange={(v) => toggleActive(v).then(() =>
                  toast.success(v ? "Vertex AI ativada" : "Voltando aos créditos do app")
                )}
              />
              <Label className="text-xs">Usar Vertex em vez dos créditos</Label>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={busy}>
                  <Trash2 className="h-4 w-4" /> Remover
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover Vertex AI?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A chave será apagada e o app voltará a usar os créditos de IA.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ) : !showForm ? (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1.5 bg-muted/30 rounded-lg p-3">
            <p className="font-medium text-foreground">Como obter a chave (5 min):</p>
            <ol className="list-decimal list-inside space-y-1 ml-1">
              <li>Console GCP → IAM & Admin → Service Accounts</li>
              <li>Criar Service Account com papel <b>Vertex AI User</b></li>
              <li>Keys → Add Key → JSON → baixar arquivo</li>
              <li>Ativar a API <b>Vertex AI</b> no projeto</li>
            </ol>
          </div>
          <Button onClick={() => setShowForm(true)} className="w-full">
            <Upload className="h-4 w-4" /> Conectar Vertex AI
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Service Account JSON</Label>
            <Input
              type="file"
              accept="application/json,.json"
              onChange={handleFileUpload}
              className="text-xs"
            />
            <Textarea
              placeholder='Ou cole aqui o conteúdo do JSON: { "type": "service_account", ... }'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={4}
              className="font-mono text-[11px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Região</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="us-central1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Modelo padrão</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setShowForm(false); setJsonText(""); }} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={busy} className="flex-1">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar e ativar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
