import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useLocalFinanceImport } from '@/hooks/useLocalFinanceImport';
import { formatCurrency } from '@/lib/format';
import { useState } from 'react';

// Etapa 5 · Fatia 6 (finance) — mesmo padrão de LocalQuotesImportCard.tsx (Fatia 3).
export function LocalFinanceImportCard() {
  const { candidates, loading, error, analyze, importSelected } = useLocalFinanceImport();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // F3/precisão: advertências pré-clique — só entre os candidatos importáveis ("new").
  const eligible = candidates.filter((c) => c.status === 'new');
  const orphanCount = eligible.filter((c) => c.clientOrphan || c.quoteOrphan || c.opportunityOrphan).length;
  const moneyWarnCount = eligible.filter((c) => c.money?.amountMismatch).length;

  const handleOpenChange = (open: boolean) => {
    if (open) analyze();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const handleImport = async () => {
    if (selectedIds.length === 0) {
      toast.warning('Selecione ao menos um lançamento para importar');
      return;
    }
    const result = await importSelected(selectedIds);
    if (result.successIds.length > 0) {
      toast.success(`${result.successIds.length} lançamento(s) importado(s) com sucesso`);
    }
    if (result.failedIds.length > 0) {
      // Mesma disciplina das Fatias 2/3: falha parcial é sinalizada, não escondida
      // atrás de um toast de sucesso genérico.
      toast.warning(`${result.failedIds.length} lançamento(s) falharam ao importar — nada foi gravado para eles.`);
    }
    setSelectedIds([]);
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle>Importar lançamentos financeiros locais</CardTitle>
            <CardDescription>Sincronize lançamentos gravados no navegador com Supabase</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm">Abrir importador</Button>
          </CardFooter>
        </Card>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importador assistido de lançamentos financeiros</DialogTitle>
          <DialogDescription>
            Analisa lançamentos locais, identifica novos ou já importados e permite importar os "novos".
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
                      {orphanCount} lançamento(s) com cliente, orçamento ou oportunidade{' '}
                      <strong>não vinculado</strong> — subirão com o respectivo campo nulo (os dados
                      textuais são preservados).
                    </li>
                  )}
                  {moneyWarnCount > 0 && (
                    <li>
                      {moneyWarnCount} lançamento(s) com <strong>divergência monetária</strong> (valor ≠
                      total do orçamento vinculado) — o valor local é preservado; apenas confira.
                    </li>
                  )}
                </ul>
              </div>
            )}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {candidates.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum lançamento local encontrado.</p>
              )}
              {candidates.map((c) => {
                const money = c.money;
                const showMoney = c.status === 'new' && money?.amountMismatch;
                const hasOrphan = c.status === 'new' && (c.clientOrphan || c.quoteOrphan || c.opportunityOrphan);
                return (
                  <div key={c.localTransaction.id} className="flex items-start justify-between p-2 border rounded-md">
                    <div className="flex items-start space-x-2 min-w-0">
                      <Checkbox
                        checked={selectedIds.includes(c.localTransaction.id)}
                        onCheckedChange={() => toggleSelection(c.localTransaction.id)}
                        disabled={c.status !== 'new'}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <span className="font-medium truncate max-w-xs block">{c.localTransaction.title}</span>
                        {hasOrphan && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 block">
                            · vínculo não encontrado
                          </span>
                        )}
                        {showMoney && (
                          <span className="text-xs text-amber-600 dark:text-amber-400 block">
                            · valor ≠ total do orçamento (Δ {formatCurrency(money?.diff ?? 0)})
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={c.status === 'new' ? 'success' : 'secondary'}>{c.status}</Badge>
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
