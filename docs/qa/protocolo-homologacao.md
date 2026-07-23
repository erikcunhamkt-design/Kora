# Protocolo de Homologação — Etapa 5 (e migrações de dado real em geral)

> **O que é.** O contrato operacional **permanente** que rege TODA homologação que toca
> dado real de cliente (import `localStorage → Supabase`, aplicação de migration em
> produção, cutover de leitura). Vale para cada fatia da Etapa 5 e para qualquer trabalho
> futuro que escreva no banco de produção.
>
> **Por que existe.** O projeto Supabase está no plano **FREE, sem backup automático**
> (`LAST BACKUP: No backups`). O gate clássico "confirmar backup/PITR" das Etapas 1–4 **não
> se aplica**; é substituído pelos gates abaixo. Além disso, incidentes reais (card errado
> clicado por atropelamento; id local cru numa coluna `uuid`) motivaram gates de conferência
> pré-clique e de verificação explícita de índice.
>
> **Fonte da verdade dos papéis:** o **Code** diagnostica, escreve código/migration/queries e
> **confere**; o **operador** exporta, aplica migration, dispara import e digita credenciais.
> O Code **nunca** faz essas quatro coisas — **exceto** a aplicação de DDL aditiva sob a
> exceção estreita e datada da [seção 8](#8-emenda-2026-07-19--aplicação-de-ddl-pelo-code-sob-runbook-aprovado)
> (credencial só via variável de ambiente; dado e proibições absolutas continuam fora do escopo
> dessa exceção).
>
> Padrão de migração: [`../architecture/espelho-reversivel.md`](../architecture/espelho-reversivel.md).
> Primeira aplicação registrada: [`etapa-5-ficha-tecnica.md`](etapa-5-ficha-tecnica.md) (seção 0).

---

## 0. Declaração de risco do operador (verbatim, permanente)

> "Estou ciente de que meu projeto Supabase está no plano free e não tem backup ativo.
> Estou ciente de que, se dado for perdido durante a Etapa 5, o risco é meu e não tenho
> como restaurar. Autorizo prosseguir mesmo assim."

Decisão consciente, registrada para efeito permanente. A homologação prossegue sob esse
risco declarado — o que torna os gates 1–4 abaixo **inegociáveis** (são a única rede de
segurança que resta).

---

## 1. Gate EXPORT MANUAL — substitui "confirmar backup"

Antes de **qualquer** escrita em produção (import ou migration destrutiva), o operador:

1. Exporta as tabelas afetadas **e seus pais de FK** — via Export (CSV/SQL) do painel
   Supabase ou `pg_dump`. (Ex.: import de `quotes` → exportar `quotes` + `quote_items`;
   migration em `crm_opportunities` → exportar `crm_opportunities`.)
2. Confirma **por escrito**: _"exportei &lt;tabelas&gt;, salvei em &lt;caminho&gt;"_.
3. Guarda os arquivos em **`backups/`** (pasta `gitignore`d — contém PII, **nunca** versionar).

**Sem essa confirmação escrita, o Code NÃO libera a escrita.** Se a tabela estava vazia no
baseline (0 linhas), registrar isso como "nada a perder" — o gate continua cumprido pela
constatação explícita, não pulado.

---

## 2. Gate PRINT PRÉ-CLIQUE — conferência antes de escrever

Antes de **qualquer clique** que escreva no banco, o operador manda um **print do card/tela
exata que vai acionar**, com os contadores visíveis. O Code só autoriza após confirmar:

- (a) é o **card certo** (ex.: "Importar Orçamentos" — **não** "Importar Clientes");
- (b) os **números batem** com o cenário combinado (tiles de contagem: novos / já importados
  / duplicados / bloqueados / órfãos).

**Motivo:** num incidente anterior o **card errado foi clicado por atropelamento**. Este gate
existe para impedir a repetição. O Code confere o print **antes** de dar o "pode clicar".

---

## 3. Gate INDISVALID EXPLÍCITO — nunca assumir que o índice subiu

Todo índice criado com `CREATE ... CONCURRENTLY` pode falhar e deixar um índice **inválido**
sem lançar erro visível. Depois de aplicar, o operador roda e devolve:

```sql
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid = 'public.<nome_do_indice>'::regclass;
-- exigido: indisvalid = true (e indisunique = true, quando for UNIQUE)
```

Se `indisvalid = false` → `DROP INDEX IF EXISTS public.<nome>;`, tratar a causa (ex.: duplicata
pré-existente) **com aprovação**, e recriar. **Só se declara o índice pronto com o `t` na mão.**
Vale também confirmar, para índice de idempotência, um `EXPLAIN` da leitura usando o índice
(com `set enable_seqscan = off;` em tabela pequena, para provar que o índice é utilizável).

---

## 4. Gate CREDENCIAIS — só pelo operador, contas QA descartáveis

Regra dura, sem exceção — vale inclusive para QA:

- O **agente NÃO lê arquivo de credencial** de lugar nenhum (nem `.env`, nem doc, nem print),
  **mesmo que seja de QA**. Se topar com segredo versionado, **para e avisa** — não remove do
  histórico por conta própria.
- O **agente NÃO digita** em campo de senha/login e **não autentica** (regra de ação proibida).
- Na homologação que exige login no preview, o **operador digita as credenciais manualmente**.
  O Code para no ponto de login, manda o **print pré-clique** e aguarda.
- Usar **contas QA descartáveis e novas** por rodada de homologação — nunca a conta real de
  produção, nunca credencial reaproveitada.

---

## 5. Invariantes de papel (o que o Code nunca faz)

| # | Regra |
|---|---|
| P1 | O Code **não dispara** import de dado (o botão é do operador, após gates 1–2). |
| P2 | O Code **não aplica** migration em produção (o operador aplica, após export). **Exceção estreita, datada e registrada:** ver [seção 8](#8-emenda-2026-07-19--aplicação-de-ddl-pelo-code-sob-runbook-aprovado). |
| P3 | O Code **não lê nem digita** credencial (gate 4). Emenda da seção 8 não abre exceção a P3 — o Code referencia a credencial só via variável de ambiente (`$DATABASE_URL`), nunca vê/imprime o valor. |
| P4 | O Code **não apaga/sobrescreve** o `localStorage` da entidade (invariante *a* do molde). |
| P5 | A **flag de escrita/experimental** da entidade fica **OFF/carência** até a homologação fechar. |
| P6 | `git add` por **caminho explícito** — nunca `git add .`. Push/CI são **do operador**. |

---

## 6. Sequência canônica de uma homologação de fatia

1. **Fase A — diagnóstico** (Code, leitura pura): auditar os invariantes + pontos da entidade;
   avaliação de risco; recomendação. **Registros reais** (contagem local + Supabase) medidos
   pelo operador (o Code não acessa browser nem banco). **PARA para aprovação.**
2. **Fase B.1 — código** (Code): ajustes mínimos + testes. `tsc=0`, lint sem regressão, testes
   subindo. **PARA para aprovação de design** (ex.: namespacing de `source_local_id`).
3. **Fase B.2 — migration** (Code escreve; **operador aplica**): arquivos isolados; queries de
   pré-aplicação; gate 1 (export) → aplica ALTER → gate 3 (indisvalid) no índice.
4. **Fase B.3 — homologação** (**operador roda**; Code confere): gate 2 (print pré-clique) →
   import → provas (zero perda · idempotência 2× · reversibilidade · leitura indexada ·
   dependência ausente reportada). Preencher resultados no doc da fatia.
5. **Limpeza** do cenário de teste (operador) + **push/CI** (operador). Flag em **carência**.

---

## 7. Provas mínimas exigidas por homologação (checklist)

- [ ] **Zero perda:** contagem local == remota + amostra campo-a-campo bate.
- [ ] **Idempotência:** rodar o import 2× → mesmas contagens, 0 duplicatas (query `group by`).
- [ ] **Reversibilidade:** flipar `dataSource` → local intacto (devtools), leitura sem perda.
- [ ] **Leitura indexada:** `EXPLAIN` usa Index Scan (não Seq Scan) na chave de idempotência.
- [ ] **Dependência ausente reportada, não perdida:** órfã de FK vira `null` + report, nunca
      id local cru numa coluna `uuid`, nunca registro descartado.
- [ ] **Gate 1 (export)** e **Gate 2 (print pré-clique)** cumpridos e registrados.
- [ ] **Gate 3 (indisvalid = t)** para todo índice `CONCURRENTLY` da fatia.

---

## 8. Emenda 2026-07-19 — Aplicação de DDL pelo Code sob runbook aprovado

> **Decidida pelo operador, registrada pelo revisor.** Exceção **estreita** ao gate P2 (Code
> não aplica migration em produção) — não revoga P2 como regra padrão; abre um caminho
> alternativo, sob controles próprios, quando o operador explicitamente autorizar. Primeira
> aplicação: Etapa 5 · Fatia 3 (`quotes`/`quote_items`), 2026-07-19 — 6 migrations, 6/6 marcos
> verdes, sem incidente.

1. **Aplicação de DDL pelo Code via `psql`, sob runbook aprovado pelo revisor:** um arquivo
   por vez, na ordem definida no runbook; **output bruto** da checagem de cada marco colado na
   resposta; **parada obrigatória** em qualquer resultado divergente do esperado — nunca
   prossegue ao arquivo seguinte com um marco vermelho.
2. **Credencial de sessão:** fornecida pelo **operador**, fora do repositório (variável de
   ambiente persistente, ex. `setx`) — **nunca** persistida em arquivo do projeto, commit, log
   ou output do Code. O Code referencia exclusivamente `$DATABASE_URL` (símbolo), nunca lê nem
   imprime o valor. **Item de checklist do sign-off:** a senha do banco usada na rodada é
   **rotacionada** (reset) ao final dessa rodada — independente de ter havido qualquer
   incidente.
3. **Dado existente exige gate reforçado**, mesmo sob esta emenda: aprovação do revisor **por
   statement** que toque dado (não só schema) + export prévio (gate 1) quando houver linha a
   perder. A emenda cobre **DDL aditiva sobre schema**, não abre caminho para o Code manipular
   dado de produção.
4. **Proibições absolutas, sob qualquer runbook, sem exceção:** `DROP TABLE`, `TRUNCATE`,
   `DELETE` sem `WHERE`, `DROP COLUMN`. Nenhuma autorização do operador nesta emenda cobre
   essas operações — pedido explícito de qualquer uma delas exige um runbook **novo e
   separado**, não uma extensão desta emenda.
5. **Demais gates permanentes (seções 0–7) inalterados** — export manual, print pré-clique,
   indisvalid explícito, contas QA descartáveis, sequência canônica e provas mínimas continuam
   valendo integralmente.

---

## 9. Emenda 2026-07-20 — Autorização de rodada de homologação exige "vai" literal do revisor

> **Motivada por:** Etapa 5 · Fatia 3, Rodada 2 — executada sobre um "vai" digitado pelo
> **operador** em chat casual (resposta a uma pergunta do Code), não sobre um "vai" com
> proveniência explícita do **revisor**. Resultado técnico da rodada foi verde (zero perda,
> conferência batendo), mas a autorização não seguiu o padrão exigido. Registrado como Desvio #3
> em [`etapa-5-fatia-3-quotes.md` §11.5](etapa-5-fatia-3-quotes.md#115-desvio-de-processo--registrado-sem-suavizar).

1. **Toda rodada de homologação (semeada ou real) só executa mediante "vai" literal do revisor,
   colado no chat do Code pelo operador.** Não conta: um "vai" (ou equivalente — "pode", "ok",
   "manda") digitado pelo operador em nome próprio; uma aprovação inferida do tom da conversa;
   uma resposta a pergunta de múltipla escolha do Code (`AskUserQuestion` ou similar) tratada
   como se fosse a autorização da rodada.
2. **O Code nunca aprova rodada própria, sob nenhuma hipótese.** Isso inclui: interpretar
   contexto ambíguo a favor de prosseguir; tratar uma correção de escopo descoberta **durante**
   a execução (ex.: candidatos previstos que na prática não existem, e um novo escopo é montado
   ali mesmo) como coberta pelo "vai" original. **Mudança de escopo em runtime PARA a rodada** e
   aguarda um novo "vai" do revisor, específico para o escopo revisado, antes de continuar.
3. **Todo prompt de runbook que descreve uma rodada de homologação termina com uma linha de
   proibição explícita**, no formato: _"NADA EXECUTA sem o 'vai' literal do revisor, colado
   neste chat pelo operador."_ — não basta a rodada estar "proposta" ou "aguardando aprovação"
   no doc da fatia; a proibição precisa estar no texto que efetivamente aciona a execução.
4. **Demais gates permanentes (seções 0–8) inalterados.**

---

## 10. Emenda 2026-07-20 — Regularização de P5 para `clients` (dívida assumida, sem homologação retroativa)

> **Motivada por:** Etapa 5 · Fatia 4 (`clients`), Fase A + decisão C6 do revisor — descoberta de
> que a nuvem já é fonte oficial de leitura/escrita de `clients` desde antes da Etapa 5, fora do
> molde Espelho Reversível, sem nenhuma rodada de homologação sob este protocolo. Detalhamento
> completo em [`etapa-5-fatia-4-clients.md`](etapa-5-fatia-4-clients.md) §4.

1. **Fato registrado:** a nuvem (Supabase) é fonte oficial de leitura e escrita de `clients`
   desde **2026-06-15** (commit `7ab2367`, `src/hooks/useClientsDataSource.ts:47`) — decisão do
   operador, anterior à Etapa 5.
2. **Não é revertido.** A Fatia 4 não desfaz esse cutover — reverter quebraria uso corrente já em
   produção. Esta emenda regulariza o fato consumado, não o desfaz.
3. **Registrado como dívida assumida, não como violação corrigida.** P5 ("flag de
   escrita/experimental fica OFF/carência até a homologação fechar") não foi cumprido para
   `clients` e não será cumprido retroativamente — não há como homologar algo que já rodou.
4. **Contrapartida entregue pela Fatia 4** em troca de regularizar, não reverter: (a) correção do
   bug ativo de perda de dado silenciosa em `client_contacts` (C8 — ver
   `etapa-5-fatia-4-clients.md` §4.2/§4.4); (b) catalogação explícita, pronta-pra-construir, dos
   invariantes de import (idempotência, RPC atômica de import) para o dia em que voltarem a ser
   relevantes (mesmo doc, §4.1).
5. **Escopo estreito, não um precedente geral.** Esta emenda cobre só `clients`. Um cutover
   Supabase-first descoberto em outra entidade exige o mesmo tratamento explícito nesta seção —
   não herda esta emenda por analogia, mesmo que o padrão de achado se repita.
6. **Demais gates permanentes (seções 0–9) inalterados.**

---

## 11. Emenda 2026-07-23 — Dado real é só-leitura em homologação (nunca alvo de escrita/vínculo)

> **Motivada por:** Etapa 5 · Fatia 7 (`projects`/`tasks`) — quase-desvio no desenho original do
> runbook: o seed de homologação referenciava uma **quote real** pré-existente para calibrar
> `ux_projects_from_quote`. Se a limpeza pós-rodada falhasse, um projeto de teste ficaria ocupando
> o slot único daquela quote real, bloqueando o fluxo de negócio de verdade. Corrigido em emenda
> **pré-execução** do runbook (cliente/quote sintéticos próprios, `HOMOLOG-F7-cliente` /
> `HOMOLOG-F7-quote`) — nenhuma rodada real chegou a usar o desenho original.

1. Toda homologação semeada **cria seus próprios registros sintéticos** (cliente, quote, ou
   equivalente) e nunca cria linha com FK apontando para um registro que o próprio seed não criou.
2. Dado real pode ser **lido** (para calibrar formato/volume esperado), nunca usado como **alvo**
   de escrita ou vínculo — nenhum caso de homologação grava FK para uma linha pré-existente fora
   do seed.
3. Regra vale para toda fatia futura sob este protocolo, não só para a que a descobriu.
4. **Demais gates permanentes (seções 0–10) inalterados.**

---

## 12. Emenda 2026-07-23 — Push da branch de fatia ao fim de cada fase

> **Motivada por:** Etapa 5 · Fatia 7 — a branch inteira residiu só em disco local (worktree
> `Kora-laneA`) da Fase A até a Fase D, sem nenhum push intermediário. O projeto está hospedado em
> plano Free sem backup automático de banco — o mesmo raciocínio de risco (seção 0) se aplica a
> código não versionado remotamente: um disco corrompido apagaria fases inteiras de trabalho sem
> recuperação possível.

1. Toda branch de fatia é **pushada para `origin` ao final de cada fase concluída** (A, B, C, D —
   não só no merge final para `main`).
2. Push é ação do operador (P6 já cobre isso) — esta emenda apenas torna explícita a **cadência
   mínima** exigida, não altera quem executa.
3. **Demais gates permanentes (seções 0–11) inalterados.**

---

## 13. Emenda 2026-07-23 — Credencial em arquivo: destruição do arquivo E rotação, não uma ou outra

> **Motivada por:** Etapa 5 · Fatia 7 — desvio de credencial nº 1: uma connection string com senha
> em texto plano foi colocada num arquivo no Desktop do operador para contornar a
> não-persistência de `$env:` entre chamadas do PowerShell tool. Mitigado (arquivo destruído,
> senha rotacionada), mas o protocolo até então (seção 8, item 2) só exigia rotação — não
> mencionava o arquivo em si.

1. Se uma credencial for gravada em arquivo (mesmo temporário, mesmo fora do repositório) durante
   uma sessão de DDL sob a exceção da seção 8, o fechamento dessa sessão exige **duas**
   confirmações verificadas, não uma: (a) **destruição do arquivo**, incluindo a lixeira/recycle
   bin; (b) **rotação da senha** usada.
2. As duas confirmações são registradas explicitamente no doc da fatia (ou equivalente) — não
   basta a rotação sozinha, mesmo que nenhum incidente tenha ocorrido.
3. A preferência permanece pelo padrão **sem** arquivo (variável de ambiente carregada e usada num
   único bloco de comando) — esta emenda cobre o caso em que um arquivo ainda assim foi usado.
4. **Demais gates permanentes (seções 0–12) inalterados.**

---

## 14. Emenda 2026-07-23 — Entradas de catálogo (G/PT/Q) sincronizam via `main`

> **Motivada por:** Etapa 5 · Fatia 7 — conflito de merge real na seção G9 do plano mestre
> (`docs/architecture/kora-hub-auditoria-e-plano.md`): a LANE A catalogou o achado do gate
> `tsc --noEmit` vazio na branch da própria fatia, roteando o fix para uma "LANE B" futura; em
> paralelo, uma rodada `qualidade-lint` corrigiu o mesmo achado diretamente em `main`, sem ver a
> primeira catalogação — resultado foi duas versões divergentes da mesma entrada G9, resolvidas
> manualmente no merge.

1. Achado catalogado no plano mestre (prefixos `G`/`P`/`Q`/`PT` ou equivalente) **nasce em
   `main`**, ou é sincronizado para `main` o quanto antes — nunca fica retido só numa branch de
   fatia por mais que uma fase.
2. Antes de catalogar um achado novo a partir de uma branch de fatia, conferir se `main` já
   avançou e já contém uma entrada relacionada — evita duplicação e divergência de estado
   (pendente vs. corrigido) na mesma entrada.
3. Se duas lanes catalogarem o mesmo achado em paralelo sem sincronizar, o merge resolve adotando
   a versão que reflete o estado mais avançado (ex.: "corrigido" prevalece sobre "pendente"),
   preservando qualquer fato exclusivo da versão descartada (ex.: proveniência) em 1-2 linhas —
   mesmo critério já usado na resolução do conflito G9 desta fatia.
4. **Demais gates permanentes (seções 0–13) inalterados.**

---

## 15. Emenda 2026-07-23 — Enquadramento de print em sessão de DDL: credencial nunca aparece

> **Motivada por:** Etapa 5 · Fatia 8 (cutover de escrita de `opportunities`) — durante a
> aplicação da migration O1 sob a exceção da seção 8, a senha do banco apareceu em texto puro no
> chat 3 vezes (1 print de terminal + 2 mensagens de texto), sempre por ação do operador ao
> colar a connection string completa em vez de só os valores nos placeholders indicados. O Code
> recusou usar o valor a cada vez e não o reproduziu em nenhuma resposta, mas a exposição em si já
> ocorreu — a emenda existente (seção 13) cobre credencial em **arquivo**, não em **print/texto
> de terminal colado no chat**, que é o vetor real deste incidente.

1. **Prints de terminal enviados ao Code durante uma sessão de DDL (seção 8) são capturados
   ANTES de digitar/colar a credencial**, ou com a linha que contém a credencial **fora do
   enquadramento** do print — nunca depois, nunca com a linha visível.
2. **Se a credencial aparecer em texto puro no chat por qualquer via** (print, mensagem colada,
   comando ecoado) — o Code recusa usá-la, não a reproduz em nenhuma resposta, e o operador
   rotaciona a senha ao final da sessão, independente de a aplicação da migration ter dado certo
   ou não. Mesmo critério já em vigor (seção 8, item 2) para o caso de arquivo (seção 13) — esta
   emenda estende o mesmo princípio ao vetor "print/texto colado", que é distinto de "arquivo".
3. **Registro obrigatório no doc da fatia** quando o incidente ocorrer: quantas vezes, por qual
   vetor, e a confirmação de que o Code nunca usou/reproduziu o valor — mesmo padrão de
   transparência já usado nos registros de incidente de homologação anteriores (Fatia 7 §13.7,
   Fatia 8 §6.8).
4. **Demais gates permanentes (seções 0–14) inalterados.**
4. **Demais gates permanentes (seções 0–13) inalterados.**
