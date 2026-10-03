import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/hooks/useProjects";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import { isSupabaseProjectsWriteEnabled } from "@/hooks/useSupabaseProjectsWriteFlag";
import { getProjectsDataSource } from "@/config/flags";
import { getFriendlyMessage } from "@/lib/supabase/errors";

interface CreateProjectFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteTitle: string;
  quoteTotal: number;
  clientName: string;
  quoteId: string;
  clientId?: string | null;
  opportunityId?: string | null;
  onSuccess: () => void;
}

export function CreateProjectFromQuoteDialog({
  // G22 (Fase B, dashboard-g22-fix): dual-write — o projeto local continua sendo a
  // fonte que a tela Projetos lê em modo local (invariante "local nunca refém da
  // nuvem"), e quoteId/clientId/opportunityId alimentam também um espelho na
  // nuvem. G85: esse espelho agora passa pelo MESMO caminho dos outros 3 call
  // sites (mirrorProjectToSupabase → mapper → vocabulário canônico, gateado por
  // isSupabaseProjectsWriteEnabled) — antes chamava
  // projectsRepository.createProjectFromQuote direto, sem gate e gravando
  // status "active" (alias legado). O workspace vem de useCurrentWorkspace()
  // (como nos outros 3), então a prop `workspaceId` deixou de existir.
  open,
  onOpenChange,
  quoteTitle,
  quoteTotal,
  clientName,
  quoteId,
  clientId,
  opportunityId,
  onSuccess,
}: CreateProjectFromQuoteDialogProps) {
  const { addProject } = useProjects();
  // Cutover do irmão de CRM (mesma decisão de produto do Caso 7.2 de Vendas,
  // `QuoteToProjectDialog.tsx`, 5be5c3d): em modo Supabase o projeto é criado
  // NATIVAMENTE na nuvem (createSupabaseProject, mesmo caminho de
  // ProjectsSection.tsx pós-flip), não mais "local + espelho best-effort" —
  // em modo Supabase o local nem é lido pela tela Projetos (leitura
  // bifurcada), então o projeto gerado aqui ficava invisível. Mesmo gate de
  // ProjectsSection (getProjectsDataSource, sem flag extra). Modo local:
  // intocado (addProject + espelho G22 abaixo, byte a byte).
  const cloudMode = getProjectsDataSource() === "supabase";
  const { createProject: createSupabaseProject } = useSupabaseProjects();
  const { workspace } = useCurrentWorkspace();
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [budget, setBudget] = useState(0);

  // Pre-fill fields when modal opens
  useEffect(() => {
    if (open) {
      setTitle(`Projeto - ${quoteTitle}`);
      setBudget(quoteTotal);
      setDescription(`Projeto gerado a partir do orçamento experimental aprovado: ${quoteTitle}.`);
      
      const todayStr = new Date().toISOString().slice(0, 10);
      setStartDate(todayStr);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 30);
      setDueDate(targetDate.toISOString().slice(0, 10));
    }
  }, [open, quoteTitle, quoteTotal]);

  const mirrorCreateToSupabase = async (mirrored: Project) => {
    if (!isSupabaseProjectsWriteEnabled() || !workspace) return;
    try {
      await mirrorProjectToSupabase(workspace.id, mirrored);
    } catch (mirrorErr) {
      console.error("Espelho nuvem do projeto falhou (local já gravado):", mirrorErr);
      toast.warning("Projeto salvo localmente, mas o espelho no Supabase falhou.", {
        description: "Rode a importação manual em Configurações → Dados quando possível.",
      });
    }
  };

  const handleConfirm = async () => {
    if (!title.trim()) {
      toast.error("O título do projeto é obrigatório.");
      return;
    }
    if (budget < 0) {
      toast.error("O orçamento do projeto não pode ser negativo.");
      return;
    }
    if (!startDate) {
      toast.error("A data de início é obrigatória.");
      return;
    }
    if (!dueDate) {
      toast.error("A data de vencimento/prazo é obrigatória.");
      return;
    }

    setSubmitting(true);
    if (cloudMode) {
      try {
        // Vínculos REAIS (G37, payload completo): quote_id/client_id/
        // opportunity_id chegam aqui já como uuid (props string vindas de
        // cotações da nuvem). Project.clientId/opportunityId são tipados
        // `number` (uuid "contrabandeado", useClientsDataSource.ts:9) —
        // cast, NUNCA Number() (G67: Number(uuid) = NaN). resolveProjectFk
        // (projectsMapper.ts) tem passthrough de uuid; source "orçamento" +
        // quote_id resolvido => "quote" na nuvem, e importProject já roteia
        // esse caso por createProjectFromQuote (idempotente contra
        // ux_projects_from_quote: repetir "Gerar projeto" na mesma cotação
        // devolve o projeto existente em vez de duplicar).
        await createSupabaseProject({
          name: title,
          clientName,
          clientId: (clientId ?? undefined) as unknown as number | undefined,
          quoteId,
          quoteTitle,
          opportunityId: (opportunityId ?? undefined) as unknown as number | undefined,
          description: description || undefined,
          budget,
          startDate,
          dueDate,
          status: "planning",
          priority: "medium",
          source: "orçamento",
          tags: [],
        });
        toast.success("Projeto criado. Veja em Projetos.");
        onSuccess();
        onOpenChange(false);
      } catch (err: unknown) {
        console.error("Falha ao criar projeto no Supabase:", err);
        toast.error("Erro ao gerar projeto no Supabase.", { description: getFriendlyMessage(err) });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    try {
      // F5-equivalente (padrão F5-b): grava LOCAL (useProjects().addProject()),
      // nivelado ao mesmo caminho que QuoteToProjectDialog.tsx (Vendas) já usa em
      // produção — ProjectsSection.tsx só lê local hoje (ver
      // docs/qa/etapa-5-fatia-7-projects.md §2.4/§11), então é o único jeito do
      // usuário ver este projeto na tela que realmente usa em modo local.
      const project = addProject({
        name: title,
        clientName,
        quoteTitle,
        description: description || undefined,
        budget,
        startDate,
        dueDate,
        status: "planning",
        priority: "medium",
        source: "orçamento",
        tags: [],
      });

      // G22 (Fase B) + G85 — espelho nuvem, best-effort, MESMO caminho dos
      // outros 3 call sites do espelho de Projetos: gate de
      // isSupabaseProjectsWriteEnabled() + mirrorProjectToSupabase → mapper
      // (vocabulário canônico: status "planning", source "quote" quando há
      // quote_id uuid) → importProject, que roteia o caso quote-linked por
      // createProjectFromQuote (idempotente contra ux_projects_from_quote).
      // O vínculo quote/cliente/oportunidade vai numa CÓPIA só do espelho —
      // o projeto local fica byte a byte como antes. clientId/opportunityId
      // são uuid tipados `number` (cast, nunca Number() — G67). Falha aqui
      // NUNCA desfaz nem bloqueia o projeto local acima.
      await mirrorCreateToSupabase({
        ...project,
        quoteId,
        clientId: (clientId ?? undefined) as unknown as number | undefined,
        opportunityId: (opportunityId ?? undefined) as unknown as number | undefined,
      });

      toast.success("Projeto criado. Veja em Projetos.");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Erro ao gerar projeto.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground text-sm font-semibold">Gerar projeto?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-normal">
            Esta ação criará um projeto {cloudMode ? "na nuvem (Supabase)" : "local"}, visível na tela Projetos, a partir deste orçamento aprovado. Tarefas, cronogramas e automações não serão criados nesta etapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-3 text-xs">
          <div className="space-y-1">
            <Label htmlFor="proj-title" className="text-muted-foreground">Título do Projeto</Label>
            <Input
              id="proj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background/50 h-9"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="proj-budget" className="text-muted-foreground">Orçamento / Budget (R$)</Label>
            <Input
              id="proj-budget"
              type="number"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="bg-background/50 h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="proj-start" className="text-muted-foreground">Data de Início</Label>
              <Input
                id="proj-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-background/50 h-9"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="proj-due" className="text-muted-foreground">Prazo Final</Label>
              <Input
                id="proj-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="bg-background/50 h-9"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="proj-desc" className="text-muted-foreground">Descrição / Observações</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background/50 min-h-[70px] resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-foreground h-9 text-xs"
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            className="orbit-gradient text-white border-0 h-9 text-xs"
            disabled={submitting}
          >
            {submitting ? "Processando..." : "Confirmar e Gerar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
