import { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useLocalCatalogImport } from "@/hooks/useLocalCatalogImport";
import {
  CATALOG_IMPORT_ORDER,
  CATALOG_KIND_LABEL,
  candidateKey,
  isSelectable,
  selectAllPending,
  totalDiscarded,
  type CatalogCandidate,
  type CatalogKind,
} from "@/services/catalog/catalogImport";

// G94 / CT3 — UM card com 4 ETAPAS ORDENADAS (categorias → serviços → produtos → planos), não 4 cards
// encadeados: o catálogo é um domínio só, com referências cruzadas por id (serviço→categoria,
// plano→serviço/produto). Num único diálogo a ordem é garantida por construção (uma corrida usa os mapas
// que as etapas anteriores acabaram de gravar) e a dependência é visível ("depende de …"); com 4 cards o
// usuário teria que coordenar a ordem sozinho e um plano importado antes dos serviços perderia os itens
// PARA SEMPRE. Molde visual: LocalTasksImportCard.tsx.
export function LocalCatalogImportCard() {
  const { candidates, loading, error, schemaPending, report, analyze, importSelected } = useLocalCatalogImport();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const byKind = useMemo(() => {
    const out: Record<CatalogKind, CatalogCandidate[]> = { category: [], service: [], product: [], plan: [] };
    candidates.forEach((c) => out[c.kind].push(c));
    return out;
  }, [candidates]);

  const pendingCount = candidates.filter((c) => c.status === "new").length;
  const importedCount = candidates.filter((c) => c.status === "imported").length;
  const selectedCount = selected.size;
  const blockedImport = !!schemaPending || loading;

  const handleOpenChange = (open: boolean) => {
    if (open) void analyze();
  };

  const toggle = (c: CatalogCandidate) => {
    const key = candidateKey(c.kind, c.localId);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // desmarcar uma dependência desmarca quem dependia dela (nunca deixar um serviço sem a categoria)
        for (const other of candidates) {
          if (other.needs.some((n) => n.kind === c.kind && n.localId === c.localId)) {
            next.delete(candidateKey(other.kind, other.localId));
          }
        }
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleImport = async () => {
    if (schemaPending) return;
    if (selectedCount === 0) {
      toast.warning("Selecione ao menos um item para importar");
      return;
    }
    const result = await importSelected([...selected]);
    const created = CATALOG_IMPORT_ORDER.reduce((n, k) => n + result.created[k].length, 0);
    const failed = CATALOG_IMPORT_ORDER.reduce((n, k) => n + result.failed[k].length, 0);
    const skipped = CATALOG_IMPORT_ORDER.reduce((n, k) => n + result.skippedDependency[k].length, 0);
    if (created > 0) toast.success(`${created} item(ns) do catálogo importado(s) com sucesso`);
    if (failed > 0) {
      const first = result.failures[0];
      toast.warning(
        `${failed} item(ns) falharam ao importar — nada foi gravado para eles.${first ? ` Primeiro erro (${first.label}): ${first.message}` : ""}`,
      );
    }
    if (skipped > 0) toast.warning(`${skipped} item(ns) não foram importados porque a dependência falhou — nada foi gravado para eles.`);
    const discarded = totalDiscarded(result);
    if (discarded > 0) toast.warning(`${discarded} item(ns) de plano foram DESCARTADOS (sem serviço/produto correspondente na nuvem).`);
    setSelected(new Set());
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Importar catálogo comercial</CardTitle>
            <CardDescription>Categorias, serviços, produtos e planos gravados no navegador → Supabase</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm">Abrir importador</Button>
          </CardFooter>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importador assistido do catálogo comercial</DialogTitle>
          <DialogDescription>
            Importa em ordem obrigatória: <strong>categorias → serviços → produtos → planos</strong>. Itens de
            demonstração nunca são importados. Um item que depende de outro ainda não importado só pode ser
            selecionado junto com a dependência. Reimportar é seguro (idempotente).
          </DialogDescription>
        </DialogHeader>

        {schemaPending && (
          <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-medium">Schema pendente (pacote §8-b) — importação desabilitada.</p>
            <p className="mt-1">
              A estrutura do banco para o catálogo ainda não foi criada neste workspace (tabelas ausentes:{" "}
              <strong>{schemaPending.tables.join(", ")}</strong>). O operador precisa aplicar a migration do catálogo
              antes de importar.
            </p>
          </div>
        )}
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <div className="space-y-4 mt-2 max-h-96 overflow-y-auto">
            {candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum item de catálogo local (não-demo) encontrado.</p>
            )}
            {CATALOG_IMPORT_ORDER.map((kind, idx) => {
              const list = byKind[kind];
              if (list.length === 0) return null;
              return (
                <section key={kind} aria-label={CATALOG_KIND_LABEL[kind]}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Etapa {idx + 1} · {CATALOG_KIND_LABEL[kind]}
                  </h4>
                  <div className="space-y-2">
                    {list.map((c) => {
                      const key = candidateKey(c.kind, c.localId);
                      const isOn = selected.has(key);
                      // Só marca se NOVA e com TODA dependência já selecionada (ou já importada) — ou se já está marcada (pra poder desmarcar).
                      const canToggle = c.status === "new" && (isOn || isSelectable(c, selected));
                      const waiting = c.status === "new" && !isOn && !isSelectable(c, selected);
                      return (
                        <div key={key} className="flex items-start justify-between p-2 border rounded-md">
                          <div className="flex items-start space-x-2 min-w-0">
                            <Checkbox
                              aria-label={`Selecionar ${c.label}`}
                              checked={isOn}
                              onCheckedChange={() => toggle(c)}
                              disabled={!canToggle || blockedImport}
                              className="mt-0.5"
                            />
                            <div className="min-w-0">
                              <span className="font-medium truncate max-w-xs block">{c.label}</span>
                              {c.warning && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 block">· {c.warning}</span>
                              )}
                              {waiting && (
                                <span className="text-xs text-muted-foreground block">
                                  · depende de {c.needs.length} item(ns) ainda não importado(s) — selecione-os junto
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge variant={c.status === "new" ? "success" : "secondary"}>
                            {c.status === "new" ? "nova" : "já importada"}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {report && (
              <div className="rounded-md border p-3 text-sm space-y-1" role="status" aria-label="Relatório do último import">
                <p className="font-medium">Relatório do último import</p>
                <ul className="list-disc pl-5">
                  {CATALOG_IMPORT_ORDER.map((k) => {
                    const c = report.created[k].length, f = report.failed[k].length, s = report.skippedDependency[k].length;
                    if (c + f + s === 0) return null;
                    return (
                      <li key={k}>
                        {CATALOG_KIND_LABEL[k]}: {c} importado(s){f > 0 ? `, ${f} com falha` : ""}{s > 0 ? `, ${s} pulado(s) por dependência` : ""}
                      </li>
                    );
                  })}
                </ul>
                {report.failures.length > 0 && (
                  <div className="text-destructive">
                    <p className="font-medium">{report.failures.length} item(ns) com FALHA — nada foi gravado para eles:</p>
                    <ul className="list-disc pl-5">
                      {report.failures.map((f) => (
                        <li key={`${f.kind}:${f.localId}`}>
                          {CATALOG_KIND_LABEL[f.kind]} · {f.label}: {f.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.discardedPlanItems.length > 0 && (
                  <div className="text-amber-700 dark:text-amber-400">
                    <p className="font-medium">
                      {totalDiscarded(report)} item(ns) de plano DESCARTADO(S) — não havia serviço/produto correspondente na nuvem:
                    </p>
                    <ul className="list-disc pl-5">
                      {report.discardedPlanItems.map((p) => (
                        <li key={p.planId}>{p.planName}: {p.items.map((i) => i.name || i.refId).join(", ")}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!loading && !error && candidates.length > 0 && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {pendingCount} nova(s) · {importedCount} já importada(s) · {selectedCount} selecionada(s)
          </p>
        )}

        <DialogFooter>
          <Button onClick={handleImport} disabled={blockedImport || selectedCount === 0}>
            Importar selecionados
          </Button>
          <Button variant="outline" onClick={() => setSelected(selectAllPending(candidates))} disabled={blockedImport || pendingCount === 0}>
            Selecionar todas as novas
          </Button>
          <Button variant="outline" onClick={() => setSelected(new Set())} disabled={loading}>
            Limpar seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
