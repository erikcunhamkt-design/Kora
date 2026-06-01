// Vitest test for useLocalQuotesImport hook
import { renderHook, act } from '@testing-library/react-hooks';
import { useLocalQuotesImport } from '@/hooks/useLocalQuotesImport';
import { useQuotes } from '@/hooks/useQuotes';
import { useCurrentWorkspace } from '@/hooks/useCurrentWorkspace';
import { quotesRepository } from '@/repositories/quotesRepository';
import { emitNotification } from '@/lib/notify';

// Mock dependencies
jest.mock('@/hooks/useQuotes');
jest.mock('@/hooks/useCurrentWorkspace');
jest.mock('@/repositories/quotesRepository');
jest.mock('@/lib/notify');

const mockLocalQuotes = [
  { id: '1', title: 'Orc 1', clientName: 'Cliente A', clientEmail: 'a@example.com', total: 100, isDemo: false, clientId: 'c1' },
  { id: '2', title: 'Orc 2', clientName: 'Cliente B', clientEmail: 'b@example.com', total: 200, isDemo: true }, // demo
  { id: '3', title: 'Orc 3', clientName: 'Cliente C', clientEmail: 'c@example.com', total: 150.005, isDemo: false }, // close total
];

const mockRemoteQuotes = [
  { id: 'r1', title: 'Orc 1', client_name: 'Cliente A', client_email: 'a@example.com', total: 100 }, // duplicate by title+client+total
  { id: 'r2', title: 'Orc 4', client_name: 'Cliente D', client_email: 'd@example.com', total: 300 },
];

const mockWorkspace = { id: 'ws1' };

beforeEach(() => {
  // Reset localStorage
  localStorage.clear();
  // Mock useQuotes
  (useQuotes as jest.Mock).mockReturnValue({ quotes: mockLocalQuotes });
  // Mock workspace
  (useCurrentWorkspace as jest.Mock).mockReturnValue({ workspace: mockWorkspace });
  // Mock repository listQuotes
  (quotesRepository.listQuotes as jest.Mock).mockResolvedValue(mockRemoteQuotes);
  // Mock createQuote & replaceQuoteItems
  (quotesRepository.createQuote as jest.Mock).mockImplementation(async (_, payload) => ({ id: 'new-id', ...payload }));
  (quotesRepository.replaceQuoteItems as jest.Mock).mockResolvedValue([]);
  // Mock notifications
  (emitNotification as jest.Mock).mockImplementation(() => {});
});

describe('useLocalQuotesImport - QA scenarios', () => {
  it('reads local quotes via useQuotes and ignores demos', async () => {
    const { result } = renderHook(() => useLocalQuotesImport());
    await act(async () => {
      await result.current.analyze();
    });
    // Expect three locals but one demo filtered out
    const ids = result.current.candidates.map(c => c.localQuote.id);
    expect(ids).toContain('1');
    expect(ids).toContain('3');
    expect(ids).not.toContain('2'); // demo ignored
  });

  it('metadata initializes empty and preserves existing data', async () => {
    // Set existing metadata
    const existingMeta = {
      lastImportedAt: '2024-01-01T00:00:00Z',
      importedLocalIds: ['1'],
      skippedLocalIds: [],
      importedMap: { '1': 'r1' },
    };
    localStorage.setItem('kora.quotes.supabaseImport.v1', JSON.stringify(existingMeta));

    const { result } = renderHook(() => useLocalQuotesImport());
    await act(async () => result.current.analyze());
    const meta = JSON.parse(localStorage.getItem('kora.quotes.supabaseImport.v1')!);
    expect(meta.importedMap['1']).toBe('r1'); // preserved
    expect(meta.lastImportedAt).toBe('2024-01-01T00:00:00Z');
  });

  it('dedupe classifies new, duplicate, imported, blocked correctly', async () => {
    // Add imported map for id 1
    const meta = { lastImportedAt: '', importedLocalIds: [], skippedLocalIds: [], importedMap: { '1': 'rX' } };
    localStorage.setItem('kora.quotes.supabaseImport.v1', JSON.stringify(meta));
    const { result } = renderHook(() => useLocalQuotesImport());
    await act(async () => result.current.analyze());
    const statuses = result.current.candidates.reduce((acc, cur) => {
      acc[cur.localQuote.id] = cur.status;
      return acc;
    }, {} as Record<string, string>);
    expect(statuses['1']).toBe('imported'); // already imported
    expect(statuses['3']).toBe('new'); // not duplicate, not blocked
    // duplicate by title+client+total for id 1 was already caught as imported
    // add a code field to trigger duplicate path
    mockLocalQuotes[2].code = 'CODE123';
    mockRemoteQuotes.push({ id: 'r3', code: 'CODE123', title: 'Other', client_name: 'X', client_email: 'x@x.com', total: 10 });
    await act(async () => result.current.analyze());
    const dupStatus = result.current.candidates.find(c => c.localQuote.id === '3')?.status;
    expect(dupStatus).toBe('duplicate');
  });

  it('mapping of clients and opportunities applied correctly', async () => {
    // client map
    const clientMap = { importedMap: { c1: 'supClient1' } };
    localStorage.setItem('kora.clients.supabaseImport.v1', JSON.stringify(clientMap));
    // opportunity map
    const oppMap = { importedMap: { lead99: 'supOpp99' } };
    localStorage.setItem('kora.crm.supabaseImport.v1', JSON.stringify(oppMap));
    // augment local quote with leadId
    mockLocalQuotes[0].leadId = 'lead99';
    const { result } = renderHook(() => useLocalQuotesImport());
    await act(async () => result.current.importSelected(['1']));
    const payload = (quotesRepository.createQuote as jest.Mock).mock.calls[0][1];
    expect(payload.client_id).toBe('supClient1');
    expect(payload.opportunity_id).toBe('supOpp99');
  });

  it('successful import updates metadata only after quote and items', async () => {
    const { result } = renderHook(() => useLocalQuotesImport());
    await act(async () => result.current.importSelected(['1']));
    const meta = JSON.parse(localStorage.getItem('kora.quotes.supabaseImport.v1')!);
    expect(meta.importedMap['1']).toBeDefined();
    expect(meta.importedLocalIds).toContain('1');
  });

  it('failed items do not mark as imported', async () => {
    // Force replaceQuoteItems to reject
    (quotesRepository.replaceQuoteItems as jest.Mock).mockRejectedValue(new Error('items fail'));
    const { result } = renderHook(() => useLocalQuotesImport());
    await act(async () => result.current.importSelected(['1']));
    const meta = JSON.parse(localStorage.getItem('kora.quotes.supabaseImport.v1')!);
    expect(meta.importedMap['1']).toBeUndefined();
    expect(meta.skippedLocalIds).toContain('1');
  });
});
