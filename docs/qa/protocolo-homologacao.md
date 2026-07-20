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
