# Etapa 6 — Aposentadoria do modo local, Fase A (investigação, zero código)

Levantamento read-only, domínio por domínio, de todo caminho "modo local" ainda vivo no Kora Hub: o que existe, quem consome, o que quebraria se fosse removido hoje, e se já existe alguma decisão de produto registrada no catálogo mestre (`docs/architecture/kora-hub-auditoria-e-plano.md`) vinculando a remoção à aposentadoria do modo local. Nenhum arquivo de código foi alterado nesta rodada — só grep real, leitura de arquivos e leitura do catálogo. Investigação feita por 5 sub-rodadas paralelas (Clientes+Fichas, CRM+Vendas, Projetos+Financeiro, Tarefas, Catálogo/Materiais), cada uma confirmando leitores/escritores por grep antes de classificar.

## §0 Vocabulário usado neste doc

- **dataSource**: seletor local/nuvem por domínio, chave de localStorage `kora.<domínio>.dataSource.v1` (ou equivalente), lido/escrito via `src/config/flags.ts` ou hook próprio.
- **write flag**: flag separada que liga/desliga ESCRITA na nuvem, independente da leitura (`kora.<domínio>.supabaseWrite.v1`/`.enabled`).
- **bifurcated hook** (`useBifurcatedXxx`): decide ler da nuvem ou do store local conforme a dataSource flag.
- **espelho (padrão G22)**: ao escrever na nuvem, grava também uma cópia no localStorage, para sustentar o "rollback nível 1".
- **rollback nível 1**: setar a dataSource flag para `"local"` no navegador e o app volta a funcionar com os dados antigos do localStorage, sem deploy.
- **ferramenta de migração** (import assistido, cards em `Configuracoes.tsx`): NÃO é um "modo" — é o caminho de subida local→nuvem, permanente por desenho.

## §1 Levantamento por domínio

### §1.1 Clientes

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| C1 | `orbyt.clients.v1` (`useClients.ts:48`) — store local dos registros de cliente | **(d)** decisão de produto pendente | **Sem flag de dataSource própria** — único domínio nessa situação. A fonte é decidida automaticamente em `useClientsDataSource.ts:58` (`workspaceLoading \|\| workspace ? "supabase" : "local"`): quem não tem workspace fica **100% em local, sem alternativa** (não é fallback, é a única fonte). Não há toggle manual (`docs/architecture/kora-roadmap.md:93-95` confirma: "não há toggle manual, mas também não há como cair em local por engano"). |
| C2 | `kora.clients.supabaseImport.v1` — mapa idLocal→uuid | **(c)** deve ficar | Glue de FK consumido por quase todos os outros domínios (quotes/projects/tasks/finance/CRM/fichas) para resolver vínculo de cliente legado. Só escrito por `useLocalClientsImport.ts:184`. G82 documenta esse mapa como causa-raiz de um bug já corrigido — não propõe removê-lo. |
| C3 | `kora.clientLibrary.local.v1` — Biblioteca de Materiais do cliente (M0, interino) | **(b)** removível só após homologação específica | Gate = aplicação da DDL `clients.library_assets` (pacote §8-b-catálogo). Código M1-M3 já completo (`939afa3`) mas "só entra em vigor depois do operador aplicar a DDL" (G97). Enquanto a coluna não existir, é a ÚNICA persistência real da Biblioteca em modo nuvem. |
| C4 | `LocalClientsImportCard`/`useLocalClientsImport.ts` | **(c)** deve ficar | Ferramenta de migração. **Gap de qualidade**: sem teste unitário próprio — só coberta indiretamente (hook mockado) em `Configuracoes.import-cards.test.tsx`. |
| C5 | `ClientLibraryImportCard`/`useClientLibraryImport.ts` (M3) | **(c)** deve ficar | Ferramenta de migração M0→coluna nativa, bem testada (15 casos). Bloqueada por "schema pendente" até a DDL de C3 ser aplicada. |

### §1.2 Fichas Técnicas

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| F1 | `kora.technicalSheets.supabaseExperimental.enabled` — kill-switch/rollback nível 1 | **(d)** pendente, **carência explícita já registrada** | `docs/qa/etapa-5-ficha-tecnica.md:198-204`: *"Esta fatia não aposenta a flag... A aposentadoria só será proposta em fatia posterior, após a homologação verde e um período de observação."* Sem data/critério fechado ainda. |
| F2 | `kora.technicalSheets.supabaseAutoSave.enabled` | **(d)** pendente, mesmo guarda-chuva de F1 | Nasceu do hotfix G63 (16/ago/2026). |
| F3 | `kora.technicalSheets.dataSource.v1` (mapa por cliente) | **(d)** pendente | Rollback nível 1 granular, por cliente específico. Clientes "só-nuvem" (`cloudOnly=true`) já ignoram esse seletor. |
| F4 | `kora.technicalSheets.accessesLocal.v1` (acessos, G63) | **FORA DE ESCOPO — decisão permanente** | `accesses[].password` nunca pode ir para a nuvem; invariante permanente, não candidato a aposentadoria. |
| F5 | `kora.technicalSheets.restoreBackups.v1` — até 5 backups antes de "Restaurar do Supabase" | **achado novo, não documentado** | Buffer de segurança de uma ação destrutiva, não espelho morto. Sem teste dedicado, sem entrada no catálogo — gap de documentação a registrar, não candidato a remoção. |
| F6 | `kora.technicalSheets.supabaseImport.v1` | **(c)** deve ficar | Metadado interno da ferramenta de migração. Mesmo gap de teste que C4 (só cobertura indireta). |
| F7 | `technicalSheet` aninhado em `orbyt.clients.v1` | **(d)** pendente | É o próprio dado por trás do rollback nível 1 de F1-F3; sem ele não há "para onde voltar". |

### §1.3 CRM (oportunidades)

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| R1 | `orbyt.leads.v1` (`useLeads.ts:71`) — store local | **(d)** pendente | **Nenhuma decisão registrada** equivalente ao G85 de Projetos para este domínio — busca exaustiva por "aposentad" no catálogo só encontra a entrada de Projetos. |
| R2 | `kora.crm.dataSource.v1` | **(d)** pendente | Default "supabase"; só "local" explícito muda. Único seletor/escritor: `CRM.tsx`. |
| R3 | `kora.crm.supabaseWrite.enabled` | **(c)** deve ficar | Gate de escrita, não "modo" — necessário independente do futuro do local. |
| R4 | `kora.crm.supabaseImport.v1` | **(c)** deve ficar | Ferramenta de migração; também lida por `quoteMapper`/`projectsCloudMirror` para resolver FK de oportunidade. |
| R5 | 5 logs write-only: `supabaseArchives/SoftDeletes/StageMoves/Creates/Edits.v1` + import morto de `supabaseCrmAuditLog.ts` (`kora.crm.supabaseActions.v1`) | **(a) removível já** | Grep exaustivo: **zero leitor** de qualquer uma das 5 chaves. `CrmSupabaseOperationalToggleCard.tsx:68` promete ao usuário "Auditoria local em `kora.crm.supabaseActions.v1`" — chave que hoje **nunca é escrita** (o serviço dedicado existe mas seus métodos nunca são chamados). Texto da UI desalinhado do código — achado novo, não catalogado. |
| R6 | `kora.crm.supabaseCreateQuote.enabled` | **(c)** deve ficar | Gate de visibilidade de botão; o fluxo que ele libera (`CreateCrmSupabaseQuoteDialog`) já é 100% nativo-nuvem, sem ramo local. |

### §1.4 Vendas (orçamentos/Quotes)

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| V1 | `orbyt.quotes.v1` (`useQuotes.ts:72`) — store local | **(d)** pendente | Mesmo padrão de R1 — nenhuma decisão registrada de aposentadoria. |
| V2 | `kora.quotes.dataSource.v1` | **(d)** pendente | Default "supabase" desde o Pacote do Flip. |
| V3 | `kora.quotes.supabaseWrite.enabled` | **(c)** deve ficar | Gate de escrita. |
| V4 | `kora.quotes.supabaseImport.v1` | **(c)** deve ficar | Ferramenta de migração; também mapa de FK para `crmOpportunityMapper`/`projectsCloudMirror`. |
| V5 | `quotesSupabaseCreateProject`/`CreateReceivable.enabled` | **(c)** deve ficar | Gates de visibilidade de botão, vivos. |
| V6 | `quotesSupabaseExperimental`/`quotesSupabaseApproval.enabled` | **(a) removível já** | **Confirmado morto por teste próprio** (`useSupabaseQuotesWriteFlag.test.ts:92-94`: "retirada, não só ignorada por acidente"). Falta só apagar de `BOOLEAN_FLAG_KEYS` e os testes que fixam "sem efeito". |
| V7 | 3 logs write-only: `kora.quotes.supabaseApprovals/Rejections/Receivables.v1` | **(a) removível já** | Grep exaustivo: zero leitor em `src/`. |
| V8 | Leitura NÃO bifurcada de quotes em `ClientProfileDrawer.tsx:806`, `ClientActivitiesTab.tsx:122`, `ClientActivityLogDialog.tsx:34` (usam `useQuotes()` cru, não `useBifurcatedQuotes()`) | **gap vivo, não registrado** — mais próximo de **(d)** mas é bug, não decisão | Mesma classe do **G92** (leitor bifurcado, produtor local), que já corrigiu `leads` nessas 3 telas e `quotes` em `KoraOnboarding.tsx`/`useDayCenterData.ts` — mas **não** nestas 3. Hoje, em modo Supabase (default pós-flip), um cliente só-nuvem aparece com a aba "Comercial" zerada e sem orçamentos na timeline/seletor de atividade. **Candidato a G novo, não a fatia de aposentadoria** — é correção de bug, independente do destino do modo local. |

### §1.5 Pontes CRM/Vendas → Projetos/Financeiro

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| B1 | `QuoteToProjectDialog.tsx`/`CreateProjectFromQuoteDialog.tsx` — ramo local + espelho G22→Projects, gated por `getProjectsDataSource()` | **(b)** condicionado | **G85 já registra exatamente esta condição**: "remoção total do espelho G22 de Projetos só quando o modo local [de Projects] for aposentado — o rollback nível 1 depende dele" (`kora-hub-auditoria-e-plano.md:1339`). |
| B2 | `QuoteToReceivableDialog.tsx`/`CreateReceivableDialog.tsx` — dual-write SEMPRE-ligado→Finance (não gated pela write flag de Financeiro) | **(c)** deve ficar — decisão de design permanente | G41 e a nota-e do próprio código confirmam: "sempre-ligado por desenho". Não há plano de cutover registrado (diferente de B1). |
| B3 | `CreateCrmSupabaseQuoteDialog.tsx` | N/A | Já 100% nativo-nuvem, sem ramo local. |

### §1.6 Projetos

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| P1 | `kora.projects.dataSource.v1` | **(b)** — G85 | Gatilho do rollback nível 1 que o G85 protege. |
| P2 | `kora.projects.supabaseWrite.enabled` (leitor imperativo; hook reativo já removido por órfão) | **(b)** — G85 | Gate dos 4 call sites do espelho. |
| P3 | `orbyt.projects.v1` — store local | **(b)** — G85 | Dado real sustentando o rollback; apagar hoje = perda de dado real para quem está em local. |
| P4 | `mirrorProjectToSupabase`/`projectsCloudMirror.ts` (espelho G22) | **(b)** — G85 explícito | **Atenção**: `readProjectImportMaps` (exportado do mesmo módulo) também é usado pelo **caminho nativo-nuvem** (`useSupabaseProjects.ts:71`, resolve FKs no CREATE). Remover o módulo inteiro quebraria também o caminho 100%-nuvem — qualquer fatia de remoção precisa separar essa função antes. |
| P5 | `kora.projects.supabaseImport.v1` + `LocalProjectsImportCard` | **(c)** deve ficar | Ferramenta de migração; compartilha e sincroniza a mesma chave que P4 usa (upsert consistente). |
| P6 | `ContentSection.tsx` (gerador de rascunho) | fora do escopo | Simulado em memória, sem `localStorage`/flag — não é "modo local" persistente, é feature sem backend ainda. |

### §1.7 Financeiro

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| N1 | `kora.finance.dataSource.v1` | **(b)**, com nuance estrutural importante | **Diferente de Projetos**: as abas principais "Contas a receber"/"Contas a pagar" (`TransactionsTab`) renderizam **sempre** o local, **independente** do valor da flag (comentário explícito em `Financeiro.tsx:155-161`). O dataSource governa só o painel de topo (`SupabaseTransactionsPanel`) e os diálogos de criação rápida. **Bifurcação parcial/aditiva, não exclusiva** (diferente de Projetos, que é exclusiva: OU local OU nuvem na mesma tela). |
| N2 | `kora.finance.supabaseWrite.enabled` (hook reativo, ainda vivo e consumido) | **(b)** | Gate de `blockWrite()`/`cloudMode` nos diálogos — não gateia o espelho (ver N5). |
| N3 | `orbyt.finance.v1` — store local | **(b)**/coexistência permanente | É a ÚNICA fonte das abas receivables/payables hoje, não um fallback — apagar quebra a funcionalidade primária da tela para 100% dos usuários. |
| N4 | 5 sub-domínios 100% locais sem contraparte na nuvem: `kora.finance.suppliers/categories/pixSettings/recurring/cashAccounts.v1` | **(c)** estrutural | Repository confirma zero função cloud para esses 5 — não é "modo a aposentar", é onde o dado mora porque não existe alternativa de nuvem implementada. |
| N5 | Espelho inline G22 de "Gerar recebível" (`QuoteToReceivableDialog`/`CreateReceivableDialog`, sem módulo dedicado como `projectsCloudMirror.ts`) | **(b)**, **GAP: sem decisão de produto registrada** | Mesma lógica causal do G85 se aplica por construção, mas **nenhuma entrada de catálogo documenta isso formalmente para Financeiro** — quem lê só o catálogo não encontra essa trava. Candidato a G novo (pedir ID ao revisor) ou extensão explícita do G85 por analogia. |
| N6 | `kora.finance.supabaseImport.v1` + `LocalFinanceImportCard` | **(c)** deve ficar | Ferramenta de migração; independente do import-map do espelho (N5) — os dois confiam em `source_local_id` + constraint única no banco, sem risco de duplicata. |
| N7 | Log órfão write-only `kora.quotes.supabaseReceivables.v1` (`CreateReceivableDialog.tsx:148-160`) | **(a) removível já** | Mesma classe que o G85 já limpou do lado de Projetos (`kora.quotes.supabaseProjects.v1`) — o equivalente do lado Financeiro **não foi limpo ainda**. Achado novo. |

**Achado estrutural (não pedido, mas relevante):** Projetos e Financeiro implementam "bifurcação" de formas diferentes — Projetos é exclusiva (a tela mostra OU local OU nuvem), Financeiro é aditiva (a tabela principal é sempre local; a nuvem é um painel extra). Essa diferença não está refletida em nenhuma decisão de produto formal comparando os dois — vale registro próprio no catálogo.

### §1.8 Tarefas

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| T1 | `kora.tasks.dataSource.v1` | **(d)** pendente | **Único domínio sem nenhuma UI de toggle** — `setTasksDataSource()` só é chamado em teste. Rollback nível 1 hoje só é possível via devtools/console. |
| T2 | `kora.tasks.supabaseWrite.v1` | **(d)** pendente | Mesma lacuna de UI — hook tem `setEnabled`/`toggle` exportados mas **zero chamador de produção**. |
| T3 | `useBifurcatedTasks` | **(c)** deve ficar | Mecanismo de bifurcação puro, read-only. |
| T4 | `orbyt.tasks.v1` (`useTasks.ts`) | **(b)** | Único resíduo do prefixo legado `orbyt.*` ainda vivo no domínio. Caminho de escrita real sempre que: dataSource=local explícito, write-flag desligada, OU campos sem contraparte cloud (ver T5/T6). |
| T5 | `kora.taskProjects.v1` (`useTaskProjects.ts`) | **(c) PERMANENTE** | `TaskProject` nunca teve representação na nuvem — gap genuíno por desenho (`tasksMapper.ts:262-265`), não resíduo de migração incompleta. |
| T6 | `reminderSentAt` — sempre local, mesmo em modo Supabase | **(c) PERMANENTE, decisão já tomada** | `tasksMapper.ts:394-395`: "Qualquer PR que adicione esse `if` aqui está reabrindo uma decisão de produto já tomada, não corrigindo um campo esquecido." Guard anti-loop (`UUID_RE`) pula tarefas-nuvem de propósito (G76) — consequência aceita: tarefa só-nuvem nunca dispara lembrete local. |
| T7 | **Espelho G22 — NÃO EXISTE para Tarefas** (achado central) | — | Confirmado por comentário explícito em `QuoteToProjectDialog.tsx:69-86` e teste (`QuoteToProjectDialog.cutover.test.tsx`): "nenhum espelho pra tasks existe". **Implicação**: o "rollback nível 1" de Tarefas **não é sem perda**, diferente de Projetos/Financeiro/Fichas — tarefas criadas nativamente na nuvem desaparecem da tela se a flag voltar para "local" (não há cópia local correspondente). **Gap não tratado em nenhum G** — merece decisão de produto formal (documentar como esperado, ou construir espelho). |
| T8 | `kora.tasks.supabaseImport.v1` + `LocalTasksImportCard` | **(c)** deve ficar | Ferramenta de migração. Ressalva: 5 tarefas sintéticas de QA permanecem no localStorage de um operador (`etapa-5-flip-tarefas-homologacao-fase-d.md:113`) — dado de teste esquecido, não bug de código. |
| T9 | `QuoteToProjectDialog.tsx` Caso 7.2 (starter tasks) | **(c)**, decisão já tomada | **Cutover total** (não espelho) — fechado por `5be5c3d`, confirmado no catálogo (`:1149`). |
| T10 | `ProjectDetailDrawer.tsx` G78 | **(c)**, fechado | **Catálogo desatualizado**: a entrada G78 (`:1267`) diz "decisão de produto em aberto", mas `e783912` (04/out) já estendeu o cutover de fato. Doc-only fix pendente, fora do escopo de código desta rodada. |
| T11 | `DayCenter.tsx`/`useDayCenterActions.ts` G76/G77 | **(c)**, fechado | Confirmado fechado no catálogo. |

### §1.9 Catálogo/Materiais (categorias, serviços, produtos, planos)

**Achado crítico de estado**: existe uma branch separada e **NÃO mesclada**, `etapa-5-g94-ct6-flip-defaults` (commit `1302276`), com o **CT6 — flip dos defaults preparado e pronto, mas explicitamente bloqueado** ("PREPARADO, NAO MESCLAR sem ordem explicita"). O doc `docs/qa/etapa-5-g94-ct6-flip.md` (nessa branch) define a ordem de 3 pré-condições: (1) DDL do §8-b aplicada e provada; (2) homologação do catálogo SEM flip (runbook Casos 0-16); (3) "vai" do revisor. **Nenhuma das 3 foi cumprida.** `getCatalogDataSource()` continua com default `"local"` — o Catálogo é o ÚNICO domínio dos 8 cujo default ainda não foi flipado para nuvem.

| # | Caminho | Classificação | Observação |
|---|---|---|---|
| M1 | 4 stores locais: `orbyt.services.v1`, `kora.serviceCategories.v1`, `kora.products.v1`, `kora.commercialPlans.v1` | **(b)** | Gate: DDL §8-b aplicado + CT6 mesclado + CT7/Fase D. Hoje, com default local e DDL nunca aplicada, é provavelmente a fonte real da maioria dos usuários do domínio. |
| M2 | `kora.catalog.dataSource.v1` | **(b)** — default já preparado em CT6 | Chave em si fica até Fase D (não planejada formalmente). |
| M3 | `kora.catalog.supabaseWrite.v1` | **(b)** — idem CT6 | |
| M4 | `kora.catalog.supabaseImport.v1` + `LocalCatalogImportCard`/`useLocalCatalogImport.ts` | **(c)** nunca — é a própria ferramenta | Também consumido por `quoteMapper` para resolver `serviceId` legado em orçamentos antigos. |
| M5 | Bifurcação (`useBifurcatedCatalog.ts`, `catalogCloudContext.ts`, `CatalogDataProvider.tsx`, `useCatalogSource.ts`) | **(c)** deve ficar | Sobrevive ao flip — o flip troca só o default, não remove a bifurcação (mesmo padrão de `useBifurcatedTasks`/`useBifurcatedFinance` pós-flip). |
| M6 | `CatalogSupabaseToggleCards.tsx` | **(c)** componente / **(d)** quando mesclar | Textos atuais ("Padrão: Local") ficam FALSOS automaticamente no dia em que o CT6 for mesclado — patch de texto já pronto na branch, só não aplicado. |
| M7 | `CheckoutTab` em `ServicesSection.tsx:1091-1101` — bypassa a bifurcação deliberadamente | **(d)** pendente, sem prazo | Documentado explicitamente (CT4 "não cobre... Checkout, segue local"). Checkout é stub "Em breve" sem backend de pagamento — migrar para bifurcação é trabalho futuro não planejado em nenhum CT cortado. |
| M8 | `catalogRepositoryShared.ts` (infra de erro/degradação — `isMissingTableError`, `CatalogUnavailableError`) | **(c)** até DDL estável | Defesa em profundidade razoável mesmo pós-DDL (schema pode ficar indisponível por outros motivos). |

**Nenhum caminho deste domínio é "removível já" (a)** — todos dependem de pelo menos uma homologação específica ainda não cumprida.

## §2 Riscos

### §2.1 Perda de dados de quem nunca importou

Real e significativo em praticamente todos os domínios:
- **Clientes**: quem não tem workspace está 100% em local, SEM alternativa — não é um "modo" a aposentar, é a única fonte disponível hoje para esse segmento de usuário.
- **Catálogo**: com o default ainda local e a DDL nunca aplicada, é provável que a MAIORIA dos usuários atuais do domínio dependa inteiramente do local hoje.
- **CRM/Vendas/Projetos/Financeiro/Tarefas/Fichas**: qualquer sessão com a dataSource flag setada explicitamente em `"local"` (override manual, ou sessão herdada de antes do respectivo flip) perde o dado real se o store for apagado.
- **Como detectar — gap real**: não existe hoje telemetria central que diga "este workspace/usuário ainda tem dado só-local não migrado". A única forma indireta é: (i) lado servidor, `SELECT count(*)` nas tabelas cloud por workspace comparado com "workspace existe mas está vazio" (sinal fraco — não prova que não há dado local); (ii) lado cliente, enumerar chaves `orbyt.*`/`kora.*.v1` não-vazias no `localStorage` do navegador — hoje isso só é visível abrindo o DevTools daquele navegador específico, não há agregação. Qualquer fatia RL que dependa de "confirmar que ninguém mais usa o local" precisa primeiro resolver esse gap de instrumentação (ver RL5 abaixo).

### §2.2 Usuários sem workspace

Afeta diretamente **Clientes** (ver §2.1) e, em cascata, qualquer tela que dependa de `useClientsDataSource` (Fichas Técnicas, Biblioteca de Materiais do cliente). Decisão de produto preexistente a essa Fase A: hoje o produto não força criação de workspace — "não há toggle manual, mas também não há como cair em local por engano" (`kora-roadmap.md`). Qualquer aposentadoria do modo local em Clientes precisa primeiro responder: o produto vai exigir workspace sempre, ou vai manter o fallback local como feature permanente de disponibilidade para esse segmento?

### §2.3 Testes que dependem do modo local

Catalogados exaustivamente por domínio nas 5 sub-investigações (listas completas nos relatórios-fonte desta rodada, resumidas aqui por volume): cada um dos 8 domínios tem entre 3 e 15+ arquivos de teste com describes explícitos de "modo local (padrão G22)"/"modo local (explícito)"/"regressão modo local" — são o contrato formal de que o fallback não quebra. Qualquer fatia de remoção efetiva (RL7/RL8) é, em grande parte, trabalho de reescrever ou remover essas suítes — não é 1 linha por domínio, é esforço real de varredura.

### §2.4 Achados colaterais não documentados (gaps encontrados nesta rodada, fora do pedido original)

Levados aqui para registro — não são "modo local" a aposentar, são lacunas de qualidade/documentação que a investigação encontrou de carona:

1. **CRM** — `CrmSupabaseOperationalToggleCard.tsx` promete ao usuário auditoria em `kora.crm.supabaseActions.v1`, chave que nunca é escrita (serviço dedicado existe, nunca é chamado). Texto da UI desalinhado do código.
2. **Vendas** — leitura NÃO bifurcada de `quotes` em 3 telas de Clientes (`ClientProfileDrawer`, `ClientActivitiesTab`, `ClientActivityLogDialog`) — mesma classe do G92, não coberta pelo adendo que já corrigiu `leads`/`quotes` em outras telas. Bug vivo, candidato a G novo.
3. **Financeiro** — espelho G22 de "Gerar recebível" não tem decisão de produto registrada equivalente ao G85 (gap de documentação, não de código).
4. **Financeiro** — log órfão write-only `kora.quotes.supabaseReceivables.v1`, paralelo ao que o G85 já limpou do lado de Projetos, nunca limpo deste lado.
5. **Tarefas** — nenhuma UI de rollback nível 1 existe (único domínio assim); e o rollback nível 1 que existe (via console) não é "sem perda", porque nunca houve espelho G22 para tarefas — gap arquitetural sem decisão de produto registrada.
6. **Tarefas** — catálogo desatualizado na entrada G78 (diz "decisão em aberto"; já foi fechada em código por `e783912`).
7. **Catálogo** — branch `etapa-5-g94-ct6-flip-defaults` com o flip do default pronto, aguardando as 3 pré-condições (DDL, homologação, "vai").
8. **Clientes/Fichas** — `useLocalClientsImport.ts`/`useLocalTechnicalSheetsImport.ts` sem teste unitário próprio (só mock indireto).
9. **Fichas** — `kora.technicalSheets.restoreBackups.v1` (buffer de 5 backups) não documentado em nenhum G, sem teste dedicado.

Nenhum destes é bloqueador da Fase A; todos ficam marcados aqui para o revisor decidir se abre G novo (IDs: pedir ao revisor).

## §3 Proposta de fatias (RL1…RLn)

Ordem sugerida, da menor pra maior dependência/risco. Cada fatia é independente das posteriores, mas depende das anteriores quando indicado.

- **RL1 — Limpeza de resíduos mortos (classe "a", zero risco, zero dependência).** Remover: os 5 logs write-only de CRM (R5) + decidir religar ou apagar `supabaseCrmAuditLog.ts`; as 2 flags mortas de Vendas confirmadas por teste (V6) + os 3 logs write-only (V7); o log órfão de Financeiro (N7). Grep já confirmou zero leitor em todos os casos — pode rodar em qualquer momento, sem esperar nada.
- **RL2 — Fechar gaps de qualidade das ferramentas de migração.** Testes unitários dedicados para `useLocalClientsImport`/`useLocalTechnicalSheetsImport` (hoje só mock indireto). Não remove nada — prepara terreno de confiança para qualquer fatia que dependa de "a ferramenta de import funciona" antes de cortar o que ela substitui.
- **RL3 — Corrigir o bug de leitura não-bifurcada de Vendas (V8).** Independente do destino do modo local — é bug vivo hoje, mesma classe do G92 já fechado em outras telas. Pedir ID ao revisor.
- **RL4 — Fechar o flip do Catálogo.** Pré-requisitos, na ordem já definida pela branch `etapa-5-g94-ct6-flip-defaults`: (1) DDL do pacote §8-b aplicada e provada pelo operador; (2) homologação do catálogo SEM flip (runbook Casos 0-16); (3) "vai" do revisor para mesclar CT6; (4) CT7/Fase D. Só depois disso o Catálogo entra no mesmo estágio dos outros 7 domínios (default nuvem, local como fallback).
- **RL5 — Registrar as decisões de produto que faltam (doc-only, sem código).** G novo (ou extensão explícita do G85 por analogia) para: CRM (R1/R2, sem decisão hoje), Vendas (V1/V2, idem), Financeiro (N5, espelho sem decisão formal), Tarefas (T7, rollback nível 1 "com perda" sem decisão formal), Clientes (C1, "manter modo offline para quem não tem workspace?" — pergunta de produto real, não técnica). Sem isso, RL6/RL7 não têm critério de saída.
- **RL6 — Instrumentar detecção de quem ainda depende do local.** Resolve o gap do §2.1: hoje não há telemetria agregada. Proposta mínima: no boot de cada domínio bifurcado, emitir sinal (anônimo, agregável) quando a dataSource efetiva é "local" OU quando o store local tem itens não-vazios enquanto a fonte é nuvem (candidato a import esquecido). Pré-requisito para qualquer RL7 com segurança.
- **RL7 — Homologação por domínio confirmando "zero usuário real depende do fallback local", com período de observação definido pelo operador.** Depende de RL6 (dados) e RL5 (critério de saída formal). Candidatos, na ordem de menor pra maior risco de bifurcação: CRM → Vendas (depende de Projetos/B1 estarem resolvidos, por causa da ponte) → Fichas Técnicas (já tem período de carência citado em `etapa-5-ficha-tecnica.md`) → Projetos (tem G85, mas `projectsCloudMirror.ts` precisa separar `readProjectImportMaps` do resto antes de remover, pois o caminho nativo-nuvem também o usa) → Financeiro (o mais complexo: bifurcação aditiva, não exclusiva — exigiria redesenhar a tela de recebíveis/pagáveis, não é só apagar store) → Tarefas (não há o que "destrinchar" de um espelho que nunca existiu — aqui RL5 já resolve o essencial; o código do fallback local fica como está).
- **RL8 — Catálogo, mesma sequência de RL6/RL7, depois que RL4 tiver rodado.**
- **RL9 — Decisão de produto final: "aposentar" significa remover todo fallback local (virar 100%-nuvem sempre) OU manter a bifurcação como feature permanente de resiliência (sem internet / sem workspace) e só limpar os resíduos classe (a)/(b) condicionados?** Esta Fase A não decide isso — expõe a pergunta. A resposta determina se RL7/RL8 terminam removendo código de bifurcação (classe c também vira removível) ou só os resíduos mortos.

### RL1 — checklist executável (detalhado nesta rodada, 2026-10-19)

**Antes de executar qualquer item**: confirmar que a varredura global de código morto via `knip` da lane B (classe G84) já mesclou em `main` (`git log --grep=knip` ou o relatório que ela enviar) e **re-rodar o grep de prova de cada item** — se a B já tiver removido, pular (não duplicar trabalho); se sobrou algo, remover só o que sobrar. G105 (catálogo) registra este checklist como ABERTO até essa confirmação.

| # | Item | Chave(s)/arquivo(s) | Grep de prova (zero leitor esperado fora da própria escrita) | Ação |
|---|---|---|---|---|
| 1 | CRM — 5 logs write-only | `kora.crm.supabaseArchives/SoftDeletes/StageMoves/Creates/Edits.v1`, todos em `src/pages/CRM.tsx` | `grep -rn "kora\.crm\.supabase\(Archives\|SoftDeletes\|StageMoves\|Creates\|Edits\)\.v1" src/` — esperado: só o par get/set dentro de `CRM.tsx` | Remover os 5 pares get/set e as 5 chamadas de log nos handlers correspondentes |
| 2 | CRM — import morto | `supabaseCrmAuditLog.ts` (`kora.crm.supabaseActions.v1`), importado em `CRM.tsx` | `grep -rn "supabaseCrmAuditLog" src/` — esperado: só a importação, sem `.log(`/`.list(`/`.clear(` chamados | **Decisão do operador antes de remover**: religar de verdade (chamar `.log()` nos 5 handlers do item 1, cumprindo o texto de `CrmSupabaseOperationalToggleCard.tsx`) OU remover o import morto e corrigir o texto da UI que promete essa auditoria. Esta rodada não decide — só documenta a bifurcação |
| 3 | Vendas — 2 flags mortas | `quotesSupabaseExperimental`, `quotesSupabaseApproval` em `BOOLEAN_FLAG_KEYS` (`src/config/flags.ts`) | `grep -rn "quotesSupabaseExperimental\|quotesSupabaseApproval" src/` — esperado: só a definição em `flags.ts` + os testes que já fixam "sem efeito" (`useSupabaseQuotesWriteFlag.test.ts`), zero produtor de comportamento | Remover as 2 entradas de `BOOLEAN_FLAG_KEYS`; remover/atualizar os testes que hoje fixam "sem efeito" (deixam de fazer sentido, não de passar) |
| 4 | Vendas — 2 logs write-only | `kora.quotes.supabaseApprovals.v1`, `kora.quotes.supabaseRejections.v1` — escritos em `LinkedQuotesSection.tsx` e `SupabaseQuotesViewerCard.tsx` (2 lugares cada) | `grep -rn "kora\.quotes\.supabase\(Approvals\|Rejections\)\.v1" src/` — esperado: só as 4 escritas (2 chaves × 2 arquivos) | Remover os pares get/set + chamadas de escrita nos 2 arquivos |
| 5 | Financeiro/Vendas — log órfão (ponte) | `kora.quotes.supabaseReceivables.v1`, escrito só em `CreateReceivableDialog.tsx` (pasta `crm/`, mas grava em Financeiro) | `grep -rn "kora\.quotes\.supabaseReceivables\.v1" src/` — esperado: só a escrita em `CreateReceivableDialog.tsx` | Remover o par get/set + a chamada de escrita. **Mesmo item relatado por 2 ângulos (N7 em Financeiro, B6 em Vendas) — não duplicar a remoção** |

Itens **fora** deste checklist RL1 (não são classe "a", não entram nesta fatia): qualquer store/flag/espelho classificado (b)/(c)/(d) nas tabelas de §1 — esses dependem de homologação, decisão de produto, ou ficam permanentes por desenho.

### G106 fatia 2 — confirmação: "Visão Operacional Supabase (Experimental)" NÃO afeta Tarefas (2026-10-19)

Investigado o card `SupabaseOperationalDashboardToggleCard.tsx` (título exibido: "Visão Operacional Supabase (Experimental)", em Configurações → Dados), que controla a flag `supabaseOperationalDashboard` (`kora.supabase.operationalDashboard.enabled`, em `BOOLEAN_FLAG_KEYS`).

**Conclusão: esta flag não muda a fonte de leitura nem de escrita de Tarefas, e não faz nenhuma lista "voltar pro local".** Ela só gateia a montagem/visibilidade de um painel de consulta separado (`SupabaseOperationalDashboardCard.tsx`, montado condicionalmente em `Configuracoes.tsx:908`). Grep exaustivo (`grep -rn "supabaseOperationalDashboard" src/`) confirma que a flag só é lida em 3 lugares: a própria definição em `flags.ts:44`, o toggle card (liga/desliga + sincroniza estado visual), e o gate de montagem do painel — nenhuma ocorrência em `Tarefas.tsx`, `useBifurcatedTasks.ts`, `useSupabaseTasksWriteFlag.ts` ou `config/flags.ts` (`TASKS_DATA_SOURCE_KEY`). O painel em si busca dados via `useSupabaseProjectTasks`/`useSupabaseProjectsSummary` (hooks nativos-nuvem diretos, confirmado por leitura do arquivo), nunca via `useBifurcatedTasks`/`getTasksDataSource` — é um dashboard de consulta paralelo à tela principal, não uma segunda fonte. O próprio texto do card já é honesto sobre isso: *"As telas principais (Orçamentos, CRM, Projetos, Tarefas, Financeiro) já usam o Supabase por padrão, sem esta chave."*

**G106 fica fechado só com os comentários de texto já aplicados** (`flags.ts`/`useSupabaseTasksWriteFlag.ts`) — esta fatia 2 não precisou de código, por não haver nada a corrigir.

### RL5 — nota de decisão para o operador: G106 (Tarefas sem espelho) e G107 (Financeiro sem decisão registrada)

Esta seção não decide — apresenta as saídas e um custo aproximado de cada uma, para o operador escolher.

**G106 — Tarefas nunca teve espelho G22 (rollback nível 1 "com perda")**

| Saída | O que muda | Custo aproximado | Quando cabe |
|---|---|---|---|
| **(i) Aceitar a perda, formalizar com aviso explícito** | Nenhuma mudança de comportamento. Documentar definitivamente (já feito nos comentários de código desta rodada) que voltar para "local" não recupera tarefas só-nuvem; opcionalmente, UI mínima em Configurações avisando isso SE algum dia um toggle for exposto. | Baixo — já praticamente feito; o que falta é só a decisão formal (fechar G106 "por design", não "corrigido"). | Se o produto aceita que o rollback nível 1 de Tarefas é só para quem nunca usou o modo Supabase (não para reverter uma sessão já migrada) — compatível com o fato de HOJE não haver nenhuma UI de toggle (ninguém troca essa flag no fluxo normal). |
| **(ii) Construir o espelho G22 que falta** | Novo módulo `tasksCloudMirror.ts` (mesmo padrão de `projectsCloudMirror.ts`): toda escrita nativa-nuvem de tarefa passa a gravar também uma cópia local, chaveada por `source_local_id`, reaproveitando os import-maps que já existem (`kora.tasks.supabaseImport.v1`). Precisa cobrir `addTask`/`updateTask`/`moveTask`/`deleteTask` em `Tarefas.tsx`, `ProjectDetailDrawer.tsx`, `DayCenter.tsx`/`useDayCenterActions.ts`, e os 2 pontos de criação nativa em `QuoteToProjectDialog.tsx` (Caso 7.2, hoje cutover — reabriria essa decisão já tomada). | Alto — não é 1 arquivo novo, é retrofit em 5+ call sites já estáveis, mais testes de regressão equivalentes aos que Projetos tem para o próprio espelho (`projectsCloudMirror.test.ts`, suítes "padrão G22" em `ProjectsSection.test.tsx`/`ProjectDetailDrawer.test.tsx`), mais reabrir uma decisão de produto já fechada (Caso 7.2). | Se o produto decidir que Tarefas precisa do mesmo nível de segurança de rollback que Projetos/Financeiro/Fichas têm — ex.: por incidente real, ou por exigência de um cliente que depende do modo local. |

**Recomendação (não é decisão):** (i) é consistente com o estado atual (nenhuma UI de toggle existe, ninguém troca a flag no fluxo normal — o risco só se materializa via override manual de localStorage) e tem custo quase zero porque já foi praticamente executado nesta rodada. (ii) só se justifica se houver um motivo concreto para expor uma UI de rollback de Tarefas no futuro — sem isso, construir o espelho é esforço sem consumidor.

**G107 — Financeiro: espelho sem decisão de produto registrada**

Diferente de G106, aqui o espelho **já existe e está ativo** (`QuoteToReceivableDialog.tsx`/`CreateReceivableDialog.tsx`, sempre-ligado por desenho) — a lacuna é só de documentação, não de código. As 2 saídas são sobre *registrar formalmente* o que já é verdade na prática:

| Saída | O que muda | Custo |
|---|---|---|
| **(i) Registrar como permanente** (análogo ao G41, não ao G85) | Nenhuma mudança de código — só uma entrada no catálogo dizendo que, diferente do espelho de Projetos (G85, condicionado à aposentadoria do modo local), o de Financeiro é dual-write permanente porque a tela principal de recebíveis/pagáveis lê sempre o local (bifurcação aditiva, não exclusiva — achado §1.7 N1). Remover o espelho sem redesenhar a tela quebraria a funcionalidade primária hoje. | Baixo — é só fechar o G107 com essa redação. |
| **(ii) Registrar como condicionado**, igual ao G85 | Equivale a assumir um projeto futuro de redesenhar `TransactionsTab` para ler bifurcado (como Projetos faz) antes de poder remover o espelho — mudança estrutural na tela principal de Financeiro, não um ajuste pontual. | Alto — abre um RL próprio, não é consequência natural do estado atual do código. |

**Recomendação (não é decisão):** (i) — o achado §1.7 N1 já mostra que a bifurcação de Financeiro é estruturalmente diferente da de Projetos (aditiva, não exclusiva); tratar o espelho como "condicionado à aposentadoria" pressupõe uma mudança de arquitetura que ninguém propôs. Registrar como permanente reflete o que o código já faz, sem prometer um trabalho que não está no plano.

## §4 Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G22 (origem do padrão espelho), G85 (única decisão de aposentadoria já registrada, Projetos), G75/G94/G97 (Biblioteca de Materiais do cliente), G92 (leitor bifurcado/produtor local, leads+parcial de quotes), G41 (dual-write de Financeiro), G76/G77/G78/G79 (Tarefas).
- `docs/architecture/kora-roadmap.md` — status de flip por domínio.
- `docs/architecture/espelho-reversivel.md` — padrão geral do espelho e da carência antes de aposentar uma flag experimental.
- `docs/qa/etapa-5-ficha-tecnica.md` §198-204 — carência explícita da Ficha Técnica.
- `docs/qa/etapa-5-g94-ct6-flip.md` (branch `etapa-5-g94-ct6-flip-defaults`, commit `1302276`, NÃO mesclada) — pré-condições do flip do Catálogo.
- `docs/qa/etapa-5-flip-financeiro-runbook.md`, `docs/qa/etapa-5-flip-tarefas-homologacao-fase-d.md`, `docs/qa/etapa-5-flip-projetos-runbook.md` — runbooks operacionais de rollback por domínio.

---

**Status desta Fase A**: investigação concluída, zero código alterado. Commit local apenas deste documento, **sem push/merge** (§18) — parado aguardando "vai" do revisor.

**Adendo (rodada de coordenação, 2026-10-19):** G106 (Tarefas, rollback nível 1 sem espelho) recebeu correção interina de TEXTO — comentários honestos em `src/config/flags.ts` (`TASKS_DATA_SOURCE_KEY`) e `src/hooks/useSupabaseTasksWriteFlag.ts`, sem mudança de comportamento. **Não existe card de toggle de Tarefas em Configurações** (confirmado nesta rodada — nenhum dos cards montados ali, `LocalTasksImportCard` e `QuotesSupabaseBaseTasksToggleCard`, é sobre `dataSource`/`supabaseWrite` de Tarefas), então a parte do pedido sobre "cards" não pôde ser cumprida literalmente — só a parte sobre comentários de código. Checklist executável de RL1 adicionado acima. Commit local, **sem push/merge** (§18) — parado aguardando "vai".
