# Etapa 5 · Fichas Técnicas · Pacote do Flip — Runbook da Fase D (pronto pra execução)

> **Status:** fechado contra o código da branch do F4 (`etapa-5-fichas-f4-flip`) — todos os antigos
> `[completar pós-F4]` foram resolvidos (comportamento real de FP0/FP1/FP2/FP4/FP5 + flip dos
> defaults). **Só executa depois do "vai" do revisor + merge do F4**, com o operador, em cima do
> hash mesclado. Molde: [`etapa-5-flip-tarefas-runbook.md`](etapa-5-flip-tarefas-runbook.md), com as
> correções que a homologação de Tarefas ensinou (nome real de abas/botões, caminho real de cada
> gatilho). Plano e achados: [`etapa-5-flip-fichas-fase-a.md`](../architecture/etapa-5-flip-fichas-fase-a.md)
> e [`etapa-5-flip-fichas-f4.md`](etapa-5-flip-fichas-f4.md). Os `SELECT` aqui **não foram executados**
> (protocolo §0/§6: Code não acessa o banco; só o operador).
>
> **Caso 0 = confirmação ao vivo do G82** (vínculo cliente→uuid): foi corrigido em código (FP0) e
> segue "confirmação pendente" no catálogo até este caso fechar.

## Lições de Tarefas incorporadas (não re-derivar)

- **O gatilho documentado pode não ser o real.** Cada gatilho abaixo foi lido no código; mesmo assim,
  **primeiro passo de cada caso: confirmar na tela que o botão/aba existe com esse nome** e, se não,
  registrar a correção no runbook (como Tarefas fez) em vez de improvisar.
- **Nomes reais (lidos no código):**
  - Perfil do cliente (drawer): abas **"Visão geral" · "Histórico de Relacionamento" · "Contatos" ·
    "Comercial" · "Projetos" · "Financeiro" · "Materiais" · "Ficha Técnica"**. A aba "Atividades"
    **não existe** — é "Histórico de Relacionamento".
  - Aba "Ficha Técnica" → botão **"Abrir ficha técnica"**; na aba "Materiais" há também
    **"Gerenciar na Ficha Técnica"** → rota `/clientes/:clientId/ficha-tecnica`.
  - Página da ficha: título **"Ficha técnica"**; seletor **"Fonte da Ficha Técnica:"** com botões
    **"Local"** e **"Supabase (nuvem)"**; banner **"Ficha sincronizada com o Supabase"**; painel
    **"Versão Supabase"** (somente leitura); botões **"Restaurar do Supabase"** (só na fonte "Local";
    diálogo "Restaurar versão do Supabase?" → **"Restaurar versão Supabase"**) e **"Salvar versão atual
    no Supabase"** (AlertDialog "Salvar cópia no Supabase?" → **"Salvar no Supabase"**); badges
    **"Sincronizando..."**, **"Salvo no Supabase"**, **"Erro de Sincronia"**; selo **"Ficha vazia/parcial/completa"**.
  - Seções: **Branding · Persona · Linha Editorial · Tipografia · Redes Sociais · Acessos ·
    Concorrentes · Briefing & Notas · Materiais e Anexos**. Seções com formulário gravam por **"Salvar
    seção"**; **Concorrentes**, **Acessos** e **Materiais** gravam ao salvar o item no diálogo.
  - Configurações → **Dados** → grupo **"Sincronização Cloud & CRM (Supabase)"**: cards
    **"Fichas Técnicas Supabase - Autosave"** e **"Ficha Técnica na nuvem (Supabase)"**; card
    **"Importar Fichas Técnicas"**.
  - Snapshot no projeto: dentro do drawer de projeto, só aparece se `project.clientId` resolve para
    um cliente. **Atenção G79:** nenhum caminho de UI cria projeto com `client_id` real fora de
    "projeto a partir de orçamento" — usar um projeto vindo de orçamento do cliente `HOMOLOG-FIC-`,
    ou registrar o caso como parcial (como o 7.4 de Tarefas).
- **SELECT depois da ação, nunca antes.**
- **Print pré-clique** (protocolo §2) em todo passo que grava na nuvem.
- **Limpeza com `count = 0` e ressalva de `localStorage`** (Tarefas deixou 5 sintéticas no navegador do operador).
- **G30:** a UI reflete a escrita sem F5 — a própria resposta do upsert vira o cache (Caso 2.3 e 3.1).
- **Servidor primeiro — §17 passo 0:** declarar worktree + branch + URL e confirmar
  `[Kora] BUILD <hash> (<branch>)` no console batendo com o hash do merge do F4. Nunca inferir.

## O que muda com o flip (referência rápida)

| | Antes (G63) | Depois (F4) |
|---|---|---|
| `kora.technicalSheets.dataSource.v1` (por cliente) | só `"supabase"` explícito escolhia nuvem | só `"local"` explícito escolhe local |
| `kora.technicalSheets.supabaseExperimental.enabled` | só `"true"` liga | só `"false"` desliga |
| `kora.technicalSheets.supabaseAutoSave.enabled` | só `"true"` liga | só `"false"` desliga |
| Nuvem como fonte | opt-in | default — **salvo** nuvem inalcançável (sem workspace ou cliente sem vínculo ⇒ local, sem erro) |
| `accesses` | local (fonte local) / sumia (fonte nuvem) | **só-local sempre**; em fonte nuvem vivem no armazenamento deste dispositivo (`kora.technicalSheets.accessesLocal.v1`), com aviso |

## Abertura (preencher na execução)

- Worktree / branch / **hash do merge do F4** / URL do dev server: ______
- Workspace de QA: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (mesmo das homologações anteriores; reconfirmar)
- Prefixo: **`HOMOLOG-FIC-`** (e `HOMOLOG-FIC-%` em toda query de limpeza)
- **Migrations: nenhuma obrigatória** para o flip (Fase A §6). Os 3 drafts opcionais — coluna
  `competitors` (6.1), teto de `raw_payload` (6.2), gate de papel (6.3) — ficam no pacote §8-b e **não
  bloqueiam** esta homologação. Registrar aqui se algum foi aplicado antes: ______

### Entidades sintéticas

| Entidade | Como criar | Papel |
|---|---|---|
| `HOMOLOG-FIC-cliente-A` | Clientes → novo cliente pela UI (nasce **na nuvem**, uuid) | Casos 0–8, 10: o caso normal pós-G58 |
| `HOMOLOG-FIC-cliente-B` | cliente **local** importado pelo assistente de import de Clientes (entra no mapa local→uuid), com ficha **local** preenchida | Caso 9 (import / cópia local) |
| `HOMOLOG-FIC-cliente-C` | cliente **local** NÃO importado (sem vínculo com a nuvem) | Caso 13 (usuário 100% local) |
| `HOMOLOG-FIC-projeto-A` | projeto vindo de orçamento do cliente-A | Caso 7 (Snapshot) |

## Pré-flip — checklist do operador

1. **EXPORT MANUAL** de `client_technical_sheets` (e `clients`) antes de qualquer caso que grave. Confirmação "exportei" é o gate.
2. SELECTs de reconfirmação (esperado conforme doc Fase A §6): total de fichas; fichas com material-fantasma/dataURL; **invariante G63 = 0**:
   ```sql
   SELECT count(*) FROM public.client_technical_sheets;
   SELECT count(*) FROM public.client_technical_sheets
   WHERE raw_payload::text LIKE '%[Conteúdo binário não enviado nesta etapa]%' OR branding::text LIKE '%data:image%';
   SELECT count(*) FROM public.client_technical_sheets
   WHERE raw_payload::text ILIKE '%password%' OR raw_payload ? 'accesses';   -- esperado 0
   ```
3. Estado dos flags no navegador de teste: **sessão limpa (sem override)** — anotar os 3 valores de `localStorage` (esperado: ausentes).

## Rollback

- **Nível 1** (sem deploy, por navegador — nada é apagado; fichas já gravadas na nuvem só somem da view
  até a fonte voltar):
  ```js
  localStorage.setItem("kora.technicalSheets.supabaseExperimental.enabled", "false"); // tudo volta a "local"
  // e/ou, só o autosave:
  localStorage.setItem("kora.technicalSheets.supabaseAutoSave.enabled", "false");     // grava só pelo botão "Salvar versão atual no Supabase"
  // por cliente:
  localStorage.setItem("kora.technicalSheets.dataSource.v1", JSON.stringify({ "<id-do-cliente>": "local" }));
  ```
  seguido de F5. Alternativa pela UI: botão **"Local"** na página, ou **Desativar** os cards em Configurações.
- **Nível 2:** `git revert <hash-do-commit-de-flip>` — o flip é **um commit isolado** (`flags.ts` + testes
  de defaults + textos); FP0/FP1/FP2/FP4/FP5 permanecem. Preencher o hash na abertura: ______
- **Critério de acionamento:** qualquer caso vermelho sem correção rápida, ou perda/duplicação relatada
  em uso real ⇒ nível 1 imediato; nível 2 só se o nível 1 não resolver.

---

## Casos

### Caso 0 — Confirmação ao vivo do G82 (vínculo cliente→uuid; pré-requisito dos demais)

Cliente `HOMOLOG-FIC-cliente-A` (nuvem).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 0.1 | Clientes → abrir `HOMOLOG-FIC-cliente-A` → aba **"Ficha Técnica"** → **"Abrir ficha técnica"** | Página "Ficha técnica" abre; seletor **"Fonte da Ficha Técnica:"** com **"Supabase (nuvem)"** marcado; painel "Versão Supabase" **não** mostra "Este cliente ainda não está vinculado ao Supabase." | Visual (print) |
| 0.2 | — | O id da URL é o uuid do cliente | `SELECT id FROM public.clients WHERE workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' AND name LIKE 'HOMOLOG-FIC-%';` → uuid == segmento da URL |
| 0.3 | Console: `localStorage.getItem("kora.clients.supabaseImport.v1")` | (informativo) o mapa **não** contém o uuid do cliente-A como chave — o vínculo vem da resolução direta | Print do console |

**Vermelho:** "Este cliente ainda não está vinculado ao Supabase." + botão "Supabase (nuvem)" desabilitado ⇒ regressão do G82. **Se este caso for verde, o G82 pode ser fechado no catálogo.**

### Caso 1 — Leitura no estado padrão pós-flip (sessão limpa)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 1.1 | Sessão limpa (sem override), abrir a ficha do cliente-A | Fonte padrão = nuvem, sem tocar em nenhum seletor; banner "Ficha sincronizada com o Supabase" com "Autosave **ativado**"; ficha vazia ("Ficha vazia") pois ainda não existe linha | Visual |
| 1.2 | — | Nenhuma linha criada só por abrir | `SELECT count(*) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name LIKE 'HOMOLOG-FIC-%';` → 0 |

### Caso 2 — Escrita nativa por seção (autosave padrão) + G30

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 2.1 | Seção **Branding** → preencher slogan `HOMOLOG-FIC-slogan` → **"Salvar seção"** | Badge **"Sincronizando..."** → **"Salvo no Supabase"**; sem reload, a seção mostra o valor | Visual |
| 2.2 | — (SELECT depois da ação) | 1 linha criada, slogan gravado | `SELECT branding->>'slogan' FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → `HOMOLOG-FIC-slogan` |
| 2.3 | **F5** | Valor continua | Visual |
| 2.4 | **G30 / sem refetch:** DevTools → Network, filtro `client_technical_sheets`; salvar outra seção | A tela atualiza sem F5 e **não** aparece um GET de listagem da ficha logo após o upsert (a resposta do próprio upsert vira o cache) | Network (print) |

### Caso 3 — Ordem e idempotência (UNIQUE `client_id`, G56-classe; FP4)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 3.1 | Salvar 3 seções (Persona, Tipografia, Redes) em sequência rápida | Nenhum erro; os upserts saem **um por vez, na ordem** (Network); badge final "Salvo no Supabase" | Visual + Network |
| 3.2 | — | Continua **1** linha por cliente; as seções presentes | `SELECT count(*), bool_and(persona<>'{}'::jsonb) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → `1 \| t` |
| 3.3 | Salvar uma seção e, **imediatamente**, abrir **outra aba do navegador** na mesma ficha e salvar outra seção | Ficha final contém as duas **ou** o resultado é registrado como **ressalva** (last-write-wins entre abas — não há versão/`updated_at` condicional) | SELECT das duas colunas |

### Caso 4 — Round-trip de Concorrentes (G83, FP1)

Pré-requisito: Caso 0 verde. **Sem coluna dedicada** (draft 6.1 não aplicado): a escrita grava em
`raw_payload.competitors` e a leitura devolve de lá. **Nenhum** toast de aviso de "campo sem persistência" (esse aviso não existe mais para concorrentes).

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 4.1 | Seção **Concorrentes** → **"Novo concorrente"** → Nome `HOMOLOG-FIC-concorrente-1`, Link `https://example.com/rival`, Observações `HOMOLOG-FIC-obs` → **"Salvar"** (do diálogo — grava a ficha; não há "Salvar seção" aqui) | Badge "Sincronizando..." → "Salvo no Supabase"; item na lista; nenhum toast de aviso | Visual (print) |
| 4.2 | — (SELECT depois da ação) | Gravado com os 3 campos | `SELECT jsonb_array_length(raw_payload->'competitors') AS n, raw_payload->'competitors'->0->>'name' AS nome, raw_payload->'competitors'->0->>'url' AS url, raw_payload->'competitors'->0->>'notes' AS obs FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → `1 \| HOMOLOG-FIC-concorrente-1 \| https://example.com/rival \| HOMOLOG-FIC-obs` |
| 4.3 | **F5** | Concorrente **continua listado** com os 3 campos — **prova do G83** | Visual (print) |
| 4.4 | Adicionar `HOMOLOG-FIC-concorrente-2` (só nome) e editar o 1º pelo lápis (mudar a observação) | 2 itens; edição refletida sem F5 | `SELECT jsonb_array_length(raw_payload->'competitors') FROM … ;` → `2` |
| 4.5 | Remover o 2º (lixeira → "Remover concorrente?" → confirmar) e F5 | 1 item; o removido **não volta** | mesmo SELECT → `1` |
| 4.6 | Remover também o 1º; F5 | Lista vazia; seção volta a "Vazio" | mesmo SELECT → `0` (array vazio, não ausente) |

**Vermelho:** o concorrente some no F5 (4.3) ⇒ regressão do G83. Se o operador aplicar o draft 6.1 antes: a leitura prefere a coluna quando tem dados e cai no `raw_payload` quando vazia; a escrita continua só em `raw_payload` — com a coluna criada e vazia este caso deve passar igual (registrar a presença da coluna na abertura).

### Caso 5 — Acessos: só-locais, com aviso; a senha NUNCA vai pra nuvem (G63 / FP2)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 5.1 | Seção **Acessos** | Nota fixa no topo: "**Acessos ficam só neste dispositivo.** Por segurança, logins e senhas nunca são enviados ao Supabase — o que for digitado aqui é mantido apenas neste navegador…" | Visual (print da nota) |
| 5.2 | **"Novo acesso"** → plataforma `HOMOLOG-FIC-plat`, login `a@b.c`, senha `HOMOLOG-FIC-SENHA-TESTE` → **"Salvar"** | Toast "Acessos salvos só neste dispositivo — não sincronizam com a nuvem (por segurança)." | Visual |
| 5.3 | **Prova obrigatória de segurança** — SELECT depois | Nem a senha, nem `accesses`, nem login/notas na linha da nuvem | `SELECT count(*) FROM public.client_technical_sheets WHERE raw_payload::text ILIKE '%HOMOLOG-FIC-SENHA-TESTE%' OR raw_payload::text ILIKE '%password%' OR raw_payload ? 'accesses' OR branding::text ILIKE '%HOMOLOG-FIC-plat%';` → **0** |
| 5.4 | **F5** | O acesso **continua** na seção (armazenamento local deste dispositivo) e a aba "Ficha Técnica" do drawer conta "Acessos" | Visual |
| 5.5 | Abrir a mesma ficha em **outro navegador/janela anônima** (mesmo usuário) | A seção Acessos aparece **vazia** (só-local, não sincroniza) com a mesma nota — comportamento esperado, registrar | Visual |
| 5.6 | Console: `JSON.parse(localStorage.getItem("kora.technicalSheets.accessesLocal.v1"))` | Chave = uuid do cliente-A; contém o acesso do 5.2 | Print do console |

**5.3 é vermelho automático se ≠ 0** — rollback nível 1 imediato, tratar como incidente (G63).

### Caso 6 — Materiais e logo (Storage `client-assets`) — G67 + G75 + G83

Regras do bucket (`clientAssetsStorage`, G75): **png/jpeg/webp, ≤ 2 MB**. Convenção de path:
`<workspace_id>/<client_uuid>/technical-sheet/logo/<ts>-<rand>.<ext>` e `…/technical-sheet/materials/…`.
**Upload ≠ salvar a ficha:** o arquivo sobe ao escolher, mas só entra na ficha ao clicar **"Usar na
Ficha Técnica local"** (logo) / **"Adicionar à Ficha Técnica local"** (material) — e aí a ficha é gravada.

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 6.1 | Seção **Branding** → "Selecionar e Enviar" com `HOMOLOG-FIC-logo.png` (< 2 MB) | Toast "Logo enviado ao Supabase Storage com sucesso!" e caminho mostrado; **sem** "Vínculo Supabase ou workspace ativo ausente." (G67) | `SELECT name FROM storage.objects WHERE bucket_id='client-assets' AND name LIKE '<workspace_id>/<client_uuid>/technical-sheet/logo/%';` → 1 |
| 6.2 | **"Usar na Ficha Técnica local"** → **"Salvar seção"** | Logo exibido (URL assinada); badge "Salvo no Supabase" | `SELECT branding->>'logoStoragePath' FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-A';` → o path do 6.1; e `SELECT count(*) FROM public.client_technical_sheets WHERE branding::text LIKE '%data:image%';` → **0** |
| 6.3 | **Materiais e Anexos** → adicionar **link** `https://example.com/HOMOLOG-FIC-doc` | Aparece; "Salvo no Supabase" | `SELECT materials FROM … WHERE c.name='HOMOLOG-FIC-cliente-A';` contém a URL |
| 6.4 | Preencher **descrição** e **tags** do material do 6.3, salvar, **F5** | Descrição e tags **continuam** (antes da FP1 eram descartadas na leitura) | `SELECT raw_payload->'assets'->0->>'description', raw_payload->'assets'->0->'tags' FROM … ;` não nulos, e visíveis após o F5 |
| 6.5 | Material por **arquivo**: "Selecionar e Enviar" com PNG < 2 MB → **"Adicionar à Ficha Técnica local"** | Item com `storagePath`; sobrevive ao F5 | `SELECT raw_payload->'assets'->1->>'storagePath' FROM … ;` e o objeto em `storage.objects` (`…/technical-sheet/materials/…`) |
| 6.6 | Arquivo fora da policy (PDF ou > 2 MB) em qualquer dos 2 uploads | Rejeitado **no cliente**, mensagem clara (G75); nada sobe | `SELECT count(*) FROM storage.objects WHERE bucket_id='client-assets' AND name LIKE '%HOMOLOG-FIC%';` inalterado |
| 6.7 | **Binário local não vai pra nuvem (G83):** havendo resíduo de ficha local antiga com logo/material `data:`/`blob:`, salvar qualquer seção | Toast "Não foi enviado à nuvem: o logo (arquivo local)… Use 'Selecionar e Enviar'…"; demais campos gravam | `SELECT count(*) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name LIKE 'HOMOLOG-FIC-%' AND (raw_payload::text LIKE '%[Conteúdo binário não enviado nesta etapa]%' OR branding::text LIKE '%data:image%');` → **0** (linhas legadas anteriores à FP1 podem ter o placeholder — a **tela** não deve mostrar item fantasma) |
| 6.8 | **Teto de tamanho (G83):** colar > 1 MB de texto no Briefing e salvar a seção | Toast "A ficha técnica tem X MB e o limite … é 1 MB. Nada foi gravado…"; badge "Erro de Sincronia" | `updated_at` da linha **inalterado** |
| 6.9 | F5 | Nenhum material-fantasma "[Conteúdo binário não enviado nesta etapa]" na lista | Visual |

**Vermelho:** 6.1 com "Vínculo… ausente" ⇒ regressão G82/G67; 6.2 com `data:image` na coluna ⇒ regressão G83; 6.8 gravando ⇒ teto quebrado.

### Caso 7 — Consumidores cruzados (G74 + KoraOnboarding)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 7.1 | Drawer do cliente-A → aba **"Ficha Técnica"** | Mostra as seções preenchidas dos Casos 2–6 (inclui **Acessos** do 5.2, que vem do armazenamento local), **não vazio** | Visual |
| 7.2 | Aba **"Materiais"** | Bloco "Materiais da Ficha Técnica" lista os materiais do 6; "Redes & links" lista as redes do 3.1 | Visual |
| 7.3 | Aba **"Histórico de Relacionamento"** | Eventos de material da ficha aparecem | Visual |
| 7.4 | Abrir `HOMOLOG-FIC-projeto-A` → seção de snapshot da ficha | Snapshot mostra a ficha da nuvem. **Se não houver projeto com `client_id` real alcançável por UI (G79), registrar como parcial, não vermelho** | Visual |
| 7.5 | Início → checklist de ativação → passo **"Preencher Ficha Técnica"** | Marcado como concluído (a ficha da nuvem do cliente tem conteúdo) | Visual |

### Caso 8 — Toggles, seletor por cliente e rollback nível 1

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 8.1 | Configurações → **Dados** → grupo "Sincronização Cloud & CRM (Supabase)" | **"Fichas Técnicas Supabase - Autosave"** e **"Ficha Técnica na nuvem (Supabase)"** ambos "Status: **Ativo**" por padrão (sessão limpa) | Visual |
| 8.2 | **Desativar** "Fichas Técnicas Supabase - Autosave" → voltar à ficha → editar Persona → "Salvar seção" | Banner "…O autosave está desligado neste navegador: as edições feitas aqui são temporárias… clique em **"Salvar no Supabase"**"; **nada** gravado ainda; sem badge "Salvo" | `SELECT updated_at …` inalterado |
| 8.3 | **"Salvar versão atual no Supabase"** → "Salvar no Supabase" | Grava; toast de sucesso; **sem** `accesses`/senha no payload | `SELECT persona->>… ` atualizado + SELECT do 5.3 → 0 |
| 8.4 | **Desativar** "Ficha Técnica na nuvem (Supabase)" → **recarregar a ficha** (a página lê o flag no mount) | Seletor de fonte some; fonte "Local"; texto "A sincronização com o Supabase está desligada neste navegador (override de rollback)…" | Visual |
| 8.5 | Reativar os 2 → botão **"Local"** para o cliente-A (cliente **só-nuvem**) | Toast "Este cliente só existe na nuvem — não há cópia local da ficha." e a fonte **não** muda (não existe cópia local) | Visual |
| 8.6 | Limpar overrides (`localStorage`) | Volta ao padrão pós-flip | Visual |

### Caso 9 — Cópia local legada, import assistido e sobrescrita (cliente-B)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 9.1 | Cliente-B (local importado, ficha **local** preenchida, sem linha na nuvem): abrir a ficha com os defaults | Fonte nuvem (vazia) **e** aviso: "Existe uma ficha salva só neste dispositivo que ainda não foi enviada à nuvem…" apontando **Importar Fichas Técnicas** ou a fonte **"Local"** | Visual (print) |
| 9.2 | Botão **"Local"** (rollback por cliente) | Mostra a cópia local; editar grava só local (nada na nuvem) | `SELECT count(*) FROM … WHERE c.name='HOMOLOG-FIC-cliente-B';` → 0 |
| 9.3 | Configurações → Dados → **"Importar Fichas Técnicas"** → selecionar o cliente-B → importar | Toast "1 fichas técnicas importadas com sucesso!"; candidato vira "Já existe no Supabase" | mesmo SELECT → 1 |
| 9.4 | Reabrir o import | Candidato **não** reimportável (status "existe"); sem 2ª linha | mesmo SELECT → 1 |
| 9.5 | Voltar a fonte para **"Supabase (nuvem)"** | Mostra a ficha importada; o aviso do 9.1 some | Visual |
| 9.6 | Com ficha na nuvem mais nova, na fonte **"Local"** usar **"Salvar versão atual no Supabase"** com o estado local velho | **Pede confirmação** (AlertDialog) antes de sobrescrever; registrar se há aviso de "nuvem mais nova" (**ressalva** se não houver — last-write-wins) | `updated_at` antes/depois |

### Caso 10 — Falha de rede e rollback visual

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 10.1 | DevTools → Offline → salvar uma seção (fonte nuvem) | Badge **"Erro de Sincronia"** + toast "Erro no salvamento automático. Modificações estão apenas nesta tela até re-tentativa."; a UI volta ao último estado da nuvem (rollback visual) | Visual |
| 10.2 | Voltar online → salvar de novo | "Salvo no Supabase"; sem duplicata | `count(*)` = 1 |

### Caso 11 — Textos (G29) — conferência de UI

Conferir que **nenhum** destes textos pré-flip permanece na ficha/Configurações: "Modo Supabase
experimental ativo", "Use com cuidado; o modo local continua disponível", botão/badge "Supabase
experimental", badge "Experimental" no painel "Versão Supabase", "A edição principal desta página ainda
usa dados locais… somente leitura nesta etapa", "A edição principal continuará local nesta etapa",
"Fichas Técnicas Supabase - Autosave Experimental", "Modo Supabase Experimental da Ficha Técnica",
"Permite testar a leitura e salvamento manual…". Lista com linhas: doc Fase A §3.C e
[`etapa-5-flip-fichas-f4.md`](etapa-5-flip-fichas-f4.md) §Textos.

### Caso 12 — Limpeza (prefixo `HOMOLOG-FIC-%`, `count = 0`)

Operador executa (Code não executa), fichas antes de clientes:

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

**Ressalva de `localStorage` (lição de Tarefas):** fichas locais sintéticas, backups e o armazenamento
de acessos ficam no navegador do operador — remover manualmente: `orbyt.clients.v1` (clientes B/C),
`kora.technicalSheets.restoreBackups.v1`, `kora.technicalSheets.dataSource.v1`,
`kora.technicalSheets.accessesLocal.v1` (**contém a senha de teste do 5.2**),
`kora.technicalSheets.supabaseImport.v1`.

### Caso 13 — Usuário 100% local não regride (cliente-C, sem vínculo com a nuvem)

| Passo | Ação | Esperado | Prova |
|---|---|---|---|
| 13.1 | Abrir a ficha do `HOMOLOG-FIC-cliente-C` (local, nunca importado) | Fonte efetiva **Local** (o botão "Supabase (nuvem)" fica desabilitado com cadeado; o painel "Versão Supabase" diz que o cliente não está vinculado) | Visual |
| 13.2 | Preencher e **"Salvar seção"** (Briefing) | Grava na cópia local, **sem** toast de erro "Vínculo… ausente"; F5 mantém | Visual |
| 13.3 | — | Nada na nuvem | `SELECT count(*) FROM public.client_technical_sheets t JOIN public.clients c ON c.id=t.client_id WHERE c.name='HOMOLOG-FIC-cliente-C';` → 0 (e o cliente-C nem existe em `clients` da nuvem) |

---

## Placar (preencher na execução)

| Caso | Resultado | Nota |
|---|---|---|
| 0 Confirmação do G82 | — | pré-requisito; verde fecha o G82 |
| 1 Leitura padrão | — | |
| 2 Escrita nativa + G30 | — | 2.4 prova de ausência de refetch |
| 3 Ordem / idempotência | — | 3.3 pode ser ressalva (last-write-wins entre abas) |
| 4 Round-trip concorrentes | — | G83 |
| 5 Acessos / G63 / FP2 | — | 5.3 vermelho automático se ≠ 0 |
| 6 Materiais e logo | — | G82/G83 |
| 7 Consumidores | — | 7.4 pode ser parcial (G79) |
| 8 Toggles / rollback | — | |
| 9 Cópia local / import | — | 9.6 pode ser ressalva |
| 10 Falha de rede | — | |
| 11 Textos | — | |
| 12 Limpeza | — | `count = 0` + ressalva de `localStorage` |
| 13 Usuário 100% local | — | |

**§18: o F4 só mescla com "vai" explícito do revisor; este runbook só roda depois disso.**
