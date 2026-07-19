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
> O Code **nunca** faz essas quatro coisas.
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
| P2 | O Code **não aplica** migration em produção (o operador aplica, após export). |
| P3 | O Code **não lê nem digita** credencial (gate 4). |
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
