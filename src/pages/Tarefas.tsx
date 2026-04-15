import { useState, useCallback, useEffect } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { UsageBadge } from "@/components/plan/UsageBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  Plus, Search, ArrowUpDown, LayoutList, LayoutGrid, Clock, Calendar,
  MoreHorizontal, GripVertical, CheckCircle2, AlertCircle, Timer,
  Briefcase, Tag, MessageSquare, Paperclip, ListChecks,
  CalendarDays, CircleDot, Flag
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type Priority = "alta" | "média" | "baixa";
type TaskStatus = "a_fazer" | "em_andamento" | "revisao" | "concluido";
interface SubTask { text: string; done: boolean; }
interface Task {
  id: number; title: string; description: string; client: string; project: string;
  priority: Priority; deadline: string; status: TaskStatus; createdAt: string;
  tags: string[]; subtasks: SubTask[];
  comments: { author: string; text: string; date: string }[];
}
interface ColumnConfig { key: TaskStatus; label: string; color: string; dotColor: string; }

const columns: ColumnConfig[] = [
  { key: "a_fazer", label: "A fazer", color: "border-primary/60", dotColor: "bg-primary" },
  { key: "em_andamento", label: "Em andamento", color: "border-amber-500/60", dotColor: "bg-amber-500" },
  { key: "revisao", label: "Revisão", color: "border-secondary/60", dotColor: "bg-secondary" },
  { key: "concluido", label: "Concluído", color: "border-emerald-500/60", dotColor: "bg-emerald-500" },
];

const priorityStyles: Record<Priority, { badge: string; icon: string }> = {
  alta: { badge: "bg-destructive/10 text-destructive border-destructive/20", icon: "text-destructive" },
  média: { badge: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: "text-amber-400" },
  baixa: { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: "text-emerald-400" },
};

const statusLabels: Record<TaskStatus, string> = {
  a_fazer: "A fazer", em_andamento: "Em andamento", revisao: "Revisão", concluido: "Concluído",
};
const statusBadgeStyle: Record<TaskStatus, string> = {
  a_fazer: "bg-primary/10 text-primary border-primary/20",
  em_andamento: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  revisao: "bg-secondary/10 text-secondary border-secondary/20",
  concluido: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

const clientsList = ["Acme Corp", "Studio Zen", "Nova Design", "FitTrack", "Café & Arte", "Brand Co", "StartUp X"];
const today = "15 Abr 2025";

const initialTasks: Task[] = [
  { id: 1, title: "Criar logo principal", description: "Desenvolver 3 propostas de logo para aprovação do cliente. Explorar conceitos minimalistas e tipográficos.", client: "Acme Corp", project: "Rebranding Acme 2025", priority: "alta", deadline: "18 Abr 2025", status: "em_andamento", createdAt: "05 Abr 2025", tags: ["branding", "logo"], subtasks: [{ text: "Pesquisa de referências", done: true }, { text: "Esboços iniciais", done: true }, { text: "Versão digital 1", done: false }, { text: "Apresentação ao cliente", done: false }], comments: [{ author: "Você", text: "Referências aprovadas. Seguir linha minimalista.", date: "12 Abr" }] },
  { id: 2, title: "Wireframe da landing page", description: "Criar wireframe de alta fidelidade para a landing page institucional.", client: "Studio Zen", project: "Landing Page Studio Zen", priority: "alta", deadline: "16 Abr 2025", status: "a_fazer", createdAt: "08 Abr 2025", tags: ["web", "wireframe"], subtasks: [{ text: "Estrutura de seções", done: false }, { text: "Wireframe mobile", done: false }, { text: "Wireframe desktop", done: false }], comments: [] },
  { id: 3, title: "Revisar paleta de cores", description: "Ajustar paleta conforme feedback do último meeting.", client: "Acme Corp", project: "Rebranding Acme 2025", priority: "média", deadline: "20 Abr 2025", status: "revisao", createdAt: "10 Abr 2025", tags: ["branding", "cores"], subtasks: [{ text: "Versão light mode", done: true }, { text: "Versão dark mode", done: true }, { text: "Aprovação final", done: false }], comments: [{ author: "Você", text: "Cliente pediu tons mais quentes no secundário.", date: "14 Abr" }] },
  { id: 4, title: "Posts carrossel Instagram", description: "Criar 5 posts em formato carrossel para o feed do cliente.", client: "FitTrack", project: "Social Media FitTrack", priority: "média", deadline: "17 Abr 2025", status: "em_andamento", createdAt: "09 Abr 2025", tags: ["social media", "design"], subtasks: [{ text: "Roteiro dos slides", done: true }, { text: "Design dos 5 posts", done: false }, { text: "Revisão de copy", done: false }], comments: [] },
  { id: 5, title: "Enviar proposta comercial", description: "Finalizar e enviar proposta com escopo, timeline e investimento.", client: "Nova Design", project: "Catálogo Digital Nova", priority: "alta", deadline: "15 Abr 2025", status: "a_fazer", createdAt: "07 Abr 2025", tags: ["proposta", "comercial"], subtasks: [{ text: "Montar escopo", done: true }, { text: "Definir investimento", done: false }, { text: "Enviar PDF", done: false }], comments: [{ author: "Você", text: "Aguardando aprovação do preço.", date: "13 Abr" }] },
  { id: 6, title: "Design telas onboarding", description: "Criar fluxo de onboarding com 4 telas para o app mobile.", client: "FitTrack", project: "App UI FitTrack", priority: "alta", deadline: "22 Abr 2025", status: "a_fazer", createdAt: "11 Abr 2025", tags: ["ui", "mobile"], subtasks: [{ text: "Fluxo do usuário", done: false }, { text: "Tela 1 - Boas-vindas", done: false }, { text: "Tela 2 - Configuração", done: false }, { text: "Tela 3 - Permissões", done: false }, { text: "Tela 4 - Conclusão", done: false }], comments: [] },
  { id: 7, title: "Reunião alinhamento semanal", description: "Call semanal para alinhar entregas e próximos passos.", client: "Acme Corp", project: "Rebranding Acme 2025", priority: "baixa", deadline: "15 Abr 2025", status: "concluido", createdAt: "08 Abr 2025", tags: ["reunião"], subtasks: [{ text: "Preparar pauta", done: true }, { text: "Realizar call", done: true }, { text: "Enviar resumo", done: true }], comments: [{ author: "Você", text: "Tudo alinhado. Próxima entrega dia 18.", date: "15 Abr" }] },
  { id: 8, title: "Ajustes finais identidade visual", description: "Aplicar últimos ajustes no manual de marca.", client: "Café & Arte", project: "Identidade Visual Café & Arte", priority: "baixa", deadline: "14 Abr 2025", status: "concluido", createdAt: "06 Abr 2025", tags: ["branding", "manual"], subtasks: [{ text: "Corrigir tipografia", done: true }, { text: "Atualizar mockups", done: true }, { text: "Exportar PDF final", done: true }], comments: [{ author: "Você", text: "Manual entregue e aprovado!", date: "14 Abr" }] },
  { id: 9, title: "Criar grid de stories", description: "Definir template visual para stories semanais.", client: "Brand Co", project: "Social Media Brand Co", priority: "média", deadline: "19 Abr 2025", status: "a_fazer", createdAt: "12 Abr 2025", tags: ["social media", "template"], subtasks: [{ text: "Definir estilo visual", done: false }, { text: "Template editável", done: false }], comments: [] },
  { id: 10, title: "Protótipo navegável", description: "Montar protótipo clicável no Figma para validação.", client: "Studio Zen", project: "Landing Page Studio Zen", priority: "média", deadline: "24 Abr 2025", status: "a_fazer", createdAt: "13 Abr 2025", tags: ["web", "protótipo"], subtasks: [{ text: "Linkar telas", done: false }, { text: "Animações de transição", done: false }, { text: "Teste interno", done: false }], comments: [] },
  { id: 11, title: "Revisar banner campanha", description: "Revisão final do banner para Google Ads.", client: "StartUp X", project: "Landing StartUp X", priority: "baixa", deadline: "21 Abr 2025", status: "revisao", createdAt: "10 Abr 2025", tags: ["marketing", "banner"], subtasks: [{ text: "Ajustar CTA", done: true }, { text: "Versão mobile", done: false }], comments: [{ author: "Você", text: "CTA ajustado, falta versão mobile.", date: "14 Abr" }] },
  { id: 12, title: "Entrega final catálogo", description: "Exportar e enviar catálogo digital em PDF e link interativo.", client: "Nova Design", project: "Catálogo Digital Nova", priority: "alta", deadline: "25 Abr 2025", status: "em_andamento", createdAt: "11 Abr 2025", tags: ["entrega", "catálogo"], subtasks: [{ text: "Revisão de conteúdo", done: true }, { text: "Exportar PDF", done: false }, { text: "Publicar link interativo", done: false }], comments: [] },
];

const SummaryCard = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) => (
  <div className="orbit-card p-4 flex items-center gap-3">
    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${accent || "bg-primary/10"}`}>
      <Icon className={`h-5 w-5 ${accent ? "text-white" : "text-primary"}`} />
    </div>
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  </div>
);

const Tarefas = () => {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);

  const filtered = tasks.filter(t => {
    const q = search.toLowerCase();
    return (!q || t.title.toLowerCase().includes(q) || t.client.toLowerCase().includes(q))
      && (filterClient === "all" || t.client === filterClient)
      && (filterPriority === "all" || t.priority === filterPriority)
      && (filterStatus === "all" || t.status === filterStatus);
  });

  const moveTask = useCallback((id: number, newStatus: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    setSelectedTask(prev => prev?.id === id ? { ...prev, status: newStatus } : prev);
  }, []);

  const toggleSubtask = useCallback((taskId: number, idx: number) => {
    const update = (list: Task[]) => list.map(t => {
      if (t.id !== taskId) return t;
      const subs = [...t.subtasks];
      subs[idx] = { ...subs[idx], done: !subs[idx].done };
      return { ...t, subtasks: subs };
    });
    setTasks(update);
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev;
      const subs = [...prev.subtasks];
      subs[idx] = { ...subs[idx], done: !subs[idx].done };
      return { ...prev, subtasks: subs };
    });
  }, []);

  const todayTasks = tasks.filter(t => t.deadline === today && t.status !== "concluido").length;
  const overdue = tasks.filter(t => t.status !== "concluido" && t.deadline < today).length;
  const doneMonth = tasks.filter(t => t.status === "concluido").length;
  const inProgress = tasks.filter(t => t.status === "em_andamento").length;

  const handleDrop = (status: TaskStatus) => {
    if (draggedId !== null) { moveTask(draggedId, status); setDraggedId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground text-sm mt-1">Organize suas atividades e acompanhe o progresso dos seus projetos</p>
        </div>
        <Button onClick={() => setNewTaskOpen(true)} className="orbit-gradient text-white border-0 gap-2 shrink-0">
          <Plus className="h-4 w-4" /> Nova tarefa
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={CalendarDays} label="Tarefas do dia" value={todayTasks} />
        <SummaryCard icon={AlertCircle} label="Atrasadas" value={overdue} accent="bg-destructive/15" />
        <SummaryCard icon={CheckCircle2} label="Concluídas no mês" value={doneMonth} accent="bg-emerald-500/15" />
        <SummaryCard icon={Timer} label="Em andamento" value={inProgress} accent="bg-amber-500/15" />
      </div>

      <div className="orbit-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar tarefa ou cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/50 border-border" />
        </div>
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-border"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos clientes</SelectItem>
            {clientsList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px] bg-muted/50 border-border"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
            <SelectItem value="média">Média</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] bg-muted/50 border-border"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {columns.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => setSortAsc(!sortAsc)} className="border-border"><ArrowUpDown className="h-4 w-4" /></Button>
        <div className="flex border border-border rounded-lg overflow-hidden">
          <Button variant={viewMode === "kanban" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode("kanban")}><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode("list")}><LayoutList className="h-4 w-4" /></Button>
        </div>
      </div>

      {viewMode === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
          {columns.map(col => {
            const colTasks = filtered.filter(t => t.status === col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-[290px]" onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(col.key)}>
                <div className={`orbit-card p-3 border-t-2 ${col.color} mb-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${col.dotColor}`} />
                      <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                    </div>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                </div>
                <div className="space-y-3 min-h-[100px]">
                  {colTasks.map(task => (
                    <div key={task.id} draggable onDragStart={() => setDraggedId(task.id)} onDragEnd={() => setDraggedId(null)} onClick={() => setSelectedTask(task)} className={`orbit-card p-4 cursor-pointer hover:border-primary/30 transition-all duration-200 group ${draggedId === task.id ? "opacity-50 scale-95" : ""}`}>
                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {task.tags.slice(0, 3).map(tag => <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>)}
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold text-foreground leading-tight">{task.title}</p>
                        <GripVertical className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-grab" />
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 truncate">{task.client} · {task.project}</p>
                      {task.subtasks.length > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />Subtarefas</span>
                            <span>{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>
                          </div>
                          <div className="h-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }} />
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className={`text-[10px] ${priorityStyles[task.priority].badge}`}>
                          <Flag className={`h-2.5 w-2.5 mr-1 ${priorityStyles[task.priority].icon}`} />{task.priority}
                        </Badge>
                        <span className={`text-[10px] flex items-center gap-1 ${task.deadline <= today && task.status !== "concluido" ? "text-destructive" : "text-muted-foreground"}`}>
                          <Clock className="h-3 w-3" />{task.deadline}
                        </span>
                      </div>
                    </div>
                  ))}
                  {colTasks.length === 0 && (
                    <div className="orbit-card border-dashed p-6 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Nenhuma tarefa</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="orbit-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Tarefa</TableHead>
                <TableHead className="text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-muted-foreground">Prioridade</TableHead>
                <TableHead className="text-muted-foreground">Prazo</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Progresso</TableHead>
                <TableHead className="text-muted-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sortAsc ? filtered : [...filtered].reverse()).map(task => (
                <TableRow key={task.id} className="border-border hover:bg-muted/50 cursor-pointer" onClick={() => setSelectedTask(task)}>
                  <TableCell>
                    <p className="font-medium text-foreground text-sm">{task.title}</p>
                    <p className="text-xs text-muted-foreground">{task.project}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{task.client}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${priorityStyles[task.priority].badge}`}>{task.priority}</Badge></TableCell>
                  <TableCell className={`text-sm ${task.deadline <= today && task.status !== "concluido" ? "text-destructive" : "text-muted-foreground"}`}>{task.deadline}</TableCell>
                  <TableCell><Badge variant="outline" className={`text-xs ${statusBadgeStyle[task.status]}`}>{statusLabels[task.status]}</Badge></TableCell>
                  <TableCell>
                    {task.subtasks.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{task.subtasks.filter(s => s.done).length}/{task.subtasks.length}</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedTask(task)}>Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem>Editar</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">Nenhuma tarefa encontrada.</div>}
        </div>
      )}

      <NewTaskDialog open={newTaskOpen} onOpenChange={setNewTaskOpen} />
      <TaskDetailSheet task={selectedTask} onClose={() => setSelectedTask(null)} onMove={moveTask} onToggleSubtask={toggleSubtask} />
    </div>
  );
};

const NewTaskDialog = ({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[580px] bg-card border-border max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="text-foreground">Nova tarefa</DialogTitle>
        <DialogDescription className="text-muted-foreground">Adicione uma nova tarefa ao seu board.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground">Título</Label>
          <Input placeholder="Ex: Criar logo principal" className="bg-muted/50 border-border" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground">Descrição</Label>
          <Textarea placeholder="Descreva a tarefa..." className="bg-muted/50 border-border min-h-[80px]" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Cliente</Label>
          <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{clientsList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Projeto</Label>
          <Input placeholder="Nome do projeto" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Prioridade</Label>
          <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="média">Média</SelectItem><SelectItem value="baixa">Baixa</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Prazo</Label>
          <Input type="date" className="bg-muted/50 border-border" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Status</Label>
          <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{columns.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Etiquetas</Label>
          <Input placeholder="Ex: branding, logo" className="bg-muted/50 border-border" />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-sm text-muted-foreground">Checklist inicial</Label>
          <Textarea placeholder="Uma subtarefa por linha..." className="bg-muted/50 border-border min-h-[60px]" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button className="orbit-gradient text-white border-0" onClick={() => onOpenChange(false)}>Criar tarefa</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const TaskDetailSheet = ({ task, onClose, onMove, onToggleSubtask }: {
  task: Task | null; onClose: () => void;
  onMove: (id: number, status: TaskStatus) => void;
  onToggleSubtask: (taskId: number, idx: number) => void;
}) => {
  if (!task) return null;
  const subtasksDone = task.subtasks.filter(s => s.done).length;

  const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{title}</h3>
      {children}
    </div>
  );

  return (
    <Sheet open={!!task} onOpenChange={v => !v && onClose()}>
      <SheetContent className="bg-card border-border w-full sm:max-w-[480px] overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-foreground text-lg leading-tight">{task.title}</SheetTitle>
          <SheetDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={priorityStyles[task.priority].badge}>
              <Flag className={`h-3 w-3 mr-1 ${priorityStyles[task.priority].icon}`} />{task.priority}
            </Badge>
            <Badge variant="outline" className={`text-xs ${statusBadgeStyle[task.status]}`}>{statusLabels[task.status]}</Badge>
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-2 my-4 flex-wrap">
          {columns.filter(c => c.key !== task.status).map(c => (
            <Button key={c.key} size="sm" variant="outline" className="text-xs gap-1.5 border-border" onClick={() => onMove(task.id, c.key)}>
              <div className={`h-2 w-2 rounded-full ${c.dotColor}`} /> {c.label}
            </Button>
          ))}
        </div>

        <div className="space-y-6 pb-6">
          <Section title="Descrição" icon={Briefcase}>
            <div className="orbit-card p-4"><p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p></div>
          </Section>

          <Section title="Informações" icon={CircleDot}>
            <div className="orbit-card p-4 space-y-2.5">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Cliente</span><span className="text-foreground font-medium">{task.client}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Projeto</span><span className="text-foreground font-medium">{task.project}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Criada em</span><span className="text-foreground font-medium">{task.createdAt}</span></div>
              <div className="flex justify-between text-sm">
                <span className={`flex items-center gap-1 ${task.deadline <= today && task.status !== "concluido" ? "text-destructive" : "text-muted-foreground"}`}><Clock className="h-3.5 w-3.5" />Prazo</span>
                <span className={`font-medium ${task.deadline <= today && task.status !== "concluido" ? "text-destructive" : "text-foreground"}`}>{task.deadline}</span>
              </div>
            </div>
          </Section>

          {task.tags.length > 0 && (
            <Section title="Etiquetas" icon={Tag}>
              <div className="flex flex-wrap gap-2">
                {task.tags.map(tag => <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border">{tag}</span>)}
              </div>
            </Section>
          )}

          {task.subtasks.length > 0 && (
            <Section title={`Subtarefas (${subtasksDone}/${task.subtasks.length})`} icon={ListChecks}>
              <div className="space-y-1">
                {task.subtasks.map((sub, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => onToggleSubtask(task.id, i)}>
                    <Checkbox checked={sub.done} className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                    <span className={`text-sm ${sub.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{sub.text}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="Comentários" icon={MessageSquare}>
            {task.comments.length > 0 ? (
              <div className="space-y-3">
                {task.comments.map((c, i) => (
                  <div key={i} className="orbit-card p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground">{c.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{c.text}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>}
            <Textarea placeholder="Adicionar comentário..." className="bg-muted/50 border-border min-h-[60px] text-sm mt-2" />
          </Section>

          <Section title="Anexos" icon={Paperclip}>
            <div className="orbit-card border-dashed p-6 flex flex-col items-center justify-center gap-2">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Arraste arquivos ou clique para anexar</p>
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default Tarefas;
