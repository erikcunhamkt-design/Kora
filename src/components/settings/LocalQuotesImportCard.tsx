import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useLocalQuotesImport } from '@/hooks/useLocalQuotesImport';
import { formatCurrency } from '@/lib/format';
import { useState } from 'react';

export function LocalQuotesImportCard() {
  const { candidates, loading, error, analyze, importSelected } = useLocalQuotesImport();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Q4/Q5: advertências pré-clique — só entre os candidatos importáveis ("new").
  // Q5b: quantidade fracionária NÃO entra mais aqui — desde a promoção de
  // quote_items.quantity a numeric (2026-07-19) ela é preservada sem perda,
  // deixou de ser algo que o operador precise conferir antes do clique.
  const eligible = candidates.filter((c) => c.status === 'new');
  const orphanCount = eligible.filter((c) => c.clientOrphan).length;
  const moneyWarnCount = eligible.filter((c) => c.money?.totalMismatch).length;

  // refresh when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      analyze();
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Selecione ao menos um orçamento para importar');
      return;
    }
    const result = await importSelected(selectedIds);
    if (result.successIds.length > 0) {
      toast.success(`${result.successIds.length} orçamento(s) importado(s) com sucesso`);
    }
    if (result.failedIds.length > 0) {
      // Mesma disciplina da Fatia 2: falha parcial é sinalizada, não escondida
      // atrás de um toast de sucesso genérico.
      toast.warning(`${result.failedIds.length} orçamento(s) falharam ao importar — nada foi gravado para eles.`);
    }
    setSelectedIds([]);
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Importar orçamentos locais</CardTitle>
            <CardDescription>Sincronize orçamentos gravados no navegador com Supabase</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm">Abrir importador</Button>
          </CardFooter>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importador assistido de orçamentos</DialogTitle>
          <DialogDescription>
            Analisa orçamentos locais, identifica novos, duplicados ou bloqueados e permite importar os "novos".
          </DialogDescription>
        </DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && (
          <div className="space-y-3 mt-4">
            {(orphanCount > 0 || moneyWarnCount > 0) && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">Antes de importar, confira:</p>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {orphanCount > 0 && (
                    <li>
                      {orphanCount} orçamento(s) com cliente <strong>não vinculado</strong> — subirão com{' '}
                      <code>client_id</code> nulo (o nome/e-mail do cliente é preservado).
                    </li>
                  )}
                  {moneyWarnCount > 0 && (
                    <li>
                      {moneyWarnCount} orçamento(s) com <strong>divergência monetária</strong> (total ≠ Σ itens) — o
                      total local é preservado; apenas confira.
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum orçamento local encontrado.</p>
              )}
              {candidates.map((c) => {
                const money = c.money;
                const showMoney = c.status === 'new' && money?.totalMismatch;
                return (
                  <div key={c.localQuote.id} className="flex items-start justify-between p-2 border rounded-md">
                    <div className="flex items-start space-x-2 min-w-0">
                      <Checkbox
                        checked={selectedIds.includes(c.localQuote.id)}
                        onCheckedChange={() => toggleSelection(c.localQuote.id)}
                        disabled={c.status !== 'new'}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <span className="font-medium truncate max-w-xs block">{c.localQuote.title}</span>
                        {c.status === 'new' && c.clientOrphan && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 block">· sem cliente vinculado</span>
                        )}
                        {showMoney && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 block">
                            · total ≠ Σ itens (Δ {formatCurrency(money.diff)})
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={c.status === 'new' ? 'success' : c.status === 'duplicate' ? 'secondary' : 'destructive'}>
                      {c.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleImport} disabled={loading || selectedIds.length === 0}>
            Importar selecionados
          </Button>
          <Button variant="outline" onClick={() => setSelectedIds([])} disabled={loading}>
            Limpar seleção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
