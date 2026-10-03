# Etapa 5 · Fichas Técnicas — rodada FP1 (G83: round-trip) + G86 (deep link de Clientes)

Branch `etapa-5-fichas-fp1-g83-g86`, a partir de `83eb061`. Plano: [`etapa-5-flip-fichas-fase-a.md`](../architecture/etapa-5-flip-fichas-fase-a.md) §3.B / §4 (FP1). **Sem DDL** — nenhuma migration foi aplicada nem é necessária.

## G83 — o que escreve passa a ler de volta (varredura da classe G37)

Auditoria campo a campo (escrita → leitura), com teste de ida-e-volta (`technicalSheetMapper.test.ts`):

| Campo | Antes | Agora |
|---|---|---|
| `branding`, `persona`, `editorialLine`, `typography`, `socialLinks`, `briefing` | OK | OK (teste de ida-e-volta idêntica) |
| `assets[]` — campos básicos | OK | OK |
| `assets[].description` e `.tags` | gravados em `raw_payload.assets`, **descartados na leitura** (achado novo desta varredura) | voltam |
| `competitors[]` | gravado em `raw_payload`, **nunca lido** | volta (`id`, `name`, `url`, `notes`); lista esvaziada volta `[]`; entrada sem nome é descartada; sem id ganha id **estável** (`comp-<idx>`, não aleatório — não faz o `isDirty` oscilar); ficha sem o campo continua sem o campo |
| `accesses[]` | nunca gravado, nunca lido (G63) | **inalterado** — FP2 pendente; a seção agora avisa na tela (abaixo) |
| placeholder de binário | gravado em `raw_payload.assets[].url`, voltava como material fantasma | **não é mais gravado**; em linhas legadas a leitura **não materializa** o item (exceto se tiver `storagePath`: arquivo real no bucket) |
| `branding` com `data:`/`blob:` | a **coluna** `branding` recebia o objeto original (base64 inteiro); só a cópia em `raw_payload` era "sanitizada" (por texto) | o campo binário é **descartado** (coluna e cópia), junto com `logoFileName/Size/MimeType` — nunca sobe, nunca vira texto |
| tamanho | sem teto | `raw_payload` > **1 MB** (`SHEET_RAW_PAYLOAD_MAX_BYTES`, mesmo valor do draft 6.2) ⇒ `SheetTooLargeError`, **nada é gravado**, toast honesto. Validado no cliente; **não depende** de o operador aplicar o CHECK |

### `competitors` — coluna dedicada (draft 6.1) vs fallback

Sem DDL: a leitura prefere `competitors` (coluna) **se existir e tiver dados**; senão lê `raw_payload.competitors`. Coluna vazia (default `'[]'`) não encobre um `raw_payload` preenchido; coluna ausente (hoje) é `undefined` ⇒ cai no `raw_payload`. A **escrita** continua só em `raw_payload` (gravar uma coluna inexistente faria o upsert falhar). **Se o operador aplicar o draft 6.1** (`ALTER TABLE … ADD COLUMN competitors jsonb …` + backfill do doc da Fase A §6), a leitura já funciona sem mudança de código; a escrita na coluna fica como follow-up trivial (acrescentar `competitors` ao payload) — não foi feito agora para não quebrar o upsert enquanto a coluna não existe.

### Toasts / avisos (G75 / G29), nenhum silencioso

- **Binário local** (logo/arquivo `data:`/`blob:`) é rejeitado da gravação com toast: "Não foi enviado à nuvem: o logo (arquivo local) e N material(is)… Use 'Selecionar e Enviar' (PNG/JPEG/WEBP até 2 MB)". Os demais campos gravam normalmente. Vale na gravação por seção e no "Salvar versão atual no Supabase".
- **Tamanho:** `SheetTooLargeError` ⇒ `toast.error` com a mensagem (também no import assistido). Nada gravado.
- **Acessos:** (i) nota fixa no topo da seção, em fonte nuvem: "Acessos não sincronizam com a nuvem. Por segurança, logins e senhas nunca são enviados… o que for digitado aqui não será mantido ao recarregar"; (ii) o toast de aviso ao salvar (da FP0) continua. A seção em si **não foi tocada** (a nota é renderizada pela página). O toast de "Concorrentes" da FP0 foi **removido** — agora persiste.

## G86 — deep link `?client=` com id uuid

`Clientes.tsx`: `Number(queryClientId)` + `Number.isFinite` + `c.id === idNum` ⇒ `clients.find((c) => String(c.id) === queryClientId)` (padrão G73). Varredura da classe: o arquivo não tem outro `Number()` sobre id; os produtores (`ProjectDetailDrawer` ×2, `QuotesSection` ×2, `CRM.tsx`, `dayCenter.ts` ×2) só interpolam o id cru. Observação (fora desta correção): `QuotesSection.tsx:178` faz `Number(searchParams.get("opportunityId"))` — outro deep link (oportunidade); não verificado se ids de oportunidade em modo Supabase são uuid.

## Testes

| Arquivo | Novos | Cobertura |
|---|---|---|
| `technicalSheetMapper.test.ts` | +15 (1 existente reescrito) | ida-e-volta por campo (6 blobs, competitors ×5, assets description/tags, accesses exceção G63), placeholder legado/`storagePath`, escrita sem placeholder, `describeUnsyncedBinary`, teto de 1 MB |
| `ClientTechnicalSheet.uuid.test.tsx` | +2 (1 trocado) | teto de 1 MB na página (nada gravado + toast), Concorrentes persiste sem aviso (substitui o teste de aviso da FP0), nota/aviso de Acessos |
| `Clientes.test.tsx` | +3 | `?client=<uuid>` abre o cliente certo (dois uuid reais), uuid inexistente, regressão numérico |

**Teste reescrito de propósito:** "exclui asset binário… e substitui a URL binária no raw_payload" asseverava o placeholder (o comportamento que o G83 elimina); agora assevera a ausência.

Prova fail→fix→pass por patch (sem stash, G65): com as 5 fontes revertidas, **14 testes falham** nos 3 arquivos e 25 passam (regressões); com o patch reaplicado, **39/39**.

## Fora do escopo / pendências

- `accesses` (FP2), Dialog órfão (G84), `WhatsApp*`, `tasksMapper`, dialogs de Projetos: intocados.
- Confirmação ao vivo: Casos 4 (concorrentes) e 6 (materiais/logo) do runbook de Fichas; deep link de Clientes com um cliente da nuvem.
- Escrita de `competitors` na coluna: só após o operador aplicar o draft 6.1.
