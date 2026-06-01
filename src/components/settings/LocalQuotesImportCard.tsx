import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useLocalQuotesImport } from '@/hooks/useLocalQuotesImport';
import { useState, useEffect } from 'react';

export function LocalQuotesImportCard() {
  const { candidates, loading, error, analyze, importSelected } = useLocalQuotesImport();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
    toast.success(`${result.successIds.length} orçamento(s) importado(s) com sucesso`);
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
          <div className="space-y-4 max-h-96 overflow-y-auto mt-4">
            {candidates.length === 0 && <p className="text-sm text-muted-foreground">Nenhum orçamento local encontrado.</p>}
            {candidates.map((c) => (
              <div key={c.localQuote.id} className="flex items-center justify-between p-2 border rounded-md">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedIds.includes(c.localQuote.id)}
                    onCheckedChange={() => toggleSelection(c.localQuote.id)}
                    disabled={c.status !== 'new'}
                  />
                  <span className="font-medium truncate max-w-xs">{c.localQuote.title}</span>
                </div>
                <Badge variant={c.status === 'new' ? 'success' : c.status === 'duplicate' ? 'secondary' : 'destructive'}>
                  {c.status}
                </Badge>
              </div>
            ))}
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
