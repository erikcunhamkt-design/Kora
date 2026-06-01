import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Search as SearchIcon, CornerDownLeft } from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem as CmdItem,
} from "@/components/ui/command";
import { commandItems, type CommandItem } from "@/data/commandItems";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type LocalResult = {
  id: string;
  title: string;
  description: string;
  route: string;
};

function readLocalResults(query: string): LocalResult[] {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const out: LocalResult[] = [];
  const sources: Array<{ key: string; route: string; label: string; fields: string[] }> = [
    { key: "orbit:clients", route: "/clientes", label: "Cliente", fields: ["name", "company", "email"] },
    { key: "orbit:leads", route: "/crm", label: "Lead", fields: ["name", "company"] },
    { key: "orbit:tasks", route: "/tarefas", label: "Tarefa", fields: ["title"] },
    { key: "orbit:projects", route: "/portfolio", label: "Projeto", fields: ["name", "title"] },
    { key: "orbit:quotes", route: "/vendas", label: "Orçamento", fields: ["title", "client"] },
  ];
  for (const s of sources) {
    try {
      const raw = localStorage.getItem(s.key);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      for (const item of arr.slice(0, 50)) {
        const text = s.fields.map((f) => String(item?.[f] ?? "")).join(" ").toLowerCase();
        if (text.includes(q)) {
          const title = s.fields.map((f) => item?.[f]).find(Boolean) || "(sem nome)";
          out.push({
            id: `${s.key}-${item.id ?? title}`,
            title: String(title),
            description: s.label,
            route: s.route,
          });
          if (out.length >= 12) return out;
        }
      }
    } catch { /* intentionally empty */ }
  }
  return out;
}

export function CommandCenter({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const localResults = useMemo(() => readLocalResults(query), [query]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    for (const it of commandItems) (groups[it.group] ||= []).push(it);
    return groups;
  }, []);

  const run = (route: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(route), 50);
  };

  const askAi = () => {
    onOpenChange(false);
    toast("Busca com IA será ativada futuramente.");
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar no KORA HUB..."
        value={query}
        onValueChange={setQuery}
        className="h-14 text-base"
        autoFocus
      />
      <CommandList className="p-2">
        <CommandEmpty>
          <div className="py-6 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Nenhum resultado encontrado</p>
            <p className="text-xs text-muted-foreground">
              Tente buscar por cliente, lead, tarefa, orçamento ou módulo
            </p>
          </div>
        </CommandEmpty>

        {localResults.length > 0 && (
          <CommandGroup heading="Resultados">
            {localResults.map((r) => (
              <CmdItem
                key={r.id}
                value={`local-${r.id}-${r.title}`}
                onSelect={() => run(r.route)}
                className="gap-3"
              >
                <div className="h-8 w-8 rounded-md bg-muted/40 flex items-center justify-center">
                  <SearchIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-foreground">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{r.description}</div>
                </div>
                <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
              </CmdItem>
            ))}
          </CommandGroup>
        )}

        {Object.entries(grouped).map(([group, items]) => (
          <CommandGroup key={group} heading={group}>
            {items.map((it) => {
              const Icon = it.icon;
              const searchValue = [it.title, it.description, it.route, ...(it.aliases ?? [])].join(" ");
              return (
                <CmdItem
                  key={it.id}
                  value={searchValue}
                  onSelect={() => run(it.route)}
                  className="gap-3"
                >
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary/85" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-foreground">{it.title}</div>
                    {it.description && (
                      <div className="text-xs text-muted-foreground truncate">{it.description}</div>
                    )}
                  </div>
                  <span className="hidden md:block text-[10px] text-muted-foreground font-mono">
                    {it.route}
                  </span>
                </CmdItem>
              );
            })}
          </CommandGroup>
        ))}

        {query.trim().length > 0 && (
          <CommandGroup heading="IA">
            <CmdItem
              value={`ai-ask-${query}`}
              onSelect={askAi}
              className="gap-3"
            >
              <div className="h-8 w-8 rounded-md orbit-gradient flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-foreground">
                  Perguntar à IA: <span className="text-primary">"{query}"</span>
                </div>
                <div className="text-xs text-muted-foreground">Em breve</div>
              </div>
            </CmdItem>
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
