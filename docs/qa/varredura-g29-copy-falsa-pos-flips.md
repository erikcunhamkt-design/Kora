# Varredura G29-classe — copy de UI que ficou falsa depois dos flips/cutovers

> **Rodada de qualidade (Lane B, 2026-10-04) — só texto de UI, zero mudança de comportamento.**
> Origem: a homologação de Tarefas achou no card "Orçamentos no Supabase" o texto *"A tela principal
> de Vendas/Orçamentos ainda usa localStorage"* — falso desde o flip de quotes. A Fase A de Fichas
> (`docs/architecture/etapa-5-flip-fichas-fase-a.md` §3.C) listou 8 textos da mesma classe.
>
> **Fonte da verdade usada** (lida do código, não de doc): `src/config/flags.ts` — `getCrm/Quotes/Projects/
> Finance/TasksDataSource()` default **"supabase"** (só `"local"` explícito escolhe local); flags de escrita
> `kora.{crm,quotes,projects,finance}.supabaseWrite.enabled` e `kora.tasks.supabaseWrite.v1` **opt-out**
> (ligadas por padrão, só `"false"` desliga); as 8 `BOOLEAN_FLAG_KEYS` (`getBooleanFlag`) **continuam
> opt-in, default DESLIGADO** (`=== "true"`) — logo "Experimental" nos 7 cards que as controlam é
> **verdadeiro** e ficou; o que estava falso era a DESCRIÇÃO deles (bloqueios que já não existem). Fichas:
> defaults ainda opt-in/local (flip F4 não mergeado) — FP0/FP1 mergeados (`cloudOnly`, round-trip).
>
> **Cobertura:** `src/` inteiro, `*.tsx` não-teste — títulos, descrições de cards, banners, toasts, labels de
> botão, placeholders/tooltips. Grep por: "localStorage", "ainda usa/não/é/são", "somente/só leitura", "modo
> leitura", "experimental", "bloqueado/a", "dados locais", "neste dispositivo/navegador", "não sincroniza",
> "protótipo", "em breve", "futuramente", "criará um…", além do mapa de consumidores de cada flag.

## 1. Corrigidos (comprovadamente falsos) — 43 substituições

Linhas = as do tip `0a5d843` (antes da edição).

### 1.1 Rótulos "experimental/leitura" em telas onde Supabase já é o default

| Arquivo:linha | Texto atual | Por que é falso | Texto novo |
|---|---|---|---|
| `ProjectsSection.tsx:357` | botão "Supabase experimental" | `getProjectsDataSource()` default `"supabase"` desde o flip; nuvem não é experimento | "Supabase (nuvem)" |
| `QuotesSection.tsx:421` | botão "Supabase experimental" | idem, quotes | "Supabase (nuvem)" |
| `CRM.tsx:810` | botão "Supabase experimental" | idem, CRM | "Supabase (nuvem)" |
| `Financeiro.tsx:306` | botão "Supabase experimental" | idem, financeiro | "Supabase (nuvem)" |
| `CRM.tsx:200` | toast "Fonte do CRM alterada para Supabase experimental" | idem | "…Supabase (nuvem)" |
| `ProjectsSection.tsx:74` | toast "Fonte dos projetos alterada para Supabase (leitura)" | o modo Supabase de Projetos lê **e grava** (CRUD nativo) | "…Supabase (nuvem)" |
| `QuotesSection.tsx:137` | toast "Fonte dos orçamentos alterada para Supabase (leitura)" | idem, quotes | "…Supabase (nuvem)" |
| `CRM.tsx:2105` | banner "⚠️ Modo Supabase experimental. Os atalhos…" | modo Supabase é o default | "⚠️ Modo Supabase. Os atalhos…" |
| `QuotesSection.tsx:~435` | banner cita "Gerar projeto (G33) e gerar conta a receber (G55)" | IDs internos de catálogo vazando na UI | texto sem os IDs |

Label novo é **único** de propósito (`"Supabase (nuvem)"`): um `"Supabase"` seco colidiria com o badge de
Financeiro nos testes/leitores de tela. Fichas **mantém** "Supabase experimental" (`ClientTechnicalSheet.tsx:529/553/571`) — lá ainda é opt-in, o rótulo é verdadeiro.

### 1.2 Cards de toggle (Configurações → Sincronização Cloud) — descrevem gates que viraram default

Mínimo aplicado (instrução): o texto passa a dizer a verdade; **nenhum card removido**. As 7 flags
`getBooleanFlag` seguem opt-in — "desligado por padrão" é verdadeiro; o falso eram os "continuam bloqueados".

| Arquivo:linha | Texto atual | Por que é falso | Texto novo (resumo) |
|---|---|---|---|
| `QuotesSupabaseProjectToggleCard.tsx:23` | "Permite criar um projeto no Supabase… Tarefas, cronograma, automações e **projetos locais continuam bloqueados**." | o botão que a flag libera (`CreateProjectFromQuoteDialog`) agora cria nativo na nuvem em modo Supabase e **local+espelho** em modo local — projeto local não está bloqueado; o diálogo não cria tarefas (verdade mantida) | "Libera o botão “Gerar projeto” (CRM/Configurações). Modo Supabase (padrão): direto na nuvem; modo local: local+espelho. Não cria tarefas/cronograma/automações. Desligado por padrão — Vendas/Orçamentos gera projeto independente desta chave." |
| `QuotesSupabaseReceivableToggleCard.tsx:23` | "…Pagamentos, Pix, Asaas e **financeiro local continuam bloqueados**." | financeiro local não está bloqueado (`CreateReceivableDialog` grava local+espelho) | "Libera o botão “Gerar recebível”… Pagamentos/Pix/Asaas fora deste botão. Desligado por padrão — Vendas/Orçamentos gera conta a receber independente." |
| `QuotesSupabaseBaseTasksToggleCard.tsx:23` | "…Cronogramas, automações e **tarefas locais continuam bloqueados**." | tarefas locais nunca foram bloqueadas por esta flag; hoje Tarefas grava na nuvem por padrão | "Libera o botão “Gerar tarefas base” no painel Visão Operacional… Desligado por padrão — a tela Tarefas já grava direto no Supabase, sem esta chave." |
| `QuotesSupabaseStatusTransitionToggleCard.tsx:23` | "Permite alterar o status de tarefas no Supabase. Edição avançada, calendário, automações e **tarefas locais continuam bloqueados**." | a tela Tarefas já altera status na nuvem por padrão (B5/Fase C); a flag só gateia a transição **dentro do painel Visão Operacional** | "Libera a transição de status dentro do painel Visão Operacional… a tela Tarefas já altera status na nuvem por padrão, sem depender desta chave." |
| `SupabaseOperationalDashboardToggleCard.tsx:23` | "…dados experimentais… Esta visualização é **somente leitura** e **não substitui os módulos locais**." | (a) o painel tem ações de escrita atrás das chaves acima; (b) os módulos principais JÁ são a nuvem por padrão — "locais" é o inverso da verdade | "Painel de acompanhamento… Por padrão só consulta; ações (gerar tarefas base, transição) só com as chaves próprias. As telas principais já usam o Supabase por padrão." |
| `SupabaseOperationalDashboardCard.tsx:362,401` | mesmo texto "somente leitura… não substitui os módulos locais" | idem | mesmo texto novo |
| `SupabaseOperationalDashboardCard.tsx:384` | badge "Somente Leitura" | o painel contém botões de escrita (opt-in) | badge "Consulta" (o "Experimental" ao lado fica — opt-in, verdadeiro) |
| `SupabaseOperationalDashboardCard.tsx:366` | "Painel desativado experimentalmente. Habilite…" | "experimentalmente" aqui é ruído; é um opt-in desligado | "Painel desligado (opt-in). Habilite “Visão Operacional Supabase”…" |
| `CrmSupabaseCreateQuoteToggleCard.tsx:21` | "…A tela principal de Vendas/Orçamentos **continua usando dados locais**." | **o falso do enunciado da rodada**: quotes flipou, lê/grava na nuvem por padrão | "Libera o botão de criar orçamento a partir de uma oportunidade… A tela Vendas/Orçamentos já lê e grava no Supabase por padrão. Desligado por padrão." |
| `CrmSupabaseOperationalToggleCard.tsx:21,42-44` | toast "…volta a ser somente leitura"; descrição "Quando desligado, o CRM Supabase funciona apenas para consulta" | verdadeiro como efeito, mas omite que a flag é **opt-out (ligada por padrão)** — exigência da rodada | descrição: "Ligado por padrão; ao desligar, o CRM em modo Supabase fica somente para consulta (o modo local segue intacto e editável)"; toast alinhado |

### 1.3 Orçamentos no Supabase (viewer em Configurações) e atalhos do CRM

| Arquivo:linha | Texto atual | Por que é falso | Texto novo |
|---|---|---|---|
| `SupabaseQuotesViewerCard.tsx:172` | "…A tela principal de Vendas/Orçamentos **ainda usa localStorage**." | falso desde o flip de quotes | "…já lê e grava no Supabase por padrão (o modo “Local” segue disponível no seletor da própria tela)." |
| `SupabaseQuotesViewerCard.tsx:168` | "Visualização passiva de **somente leitura**…" | o card tem aprovar/recusar, gerar projeto, gerar recebível | "Consulta… com atalhos de aprovar/recusar, gerar projeto e gerar recebível (os dois últimos dependem das chaves acima)." |
| `SupabaseQuotesViewerCard.tsx:152` | título "Orçamentos no Supabase (Experimental)" | a leitura/escrita de quotes é o default | "Orçamentos no Supabase" |
| `SupabaseQuotesViewerCard.tsx:37,50` · `LinkedQuotesSection.tsx:41,54` | "Geração de recebível/projeto … **entra nesta etapa experimental**. Ative em Configurações." | a etapa já entrou; o toast só aparece com a chave desligada | "Gerar recebível/projeto está desligado. Ative “Orçamentos Supabase - Gerar …” em Configurações → Sincronização Cloud." |
| `SupabaseQuotesViewerCard.tsx:84` · `LinkedQuotesSection.tsx:82` | "Aprovação de orçamentos Supabase entra nesta etapa experimental. **Ative em Configurações.**" | **instrução sem destino**: o card de toggle da aprovação foi retirado (flag legada); só dispara com a escrita de Orçamentos desligada | "A escrita de Orçamentos no Supabase está desligada nesta sessão (kora.quotes.supabaseWrite.enabled=false) — aprovar/recusar fica indisponível aqui." |
| `CRM.tsx:261,276,294,487` | "Arquivamento/Exclusão/Restauração/Criação no CRM Supabase **entra nesta etapa experimental / está bloqueada**. Ative…" | as 4 ações = `supabaseWriteEnabled` (opt-out, ligado por padrão); só disparam com o CRM Operacional DESLIGADO por override | "… está desligada (CRM Supabase Operacional desativado). Reative em Configurações → Sincronização Cloud." |
| `CRM.tsx:1347` | "Criação de orçamento no CRM Supabase entra nesta etapa experimental. Ative…" | flag `crmSupabaseCreateQuote` é opt-in desligada: o toast é verdadeiro no efeito, mas "entra nesta etapa" é falso | "Criar orçamento a partir do CRM Supabase está desligado. Ative “CRM Supabase - Criar Orçamento”…" |
| `CreateCrmSupabaseQuoteDialog.tsx:202` | "Preencha os dados do orçamento **experimental** no Supabase." | orçamento no Supabase é o fluxo padrão | "…do orçamento no Supabase." |
| `CreateProjectFromQuoteDialog.tsx:80` | descrição **gravada no projeto**: "Projeto gerado a partir do orçamento **experimental** aprovado" | texto vira dado persistido; "experimental" é ruído que fica pra sempre | "…a partir do orçamento aprovado" |

### 1.4 Financeiro

| Arquivo:linha | Texto atual | Por que é falso | Texto novo |
|---|---|---|---|
| `Financeiro.tsx:208` | toast "**Escrita em modo Supabase ainda não existe** pra Financeiro — … ou ative a escrita **experimental**." | existe (CRUD nativo, Fase B/C); o bloqueio só dispara com a flag opt-out explicitamente DESLIGADA | "A escrita em nuvem do Financeiro está desligada nesta sessão (kora.finance.supabaseWrite.enabled=false) — volte para “Local”… ou religue a escrita." |
| `Financeiro.tsx:316` | "Transações operacionais (Supabase) — **escrita experimental**" | escrita é o default | "— escrita ativa" |
| `Financeiro.tsx:328` | (ramo flag OFF) "Escrita… **ainda não existe** nesse modo" | idem | "A escrita em nuvem… está desligada nesta sessão — as abas locais continuam…" |

### 1.5 Fichas — só o que é falso **hoje** (FP0 `cloudOnly` + autosave)

Dentro do escopo combinado: **Acessos (FP2 pendente) e `ClientTechnicalSheetDialog.tsx` (removido pela lane A no G84) ficaram de fora.**

| Arquivo:linha | Texto atual | Por que é falso | Texto novo |
|---|---|---|---|
| `ClientTechnicalSheet.tsx:517` | "Tudo é salvo automaticamente **neste dispositivo**." | com `cloudOnly` (G82) ou autosave a edição vai pra nuvem; sem autosave fica só na tela | por estado: nuvem+writeThrough → "gravadas direto no Supabase"; nuvem sem autosave → "ficam na tela até clicar em “Salvar no Supabase”"; local → texto antigo |
| `ClientTechnicalSheet.tsx:625` | "A edição principal desta página **ainda usa dados locais**. A versão Supabase é somente leitura…" | com fonte ativa = nuvem (cloudOnly ou escolha) a edição principal é a versão Supabase | se `activeDataSource==="supabase"`: "Esta página está editando a versão Supabase; o painel abaixo mostra a cópia salva na nuvem (somente leitura)."; senão mantém os 2 textos antigos (verdadeiros em local) |
| `ClientTechnicalSheet.tsx:784` | "A edição principal… **ainda usa dados locais**. O Supabase recebe apenas uma cópia manual…" | idem | em fonte nuvem: "A edição principal desta página está na versão Supabase (fonte ativa)."; em local, texto antigo |
| `ClientTechnicalSheet.tsx:837` | "…A edição principal **continuará local** nesta etapa." (diálogo de salvar cópia) | idem | frase só aparece quando a fonte ativa é local |

## 2. Dúvidosos — dependem de decisão de produto; **listados, não mudados**

| Item | Situação | Proposta |
|---|---|---|
| `ClientTechnicalSheet.tsx:139` toast "Versão Supabase restaurada localmente. A edição principal continua local nesta etapa." | vive em `RestoreFromSupabaseDialog` (componente separado, sem acesso à fonte ativa); para cliente `cloudOnly` a semântica de "restaurar" muda (G84 da lane A trata) | reescrever junto do FP5/G84 |
| `Configuracoes.tsx:1735` (card "Modo Supabase Experimental da Ficha Técnica") e `QuotesSupabaseTechnicalSheetsAutoSaveToggleCard.tsx:22` ("…substituindo o modelo de backup manual") | **verdadeiros hoje** (flags opt-in, default off); viram falsos no flip F4 | FP5 (já planejado "junto do flip") |
| `ClientTechnicalSheetDialog.tsx:104,563,659,990,1055,1406` ("Tudo salvo localmente neste dispositivo", "sem criptografia"…) | arquivo removido pela lane A (G84) | pulado, conforme combinado |
| `Configuracoes.tsx` DataCards "Status de armazenamento — *Dados de protótipo salvos localmente*" / "Limpar dados locais — *Remove dados de protótipo*" | "protótipo" e "salvos localmente" são falsos para os 5 domínios flipados; mas é a seção Dados inteira (3 dos 4 cards são `state="soon"`) | decidir o futuro da seção; proposta mínima: "Dados operacionais na nuvem (Supabase); resíduos locais neste navegador" |
| `SupabaseCrmViewerCard` (`Configuracoes.tsx:1975`) | componente **não renderizado** em nenhum lugar (código morto); textos condicionais já corretos | remover o componente numa rodada de limpeza |
| `CreateReceivableDialog.tsx:180` / `QuoteToReceivableDialog` ("criará um lançamento… visível na tela Financeiro") | verdadeiro hoje (local + espelho); recebível ainda **não** teve cutover | revisar se/quando o cutover de recebíveis acontecer (mesma decisão do Caso 7.2) |
| `Clientes.tsx:910` toast "Criar oportunidade chega em breve no CRM." | não é copy de flip — ação não implementada no menu da linha, embora o CRM crie oportunidades | produto: implementar ou remover o item |
| Títulos dos 7 cards `getBooleanFlag` ainda com "Experimental" | **verdadeiros** (opt-in default off) | quando/ se virarem opt-out ou forem aposentados |

## 3. Verificados — verdadeiros hoje, **não mudados**

`DayCenter.tsx:172/221` (concluir tarefa só bloqueia com escrita de Tarefas OFF; marcar pago segue local-only na Central — financeiro sem cutover ali) · `Financeiro.tsx:~1800` (recorrência/observações sem coluna — gaps reais) · `Clientes.tsx:233` e `Configuracoes.tsx:1279` (Biblioteca do cliente local — G75; "sem workspace ativo a tela Clientes usa dados locais" é condicional e correto) · toasts "Projeto/Recebível salvo localmente, mas o espelho no Supabase falhou" (ramo local+espelho, real) · `ClientTechnicalSheet.tsx:571/529/553`, "Experimental" do Painel (Fichas opt-in) e `:941` "Acessos não sincronizam" (FP2) · "Em breve/futuramente" em Briefings, Conteúdo, Serviços, IA, Plano, Portal (domínios não migrados) · banners de modo leitura/operacional de CRM/Quotes/Financeiro (já bifurcados pela flag de escrita opt-out — corretos) · nenhuma copy sobre recorrência/tipo/lembrete de tarefa afirmava "não sincroniza" (G81 fechado; nada a corrigir).

## 4. Testes

Asserções de texto **atualizadas onde a tela já tinha teste** (label "Supabase (nuvem)" em `ProjectsSection`×2, `QuotesSection`, `Financeiro`; toast de bloqueio do Financeiro; "Painel desligado"; título do viewer) + **1 teste novo** (`SupabaseQuotesViewerCard.test.tsx`, o texto falso do enunciado). Sem teste de copy "por string". Prova fail→fix→pass por patch (G65, sem stash): com a copy antiga, os testes de tela falham (20+ listados), com a nova passam — 45 arquivos/393 testes das telas afetadas.

## 5. Para o revisor

* Zero comportamento alterado; zero card removido; `flags.ts` intocado.
* Lane A: nada em Acessos/FP2; `ClientTechnicalSheetDialog.tsx` não tocado; `ClientTechnicalSheet.tsx` tocado só nos 4 textos do §1.5 (se a lane A estiver editando esse arquivo, o conflito esperado é pequeno e textual).
* Nenhum ID novo: é adendo de G29.
