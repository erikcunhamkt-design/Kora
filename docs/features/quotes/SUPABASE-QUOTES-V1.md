# Orçamentos Supabase V1

## Visão Geral
Infraestrutura e fundação técnica para persistência, mapeamento e sincronização de orçamentos no Supabase.

## Componentes Disponíveis
1. **Repository**: `quotesRepository.ts`
2. **Mapper**: `quoteMapper.ts`
3. **Hook**: `useSupabaseQuotes.ts`
4. **Importador**: Detalhado em [SUPABASE-QUOTES-IMPORT.md](./SUPABASE-QUOTES-IMPORT.md)
5. **Visualização Experimental**: Detalhado em [SUPABASE-QUOTES-VIEWER.md](./SUPABASE-QUOTES-VIEWER.md)
6. **Aprovação/Rejeição Experimental**: Detalhado em [SUPABASE-QUOTES-APPROVAL.md](./SUPABASE-QUOTES-APPROVAL.md)
7. **Dashboard Operacional Passivo**: Detalhado em [SUPABASE-OPERATIONAL-DASHBOARD.md](../dashboard/SUPABASE-OPERATIONAL-DASHBOARD.md)

## Estado do Armazenamento
- A tela principal de Vendas/Orçamentos continua utilizando `localStorage`.
- Configurações expõe a funcionalidade experimental protegida pela flag `kora.quotes.supabaseExperimental.enabled`.
- Criação experimental a partir de oportunidades do CRM Supabase (se `kora.crm.supabaseCreateQuote.enabled` estiver ativa). Detalhado em [SUPABASE-CRM-QUOTE-CREATE.md](../crm/SUPABASE-CRM-QUOTE-CREATE.md).
- Status do QA: Fluxo de criação integrado a partir do CRM Supabase validado com sucesso.
- Consulta por `opportunity_id` habilitada em `quotesRepository.listQuotesByOpportunity`.
- Aprovação/Rejeição experimental: Controlada pela flag `kora.quotes.supabaseApproval.enabled` para marcar orçamentos Supabase como aprovados/rejeitados sem afetar financeiro/projetos.
- Status do QA (Aprovação/Rejeição): Fluxo experimental de transição de status homologado e validado.
- Fluxo orçamento aprovado → recebível: Detalhado em [SUPABASE-QUOTE-RECEIVABLES.md](./SUPABASE-QUOTE-RECEIVABLES.md), permite gerar recebíveis sob a flag `kora.quotes.supabaseCreateReceivable.enabled`.
- Status do QA (Recebível Financeiro): Geração experimental de transação a receber em Supabase homologada e validada com sucesso.
- Fluxo orçamento aprovado → projeto: Detalhado em [SUPABASE-QUOTE-PROJECTS.md](./SUPABASE-QUOTE-PROJECTS.md), permite gerar projetos sob a flag `kora.quotes.supabaseCreateProject.enabled`.
- Status do QA (Projeto Supabase): Geração experimental de projetos a partir de orçamento Supabase homologada e validada com sucesso.
- Dashboard Operacional Passivo: Detalhado em [SUPABASE-OPERATIONAL-DASHBOARD.md](../dashboard/SUPABASE-OPERATIONAL-DASHBOARD.md), permite consolidação de visibilidade de CRM, Orçamentos, Financeiro e Projetos sob a flag `kora.supabase.operationalDashboard.enabled`.
- Status do QA (Dashboard Operacional): Painel e feature flag homologados e integrados com sucesso.



