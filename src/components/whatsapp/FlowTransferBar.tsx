// R11 — botões "Exportar fluxo" / "Importar fluxo" do construtor + a prévia de importação.
// Tudo local: exportar baixa um .json (sem credenciais); importar lê o arquivo, VALIDA,
// mostra o que entra + os problemas que a importação introduz e só aplica depois de
// confirmação (nunca silencioso). Nada persiste até "Salvar Fluxo" (o pai só recebe o
// novo array de nós via `onApply`).
import { useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";
import {
  flowExportFileName, parseFlowImport, planFlowImport, serializeFlow,
  type FlowImportPlan,
} from "@/components/whatsapp/flowTransfer";
import { summarizeFlowIssues } from "@/components/whatsapp/flowValidation";

type Preview =
  | { kind: "error"; fileName: string; error: string }
  | { kind: "plan"; fileName: string; exportedAt?: string; plan: FlowImportPlan };

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o arquivo."));
    reader.readAsText(file);
  });
}

export function FlowTransferBar({
  nodes,
  onApply,
}: {
  nodes: WorkflowNode[];
  /** Aplica o fluxo importado (estado local; não salva). `selectId` = primeiro nó adicionado. */
  onApply: (merged: WorkflowNode[], selectId: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  // O arquivo é lido uma vez; o PLANO é recalculado contra o fluxo ATUAL na hora de
  // mostrar/confirmar (o usuário pode ter editado entre escolher o arquivo e confirmar).
  const [fileNodes, setFileNodes] = useState<WorkflowNode[] | null>(null);

  const handleExport = () => {
    const blob = new Blob([serializeFlow(nodes)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = flowExportFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o MESMO arquivo de novo depois
    if (!file) return;
    let text = "";
    try {
      text = await readFileText(file);
    } catch (err) {
      setFileNodes(null);
      setPreview({ kind: "error", fileName: file.name, error: (err as Error).message });
      return;
    }
    const parsed = parseFlowImport(text);
    if (!parsed.ok) {
      setFileNodes(null);
      setPreview({ kind: "error", fileName: file.name, error: parsed.error });
      return;
    }
    const plan = planFlowImport(nodes, parsed.nodes);
    if (!plan.ok) {
      setFileNodes(null);
      setPreview({ kind: "error", fileName: file.name, error: plan.error });
      return;
    }
    setFileNodes(parsed.nodes);
    setPreview({ kind: "plan", fileName: file.name, exportedAt: parsed.exportedAt, plan });
  };

  const close = () => {
    setPreview(null);
    setFileNodes(null);
  };

  // plano contra o fluxo atual (pode ter mudado desde que o arquivo foi escolhido); memoizado
  // pra os ids novos não mudarem a cada render enquanto a prévia está aberta.
  const livePlan = useMemo(
    () => (preview?.kind === "plan" && fileNodes ? planFlowImport(nodes, fileNodes) : null),
    [preview, fileNodes, nodes],
  );
  const plan = livePlan && livePlan.ok ? livePlan : null;
  const summary = plan ? summarizeFlowIssues(plan.issues) : null;

  const confirm = () => {
    if (!plan) return;
    onApply(plan.merged, plan.addedIds.find((id) => plan.merged.find((n) => n.id === id)?.type === "menu") ?? plan.addedIds[0]);
    close();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={handleExport}>
          <Download className="h-3 w-3" /> Exportar fluxo
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3 w-3" /> Importar fluxo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          aria-label="Arquivo do fluxo (.json)"
          className="sr-only"
          tabIndex={-1}
          onChange={handleFile}
        />
      </div>

      {preview?.kind === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
          <span className="flex-1 min-w-[240px] text-destructive leading-relaxed">
            Arquivo recusado (“{preview.fileName}”): {preview.error} Nada foi alterado no fluxo.
          </span>
          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={close}>
            Fechar
          </Button>
        </div>
      )}

      {plan && summary && preview?.kind === "plan" && (
        <section
          aria-label="Importar fluxo"
          className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-3 text-xs space-y-2"
        >
          <p className="font-bold text-foreground">
            Importar “{preview.fileName}”?
            {preview.exportedAt ? <span className="font-normal text-muted-foreground"> · exportado em {preview.exportedAt.slice(0, 10)}</span> : null}
          </p>
          <p className="text-foreground/90 leading-relaxed">
            Adiciona <strong>{plan.menus} {plan.menus === 1 ? "menu" : "menus"}</strong> e{" "}
            <strong>{plan.messages} {plan.messages === 1 ? "mensagem" : "mensagens"}</strong> ao fluxo atual, com ids novos e as ligações
            refeitas. Nada do que já existe é apagado ou substituído, e credenciais nunca vêm do arquivo. Nada é salvo até “Salvar Fluxo”.
          </p>
          {plan.notes.length > 0 && (
            <ul className="list-disc pl-5 space-y-0.5 text-muted-foreground leading-relaxed">
              {plan.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
          {plan.issues.length > 0 ? (
            <div role="group" aria-label="Problemas da importação" className="space-y-1">
              <p className="font-bold text-foreground">Problemas que esta importação traz — {summary.label}</p>
              <ul className="space-y-0.5">
                {plan.issues.map((it, i) => (
                  <li key={`${it.code}-${it.nodeId}-${i}`} data-issue-severity={it.severity} data-issue-code={it.code} className="flex gap-1.5 leading-relaxed">
                    <span className={`shrink-0 font-bold ${it.severity === "error" ? "text-destructive" : "text-amber-600 dark:text-amber-400"}`}>
                      {it.severity === "error" ? "Erro" : "Aviso"}
                    </span>
                    <span className="text-foreground/90">{it.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-emerald-600 dark:text-emerald-400">A importação não traz nenhum problema novo.</p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button type="button" size="sm" className="h-7 text-[11px]" onClick={confirm}>
              {summary.errors > 0 ? `Importar mesmo assim (${summary.label})` : "Importar"}
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={close}>
              Cancelar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
