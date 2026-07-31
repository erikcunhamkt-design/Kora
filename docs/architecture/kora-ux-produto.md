# Kora Hub — Achados de UX/Produto

> Catálogo irmão de [`kora-hub-auditoria-e-plano.md`](kora-hub-auditoria-e-plano.md) (G/O —
> técnico/arquitetura), mas para achados de **experiência de uso e produto**: padrões de
> interação que funcionam bem e deveriam se espalhar, padrões que causam erro de usuário, e
> contrastes entre telas do mesmo domínio que resolveram o mesmo problema de jeitos diferentes.
> Não é lista de bugs — é lista de decisões de design a revisar numa rodada de UX/Produto
> dedicada. Numeração própria (`UX1`, `UX2`, ...), sem prazo de ação associado.

---

**UX1 — Diálogo com pré-preenchimento por contexto evita a classe de erro que um wizard de campos manuais não evita. [PADRÃO BOM — espalhar]**
Achado durante a homologação do Pacote do Flip de `quotes` (Etapa 5). Detalhamento em
[`etapa-5-flip-quotes.md`](../qa/etapa-5-flip-quotes.md) e
[`etapa-5-fatia-10-quotes-write.md`](../qa/etapa-5-fatia-10-quotes-write.md) (§13, achado 3 do
incidente #2).

- **Contraste observado:** `CreateCrmSupabaseQuoteDialog.tsx` ("Criar orçamento a partir da
  oportunidade", acionado de dentro do detalhe de uma oportunidade no CRM) **pré-preenche**
  cliente/título a partir do contexto da oportunidade já aberta — o operador só completa os
  itens/valores. Em nenhuma rodada de homologação (Fatia 10, Pacote do Flip) esse diálogo
  produziu uma quote com campos trocados.
- **Contraponto:** o `NewQuoteWizard` (fluxo "Novo orçamento" da tela principal de Vendas) pede
  cliente e título como 2 campos de texto livre, lado a lado, sem nenhum contexto prévio pra
  ancorar o preenchimento. Nas rodadas de homologação desta cadeia de fatias, o operador
  inverteu/errou esses 2 campos **repetidamente** (registrado como achado 3 do incidente #2 da
  Fatia 10 — `title='zsczcs'` — e mais vezes durante o smoke do Pacote do Flip) — sempre um erro
  de digitação/organização do formulário, nunca um bug de código.
- **Leitura do achado:** não é que o operador é descuidado — é que um formulário com 2 campos de
  texto livre adjacentes, sem nenhuma âncora de contexto, convida a esse erro especificamente. O
  próprio app já tem a solução (pré-preencher a partir de um contexto conhecido) rodando em
  produção num fluxo irmão do mesmo domínio.
- **Não é uma correção nesta rodada** — é uma pergunta de produto/UX pra uma sessão dedicada:
  vale trazer algum grau de pré-preenchimento/contexto pro `NewQuoteWizard` (ex.: se acionado a
  partir de uma oportunidade/cliente já selecionado em outra tela), ou reorganizar os 2 campos
  pra reduzir a confusão (rótulos mais destacados, ordem que seguir a leitura natural, etc.)?
  Registrado pra decisão de produto, não uma pendência técnica.
