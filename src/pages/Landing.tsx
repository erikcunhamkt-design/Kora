import { Button } from "@/components/ui/button";
import {
  Users, Target, CheckSquare, DollarSign, Briefcase, TrendingUp,
  ArrowRight, Check, Star, Zap, Shield, Clock, BarChart3,
  ChevronRight, Sparkles, Crown, Layout, Quote, X, AlertTriangle, Layers
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PLAN_PRICE } from "@/contexts/plan-context-value";
import orbitLogo from "@/assets/kora-logo.png";
import { useEffect, useRef } from "react";

/* ─── scroll reveal hook ─── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed");
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useReveal();
  return (
    <div
      ref={ref}
      className={`reveal-section ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── data ─── */
const problems = [
  { icon: Clock, title: "Prazos perdidos", desc: "Sem visão clara de entregas, você vive apagando incêndios." },
  { icon: Layers, title: "Ferramentas demais", desc: "Planilha aqui, Notion ali, WhatsApp acolá. Tudo espalhado." },
  { icon: AlertTriangle, title: "Clientes esquecidos", desc: "Propostas esquecidas, follow-ups perdidos, dinheiro na mesa." },
  { icon: X, title: "Financeiro bagunçado", desc: "Não sabe quanto faturou, quanto gastou, nem quanto sobrou." },
];

const modules = [
  { icon: Users, name: "Clientes", desc: "Gerencie todos os seus clientes em um só lugar." },
  { icon: Target, name: "CRM", desc: "Pipeline visual para nunca perder uma oportunidade." },
  { icon: CheckSquare, name: "Tarefas", desc: "Organize entregas com prioridade e prazos claros." },
  { icon: DollarSign, name: "Financeiro", desc: "Controle receitas, despesas e lucro em tempo real." },
  { icon: Briefcase, name: "Portfólio", desc: "Mostre seus melhores projetos de forma profissional." },
  { icon: TrendingUp, name: "Metas", desc: "Defina objetivos e acompanhe seu progresso." },
];

const benefits = [
  { icon: Layout, title: "Mais organização", desc: "Tudo centralizado, nada se perde." },
  { icon: Shield, title: "Mais controle", desc: "Visão completa do seu negócio." },
  { icon: Sparkles, title: "Mais profissionalismo", desc: "Impressione clientes com processos claros." },
  { icon: Zap, title: "Mais produtividade", desc: "Menos tempo gerenciando, mais tempo criando." },
  { icon: BarChart3, title: "Mais faturamento", desc: "Nunca mais perca dinheiro por desorganização." },
];

const testimonials = [
  { name: "Lucas Mendes", role: "Designer UI/UX", avatar: "LM", text: "O Kora Hub mudou completamente minha rotina. Antes eu vivia perdido entre planilhas e mensagens. Agora tenho tudo em um lugar só." },
  { name: "Camila Rocha", role: "Designer Freelancer", avatar: "CR", text: "Finalmente consigo ver quanto realmente faturei no mês. O financeiro do Kora Hub é um game changer pra quem trabalha sozinho." },
  { name: "Rafael Souza", role: "Diretor de Arte", avatar: "RS", text: "O CRM me ajudou a fechar 3 projetos que eu teria esquecido. Melhor investimento que já fiz no meu negócio." },
];

const screens = [
  { label: "Dashboard", desc: "Visão geral do seu negócio" },
  { label: "CRM", desc: "Pipeline de oportunidades" },
  { label: "Financeiro", desc: "Receitas e despesas" },
  { label: "Tarefas", desc: "Entregas organizadas" },
];

const freeFeatures = ["1 cliente", "1 projeto no portfólio", "Até 3 tarefas", "1 lead no CRM", "Financeiro básico"];
const proFeatures = ["Clientes ilimitados", "Projetos ilimitados", "Tarefas ilimitadas", "CRM completo", "Financeiro completo", "Metas completas", "Relatórios", "Suporte prioritário"];

/* ─── component ─── */
const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Reveal CSS ── */}
      <style>{`
        .reveal-section {
          opacity: 0;
          transform: translateY(32px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal-section.revealed {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/30 glass-panel-subtle">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-3">
            <div className="orbit-logo-container">
              <img src={orbitLogo} alt="KORA HUB" className="h-8 w-8 object-contain" />
            </div>
            <span className="text-xl font-bold orbit-gradient-text tracking-tight">KORA HUB</span>
            <span className="hidden sm:inline text-xs text-muted-foreground/50 tracking-wide uppercase">Gestão inteligente para agências e empresas</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-muted-foreground hover:text-foreground">Entrar</Button>
            <Button size="sm" className="orbit-gradient border-0 shadow-[0_0_20px_hsl(263_84%_58%/0.25)]" onClick={() => navigate("/signup")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════
          HERO — PRIMEIRA DOBRA
      ══════════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-36 px-6">
        {/* atmospheric glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/8 blur-[160px] pointer-events-none" />
        <div className="absolute top-32 left-1/4 w-[500px] h-[500px] rounded-full bg-accent/6 blur-[140px] pointer-events-none" />
        <div className="absolute top-48 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-8 animate-fade-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium backdrop-blur-sm">
            <Sparkles className="h-4 w-4" /> Feito por designers, para designers
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight">
            Pare de perder clientes<br />
            <span className="orbit-gradient-text">por desorganização</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Gerencie clientes, projetos, tarefas e financeiro em um único sistema — feito para designers que querem crescer.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <Button
              size="lg"
              className="orbit-gradient border-0 h-13 px-10 text-base font-semibold shadow-[0_0_30px_hsl(263_84%_58%/0.3)] hover:shadow-[0_0_40px_hsl(263_84%_58%/0.4)] transition-shadow"
              onClick={() => navigate("/signup")}
            >
              Começar grátis <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-13 px-8 text-base border-border/60 hover:border-primary/30"
              onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}
            >
              Ver como funciona
            </Button>
          </div>

          <p className="text-sm text-muted-soft">Grátis para sempre · Sem cartão de crédito</p>
        </div>

        {/* Hero mockup — premium window */}
        <div className="relative max-w-5xl mx-auto mt-20 animate-fade-up" style={{ animationDelay: "200ms" }}>
          <div className="rounded-2xl border border-border/40 overflow-hidden shadow-premium-xl orbit-card-glass">
            {/* title bar */}
            <div className="flex items-center gap-2 px-5 h-11 border-b border-border/30 bg-muted/20">
              <span className="w-3 h-3 rounded-full bg-[hsl(0_84%_60%/0.8)]" />
              <span className="w-3 h-3 rounded-full bg-[hsl(45_93%_47%/0.8)]" />
              <span className="w-3 h-3 rounded-full bg-[hsl(142_71%_45%/0.8)]" />
              <span className="ml-4 text-xs text-muted-foreground/60 font-medium">Kora Hub — Dashboard</span>
            </div>
            {/* mock dashboard */}
            <div className="p-6 md:p-8 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Faturamento", value: "R$ 12.450", color: "text-primary" },
                  { label: "Clientes", value: "24", color: "text-foreground" },
                  { label: "Tarefas", value: "8 pendentes", color: "text-foreground" },
                  { label: "Meta mensal", value: "78%", color: "text-primary" },
                ].map((m, i) => (
                  <div key={i} className="rounded-xl bg-muted/30 border border-border/30 p-4 space-y-1.5">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{m.label}</p>
                    <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 h-36 rounded-xl bg-gradient-to-br from-primary/8 to-accent/5 border border-border/20 flex items-center justify-center">
                  <BarChart3 className="h-16 w-16 text-primary/20" />
                </div>
                <div className="h-36 rounded-xl bg-muted/20 border border-border/20 p-4 space-y-3">
                  {["Reunião com cliente", "Entregar landing page", "Revisar proposta"].map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary/60" />
                      <span className="text-xs text-muted-foreground">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* glow reflection */}
          <div className="absolute -bottom-12 inset-x-16 h-24 bg-primary/6 blur-3xl rounded-full pointer-events-none" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PROBLEMA — GERAR DOR
      ══════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto text-center space-y-14">
          <Reveal>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-destructive uppercase tracking-wider">O problema</p>
              <h2 className="text-3xl md:text-4xl font-bold">Você se reconhece aqui?</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">A maioria dos designers perde tempo e dinheiro por falta de organização.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {problems.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <div className="orbit-card-glass p-6 text-left space-y-3 group hover:border-destructive/30 transition-all duration-300 h-full">
                  <div className="w-11 h-11 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <p.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SOLUÇÃO — MÓDULOS
      ══════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-14">
          <Reveal>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">A solução</p>
              <h2 className="text-3xl md:text-4xl font-bold">Tudo que você precisa, em um só lugar</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">O Kora Hub reúne todos os módulos que um designer precisa para trabalhar com profissionalismo.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {modules.map((m, i) => (
              <Reveal key={m.name} delay={i * 70}>
                <div className="orbit-card-glass p-6 text-left space-y-4 group hover:border-primary/30 transition-all duration-300 h-full">
                  <div className="w-12 h-12 rounded-xl orbit-gradient flex items-center justify-center shadow-[0_0_20px_hsl(263_84%_58%/0.2)] group-hover:shadow-[0_0_30px_hsl(263_84%_58%/0.35)] group-hover:scale-110 transition-all duration-300">
                    <m.icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{m.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          DEMO — SCREENSHOTS
      ══════════════════════════════════════════════════ */}
      <section id="demo" className="py-24 md:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/20 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto text-center space-y-14">
          <Reveal>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Conheça o sistema</p>
              <h2 className="text-3xl md:text-4xl font-bold">Veja o Kora Hub em ação</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-5">
            {screens.map((s, i) => (
              <Reveal key={s.label} delay={i * 100}>
                <div className="rounded-2xl border border-border/40 overflow-hidden group hover:border-primary/30 transition-all duration-300 orbit-card-glass">
                  <div className="flex items-center gap-2 px-4 h-9 border-b border-border/20 bg-muted/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-[hsl(0_84%_60%/0.5)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[hsl(45_93%_47%/0.5)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[hsl(142_71%_45%/0.5)]" />
                    <span className="ml-3 text-xs text-muted-foreground/50">{s.label}</span>
                  </div>
                  <div className="h-52 md:h-64 bg-gradient-to-br from-primary/6 via-transparent to-accent/4 flex flex-col items-center justify-center gap-2 group-hover:from-primary/10 transition-all duration-500">
                    <span className="text-3xl font-bold text-foreground/10 group-hover:text-foreground/15 transition-colors">{s.label}</span>
                    <span className="text-sm text-muted-foreground/40">{s.desc}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          BENEFÍCIOS
      ══════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-14">
          <Reveal>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Benefícios</p>
              <h2 className="text-3xl md:text-4xl font-bold">Por que designers escolhem o Kora Hub</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {benefits.map((b, i) => (
              <Reveal key={b.title} delay={i * 60}>
                <div className="flex flex-col items-center text-center space-y-4 p-5 rounded-2xl hover:bg-muted/20 transition-colors duration-300 h-full">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_16px_hsl(263_84%_58%/0.1)]">
                    <b.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{b.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PROVA SOCIAL
      ══════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/20 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto text-center space-y-14">
          <Reveal>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Depoimentos</p>
              <h2 className="text-3xl md:text-4xl font-bold">Quem usa, recomenda</h2>
              <p className="text-muted-foreground">+2.000 designers já usam o Kora Hub</p>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="orbit-card-glass p-6 text-left space-y-4 h-full">
                  <Quote className="h-8 w-8 text-primary/25" />
                  <p className="text-[0.9375rem] text-muted-foreground leading-relaxed italic">"{t.text}"</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-border/20">
                    <div className="w-10 h-10 rounded-full orbit-gradient flex items-center justify-center text-sm font-bold text-primary-foreground shadow-[0_0_12px_hsl(263_84%_58%/0.2)]">
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                    <div className="ml-auto flex gap-0.5">
                      {[...Array(5)].map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-[hsl(45_93%_47%)] text-[hsl(45_93%_47%)]" />)}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          PLANOS
      ══════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto text-center space-y-14">
          <Reveal>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">Planos</p>
              <h2 className="text-3xl md:text-4xl font-bold">Comece grátis, evolua quando quiser</h2>
              <p className="text-muted-foreground">Sem compromisso. Cancele a qualquer momento.</p>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              {/* Free */}
              <div className="orbit-card-glass p-7 space-y-6 text-left rounded-2xl">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Free</p>
                  <p className="text-4xl font-bold mt-2">R$ 0<span className="text-base font-normal text-muted-foreground">/mês</span></p>
                  <p className="text-sm text-muted-foreground mt-2">Para quem está começando</p>
                </div>
                <div className="space-y-3">
                  {freeFeatures.map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 text-muted-soft shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full border-border/60" onClick={() => navigate("/signup")}>Começar grátis</Button>
              </div>

              {/* Pro */}
              <div className="relative rounded-2xl p-7 space-y-6 text-left border border-primary/30 bg-primary/[0.03] shadow-[0_0_40px_hsl(263_84%_58%/0.08)] backdrop-blur-sm">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full orbit-gradient text-white text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_20px_hsl(263_84%_58%/0.3)]">
                  <Crown className="h-3.5 w-3.5" /> Mais popular
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">Pro</p>
                  <p className="text-4xl font-bold mt-2">{PLAN_PRICE}<span className="text-base font-normal text-muted-foreground">/mês</span></p>
                  <p className="text-sm text-muted-foreground mt-2">Para designers profissionais</p>
                </div>
                <div className="space-y-3">
                  {proFeatures.map((f) => (
                    <div key={f} className="flex items-center gap-3 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-foreground">{f}</span>
                    </div>
                  ))}
                </div>
                <Button className="w-full orbit-gradient border-0 h-12 text-base font-semibold shadow-[0_0_24px_hsl(263_84%_58%/0.25)]" onClick={() => navigate("/signup")}>
                  Começar agora <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">7 dias grátis · Cancele quando quiser</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          CTA FINAL
      ══════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <Reveal>
          <div className="relative max-w-4xl mx-auto text-center">
            {/* bg glow */}
            <div className="absolute inset-0 rounded-3xl bg-primary/[0.04] blur-xl pointer-events-none" />
            <div className="relative rounded-3xl border border-primary/20 orbit-card-glass p-14 md:p-20 space-y-7">
              <div className="w-16 h-16 rounded-2xl orbit-gradient flex items-center justify-center mx-auto shadow-[0_0_32px_hsl(263_84%_58%/0.3)] animate-glow-pulse">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">Comece a organizar seu trabalho hoje</h2>
              <p className="text-muted-foreground max-w-lg mx-auto text-lg">Junte-se a milhares de designers que já transformaram sua rotina com o Kora Hub.</p>
              <Button
                size="lg"
                className="orbit-gradient border-0 h-13 px-12 text-base font-semibold shadow-[0_0_30px_hsl(263_84%_58%/0.3)] hover:shadow-[0_0_40px_hsl(263_84%_58%/0.4)]"
                onClick={() => navigate("/signup")}
              >
                Criar conta grátis <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <p className="text-sm text-muted-soft">Sem cartão de crédito · Setup em 30 segundos</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 py-14 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="orbit-logo-container">
                <img src={orbitLogo} alt="KORA HUB" className="h-7 w-7 object-contain" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold orbit-gradient-text">KORA HUB</span>
                <span className="text-[0.625rem] text-muted-foreground/50 tracking-wide uppercase">Gestão inteligente para agências e empresas</span>
              </div>
            </div>
            <div className="flex gap-5 text-sm text-muted-foreground">
              <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">Entrar</button>
              <button onClick={() => navigate("/signup")} className="hover:text-foreground transition-colors">Criar conta</button>
              <span className="cursor-default hover:text-foreground transition-colors">Termos</span>
              <span className="cursor-default hover:text-foreground transition-colors">Contato</span>
            </div>
          </div>
          <p className="text-sm text-muted-soft">© {new Date().getFullYear()} Kora Hub. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
