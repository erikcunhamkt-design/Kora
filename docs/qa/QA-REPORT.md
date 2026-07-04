# QA — Ciclo Operacional KORA HUB

## 1. Fluxos testados (revisão estática + deep links)
- Cliente → Central do Cliente → Ficha Técnica → Materiais.
- CRM → Oportunidade → criar Orçamento.
- Orçamentos → aprovar → gerar Recebível e Projeto (anti-duplicidade já em `QuotesSection`).
- Financeiro → destaque via `?tab=receivables&entryId=`.
- Projetos → ProjectDetailDrawer → entregáveis, snapshot da Ficha, tarefa vinculada.
- Tarefas → `?task=` destaca; concluir pela Central atualiza `useTasks`.
- Central do Dia (drawer + página) → prioridade, filtros, ações rápidas, "Resolvidos hoje" (apenas em mutação).
- Atividades manuais → `nextStepDate` entra na Central → deep link abre na aba Atividades → resolver remove da Central.

## 2. Bugs encontrados
- Deep links de cliente quebrados em vários módulos: usavam `?focus=<id>` enquanto `Clientes.tsx` lê `?client=<id>`. Resultado: abria a lista de clientes sem selecionar.
- Deep links de projeto quebrados: `/portfolio?project=<id>` (não lido pelo `Portfolio.tsx`, que espera `?tab=projetos&projectId=<id>`).
- `ProjectDetailDrawer` e CRM abriam "Ver orçamento" em `/vendas?tab=orcamentos` sem `?quote=<id>`, perdendo o destaque.

## 3. Bugs corrigidos
- `?focus=` → `?client=` em: `QuotesSection.tsx` (×2), `CRM.tsx`, `ProjectDetailDrawer.tsx` (×2).
- `?project=<id>` → `?tab=projetos&projectId=<id>` em: `ClientProfileDrawer.tsx`, `ClientActivitiesTab.tsx` (×3).
- `Ver orçamento` agora passa `&quote=<id>` em `ProjectDetailDrawer.tsx` e `CRM.tsx` (quando `selectedLead.quoteId` existe).

## 4. Bugs deixados para depois
- Botão "Ver financeiro" em `ClientProfileDrawer` (linha 879) navega para `/financeiro` genérico — sem `entryId` específico do cliente (precisa decidir qual recebível abrir).
- "Ver no CRM" em `ClientActivitiesTab` ainda genérico (sem `?lead=`) — precisa associação cliente↔lead explícita.
- "Ver financeiro" em `ClientActivitiesTab` sem `entryId`.

## 5. Rotas padronizadas
- `/clientes?client=<id>&tab=activities&activity=<id>`
- `/clientes/:clientId/ficha-tecnica`
- `/crm?lead=<id>`
- `/vendas?tab=orcamentos&quote=<id>`
- `/financeiro?tab=receivables&entryId=<id>`
- `/portfolio?tab=projetos&projectId=<id>`
- `/tarefas?task=<id>`
- `/central-do-dia`

Todas as rotas sem acento; query params em inglês.

## 6. Componentes tocados
- `src/components/vendas/QuotesSection.tsx`
- `src/pages/CRM.tsx`
- `src/components/projects/ProjectDetailDrawer.tsx`
- `src/components/clients/ClientProfileDrawer.tsx`
- `src/components/clients/ClientActivitiesTab.tsx`

## 7. Build
`npx tsc --noEmit` → **OK, sem erros**.

## 8. Próxima sugestão
Implementar **undo/desfazer** de "Resolvidos hoje" via toast com janela de 10s (reverter `task.status`, `resolvedAt` do log manual e `transaction.status`), reaproveitando `useDayCenterResolvedActions`.
