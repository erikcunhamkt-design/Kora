// Etapa 5 · Fatia 4 (clients) — C8: leitura e escrita de client_contacts para clients
// Supabase-first. Antes de C8, mapSupabaseClientToLocalClient() sempre retornava
// contacts: [] e nada chamava createClientContact/updateClientContact/deleteClientContact
// fora do import legado — a aba "Contatos" da ficha do cliente aparentava funcionar
// (toast de sucesso, estado local atualizado) mas nunca persistia nada pra client
// Supabase-first (ver docs/qa/etapa-5-fatia-4-clients.md §4.2/§4.4).
//
// Design (§4.4): operações individuais por contato (create/update/delete direto), não
// patch de array — cada ação do usuário na UI já é sempre "um contato só", então cada
// chamada já é atômica por ser uma única linha. clientId é tipado como string (não
// number) de propósito: o `client.id` de um client Supabase é uma UUID string mascarada
// de number pelo cast em useClientsDataSource.ts — o parâmetro aqui força o chamador a
// converter explicitamente (String(client.id)) em vez de deixar passar o valor cru.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsRepository, type SupabaseContactInput } from "@/repositories/clientsRepository";
import type { ClientContact } from "@/types/domain";

type SupabaseContactRow = Awaited<ReturnType<typeof clientsRepository.listClientContacts>>[number];

export function mapSupabaseContactToClientContact(row: SupabaseContactRow): ClientContact {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    isPrimary: row.is_primary ?? false,
    isFinancial: row.is_financial ?? false,
    isDecisionMaker: row.is_decision_maker ?? false,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapClientContactToSupabaseInput(c: ClientContact): SupabaseContactInput {
  return {
    name: c.name,
    role: c.role,
    email: c.email,
    phone: c.phone,
    whatsapp: c.whatsapp,
    is_primary: c.isPrimary,
    is_financial: c.isFinancial,
    is_decision_maker: c.isDecisionMaker,
    notes: c.notes,
  };
}

export function useSupabaseClientContacts(workspaceId: string | undefined, clientId: string | undefined) {
  const queryClient = useQueryClient();
  const enabled = !!workspaceId && !!clientId;
  const queryKey = ["supabase-client-contacts", workspaceId, clientId];

  const query = useQuery({
    queryKey,
    queryFn: () => clientsRepository.listClientContacts(workspaceId as string, clientId as string),
    enabled,
  });

  // G60 (docs/architecture/kora-hub-auditoria-e-plano.md) — G30 varrendo as 3
  // mutations deste hook (transferido de volta pra Lane D — pacote Clientes
  // da Lane C é doc-only, não toca este arquivo). Cache guarda a linha crua
  // do repository (SupabaseContactRow) — mapSupabaseContactToClientContact só
  // roda no `return` (leitura), nunca no cache — mesmo molde simples de
  // useSupabaseFinanceTransactions/useSupabaseProjects.
  const createMutation = useMutation({
    mutationFn: (input: SupabaseContactInput) => {
      if (!workspaceId || !clientId) throw new Error("Workspace ou cliente ausente.");
      return clientsRepository.createClientContact(workspaceId, clientId, input);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseContactRow[]>(
        queryKey,
        (prev) => [created, ...(prev ?? []).filter((c) => c.id !== created.id)],
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ contactId, patch }: { contactId: string; patch: Partial<SupabaseContactInput> }) => {
      if (!workspaceId) throw new Error("Workspace ausente.");
      return clientsRepository.updateClientContact(workspaceId, contactId, patch);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseContactRow[]>(
        queryKey,
        (prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });

  // deleteClientContact é hard delete de verdade (clientsRepository.ts) —
  // devolve `true`, não a linha apagada, então o id pra remover do cache vem
  // da própria variável de entrada da mutation (2º argumento do onSuccess).
  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => {
      if (!workspaceId) throw new Error("Workspace ausente.");
      return clientsRepository.deleteClientContact(workspaceId, contactId);
    },
    onSuccess: (_success, contactId) => {
      queryClient.setQueryData<SupabaseContactRow[]>(
        queryKey,
        (prev) => (prev ?? []).filter((c) => c.id !== contactId),
      );
    },
  });

  return {
    contacts: ((query.data ?? []) as SupabaseContactRow[]).map(mapSupabaseContactToClientContact),
    loading: query.isLoading || query.isFetching,
    error: (query.error ?? null) as Error | null,
    createContact: (c: ClientContact) => createMutation.mutateAsync(mapClientContactToSupabaseInput(c)),
    updateContact: (c: ClientContact) =>
      updateMutation.mutateAsync({ contactId: c.id, patch: mapClientContactToSupabaseInput(c) }),
    deleteContact: (contactId: string) => deleteMutation.mutateAsync(contactId),
    refresh: () => query.refetch(),
  };
}
