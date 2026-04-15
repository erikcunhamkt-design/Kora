import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Users, Target, CheckSquare, DollarSign, Briefcase, TrendingUp,
  ArrowRight, Check, Star, Zap, Shield, Clock, BarChart3,
  ChevronRight, Sparkles, Crown, Layout, PieChart, CalendarCheck,
  Quote, X, AlertTriangle, Layers
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PLAN_PRICE } from "@/contexts/PlanContext";

/* ─── data ─── */
const problems = [
  { icon: Clock, title: "Prazos perdidos", desc: "Sem visão clara de entregas, você vive apagando incêndios." },
  { icon: Layers, title: "Ferramentas demais", desc: "Planilha aqui, Notion ali, WhatsApp acolá. Tudo espalhado." },
  { icon: AlertTriangle, title: "Clientes mal gerenciados", desc: "Propostas esquecidas, follow-ups perdidos, dinheiro na mesa." },
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
  { name: "Lucas Mendes", role: "Designer UI/UX", avatar: "LM", text: "O Orbit mudou completamente minha rotina. Antes eu vivia perdido entre planilhas e mensagens. Agora tenho tudo em um lugar só." },
  { name: "Camila Rocha", role: "Designer Freelancer", avatar: "CR", text: "Finalmente consigo ver quanto realmente faturei no mês. O financeiro do Orbit é um game changer pra quem trabalha sozinho." },
  { name: "Rafael Souza", role: "Diretor de Arte", avatar: "RS", text: "O CRM me ajudou a fechar 3 projetos que eu teria esquecido. Melhor investimento que já fiz no meu negócio." },
];

const screens = [
  { label: "Dashboard", gradient: "from-primary/20 to-secondary/20" },
  { label: "Clientes", gradient: "from-accent/20 to-primary/20" },
  { label: "CRM", gradient: "from-secondary/20 to-accent/20" },
  { label: "Financeiro", gradient: "from-primary/20 to-accent/20" },
];

const freeFeatures = ["1 cliente", "1 projeto no portfólio", "Até 3 tarefas", "1 lead no CRM", "Financeiro básico"];
const proFeatures = ["Clientes ilimitados", "Projetos ilimitados", "Tarefas ilimitadas", "CRM completo", "Financeiro completo", "Metas completas", "Relatórios", "Suporte prioritário"];

/* ─── component ─── */
const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 h-16">
          <span className="text-xl font-bold orbit-gradient-text tracking-tight">Orbit</span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Entrar</Button>
            <Button size="sm" className="orbit-gradient border-0" onClick={() => navigate("/signup")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 px-6">
        {/* glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/3 w-[400px] h-[400px] rounded-full bg-secondary/10 blur-[100px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium">
            <Sparkles className="h-4 w-4" /> Feito por designers, para designers
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight">
            Organize seu trabalho<br />
            <span className="orbit-gradient-text">como um profissional</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Gerencie clientes, projetos, tarefas e financeiro em um único lugar — sem bagunça, sem planilhas.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="orbit-gradient border-0 h-12 px-8 text-base font-semibold" onClick={() => navigate("/signup")}>
              Começar grátis <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base" onClick={() => document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" })}>
              Ver como funciona
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">Grátis para sempre · Sem cartão de crédito</p>
        </div>

        {/* Hero mockup */}
        <div className="relative max-w-5xl mx-auto mt-16">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-2xl shadow-primary/5">
            {/* title bar */}
            <div className="flex items-center gap-2 px-4 h-10 bg-muted/50 border-b border-border/40">
              <span className="w-3 h-3 rounded-full bg-destructive/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-4 text-xs text-muted-foreground font-medium">Orbit — Dashboard</span>
            </div>
            {/* mock content */}
            <div className="p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-4">
              {["R$ 12.450", "24 Clientes", "8 Tarefas", "78% Meta"].map((v, i) => (
                <div key={i} className="rounded-lg bg-muted/40 border border-border/40 p-4 space-y-2">
                  <div className="h-2 w-16 rounded bg-muted-foreground/20" />
                  <p className="text-lg font-bold text-foreground">{v}</p>
                </div>
              ))}
              <div className="col-span-2 md:col-span-4 h-32 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 border border-border/30 flex items-center justify-center">
                <BarChart3 className="h-12 w-12 text-primary/40" />
              </div>
            </div>
          </div>
          {/* reflection glow */}
          <div className="absolute -bottom-8 inset-x-10 h-16 bg-primary/5 blur-2xl rounded-full" />
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="py-20 md:py-28 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">O problema</p>
            <h2 className="text-3xl md:text-4xl font-bold">Você se reconhece aqui?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">A maioria dos designers perde tempo e dinheiro por falta de organização.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {problems.map((p) => (
              <Card key={p.title} className="bg-card border-border/60 p-6 text-left space-y-3 hover:border-destructive/40 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <p.icon className="h-5 w-5 text-destructive" />
                </div>
                <h3 className="font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ── */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">A solução</p>
            <h2 className="text-3xl md:text-4xl font-bold">Tudo que você precisa, em um só lugar</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">O Orbit reúne todos os módulos que um designer precisa para trabalhar com profissionalismo.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((m) => (
              <Card key={m.name} className="bg-card border-border/60 p-6 text-left space-y-4 group hover:border-primary/40 transition-colors">
                <div className="w-12 h-12 rounded-xl orbit-gradient flex items-center justify-center group-hover:scale-110 transition-transform">
                  <m.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{m.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-20 md:py-28 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Benefícios</p>
            <h2 className="text-3xl md:text-4xl font-bold">Por que designers escolhem o Orbit</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="flex flex-col items-center text-center space-y-3 p-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <b.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo ── */}
      <section id="demo" className="py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Conheça o sistema</p>
            <h2 className="text-3xl md:text-4xl font-bold">Veja o Orbit em ação</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {screens.map((s) => (
              <div key={s.label} className="rounded-xl border border-border/60 bg-card overflow-hidden group hover:border-primary/40 transition-colors">
                <div className="flex items-center gap-2 px-4 h-9 bg-muted/40 border-b border-border/30">
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-xs text-muted-foreground">{s.label}</span>
                </div>
                <div className={`h-48 md:h-56 bg-gradient-to-br ${s.gradient} flex items-center justify-center`}>
                  <span className="text-2xl font-bold text-foreground/20">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-20 md:py-28 px-6 bg-muted/20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Planos</p>
            <h2 className="text-3xl md:text-4xl font-bold">Comece grátis, evolua quando quiser</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Free */}
            <Card className="border-border bg-card p-6 space-y-6 text-left">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Free</p>
                <p className="text-3xl font-bold mt-1">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                <p className="text-sm text-muted-foreground mt-2">Para quem está começando</p>
              </div>
              <div className="space-y-3">
                {freeFeatures.map((f) => (
                  <div key={f} className="flex items-center gap-3 text-sm">
                    <Check className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full" onClick={() => navigate("/signup")}>Começar grátis</Button>
            </Card>
            {/* Pro */}
            <Card className="border-primary/40 bg-card p-6 space-y-6 text-left relative ring-2 ring-primary/20">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full orbit-gradient text-white text-xs font-semibold flex items-center gap-1.5">
                <Crown className="h-3 w-3" /> Mais popular
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Pro</p>
                <p className="text-3xl font-bold mt-1">{PLAN_PRICE}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
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
              <Button className="w-full orbit-gradient border-0 h-11 text-base font-semibold" onClick={() => navigate("/signup")}>
                Começar agora <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-6xl mx-auto text-center space-y-12">
          <div className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider">Depoimentos</p>
            <h2 className="text-3xl md:text-4xl font-bold">Quem usa, recomenda</h2>
            <p className="text-muted-foreground">+2.000 designers já usam o Orbit</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <Card key={t.name} className="bg-card border-border/60 p-6 text-left space-y-4">
                <Quote className="h-8 w-8 text-primary/30" />
                <p className="text-sm text-muted-foreground leading-relaxed italic">"{t.text}"</p>
                <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                  <div className="w-10 h-10 rounded-full orbit-gradient flex items-center justify-center text-sm font-bold text-primary-foreground">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                  <div className="ml-auto flex gap-0.5">
                    {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />)}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-20 md:py-28 px-6">
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="absolute inset-0 rounded-3xl orbit-gradient opacity-[0.07]" />
          <div className="relative rounded-3xl border border-primary/20 bg-card/50 backdrop-blur-sm p-12 md:p-16 space-y-6">
            <Sparkles className="h-10 w-10 text-primary mx-auto" />
            <h2 className="text-3xl md:text-4xl font-bold">Comece a organizar seu trabalho hoje</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">Junte-se a milhares de designers que já transformaram sua rotina com o Orbit.</p>
            <Button size="lg" className="orbit-gradient border-0 h-12 px-10 text-base font-semibold" onClick={() => navigate("/signup")}>
              Criar conta grátis <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <p className="text-xs text-muted-foreground">Sem cartão de crédito · Cancele quando quiser</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold orbit-gradient-text">Orbit</span>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <button onClick={() => navigate("/login")} className="hover:text-foreground transition-colors">Entrar</button>
              <button onClick={() => navigate("/signup")} className="hover:text-foreground transition-colors">Criar conta</button>
              <span className="cursor-default">Termos</span>
              <span className="cursor-default">Contato</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Orbit. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
