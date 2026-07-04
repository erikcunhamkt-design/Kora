# KORA HUB - Supabase Foundation Specification

Este documento define a especificação técnica e arquitetural da fundação do Supabase para o KORA HUB. O objetivo é garantir um ambiente SaaS multi-tenant seguro, robusto, e com uma estratégia clara de transição progressiva do `localStorage` para a nuvem.

---

## 1. Visão Geral

A migração das capacidades de persistência do KORA HUB será realizada de forma modular e incremental. O aplicativo continuará totalmente funcional durante a fase de transição por meio de uma estratégia híbrida que consome o banco de dados remoto do Supabase para contas ativas e utiliza o `localStorage` do navegador para usuários em modo demonstração (não logados) ou como fallback resiliente.

---

## 2. Princípio Multi-Tenant

Para sustentar múltiplos estúdios e freelancers de forma isolada, o KORA HUB adota um modelo **Shared Database, Shared Schema (Isolamento via RLS)**. Todos os recursos operacionais devem ser indexados por um identificador de Workspace.

### Entidades Base de Controle:

#### 1. `profiles`
- Mapeia informações do usuário autenticado vinculadas ao `auth.users` do Supabase.
- Chave primária: `iduuid REFERENCES auth.users(id) ON DELETE CASCADE`.

#### 2. `workspaces`
- Representa a conta do estúdio ou empresa do usuário (equivalente ao `CompanySettings` atual).
- Chave primária: `id uuid DEFAULT gen_random_uuid()`.

#### 3. `workspace_members`
- Tabela de junção n:n para associar usuários aos seus respectivos workspaces.
- Colunas: `workspace_id`, `profile_id`, `role` (owner, admin, member, viewer).

---

## 3. Tabelas Principais do Schema (PostgreSQL)

O banco de dados relacional conterá o seguinte esquema de tabelas estruturadas:

### Base (Controle de Acesso)
- `profiles` (id, display_name, avatar_url, email, phone, role)
- `workspaces` (id, name, segment, tax_id, website, currency, country, city, state, address, postal_code, created_at)
- `workspace_members` (workspace_id, profile_id, role, joined_at)

### Comercial (CRM & Vendas)
- `clients` (id, workspace_id, name, company, email, phone, whatsapp, site, status, potential_value, origin, last_interaction, observations, created_at)
- `client_contacts` (id, client_id, name, role, email, phone, whatsapp, is_primary, is_financial, is_decision_maker)
- `client_technical_sheets` (client_id, branding, persona, editorial_line, typography, social_links, accesses, competitors, briefing, created_at)
- `client_assets` (id, client_id, title, type, url, access_status, kind, file_size, mime_type, created_at)
- `client_activity_logs` (id, client_id, type, title, description, date, outcome, next_step, next_step_date, resolved_at)
- `opportunities` (id, workspace_id, client_id, name, estimated_value, priority, temperature, stage, pipeline_id, stage_id, next_action, next_action_date, description, notes, converted, won_at, lost_reason)
- `quotes` (id, workspace_id, client_id, title, description, subtotal, discount, total, payment_condition, delivery_deadline, validity_days, status, expected_close_date, sent_at, approved_at, rejected_at, project_id, finance_entry_id)
- `quote_items` (id, quote_id, name, quantity, unit_price, service_id)

### Financeiro
- `transactions` (id, workspace_id, type, title, description, amount, category, client_name, client_id, due_date, paid_date, status, payment_method, recurrence, source, quote_id)

### Projetos & Tarefas
- `projects` (id, workspace_id, client_id, name, description, service_type, status, priority, start_date, due_date, budget, progress, tags, quote_id)
- `project_deliverables` (id, project_id, title, description, status)
- `tasks` (id, workspace_id, project_id, client_id, title, description, priority, due_date, status, tags, subtasks, comments, recurrence, archived)

---

## 4. Relacionamentos do Banco de Dados

```
[workspaces]
  ├── [workspace_members] (Mapeia acesso de usuários)
  ├── [clients]
  │     ├── [client_contacts] (1:N com clients)
  │     ├── [client_technical_sheets] (1:1 com clients)
  │     ├── [client_assets] (1:N com clients)
  │     └── [client_activity_logs] (1:N com clients)
  ├── [opportunities] (N:1 opcional com clients)
  ├── [quotes] (N:1 com clients)
  │     └── [quote_items] (1:N com quotes)
  ├── [transactions] (N:1 opcional com quotes/clients)
  ├── [projects] (N:1 com clients, 1:1 com quotes opcional)
  │     └── [project_deliverables] (1:N com projects)
  └── [tasks] (N:1 com projects/clients opcional)
```

---

## 5. Estratégia de RLS (Row Level Security)

Nenhuma tabela na nuvem poderá ser lida ou modificada sem uma política de segurança explícita. O isolamento de multi-tenancy será implementado em todas as tabelas usando como base a associação do usuário aos Workspaces autorizados.

### Exemplo de Função Auxiliar SQL de Acesso:
```sql
CREATE OR REPLACE FUNCTION auth.is_workspace_member(workspace_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = $1
      AND workspace_members.profile_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Exemplo de Política de RLS para Clientes:
```sql
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to members of the workspace"
  ON public.clients
  FOR SELECT
  USING (auth.is_workspace_member(workspace_id));
```

- **Escrita Restrita**: Somente usuários com cargos `owner` ou `admin` em `workspace_members` podem remover registros (`DELETE`).
- **Segurança de API**: O client do React usará apenas a chave pública `anon_key`. A chave administrativa `service_role` rodará unicamente em código serverless autenticado das Edge Functions.

---

## 6. Estratégia de Migração LocalStorage → Supabase

A migração de dados ocorrerá conforme a seguinte ordem segura de dependência relacional:

1. **Profiles / Workspaces**: Criação da conta do usuário no Supabase e do workspace atrelado.
2. **Clients / Contacts**: Sem clientes cadastrados, os projetos, propostas e tarefas perdem a referência relacional.
3. **Fichas Técnicas & Assets (Metadados)**: Associadas aos clientes correspondentes.
4. **Oportunidades (CRM)**: Ligadas opcionalmente a clientes.
5. **Orçamentos (Propostas)**: Ligadas a clientes e oportunidades.
6. **Transações (Financeiro)**: Lançamentos financeiros indexados a propostas.
7. **Projetos e Entregas**: Projetos ativos baseados em propostas ou criados avulsos.
8. **Tarefas**: Itens de checklist atrelados aos projetos ou clientes.
9. **Logs de Atividade**: Histórico de interações.
10. **Ações Resolvidas & Onboarding**: Dados de progresso e tracking de ativação do painel.

---

## 7. Estratégia Híbrida Temporária

Para assegurar uma transição imperceptível:
- O aplicativo continuará lendo do `localStorage` se não houver um usuário autenticado ativo no Supabase (modo convidado/demonstração).
- Se houver usuário autenticado no Supabase, a camada de acesso priorizará a busca remota. Se a conexão falhar ou o usuário estiver offline, haverá leitura do cache local sincronizado.

---

## 8. Arquitetura de Acesso a Dados (Futura)

Quando a migração começar, implementaremos uma camada de abstração para desacoplar a interface das chamadas diretas ao banco.

Criação dos serviços em diretório estruturado:
- `src/services/supabase/client.ts` (Instanciação do SDK)
- `src/repositories/clientsRepository.ts` (Métodos de CRUD abstratos)
- `src/repositories/leadsRepository.ts` (Métodos comerciais)

---

## 9. Storage Futuro

O armazenamento físico de arquivos no Supabase usará buckets privados controlados por políticas de segurança:
- `client-assets`: Armazenamento de arquivos de Ficha Técnica por cliente.
- `quote-files`: PDFs gerados e documentos comerciais de propostas.
- `project-files`: Entregas e mídias de projetos em andamento.

**Política de Download**: O frontend obterá apenas *Signed URLs* (URLs temporárias pré-assinadas válidas por 15-30 minutos) via API de Storage para garantir que links vazados expirem rapidamente.

---

## 10. Edge Functions Futuras

As integrações que necessitam de processamento seguro em segundo plano sem expor chaves ao navegador:
- `send-email`: Disparar e-mails comerciais utilizando Resend.
- `create-payment`: Lançar faturas e receber links de PIX usando Asaas.
- `payment-webhook`: Atualizar lançamentos no banco ao receber atualizações das adquirentes.
- `whatsapp-send`: Envio de mensagens operacionais automáticas.
- `ai-generate`: Geração assistida de briefing por prompts protegidos.

---

## 11. Riscos & Mitigações

- **Vazamento entre Inquilinos (Tenant Leak)**: Resolvido ativando RLS de forma restritiva em 100% das tabelas.
- **Conflito de ID na Migração**: IDs numéricos simples do `localStorage` podem colidir. Mitigado migrando chaves primárias relacionais para `uuid` nas tabelas do Supabase.
- **Inconsistência Offline**: Alterações no estado offline que não sincronizam. Resolvido adicionando colunas de rastreamento `updated_at` com verificação de timestamp mais recente.

---

## 12. Primeiro Passo Recomendado

> [!IMPORTANT]
> **Próxima Etapa:** Implementar a fundação Supabase com autenticação (`Supabase Auth`) e a geração automática do perfil do usuário (`profile`) e de seu primeiro `workspace` associado ao se cadastrar. Os dados comerciais (clientes, propostas) devem continuar rodando temporariamente via `localStorage` no frontend.

---

## 13. Critérios de Aceite para a Fundação

A fundação estará validada quando:
1. Um novo usuário conseguir realizar sign-up e login via e-mail ou Magic Link.
2. A trigger automática de banco criar um registro em `profiles` e um `workspace` inicial em `workspaces`.
3. A RLS for testada e impedir que usuários não autorizados visualizem o workspace criado.
4. O KORA HUB se mantiver totalmente usável e as telas operacionais continuarem funcionando via `localStorage` de forma transparente.
