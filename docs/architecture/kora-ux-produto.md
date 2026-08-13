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

---

**UX2 — Simulador de fluxo do bot (`WhatsAppBotConfig`) só é alcançável com uma instância WhatsApp já conectada — inacessível justamente no cenário onde seria mais útil: testar/ajustar o robô ANTES de ligar de vez. [Achado de produto — sem correção nesta rodada]**
Achado durante a reconciliação da Fase C do resgate do dashboard órfão (irmão do
[G16/G20](kora-hub-auditoria-e-plano.md)) — o operador relatou ter visto apenas o empty state
"WhatsApp não conectado" em `/whatsapp`, contradizendo a análise estática inicial (que leu só o
bloco `<Tabs>` da página, sem checar se havia um early-return acima dele no mesmo componente).
Confirmado: o operador estava certo.

- **A causa:** `src/pages/WhatsApp.tsx:485-503` —
  `if (!instance || status !== "connected") { return <WhatsAppEmptyState title="WhatsApp não conectado" .../> }`,
  ANTES do bloco que renderiza `<Tabs>` (linha 508 em diante, mesmo componente). Esse
  early-return substitui a página inteira — inclusive a aba "Robô IA" (`TabsTrigger value="bot"`,
  linha 526, sem nenhum gate próprio) e o simulador de fluxo dentro de `WhatsAppBotConfig.tsx`
  (que chama a edge function `whatsapp-bot-reply` com `isTest: true`) — sempre que o workspace
  não tem uma instância WhatsApp com `status === "connected"`.
- **Por que importa:** o cenário mais natural para usar um simulador de teste é justamente ANTES
  de conectar uma linha real — configurar o fluxo, testar respostas da IA, ajustar prompts, sem
  nenhum risco de responder um cliente de verdade. É exatamente esse cenário que a tela bloqueia:
  sem conexão ativa, a única coisa que aparece é o empty state "Conecte sua conta do WhatsApp",
  com um botão pra `/automacoes?tab=integracoes` — nenhum caminho pra ver ou testar o fluxo do
  bot antes de se comprometer com uma conexão real.
- **Não é bug de código** — o gate existe de propósito (as outras abas, Inbox/Audiências/
  Campanhas/Modelos, também só fazem sentido com uma instância conectada). É uma pergunta de
  produto: caberia deixar só a aba "Robô IA" (configuração + simulador) acessível mesmo sem
  conexão, já que `isTest: true` nunca toca em um número de WhatsApp de verdade?
- **Achado irmão, de classe técnica e não de produto:** ver [G21](kora-hub-auditoria-e-plano.md)
  — `BotRulesPanel.tsx`, uma segunda tela de configuração de robô com simulador próprio (esse
  100% mockado), nunca chegou a ser conectada em lugar nenhum da navegação — pra ela o gate de
  conexão acima nem chega a ser o problema, porque ela nunca renderiza de jeito nenhum.
- **Não é uma correção nesta rodada** — registrado pra decisão de produto numa sessão dedicada.

---

**UX3 — `BotRulesPanel.tsx` (removido no resgate G21) propunha um modelo de configuração do robô por "modos de atendimento" (desligado/sugestão/assistente/fora do horário/por tag) + guardrails visíveis + regras de elegibilidade/transferência em accordion — um paradigma diferente do construtor de fluxo visual que está em produção hoje (`WhatsAppBotConfig.tsx`). [Ideia de produto — sem protótipo funcional, registrada antes da remoção do código morto]**
O componente nunca foi conectado à navegação (ver [G21](kora-hub-auditoria-e-plano.md)) e todo o seu comportamento era mockado (persistência só em `localStorage`, simulador com resposta fixa hardcoded, cards de "Conhecimento do Robô" sem backend, botões de "Preview da Inbox" desabilitados) — não é um MVP pronto pra reaproveitar, é uma ideia de UX registrada pra não se perder com a remoção do arquivo: um modelo de "modos" pré-definidos (com badges "Seguro"/"Recomendado" orientando a escolha) pode ser mais fácil de entender pra quem está configurando o robô do que o construtor de fluxo livre atual, especialmente pra quem só quer algo básico funcionando rápido, sem desenhar um fluxo do zero. Vale considerar como inspiração de UX numa futura revisão do `WhatsAppBotConfig.tsx` — não como código a restaurar (o prefixo de storage `orbyt.*`, de um nome anterior do produto, confirma que a versão daquele arquivo já estava desatualizada mesmo antes de virar órfã).
