// F4 / FP2 (decisão do revisor: "accesses só-local com aviso") — armazenamento
// LOCAL dos acessos da ficha técnica (login/senha de plataformas do cliente)
// pra fonte nuvem.
//
// Invariante permanente (G63): `accesses[].password` NUNCA vai pra nuvem — nem
// em `raw_payload`, nem em coluna, nem em nenhum payload de leitura/escrita
// (`mapLocalToSupabaseSheet` exclui o campo; `mapSupabaseToLocalSheet` nunca o
// reconstrói). Antes desta decisão, na fonte nuvem a seção "Acessos" aparecia
// vazia e o que o usuário digitava sumia ao recarregar. Agora, em fonte nuvem,
// os acessos vivem SÓ neste dispositivo, aqui, chaveados pelo id da ficha na
// rota (uuid do cliente da nuvem, ou o id local).
//
// Mesma disciplina do restante do app: dado local, no navegador do usuário.
// (Não é um cofre: texto puro no localStorage, como já era a ficha local —
// "cofre de senhas" segue como etapa futura.)
import type { ClientAccess } from "@/types/domain";

export const ACCESSES_LOCAL_STORE_KEY = "kora.technicalSheets.accessesLocal.v1";

type Store = Record<string, ClientAccess[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(ACCESSES_LOCAL_STORE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Store;
  } catch {
    // corrompido/indisponível ⇒ como se não houvesse nada
  }
  return {};
}

/** `undefined` = nunca houve entrada pra este cliente (≠ `[]`, o usuário esvaziou a lista). */
export function readLocalAccesses(clientKey: string | number | null | undefined): ClientAccess[] | undefined {
  if (clientKey === null || clientKey === undefined || clientKey === "") return undefined;
  const v = readStore()[String(clientKey)];
  return Array.isArray(v) ? v : undefined;
}

export function writeLocalAccesses(clientKey: string | number, accesses: ClientAccess[]): void {
  try {
    const store = readStore();
    store[String(clientKey)] = accesses;
    localStorage.setItem(ACCESSES_LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // localStorage cheio/indisponível: a edição segue só em memória (não derruba a tela)
  }
}
