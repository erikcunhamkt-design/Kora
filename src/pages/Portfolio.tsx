import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Plus, Search, Eye, Pencil, FolderOpen, Send, FileCheck, Star,
  Calendar, User, Tag, BarChart3, ExternalLink, X,
} from "lucide-react";

import imgBranding from "@/assets/portfolio/branding-luxury.jpg";
import imgWebDesign from "@/assets/portfolio/webdesign-dashboard.jpg";
import imgSocial from "@/assets/portfolio/social-media.jpg";
import imgPackaging from "@/assets/portfolio/packaging-design.jpg";
import imgApp from "@/assets/portfolio/app-design.jpg";
import imgEditorial from "@/assets/portfolio/editorial-design.jpg";

interface Project {
  id: string;
  title: string;
  client: string;
  type: string;
  status: "publicado" | "rascunho";
  date: string;
  cover: string;
  images: string[];
  description: string;
  result: string;
  tags: string[];
  views: number;
}

const projectTypes = ["Branding", "Web Design", "Social Media", "Packaging", "App Design", "Editorial"];

const initialProjects: Project[] = [
  {
    id: "1", title: "Brand Identity — Luxe Co", client: "Brand Co",
    type: "Branding", status: "publicado", date: "2026-03-15",
    cover: imgBranding, images: [imgBranding, imgPackaging],
    description: "Identidade visual completa para marca de luxo, incluindo logotipo, paleta de cores, tipografia, papelaria e aplicações em embalagens premium. O projeto focou em transmitir sofisticação e exclusividade.",
    result: "Aumento de 45% no reconhecimento de marca após lançamento", tags: ["logo", "identidade", "premium"], views: 342,
  },
  {
    id: "2", title: "Dashboard Analytics — FinApp", client: "Tech Solutions",
    type: "Web Design", status: "publicado", date: "2026-03-02",
    cover: imgWebDesign, images: [imgWebDesign, imgApp],
    description: "Design de dashboard para plataforma fintech com foco em visualização de dados, acessibilidade e experiência do usuário. Interface dark com gráficos interativos.",
    result: "Redução de 30% no tempo de análise dos usuários", tags: ["dashboard", "ui/ux", "dark mode"], views: 518,
  },
  {
    id: "3", title: "Campanha Social — Creative Agency", client: "Maria Fernanda",
    type: "Social Media", status: "publicado", date: "2026-02-20",
    cover: imgSocial, images: [imgSocial],
    description: "Criação de campanha completa para redes sociais com 30 peças gráficas, stories animados e templates reutilizáveis para Instagram e LinkedIn.",
    result: "Engajamento aumentou 120% no primeiro mês", tags: ["instagram", "campanha", "ilustração"], views: 287,
  },
  {
    id: "4", title: "Packaging — Reminova Cosmetics", client: "Studio Zen",
    type: "Packaging", status: "publicado", date: "2026-02-10",
    cover: imgPackaging, images: [imgPackaging, imgBranding],
    description: "Design de embalagens para linha de cosméticos naturais. Abordagem minimalista com paleta pastel e materiais sustentáveis.",
    result: "Produto destaque na gôndola — vendas +60%", tags: ["embalagem", "minimalismo", "sustentável"], views: 195,
  },
  {
    id: "5", title: "App Mobile — FinTrack", client: "Acme Corp",
    type: "App Design", status: "rascunho", date: "2026-01-28",
    cover: imgApp, images: [imgApp, imgWebDesign],
    description: "Design de aplicativo mobile para controle financeiro pessoal. 40+ telas desenhadas com sistema de design escalável e prototipagem interativa.",
    result: "Em fase de desenvolvimento", tags: ["mobile", "fintech", "protótipo"], views: 89,
  },
  {
    id: "6", title: "Editorial — Fashion Forward", client: "Nova Design",
    type: "Editorial", status: "publicado", date: "2026-01-15",
    cover: imgEditorial, images: [imgEditorial],
    description: "Design editorial para revista de moda com 48 páginas, incluindo layout, tipografia e direção de arte fotográfica.",
    result: "Revista esgotou primeira tiragem em 2 semanas", tags: ["revista", "editorial", "moda"], views: 412,
  },
];

const Portfolio = () => {
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = projects.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.client.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== "all" && p.type !== filterType) return false;
    if (filterStatus !== "all" && p.status !== filterStatus) return false;
    return true;
  });

  const published = projects.filter((p) => p.status === "publicado").length;
  const drafts = projects.filter((p) => p.status === "rascunho").length;
  const topViews = Math.max(...projects.map((p) => p.views));

  const handleNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newP: Project = {
      id: Date.now().toString(),
      title: fd.get("title") as string,
      client: fd.get("client") as string,
      type: fd.get("type") as string,
      status: (fd.get("status") as Project["status"]) || "rascunho",
      date: new Date().toISOString().slice(0, 10),
      cover: imgBranding,
      images: [imgBranding],
      description: fd.get("description") as string,
      result: fd.get("result") as string,
      tags: (fd.get("tags") as string).split(",").map((t) => t.trim()).filter(Boolean),
      views: 0,
    };
    setProjects((p) => [newP, ...p]);
    setDialogOpen(false);
  };

  const indicators = [
    { label: "Total", value: projects.length, icon: FolderOpen, color: "text-primary" },
    { label: "Publicados", value: published, icon: Send, color: "text-emerald-400" },
    { label: "Rascunhos", value: drafts, icon: FileCheck, color: "text-amber-400" },
    { label: "Mais visto", value: topViews, icon: Star, color: "text-secondary" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfólio</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize e apresente seus melhores projetos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="orbit-gradient hover:opacity-90 gap-2"><Plus className="h-4 w-4" /> Novo projeto</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Novo Projeto</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4">
              <div><Label>Nome do projeto</Label><Input name="title" required className="mt-1.5 bg-muted border-border" /></div>
              <div><Label>Cliente</Label><Input name="client" required className="mt-1.5 bg-muted border-border" /></div>
              <div><Label>Tipo</Label>
                <Select name="type" defaultValue="Branding">
                  <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {projectTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Status</Label>
                <Select name="status" defaultValue="rascunho">
                  <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="rascunho">Rascunho</SelectItem>
                    <SelectItem value="publicado">Publicado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Descrição</Label><Textarea name="description" className="mt-1.5 bg-muted border-border" rows={3} /></div>
              <div><Label>Resultado</Label><Input name="result" className="mt-1.5 bg-muted border-border" placeholder="Ex: aumento de vendas em 30%" /></div>
              <div><Label>Tags (separadas por vírgula)</Label><Input name="tags" className="mt-1.5 bg-muted border-border" placeholder="logo, branding, premium" /></div>
              <DialogFooter><Button type="submit" className="orbit-gradient hover:opacity-90">Criar Projeto</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indicators.map((ind) => {
          const Icon = ind.icon;
          return (
            <div key={ind.label} className="orbit-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><Icon className={`h-5 w-5 ${ind.color}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{ind.label}</p>
                <p className="text-lg font-bold text-foreground">{ind.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar projeto ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-muted border-border" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-44 bg-muted border-border"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos os tipos</SelectItem>
            {projectTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-40 bg-muted border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="publicado">Publicados</SelectItem>
            <SelectItem value="rascunho">Rascunhos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((project) => (
          <div
            key={project.id}
            className="orbit-card overflow-hidden group cursor-pointer hover:orbit-glow transition-all duration-300"
            onClick={() => setSelectedProject(project)}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={project.cover}
                alt={project.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                <button className="p-2.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors">
                  <Eye className="h-5 w-5" />
                </button>
                <button className="p-2.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors" onClick={(e) => e.stopPropagation()}>
                  <Pencil className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute top-3 right-3">
                <Badge className={project.status === "publicado" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"}>
                  {project.status === "publicado" ? "Publicado" : "Rascunho"}
                </Badge>
              </div>
            </div>
            <div className="p-4">
              <Badge variant="outline" className="text-xs border-border text-muted-foreground">{project.type}</Badge>
              <h3 className="text-sm font-semibold text-foreground mt-2 line-clamp-1">{project.title}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" />{project.client}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" />{project.views}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="orbit-card p-12 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhum projeto encontrado</p>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedProject} onOpenChange={(o) => !o && setSelectedProject(null)}>
        <SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="sr-only"><SheetTitle>Detalhes do Projeto</SheetTitle></SheetHeader>
          {selectedProject && (
            <>
              <div className="relative aspect-video w-full overflow-hidden">
                <img src={selectedProject.cover} alt={selectedProject.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                <button onClick={() => setSelectedProject(null)} className="absolute top-4 right-4 p-2 rounded-full bg-background/60 text-foreground hover:bg-background/80 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="border-border text-muted-foreground">{selectedProject.type}</Badge>
                    <Badge className={selectedProject.status === "publicado" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" : "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"}>
                      {selectedProject.status === "publicado" ? "Publicado" : "Rascunho"}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{selectedProject.title}</h2>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{selectedProject.client}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{new Date(selectedProject.date).toLocaleDateString("pt-BR")}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{selectedProject.views} visualizações</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Sobre o Projeto</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{selectedProject.description}</p>
                </div>

                {selectedProject.result && (
                  <div className="p-4 rounded-xl bg-muted/50 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">Resultado</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedProject.result}</p>
                  </div>
                )}

                {selectedProject.images.length > 1 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3">Galeria</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedProject.images.map((img, i) => (
                        <div key={i} className="rounded-lg overflow-hidden aspect-[4/3]">
                          <img src={img} alt={`${selectedProject.title} — ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="border-border text-muted-foreground">{tag}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button className="orbit-gradient hover:opacity-90 flex-1 gap-2"><ExternalLink className="h-4 w-4" />Visualizar</Button>
                  <Button variant="outline" className="border-border flex-1 gap-2"><Pencil className="h-4 w-4" />Editar</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Portfolio;
