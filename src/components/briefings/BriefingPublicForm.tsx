import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, FileText } from "lucide-react";
import koraLogo from "@/assets/kora-logo.png";
import { useBriefings } from "@/hooks/useBriefings";
import { useBriefingTemplates } from "@/hooks/useBriefingTemplates";
import { toast } from "@/hooks/use-toast";

export default function BriefingPublicForm() {
  const { token = "" } = useParams<{ token: string }>();
  const { findByToken, submitResponse } = useBriefings();
  const { templates } = useBriefingTemplates();

  const briefing = useMemo(() => findByToken(token), [findByToken, token]);
  const template = useMemo(
    () => (briefing ? templates.find((t) => t.id === briefing.templateId) : undefined),
    [briefing, templates],
  );

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    briefing?.responses?.forEach((r) => { initial[r.fieldId] = r.value; });
    return initial;
  });
  const [submitted, setSubmitted] = useState(briefing?.status === "respondido");

  if (!briefing || !template) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Briefing não encontrado</CardTitle>
            <CardDescription>
              O link pode ter expirado ou ser inválido. Solicite um novo link ao seu contato.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = template.fields.filter((f) => f.required && !(values[f.id] ?? "").trim());
    if (missing.length) {
      toast({ title: "Preencha os campos obrigatórios", description: missing.map((m) => m.label).join(", "), variant: "destructive" });
      return;
    }
    const responses = template.fields.map((f) => ({ fieldId: f.id, value: values[f.id] ?? "" }));
    submitResponse(token, responses);
    setSubmitted(true);
    toast({ title: "Respostas enviadas", description: "Obrigado por preencher o briefing!" });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-10 pb-8 space-y-4">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Tudo certo!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Suas respostas foram enviadas. O estúdio entrará em contato em breve.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <img src={koraLogo} alt="KORA" className="h-9 w-9 object-contain" />
          <div>
            <span className="text-sm font-semibold orbit-gradient-text">KORA</span>
            <p className="text-[0.65rem] text-muted-foreground/60 uppercase tracking-wider">Briefing</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{template.name}</CardTitle>
                <CardDescription className="mt-1">
                  Olá <strong className="text-foreground">{briefing.clientName}</strong>! Preencha as informações abaixo para começarmos.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {template.fields.map((field) => (
                <div key={field.id} className="space-y-1.5">
                  <Label>
                    {field.label} {field.required && <span className="text-primary">*</span>}
                  </Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                      rows={3}
                      placeholder={field.placeholder}
                    />
                  ) : field.type === "select" ? (
                    <Select value={values[field.id] ?? ""} onValueChange={(v) => setValues((s) => ({ ...s, [field.id]: v }))}>
                      <SelectTrigger><SelectValue placeholder="Escolha uma opção" /></SelectTrigger>
                      <SelectContent>
                        {(field.options ?? []).map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "url" ? "url" : "text"}
                      value={values[field.id] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
                      placeholder={field.placeholder}
                    />
                  )}
                  {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
                </div>
              ))}

              <Button type="submit" className="w-full">Enviar respostas</Button>
              <p className="text-[0.7rem] text-center text-muted-foreground">
                Suas respostas ficam salvas neste dispositivo até serem sincronizadas pelo estúdio.
              </p>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Powered by <span className="orbit-gradient-text font-semibold">KORA</span>
        </p>
      </div>
    </div>
  );
}
