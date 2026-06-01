import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Sparkles, ShieldCheck, Loader2 } from "lucide-react";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sanitize = (s: string) => s.replace(/<[^>]*>/g, "").trim();

const PublicClientSignup = () => {
  const { slug } = useParams<{ slug: string }>();
  const ownerId = slug && UUID_RE.test(slug) ? slug : null;

  const [studioName, setStudioName] = useState<string>("Estúdio");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startedAt] = useState(Date.now());

  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "",
    document: "", project_interest: "", message: "",
    consent: false,
    website: "", // honeypot
  });
  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v as never }));

  useEffect(() => {
    document.title = "Cadastro de cliente";
    if (!ownerId) { setLoadingProfile(false); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", ownerId)
        .maybeSingle();
      if (data?.display_name) setStudioName(data.display_name);
      setLoadingProfile(false);
    })();
  }, [ownerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerId) return setError("Link inválido.");
    if (form.website) return; // honeypot: silent drop
    if (Date.now() - startedAt < 1500) return setError("Aguarde alguns instantes antes de enviar.");

    const name = sanitize(form.name).slice(0, 120);
    const email = sanitize(form.email).slice(0, 255);
    const phone = sanitize(form.phone).slice(0, 40);
    if (!name) return setError("Informe seu nome.");
    if (!email && !phone) return setError("Informe um e-mail ou telefone para contato.");
    if (!form.consent) return setError("É necessário aceitar o consentimento.");

    setSubmitting(true);
    const payload = {
      owner_id: ownerId,
      name,
      email: email || null,
      phone: phone || null,
      company: sanitize(form.company).slice(0, 160) || null,
      document: sanitize(form.document).slice(0, 40) || null,
      project_interest: sanitize(form.project_interest).slice(0, 200) || null,
      message: sanitize(form.message).slice(0, 2000) || null,
      consent: true,
      status: "pending",
      source: "public_signup",
    };

    const { error: insErr } = await supabase
      .from("client_signup_requests")
      .insert(payload);

    setSubmitting(false);
    if (insErr) {
      setError("Não foi possível enviar agora. Tente novamente em instantes.");
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]">
      <div className="w-full max-w-xl">
        {/* Brand head */}
        <div className="flex items-center gap-2 mb-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {loadingProfile ? "Carregando…" : studioName}
        </div>

        {!ownerId ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-2xl font-semibold mb-2">Link inválido</h1>
            <p className="text-sm text-muted-foreground">
              Verifique o link compartilhado pelo estúdio.
            </p>
          </div>
        ) : done ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
              <CheckCircle2 className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Recebemos suas informações</h1>
            <p className="text-sm text-muted-foreground">
              A equipe entrará em contato em breve. Obrigado!
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-border bg-card p-7 sm:p-9 shadow-premium space-y-5"
          >
            <div>
              <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight">
                Solicitar cadastro
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Preencha seus dados para que o estúdio entre em contato.
              </p>
            </div>

            {/* Honeypot */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => set("website", e.target.value)}
              className="hidden"
              aria-hidden
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nome*" value={form.name} onChange={(v) => set("name", v)} maxLength={120} />
              <Field label="Empresa" value={form.company} onChange={(v) => set("company", v)} maxLength={160} />
              <Field label="E-mail" type="email" value={form.email} onChange={(v) => set("email", v)} maxLength={255} />
              <Field label="Telefone / WhatsApp" value={form.phone} onChange={(v) => set("phone", v)} maxLength={40} />
              <Field label="CPF/CNPJ (opcional)" value={form.document} onChange={(v) => set("document", v)} maxLength={40} />
              <Field label="Interesse / projeto" value={form.project_interest} onChange={(v) => set("project_interest", v)} maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Mensagem</Label>
              <Textarea
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                maxLength={2000}
                placeholder="Conte um pouco sobre o que você precisa…"
                className="min-h-[110px] bg-secondary/50 border-border"
              />
            </div>

            <label className="flex items-start gap-3 text-sm text-muted-foreground cursor-pointer">
              <Checkbox
                checked={form.consent}
                onCheckedChange={(v) => set("consent", v === true)}
                className="mt-0.5"
              />
              <span>
                Autorizo o estúdio a entrar em contato e armazenar estes dados para fins
                comerciais, conforme a LGPD.
              </span>
            </label>

            {error && (
              <p className="text-sm text-destructive border border-destructive/30 bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar cadastro"}
            </Button>

            <p className="flex items-center gap-2 text-[11px] text-muted-foreground justify-center pt-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Conexão segura · seus dados ficam apenas com o estúdio
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

const Field = ({
  label, value, onChange, type = "text", maxLength,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; maxLength?: number;
}) => (
  <div className="space-y-2">
    <Label className="text-sm">{label}</Label>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      className="bg-secondary/50 border-border"
    />
  </div>
);

export default PublicClientSignup;
