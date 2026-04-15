import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const projects = [
  { title: "Landing Page Acme Corp", category: "Web Design", date: "Jun 2024", status: "Concluído" },
  { title: "App Mobile FitTrack", category: "UI/UX", date: "Mai 2024", status: "Concluído" },
  { title: "Branding Studio Zen", category: "Branding", date: "Mai 2024", status: "Em andamento" },
  { title: "E-commerce Nova Shop", category: "Web Design", date: "Abr 2024", status: "Concluído" },
  { title: "Dashboard Analytics Pro", category: "UI/UX", date: "Mar 2024", status: "Concluído" },
  { title: "Identidade Visual Brand Co", category: "Branding", date: "Mar 2024", status: "Concluído" },
  { title: "Redesign Portal Edu", category: "Web Design", date: "Fev 2024", status: "Concluído" },
  { title: "App Delivery QuickBite", category: "UI/UX", date: "Jan 2024", status: "Concluído" },
];

const Portfolio = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {projects.map((p, i) => (
        <div key={i} className="orbit-card overflow-hidden group hover:orbit-glow transition-all duration-300">
          <div className="h-40 bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-xs">Preview</span>
          </div>
          <div className="p-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-sm font-semibold text-foreground leading-tight">{p.title}</h3>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">{p.category}</Badge>
              <span className="text-xs text-muted-foreground">{p.date}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default Portfolio;
