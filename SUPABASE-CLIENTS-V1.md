# KORA HUB - Supabase Clientes V1 Migration

Este documento detalha o roteiro, esquemas e a fundação estrutural criados para a migração gradual de Clientes e Contatos adicionais no KORA HUB.

---

## 1. Migrações de Banco de Dados
Foi gerada a seguinte migration no projeto:
- **Migration**: [20260530010000_create_clients_schema.sql](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/supabase/migrations/20260530010000_create_clients_schema.sql)

### Tabelas Criadas:
- `public.clients`: Mapeia todos os atributos comerciais de cliente (name, company, status, tags, etc.) vinculados à chave primária `workspace_id`.
- `public.client_contacts`: Permite armazenar contatos adicionais de forma isolada por inquilino.

---

## 2. Políticas de RLS (Row Level Security)
Seguindo as diretrizes de multi-tenancy:
- A leitura (`SELECT`), inserção (`INSERT`), atualização (`UPDATE`) e remoção (`DELETE`) em `clients` e `client_contacts` estão restritas a membros ativos do `workspace_id` correspondente, avaliado através da função segura `public.is_workspace_member(workspace_id)`.
- Triggers para atualização automática de `updated_at` acopladas a ambas as tabelas.

---

## 3. Camada de Repositório
Foi criada a camada de acesso a dados isolada:
- **Arquivo**: [clientsRepository.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/repositories/clientsRepository.ts)
- **Métodos**: Abstração do CRUD de clientes e contatos no Supabase sem misturar lógica de UI ou localStorage.

---

## 4. Hook de Acesso (`useSupabaseClients`)
- **Hook**: [useSupabaseClients.ts](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/hooks/useSupabaseClients.ts)
- Oferece controle completo de listagem e mutação de clientes do Supabase associados ao workspace carregado na sessão.
- **Tipagem**: Totalmente livre do uso de `any` para cumprir as regras do linter.

---

## 5. Status de Armazenamento Híbrido
- A UI principal de clientes (`Clientes.tsx`) e os módulos associados de CRM, Financeiro, Projetos e Tarefas **não foram alterados** e continuam utilizando a persistência em `localStorage`.
- Um card informativo foi inserido em [Configuracoes.tsx](file:///C:/Users/erikw/.gemini/antigravity/scratch/orbit-designer-hub/src/pages/Configuracoes.tsx) indicando que a infraestrutura Supabase de clientes está pronta para uso (sincronização futura).
- A migração de dados locais para a nuvem ocorrerá na próxima fase de sincronização transparente.
