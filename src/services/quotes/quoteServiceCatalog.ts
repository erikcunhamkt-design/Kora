// G96/G98 — regras puras que ligam o catálogo de serviços ao orçamento.
//
//  - `isServiceSelectableInQuotes` (G96): o wizard de orçamento só oferece serviços ATIVOS e
//    marcados "Disponível em orçamentos" (`availableInQuotes`). O campo é opcional no modelo legado
//    (serviços antigos nunca o tiveram) — ausente conta como disponível (`!== false`), só o `false`
//    explícito esconde. Antes o toggle gravava o valor e nenhum consumidor o lia.
//  - `countServiceUsage` (G98): quantos itens de orçamento apontam pra cada serviço (`serviceId`).
//    Aceita orçamentos de QUALQUER fonte (local ou da nuvem, já com `serviceId` lido de volta pelo
//    mapper) — o consumidor ("Mais usado em orçamentos", `ServicesSection`) só precisa alimentar
//    com a lista bifurcada (`useBifurcatedQuotes`) em vez da local.
import type { Quote } from "@/hooks/useQuotes";
import type { Service } from "@/hooks/useServices";

export function isServiceSelectableInQuotes(service: Pick<Service, "active" | "availableInQuotes">): boolean {
  return service.active && service.availableInQuotes !== false;
}

export function countServiceUsage(quotes: ReadonlyArray<Pick<Quote, "items">>): Map<string, number> {
  const usage = new Map<string, number>();
  for (const quote of quotes) {
    for (const item of quote.items ?? []) {
      if (item.serviceId) usage.set(item.serviceId, (usage.get(item.serviceId) || 0) + 1);
    }
  }
  return usage;
}
