# Importador Assistido de Leads/Oportunidades (CRM)

Este documento descreve o funcionamento técnico, o fluxo de mapeamento e as políticas de deduplicação do **Importador Assistido de Leads e Oportunidades** locais do `localStorage` para a tabela `crm_opportunities` no Supabase.

---

## 1. Como Funciona o Fluxo de Importação

A importação é mediada pela interface gráfica em Configurações (área da Empresa) sob o card **"Importar Oportunidades Locais"** e executada por meio do React Hook [useLocalOpportunitiesImport.ts](../../../src/hooks/useLocalOpportunitiesImport.ts):

1. **Obtenção de Leads Locais**: Recupera a lista de leads atualmente salvos na chave `orbyt.leads.v1` do navegador (utilizada pelo hook `useLeads`). Leads marcados com a flag `isDemo === true` (dados de demonstração fornecidos pelo sistema) são **descartados** e ignorados.
2. **Obtenção de Oportunidades Remotas**: Consulta as oportunidades existentes no Supabase pertencentes ao Workspace ativo selecionado.
3. **Análise de Candidatos**: O hook cruza os dados locais e remotos para construir a lista de candidatos elegíveis para migração, indicando status relativos a novos leads, duplicados ou já integrados.
4. **Resumo Comparativo e Seleção**: O usuário visualiza uma contagem (Total Local, Novos, Duplicados, Já Importados), clica em **"Analisar importação"** e abre um diálogo com a lista de cards individuais. Cada oportunidade pode ser desmarcada individualmente antes do envio.
5. **Gravação e Mapeamento**: O sistema realiza as chamadas `createOpportunity` no repositório Supabase, obtém as chaves geradas e grava o mapeamento de IDs no navegador.

---

## 2. Regras de Deduplicação (Dedupe)

Para evitar poluir a base de dados do cliente com oportunidades redundantes causadas por cliques sucessivos, a análise aplica três camadas de busca para classificar uma oportunidade local como `"duplicate"`:
1. **E-mail idêntico**: Se o e-mail do lead local for igual ao e-mail de alguma oportunidade no Supabase do mesmo workspace (case-insensitive).
2. **Telefone/WhatsApp equivalente**: Os caracteres não-numéricos são limpos e o valor normalizado é confrontado com os campos `phone` e `whatsapp` remotos.
3. **Par Nome + Empresa**: Se o título/nome da oportunidade e a empresa cadastrada forem idênticos (case-insensitive).

Se a oportunidade local já possuir seu ID na lista de metadados locais de importados, o status é definido como `"imported"`, bloqueando a marcação do checkbox na listagem.

---

## 3. Relacionamento com Clientes Importados

Se um Lead local contiver associação relacional com um cliente cadastrado por meio de `clientId`:
- O sistema lê o mapeamento de clientes em `kora.clients.supabaseImport.v1`.
- Procura pelo ID remoto equivalente (`importedMap[clientId]`).
- Se encontrar, o UUID correspondente do cliente Supabase é atribuído no campo `client_id` da oportunidade no Supabase.
- Se o cliente local ainda não foi importado, a oportunidade é migrada com `client_id = null`. O vínculo relacional no banco poderá ser refeito em etapas futuras.

---

## 4. Estrutura de Metadados e Mapping Local

O progresso é persistido no `localStorage` sob a chave **`kora.crm.supabaseImport.v1`** utilizando a seguinte modelagem JSON:
```json
{
  "lastImportedAt": "2026-05-30T16:32:00.000Z",
  "importedLocalIds": [1, 3, 5],
  "skippedLocalIds": [2, 4],
  "importedMap": {
    "1": "473bc4f7-dc44-4867-b50a-cb904a7be1ad",
    "3": "8fa30800-4740-424a-9311-570a2f0a149c"
  }
}
```
Isso garante a persistência estável do estado de sincronização e evita tentativas de re-importação.

---

## 5. O que NÃO é Migrado nesta Etapa

Com o objetivo de simplificar e blindar o sistema contra falhas transacionais, as seguintes relações complexas locais são **ignoradas**:
- **Históricos de Eventos**: A lista `history` interna do lead local não é inserida (migra-se apenas notas descritivas consolidadas em `notes`).
- **Orçamentos Reais**: Associações `quoteId`/`quoteTitle` são migradas puramente como metadados textuais na tabela de oportunidades, sem criar registros reais na tabela de orçamentos da nuvem.
- **Financeiro / Contratos**: Dados de faturamento da oportunidade não tocam nas tabelas financeiras.
- **Projetos e Tarefas**: Links lógicos para entregáveis permanecem puramente locais.

---

## 6. Próximos Passos
1. Habilitar feature flag para chaveamento de visualização Local/Supabase no Kanban principal do CRM.
2. Implementar autosync (escrita híbrida write-through) do CRM na nuvem com fallback local.
