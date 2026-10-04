# Etapa 5 · Fichas Técnicas · Pacote do Flip — Runbook da Fase D (**RASCUNHO — [completar pós-F4]**)

> **Status: rascunho, não executável ainda.** Escrito antes do código do F4 existir, no molde de
> [`etapa-5-flip-tarefas-runbook.md`](etapa-5-flip-tarefas-runbook.md) e já com as correções que a
> homologação de Tarefas ensinou (nome real de abas/botões, caminho real de cada gatilho). Tudo
> marcado **[completar pós-F4]** depende de uma fatia FP-n que ainda não existe — ver
> [`docs/architecture/etapa-5-flip-fichas-fase-a.md`](../architecture/etapa-5-flip-fichas-fase-a.md)
> §4/§5. Os `SELECT` não foram executados (protocolo §0/§6: Code não acessa o banco).
>
> **Aviso estrutural:** este runbook assume que FP0 (vínculo cliente→uuid) e FP1 (round-trip) estão
> em `main`. Sem eles os Casos 0, 2, 4 e 6 fecham **vermelho por desenho** — e isso é o resultado
> esperado do Caso 0 se rodado hoje (é a prova ao vivo do achado A).

## Lições de Tarefas incorporadas (não re-derivar)

- **O gatilho documentado pode não ser o real.** Em Tarefas o Caso 5 descrevia um fluxo que não
  existe. Aqui, cada gatilho abaixo foi lido no código; mesmo assim, **primeiro passo de cada caso:
  confirmar na tela que o botão/aba existe com esse nome**, e se não, registrar a correção no
  runbook (como fez Tarefas) em vez de improvisar.
- **Nomes reais (lidos no código):**
  - Perfil do cliente (drawer): abas **"Visão geral" · "Histórico de Relacionamento" · "Contatos" ·
    "Comercial" · "Projetos" · "Financeiro" · "Materiais" · "Ficha Técnica"** (`ClientProfileDrawer.tsx:302-309`).
    A aba "Atividades" **não existe** — é "Histórico de Relacionamento".
  - Aba "Ficha Técnica" → botão **"Abrir ficha técnica"** (`SheetTab`, `:1150`); na aba "Materiais" (`MaterialsTab`)
    há também "Gerenciar na Ficha Técnica", `:1080`) → rota `/clientes/:clientId/ficha-tecnica`.
  - Página da ficha: título **"Ficha técnica"**; seletor **"Fonte da Ficha Técnica:"** com botões **"Local"** e
    **"Supabase experimental"** (só com experimental ligado); painel **"Versão Supabase"**; botões
    **"Restaurar do Supabase"** (diálogo "Restaurar versão do Supabase?" → **"Restaurar versão Supabase"**)
    e **"Salvar versão atual no Supabase"** (AlertDialog "Salvar cópia no Supabase?" → **"Salvar no Supabase"**);
    badges **"Sincronizando..."**, **"Salvo no Supabase"**, **"Erro de Sincronia"**; selo **"Ficha vazia/parcial/completa"**.
  - Seções da ficha: **Branding · Persona · Linha Editorial · Tipografia · Redes Sociais · Acessos ·
    Concorrentes · Briefing & Notas · Materiais e Anexos** (`client-technical-sheet-helpers.ts:14-24`).
  - Configurações → **Dados** → grupo **"Sincronização Cloud & CRM (Supabase)"**: cards
    **"Fichas Técnicas Supabase - Autosave Experimental"** e **"Modo Supabase Experimental da Ficha Técnica"**;
    card **"Importar Fichas Técnicas"** (`Configuracoes.tsx:853,873-875,1561`).
  - Snapshot no projeto: dentro do drawer de projeto (`ProjectDetailDrawer`), só aparece se
    `project.clientId` resolve para um cliente (`:488`). **Atenção G79:** nenhum caminho de UI cria
    projeto com `client_id` real fora de "projeto a partir de orçamento" — usar um projeto vindo
    de orçamento com cliente `HOMOLOG-FIC-`, ou registrar o caso como parcial (como o 7.4 de Tarefas).
- **SELECT depois da ação, nunca antes.**
- **Print pré-clique** (protocolo §2) em todo passo que grava na nuvem.
- **Limpeza com `count = 0` e ressalva de `localStorage`** (Tarefas deixou 5 sintéticas no navegador do operador).
- **Drawer/cache — G30:** confirmar que a UI reflete a escrita sem F5 [completar pós-FP4].
- **Servidor primeiro — §17 passo 0:** declarar worktree + branch + URL e confirmar
  `[Kora] BUILD <hash> (<branch>)` no console batendo com o hash do flip. Nunca inferir.

## Abertura (preencher na execução)

- Worktree/branch/hash do flip: **[completar pós-F4]**
- Workspace de QA: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (mesmo das homologações anteriores; reconfirmar)
- Prefixo: **`HOMOLOG-FIC-`** (e `HOMOLOG-FIC-%` em toda query de limpeza)
- Migrations aplicadas pelo operador (se o revisor optar por 6.1/6.2 do doc Fase A): **[completar pós-F4]**

### Entidades sintéticas

| Entidade | Como criar | Papel |
|---|---|---|
| `HOMOLOG-FIC-cliente-A` | Clientes → novo cliente pela UI (nasce **na nuvem**, uuid) | Casos 0–9: o caso normal pós-G58 |
| `HOMOLOG-FIC-cliente-B` | cliente **local** importado pelo assistente de import de Clientes (entra no mapa local→uuid) | Caso 9 (import de ficha) e regressão do vínculo legado |
| `HOMOLOG-FIC-projeto-A` | projeto vindo de orçamento do cliente-A | Caso 7 (Snapshot) |

## Pré-flip — checklist do operador

1. **EXPORT MANUAL** de `client_technical_sheets` (e `clients`) antes de qualquer caso que grave. Confirmação "exportei" é o gate.
2. SELECTs de reconfirmação (esperado conforme doc Fase A §6): total de fichas; fichas com material-fantasma/dataURL; **invariante G63 = 0**:
   ```sql
   SELECT count(*) FROM public.client_technical_sheets
   WHERE raw_payload::text ILIKE '%password%' OR raw_payload ? 'accesses';   -- esperado 0
   ```
3. Estado dos flags no navegador de teste: sessão limpa (sem override) — anotar os 3 valores de `localStorage`.

## Rollback

- **Nível 1** (sem deploy): `localStorage.setItem("kora.technicalSheets.supabaseExperimental.enabled","false")` + F5 (tudo volta a `"local"`);
  por cliente: botão **"Local"** ou `kora.technicalSheets.dataSource.v1` = `{"<id>":"local"}`; só o autosave: `kora.technicalSheets.supabaseAutoSave.enabled="false"`.
- **Nível 2:** `git revert <hash-do-flip>` (só as 3 funções de `flags.ts` + testes). **[completar pós-F4: hash]**
- Critério: qualquer caso vermelho sem correção rápida, ou perda/duplicação relatada em uso real.

---

## Casos

### Caso 0 — Vínculo cliente→uuid (prova do G82, achado A; pré-requisito dos demais)

Cliente `HOMOLOG-FIC-cliente-A` (nuvem). **Hoje (pré-FP0) o resultado esperado é o defeito**: fecha vermelho = prova do achado.

| Passo | Ação | Esperado (pós-FP0) | Prova |
|---|---|---|---|
| 0.1 | Clientes → abrir `HOMOLOG-FIC-cliente-A` → aba **"Ficha Técnica"** → abrir a ficha | Página "Ficha técnica" abre; seletor **"Fonte da Ficha Técnica:"** mostra **"Supabase experimental"** ativo; painel "Versão Supabase" **não** mostra "Este cliente ainda não está vinculado ao Supabase." | Visual (print) |
| 0.2 | — | O id da URL é o uuid do cliente | `SELECT id FROM public.clients WHERE workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name LIKE 'HOMOLOG-FIC-%';` → uuid == segmento da URL |
| 0.3 | Console: `localStorage.getItem("kora.clients.supabaseImport.v1")` | (informativo) o mapa **não** contém o uuid do cliente-A como chave — o vínculo vem da resolução direta, não do mapa legado | Print do console |

**Vermelho (hoje):** "Este cliente ainda não está vinculado ao Supabase." + botão "Supabase experimental" desabilitado com cadeado. **[completar pós-F4]**

### Caso 1 — Leitura no estado padrão pós-flip (sessão limpa)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Sessão limpa (sem override), abrir a ficha do cliente-A | Fonte padrão = nuvem, sem tocar em nenhum seletor; ficha vazia ("Ficha vazia") pois ainda não existe linha | Visual |
| 1.2 | — | Nenhuma linha criada só por abrir | `SELECT count(*) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name LIKE 'HOMOLOG-FIC-%';` → 0 |

### Caso 2 — Escrita nativa por seção (autosave padrão) + G30

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Seção **Branding** → preencher slogan `HOMOLOG-FIC-slogan` → salvar a seção | Badge **"Sincronizando..."** → **"Salvo no Supabase"**; sem reload, a seção mostra o valor | Visual |
| 2.2 | — (SELECT depois da ação) | 1 linha criada, slogan gravado | `SELECT branding->>'slogan' FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → `HOMOLOG-FIC-slogan` |
| 2.3 | F5 | Valor continua (leitura reflete a escrita; G30) | Visual |

### Caso 3 — Idempotência (UNIQUE `client_id`, G56-classe)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Salvar mais 3 seções (Persona, Tipografia, Redes) em sequência rápida | Nenhum erro; badge final "Salvo no Supabase" | Visual |
| 3.2 | — | Continua **1** linha por cliente; as 4 seções presentes | `SELECT count(*), bool_and(persona<>'{}'::jsonb) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → `1 | t` |
| 3.3 | Salvar uma seção, **imediatamente** abrir outra aba do navegador na mesma ficha e salvar outra seção diferente | Ficha final contém as duas (ou o resultado é registrado como last-write-wins, **ressalva** — não há versão/updated_at condicional) | SELECT das duas colunas |

### Caso 4 — Round-trip de Concorrentes (G83, corrigido pela FP1)

Pré-requisito: Caso 0 verde (vínculo resolvido). **Sem coluna dedicada** (draft 6.1 não aplicado): a escrita grava em `raw_payload.competitors` e a leitura devolve de lá. Não deve haver toast de aviso de "campo sem persistência" (esse aviso é só de **Acessos**).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Seção **Concorrentes** → **"Novo concorrente"** → Nome `HOMOLOG-FIC-concorrente-1`, Link `https://example.com/rival`, Observações `HOMOLOG-FIC-obs` → **"Salvar"** (do diálogo; cada salvar do diálogo já grava a ficha — não existe "Salvar seção" nesta seção) | Badge **"Salvando…" → "Salvo no Supabase"**; item na lista; **nenhum** toast de aviso | Visual (print) |
| 4.2 | — (SELECT depois da ação) | Gravado com os 3 campos | `SELECT jsonb_array_length(raw_payload->'competitors') AS n, raw_payload->'competitors'->0->>'name' AS nome, raw_payload->'competitors'->0->>'url' AS url, raw_payload->'competitors'->0->>'notes' AS obs FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → `1 \| HOMOLOG-FIC-concorrente-1 \| https://example.com/rival \| HOMOLOG-FIC-obs` |
| 4.3 | **F5** (recarregar a ficha) | Concorrente **continua listado** com os 3 campos (antes da FP1 sumia aqui com o badge "Salvo") — **prova do G83** | Visual (print) |
| 4.4 | Adicionar `HOMOLOG-FIC-concorrente-2` (só nome) e editar o 1º pelo ícone de lápis (mudar a observação) | 2 itens; edição refletida sem F5 | `SELECT jsonb_array_length(raw_payload->'competitors') FROM … ;` → `2` |
| 4.5 | Remover o 2º (lixeira → "Remover concorrente?" → confirmar) e dar F5 | 1 item; o removido **não volta** | `SELECT jsonb_array_length(raw_payload->'competitors') FROM … ;` → `1` |
| 4.6 | Remover também o 1º; F5 | Lista vazia ("estado vazio"); seção volta a "Vazio" | `SELECT jsonb_array_length(raw_payload->'competitors') FROM … ;` → `0` (array vazio, não ausente) |

**Vermelho:** o concorrente some no F5 (4.3) ⇒ regressão do G83. Se o operador aplicar o draft 6.1 (coluna `competitors`) antes desta homologação: a **leitura** prefere a coluna quando ela tem dados e cai no `raw_payload` quando vazia; a **escrita** continua só em `raw_payload` até o follow-up — então, com a coluna criada e vazia, este caso deve passar **igual**; registrar a presença da coluna na abertura.

### Caso 5 — Acessos: a senha NUNCA vai pra nuvem (G63) + comportamento da seção **[completar pós-FP2]**

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Seção **Acessos** → adicionar plataforma `HOMOLOG-FIC-plat`, login `a@b.c`, senha `HOMOLOG-FIC-SENHA-TESTE` | **Comportamento atual (pós-FP0/FP1; FP2 pendente):** nota fixa no topo da seção — "**Acessos não sincronizam com a nuvem.** Por segurança, logins e senhas nunca são enviados ao Supabase — o que for digitado aqui não será mantido ao recarregar…"; ao salvar o acesso, toast "Acessos não são salvos na nuvem (por segurança) — a alteração não será mantida ao recarregar." **[completar pós-FP2: texto/armazenamento definitivos]** | Visual (print da nota e do toast) |
| 5.2 | **Prova obrigatória, segurança** — SELECT depois | Nem a senha, nem `accesses`, nem login/notas aparecem na linha da nuvem | `SELECT count(*) FROM public.client_technical_sheets WHERE raw_payload::text ILIKE '%HOMOLOG-FIC-SENHA-TESTE%' OR raw_payload::text ILIKE '%password%' OR raw_payload ? 'accesses';` → **0** |
| 5.3 | F5 | **Hoje (FP2 pendente):** o acesso digitado **some** (não há store) e a nota de 5.1 já avisou — **nunca** uma seção vazia com badge "Salvo" **sem** aviso. Após FP2: conforme a decisão tomada **[completar pós-FP2]** | Visual |

**5.2 é vermelho automático se ≠ 0** — rollback nível 1 imediato, tratar como incidente (G63).

### Caso 6 — Materiais e logo (Storage `client-assets`) — G67 + G75 + G83

Regras do bucket (`clientAssetsStorage`, G75): **png/jpeg/webp, ≤ 2 MB** (o logo aceita a mesma validação). Convenção de path (lida em `uploadClientLogo`/`uploadClientMaterial`): `<workspace_id>/<client_uuid>/technical-sheet/logo/<ts>-<rand>.<ext>` e `<workspace_id>/<client_uuid>/technical-sheet/materials/<ts>-<rand>.<ext>`. **Upload ≠ salvar a ficha:** o arquivo sobe pro Storage ao escolher, mas só entra na ficha quando se clica **"Usar na Ficha Técnica local"** (logo) / **"Adicionar à Ficha Técnica local"** (material) — e aí a ficha é gravada (autosave/write-through).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | Seção **Branding** → "Selecionar e Enviar" com `HOMOLOG-FIC-logo.png` (< 2 MB) | Toast "Logo enviado ao Supabase Storage com sucesso!" e caminho mostrado. **Sem** "Vínculo Supabase ou workspace ativo ausente." (G67: era `Number(uuid)=NaN` — corrigido pela FP0) | `SELECT name FROM storage.objects WHERE bucket_id='client-assets' AND name LIKE '%/technical-sheet/logo/%' AND name LIKE '<workspace_id>/<client_uuid>/%';` → 1 (nome real, com o uuid do cliente-A no meio) |
| 6.2 | Clicar **"Usar na Ficha Técnica local"** → **"Salvar seção"** | Logo exibido (URL assinada); badge "Salvo no Supabase" | `SELECT branding->>'logoStoragePath' FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → o path do 6.1; e `SELECT count(*) FROM public.client_technical_sheets WHERE branding::text LIKE '%data:image%';` → **0** |
| 6.3 | **Materiais e Anexos** → adicionar **link** `https://example.com/HOMOLOG-FIC-doc` (tipo qualquer) | Aparece; "Salvo no Supabase" | `SELECT materials FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` contém a URL |
| 6.4 | Preencher **descrição** e **tags** do material do 6.3, salvar, **F5** | Descrição e tags **continuam** (antes da FP1 eram descartadas na leitura) | `SELECT raw_payload->'assets'->0->>'description', raw_payload->'assets'->0->'tags' FROM … ;` não nulos, e visíveis na tela após o F5 |
| 6.5 | Material por **arquivo**: "Selecionar e Enviar" com um PNG < 2 MB → **"Adicionar à Ficha Técnica local"** | Item com `storagePath`; sobrevive ao F5 | `SELECT raw_payload->'assets'->1->>'storagePath' FROM … ;` e o objeto em `storage.objects` (`…/technical-sheet/materials/…`) |
| 6.6 | Arquivo fora da policy (PDF ou > 2 MB) em qualquer dos 2 uploads | Rejeitado **no cliente**, mensagem clara (G75); nada sobe | `SELECT count(*) FROM storage.objects WHERE bucket_id='client-assets' AND name LIKE '%HOMOLOG-FIC%';` inalterado |
| 6.7 | **Binário local não vai pra nuvem (G83):** se houver (resíduo de ficha local antiga) um logo/material `data:`/`blob:`, salvar qualquer seção | Toast "Não foi enviado à nuvem: o logo (arquivo local) …. Use 'Selecionar e Enviar'…"; os demais campos gravam | `SELECT count(*) FROM public.client_technical_sheets WHERE raw_payload::text LIKE '%[Conteúdo binário não enviado nesta etapa]%' OR branding::text LIKE '%data:image%' OR raw_payload::text LIKE '%data:application%';` → **0** (para as linhas `HOMOLOG-FIC-`; linhas legadas gravadas antes da FP1 podem ter o placeholder — a **tela** não deve mostrar item fantasma) |
| 6.8 | **Teto de tamanho (G83):** colar > 1 MB de texto no Briefing e salvar a seção | Toast "A ficha técnica tem X MB e o limite … é 1 MB. Nada foi gravado…"; badge "Erro de Sincronia" | `updated_at` da linha **inalterado** (nada gravado) |
| 6.9 | Reabrir a ficha (F5) | Nenhum material-fantasma com o texto "[Conteúdo binário não enviado nesta etapa]" na lista | Visual |

**Vermelho:** 6.1 com "Vínculo… ausente" ⇒ regressão do G82/G67; 6.2 com `data:image` na coluna ⇒ regressão do G83; 6.8 gravando ⇒ teto quebrado.

### Caso 7 — Consumidores cruzados (G74 + 5º consumidor)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Drawer do cliente-A → aba **"Ficha Técnica"** | Mostra as seções preenchidas dos Casos 2–6 (Branding, Persona…, contagem de Materiais), **não vazio** | Visual |
| 7.2 | Aba **"Materiais"** | Bloco "Materiais da Ficha Técnica" lista o material do 6.2; "Redes & links" lista as redes do 3.1 | Visual |
| 7.3 | Aba **"Histórico de Relacionamento"** | Eventos de material da ficha aparecem (`buildMaterialEvents`) — **correção herdada de Tarefas:** o nome da aba é este, não "Atividades" | Visual |
| 7.4 | Abrir `HOMOLOG-FIC-projeto-A` (projeto vindo de orçamento do cliente-A) → seção de snapshot da ficha | Snapshot mostra a ficha da nuvem. **Se não houver projeto com `client_id` real alcançável por UI (G79), registrar como parcial e não vermelho** | Visual |
| 7.5 | Dashboard/onboarding → passo **"Preencher Ficha Técnica"** | Marca como concluído quando a ficha (nuvem) do cliente tem conteúdo **[completar pós-FP3]** | Visual |

### Caso 8 — Toggles, seletor por cliente e rollback

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | Configurações → **Dados** → grupo "Sincronização Cloud & CRM (Supabase)" → cards de Fichas | Ambos "Status: **Ativo**" por padrão (sessão limpa) | Visual |
| 8.2 | **Desativar** "Fichas Técnicas Supabase - Autosave Experimental" → voltar à ficha → editar Persona | Sem autosave: banner "As edições feitas aqui são temporárias… clique em 'Salvar no Supabase'" **[completar texto: pode mudar em FP5]**; **nada** gravado ainda | `SELECT updated_at …` inalterado |
| 8.3 | Salvar versão atual no Supabase (botão "Salvar versão atual no Supabase" → "Salvar no Supabase") | Grava; badge/toast de sucesso | `SELECT persona->>… ` atualizado |
| 8.4 | **Desativar** "Modo Supabase Experimental da Ficha Técnica" → **recarregar a ficha** (a página congela o flag no mount) | Seletor de fonte some; `activeDataSource="local"`; ficha mostra dado **local** | Visual |
| 8.5 | Reativar os 2 → botão **"Local"** na página para o cliente-A → editar | Grava só local; nada novo na nuvem; (cliente cloud puro: **comportamento definido por FP0**, não no-op silencioso) **[completar]** | SELECT `updated_at` inalterado |
| 8.6 | Limpar overrides (`localStorage`) | Volta ao padrão pós-flip | Visual |

### Caso 9 — Import assistido e proteção contra sobrescrita com dado velho

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 9.1 | `HOMOLOG-FIC-cliente-B` (local importado): preencher ficha **local** (modo "Local") sem salvar na nuvem; Configurações → Dados → **"Importar Fichas Técnicas"** → selecionar → importar | Toast "1 fichas técnicas importadas com sucesso!"; candidato passa a "Já existe no Supabase" | `SELECT count(*) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-B';` → 1 |
| 9.2 | Reabrir o import | Candidato **não** reimportável (status "existe"); sem 2ª linha | mesmo SELECT → 1 |
| 9.3 | Aviso "ficha local ainda não importada" (FP5) para um cliente com ficha local e nuvem vazia **[completar pós-FP5]** | Aviso visível apontando para o import | Visual |
| 9.4 | No cliente-B, com ficha na nuvem mais nova, usar **"Salvar versão atual no Supabase"** com o estado local velho | **Pede confirmação** (AlertDialog) antes de sobrescrever; registrar se há/não aviso de "nuvem mais nova" (**ressalva** se não houver — G56-classe, last-write-wins) | SELECT de `updated_at` antes/depois |

### Caso 10 — Falha de rede e rollback visual

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 10.1 | DevTools → Offline → salvar uma seção | Badge **"Erro de Sincronia"** + toast "Erro no salvamento automático. Modificações estão apenas locais até re-tentativa."; UI reverte ao último estado da nuvem (rollback visual) — **registrar** se o texto "apenas locais" é verdadeiro pós-flip (G29) | Visual |
| 10.2 | Voltar online → salvar de novo | "Salvo no Supabase"; sem duplicata | `count(*)` = 1 |

### Caso 11 — Textos (G29) — conferência de UI **[completar pós-FP5]**

Conferir que **nenhum** destes textos pré-flip permanece: "Tudo é salvo automaticamente neste dispositivo", "A edição principal desta página ainda usa dados locais", "somente leitura nesta etapa", "A edição principal continuará local nesta etapa", "Tudo salvo localmente neste dispositivo", e os textos dos 2 cards ("substituindo o modelo de backup manual"). Lista completa e linhas: doc Fase A §3.C.

### Caso 12 — Limpeza (prefixo `HOMOLOG-FIC-%`, `count = 0`)

Operador executa (Code não executa), na ordem — fichas antes de clientes (FK `ON DELETE CASCADE` da ficha cobre, mas conferir):

```sql
-- 1) prova do que existe
SELECT count(*) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name LIKE 'HOMOLOG-FIC-%';
SELECT count(*) FROM public.projects WHERE title LIKE 'HOMOLOG-FIC-%';
SELECT count(*) FROM storage.objects WHERE bucket_id='client-assets' AND name LIKE '%HOMOLOG-FIC%';
-- 2) DELETE (operador; export manual já feito)
DELETE FROM public.client_technical_sheets WHERE client_id IN (SELECT id FROM public.clients WHERE name LIKE 'HOMOLOG-FIC-%');
-- (projetos/clientes/objetos de storage: pelos caminhos de UI de exclusão, ou DELETE do operador)
-- 3) DEPOIS: todos devem dar 0
```

**Ressalva de `localStorage` (lição de Tarefas):** a ficha local sintética e o store local de `accesses` (FP2) ficam no navegador do operador — remover manualmente
(`orbyt.clients.v1`, `kora.technicalSheets.restoreBackups.v1`, `kora.technicalSheets.dataSource.v1`, `kora.technicalSheets.supabaseImport.v1`, store de acessos **[completar pós-FP2: chave]**).

---

## Placar (preencher na execução)

| Caso | Resultado | Nota |
|---|---|---|
| 0 Vínculo cliente→uuid | — | pré-requisito |
| 1 Leitura padrão | — | |
| 2 Escrita nativa + G30 | — | |
| 3 Idempotência | — | 3.3 pode ser ressalva (last-write-wins) |
| 4 Round-trip concorrentes | — | FP1 em `main` (G83) |
| 5 Acessos / G63 | — | 5.2 vermelho automático se ≠ 0 |
| 6 Materiais e logo | — | FP0 + FP1 em `main` (G82/G83) |
| 7 Consumidores | — | 7.4 pode ser parcial (G79) |
| 8 Toggles / rollback | — | |
| 9 Import / sobrescrita | — | |
| 10 Falha de rede | — | |
| 11 Textos | — | depende de FP5 |
| 12 Limpeza | — | |

**PARADO — rascunho, doc-only. Marcadores `[completar pós-F4]` a resolver quando FP0–FP5 mesclarem. §18: aguardando "vai".**
