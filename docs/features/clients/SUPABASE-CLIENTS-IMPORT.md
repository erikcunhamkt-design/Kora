# Migração Híbrida Assistida: Clientes Locais para Supabase

Este documento descreve o funcionamento técnico e a estratégia da ferramenta de importação de clientes do `localStorage` para o banco de dados Supabase.

## Como funciona a importação

A migração é projetada para ser **híbrida** e **assistida**:
1. **Híbrida**: O aplicativo continua utilizando o `localStorage` como fonte de dados primária para a tela de Clientes. Os dados salvos localmente não são excluídos após a importação.
2. **Assistida**: Não há migração silenciosa em background. O usuário deve visualizar os candidatos, revisar duplicados, selecionar os registros desejados e disparar a importação manualmente.

O card de importação está disponível na aba **Empresa** (área de Supabase/Workspace) em Configurações.

## Campos Importados

Os seguintes dados do cliente local são mapeados para a tabela `clients` do Supabase:
- `name` (Nome do Cliente)
- `company` (Empresa)
- `email` (E-mail principal)
- `phone` / `whatsapp` (Telefone/WhatsApp)
- `instagram` / `website`
- `city` / `state` / `address` / `document`
- `status` (Ativo/Arquivado/etc.)
- `potential_value` / `total_revenue`
- `notes` (Observações)
- `tags`

### Contatos Adicionais
Se o cliente possuir contatos vinculados, estes são mapeados para a tabela `client_contacts` com os seguintes campos:
- `name` (Nome do contato)
- `role` (Cargo/Função)
- `email` / `phone` / `whatsapp`
- `is_primary` / `is_financial` / `is_decision_maker`
- `notes`

## Campos NÃO Importados nesta etapa
- `technicalSheet` / Ficha Técnica (e todos os respectivos campos como briefing, marcas, personas, assets e arquivos anexados).
- Histórico de CRM/leads relacionados.
- Orçamentos/propostas.
- Transações/financeiro.
- Projetos/tarefas associados.

## Estratégia de Deduplicação (Dedupe)

Para evitar registros duplicados no Supabase, a ferramenta analisa a lista de clientes já importados e realiza uma busca de duplicados no workspace atual com os seguintes critérios:
1. **E-mail idêntico**: Compara os e-mails em formato lowercase.
2. **Telefone idêntico**: Remove todos os caracteres não numéricos (como parênteses, traços e espaços) e compara os dígitos.
3. **Nome + Empresa idênticos**: Compara a combinação do nome do cliente e o nome da empresa em formato lowercase.

Cada cliente local é classificado em uma das categorias:
- **Novo**: Sem nenhuma correspondência no Supabase. Vem pré-selecionado por padrão.
- **Possível Duplicado**: Possui correspondência por e-mail, telefone ou nome+empresa. Vem desmarcado por padrão para revisão manual.
- **Já Importado**: Identificado na chave de metadados local ou já presente de forma segura. Fica desabilitado e não pode ser re-importado.

## Metadados Locais e Controle

Após a conclusão com sucesso da importação, gravamos o estado na chave do `localStorage` persistido sob `kora.clients.supabaseImport.v1`:

```json
{
  "lastImportedAt": "2026-05-29T22:00:00.000Z",
  "importedLocalIds": [1, 2, 3],
  "skippedLocalIds": [4, 5],
  "importedMap": {
    "1": "8f378a5b-9d41-4770-b747-0e6d6389745e",
    "2": "5fe912a2-cb38-4e8c-8f19-b5d1e4c76be2"
  }
}
```

### O que é o `importedMap` e por que ele é necessário?

O `importedMap` é um mapeamento chave-valor onde a chave é o ID do cliente local (string/número) e o valor é o respectivo ID (UUID do tipo string) retornado pelo Supabase após a criação bem-sucedida do registro.

Este mapeamento é crucial por duas razões:
1. **Rastreabilidade**: Permite saber exatamente qual registro local deu origem a qual registro na nuvem.
2. **Migração de Dados Filhos**: Na próxima fase, quando formos migrar a Ficha Técnica (`technicalSheet`), os assets e as atividades (que hoje estão atrelados ao ID numérico local do cliente no `localStorage`), poderemos consultar o `importedMap` para determinar qual é o `client_id` (UUID) correspondente no Supabase para salvar as informações de forma relacional segura.

## Riscos e Mitigação
- **Conflito de ID**: Os IDs locais (numéricos e sequenciais) não correspondem aos UUIDs do Supabase. O `importedMap` resolve este problema mapeando de forma segura as duas referências.
- **Perda de Conexão**: Se a rede falhar no meio da importação em lote, o loop de importação registrará no `localStorage` apenas os IDs e mapeamentos importados com sucesso, permitindo re-tentar os restantes posteriormente de forma segura.

## Visualização de Dados (Modo Leitura)

Para confirmar o sucesso da importação sem alterar o fluxo operacional do hub, criamos a seção **Clientes no Supabase** na página de Configurações:
- **Finalidade**: Permitir a auditoria visual em tempo real dos clientes salvos no banco de dados remoto Supabase, vinculados ao workspace atual.
- **Funcionamento**: Consome o hook `useSupabaseClients` de forma totalmente passiva (apenas leitura). Não permite criar, editar ou excluir registros por essa tela.
- **Limitação**: Mostra até 10 clientes e exibe o total geral no banco, com botão de atualização manual ("Atualizar").
- **Cruzamento**: Cada cliente retornado do Supabase é cruzado contra as referências no `importedMap`. Se houver correspondência, o registro ganha a badge `Importado do local`, garantindo integridade visual da migração.

## Próximos Passos
1. Validar a consistência dos dados importados e a exibição de contatos através do visualizador em Configurações.
2. Planejar a migração da Ficha Técnica (Technical Sheet) e assets utilizando o `importedMap` criado.
3. Virar a chave da tela principal de Clientes para consumir dados do Supabase com fallback local.
