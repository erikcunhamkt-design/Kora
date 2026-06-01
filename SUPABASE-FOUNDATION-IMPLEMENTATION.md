# Supabase Foundation V1 Implementation

Este documento detalha o que foi implementado e configurado na fundação do Supabase do KORA HUB.

## Histórico de Auditoria e Estrutura

### 1. Criação da Tabela `profiles`
A tabela `profiles` já existia no projeto original na migration inicial:
- **Arquivo**: `supabase/migrations/20260415142732_37c83968-177d-40f7-8561-0f4c79ccbe90.sql`
- **Campos**: `id`, `user_id`, `display_name`, `email`, `plan`, `created_at`, `updated_at`.
- **Triggers sensíveis**: Proteção a campos confidenciais como `plan` e `email` foi adicionada na migration `20260524014655`.

### 2. Migração de Banco de Dados V1 (Workspaces)
- **Arquivo**: `supabase/migrations/20260530000000_create_workspaces_schema.sql`
- **Conteúdo**:
  - Tabela `public.workspaces` (id, name, slug, owner_id, timestamps).
  - Tabela `public.workspace_members` (id, workspace_id, user_id, role, timestamps).
  - RLS ativada com políticas que permitem leitura apenas para membros de workspace (`public.is_workspace_member`).
  - Atualização da trigger corporativa `handle_new_user()` para fazer o bootstrap automático do workspace inicial (`[Nome do Usuário] Workspace`) e respectiva vinculação de papel `owner` em transação única e atômica.

### 3. RLS e Análise de Segurança
- **Isolamento**: Perfeitamente encapsulado por meio da função helper `is_workspace_member(UUID)` que usa `SECURITY DEFINER` e `search_path = public` seguros. Não há recursão direta com as tabelas membro, pois a função verifica de forma limpa.
- **Políticas Ativas**:
  - **profiles**: Usuários visualizam e atualizam somente o próprio perfil (referência `user_id = auth.uid()`).
  - **workspaces**: Usuários visualizam e atualizam apenas os workspaces onde constam em `workspace_members`.
  - **workspace_members**: Consulta pública restrita a membros do próprio workspace.
- **Privilégios**: Chamadas do cliente do React usam apenas chaves anon públicas e autenticadas. Chave `service_role` protegida.

### 4. Frontend React Hook
- **Hook**: `src/hooks/useCurrentWorkspace.ts`
- **Função**: Consulta dinamicamente no banco a filiação do usuário logado ao seu workspace e retorna o objeto do workspace, o cargo de membro (`role`) e flags de carregamento/erro sem causar loops de renderização (isolado por `useEffect` com dependência no usuário logado).

### 5. Integração na Interface de Usuário
- **Visualização**: `src/pages/Configuracoes.tsx` (aba Empresa)
- Exibe de forma discreta o **Workspace Supabase ativo** com o respectivo cargo do membro (`owner`, `admin`, etc.) somente quando há um usuário Supabase autenticado na sessão.

## Estado de Armazenamento Atual

Todas as entidades de negócio principais do app continuam rodando via **localStorage** por enquanto:
- `clients`
- `leads` (CRM)
- `quotes` (Orçamentos)
- `transactions` (Financeiro)
- `projects` / `tasks`

Isso garante estabilidade absoluta do app sem risco de regressão durante o bootstrap da infraestrutura.

---

## Validação de Integridade
- **TypeScript**: `npx tsc --noEmit` compilado com **0 erros**.
- **Linter**: O número de erros permaneceu exatamente igual a **35 erros** nos arquivos de telas críticas não modificados.
- **Recomendação**: Totalmente seguro avançar para a migração gradual de Clientes (`localStorage` -> Supabase) no próximo passo.

