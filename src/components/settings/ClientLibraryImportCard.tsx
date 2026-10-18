import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useClientLibraryImport } from "@/hooks/useClientLibraryImport";

// G94 · M3 (docs/architecture/etapa-5-flip-catalogo-materiais-fase-a.md §8/§9.2)
// — card PRÓPRIO, separado de LocalCatalogImportCard.tsx (lane A, CT3/CT6) de
// propósito: Biblioteca de Materiais é uma trilha independente (M0–M4), sem
// dependência do catálogo comercial — um card combinado teria acoplado 2
// domínios sem relação. Molde visual: LocalCatalogImportCard.tsx.
export function ClientLibraryImportCard() {
  const { candidates, loading, schemaPending, report, importSelected } = useClientLibraryImport();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (clientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) {
      toast.warning("Selecione ao menos um cliente para importar");
      return;
    }
    const result = await importSelected([...selected]);
    if (result.imported.length > 0) {
      toast.success(`Biblioteca de ${result.imported.length} cliente(s) importada para a nuvem`);
    }
    if (result.failed.length > 0) {
      toast.warning(`${result.failed.length} cliente(s) não foram importados — nada foi gravado para eles.`);
    }
    setSelected(new Set());
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Importar Biblioteca de materiais</CardTitle>
            <CardDescription>Materiais de clientes salvos só neste dispositivo → Supabase</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm">Abrir importador</Button>
          </CardFooter>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importador da Biblioteca de materiais</DialogTitle>
          <DialogDescription>
            Materiais que ficaram salvos só neste dispositivo (enquanto a Biblioteca não sincronizava com a
            nuvem) → coluna nativa do cliente. Nunca sobrescreve uma Biblioteca que já tenha itens na nuvem.
            Reimportar é seguro (idempotente).
          </DialogDescription>
        </DialogHeader>

        {schemaPending && (
          <div role="alert" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
            <p className="font-medium">Schema pendente (pacote §8-b-catálogo) — importação desabilitada.</p>
            <p className="mt-1">
              A coluna <strong>clients.library_assets</strong> ainda não foi criada neste workspace. O operador
              precisa aplicar a migration da Biblioteca de materiais antes de importar.
            </p>
          </div>
        )}
        {loading && <p className="text-sm text-muted-foreground">Importando...</p>}

        {!loading && (
          <div className="space-y-2 mt-2 max-h-96 overflow-y-auto">
            {candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhum material salvo só neste dispositivo aguardando import.
              </p>
            )}
            {candidates.map((c) => {
              const isOn = selected.has(c.clientId);
              return (
                <div key={c.clientId} className="flex items-start justify-between p-2 border rounded-md">
                  <div className="flex items-start space-x-2 min-w-0">
                    <Checkbox
                      aria-label={`Selecionar ${c.clientName}`}
                      checked={isOn}
                      onCheckedChange={() => toggle(c.clientId)}
                      disabled={!!schemaPending}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <span className="font-medium truncate max-w-xs block">{c.clientName}</span>
                      <span className="text-xs text-muted-foreground block">
                        {c.assetCount} material(is)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {report && (
              <div className="rounded-md border p-3 text-sm space-y-1" role="status" aria-label="Relatório do último import">
                <p className="font-medium">Relatório do último import</p>
                <ul className="list-disc pl-5">
                  <li>{report.imported.length} importado(s)</li>
                  {report.failed.length > 0 && (
                    <li>
                      {report.failed.length} descartado(s):{" "}
                      {report.failed.map((f) => `${f.clientName} (${f.reason})`).join(", ")}
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleImport} disabled={!!schemaPending || loading || selected.size === 0}>
            Importar selecionados
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelected(new Set(candidates.map((c) => c.clientId)))}
            disabled={!!schemaPending || loading || candidates.length === 0}
          >
            Selecionar todos
          </Button>
          <Button variant="outline" onClick={() => setSelected(new Set())} disabled={loading}>
            Limpar seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
