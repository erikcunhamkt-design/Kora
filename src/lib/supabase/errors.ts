// Centralized Supabase/PostgREST error normalization.
//
// Repositories throw normalizeSupabaseError(err) so every downstream catch
// receives an AppError whose `.message` is already a user-safe, localized
// string — no raw "duplicate key value violates unique constraint ..." ever
// reaches the UI. UI catch blocks can also call toastError()/getFriendlyMessage().
//
// Messages are pt-BR (the product's default locale); full per-locale error
// copy is deferred to the i18n pass (A4).
import { toast } from "sonner";

export type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
};

/** Normalized, user-safe application error. `.message` is display-ready. */
export class AppError extends Error {
  readonly code?: string;
  /** Original technical message, for logs/devtools — never shown to users. */
  readonly technicalMessage?: string;
  readonly original?: unknown;

  constructor(
    userMessage: string,
    opts?: { code?: string; technicalMessage?: string; original?: unknown },
  ) {
    super(userMessage);
    this.name = "AppError";
    this.code = opts?.code;
    this.technicalMessage = opts?.technicalMessage;
    this.original = opts?.original;
  }
}

const GENERIC = "Ocorreu um erro inesperado. Tente novamente.";

// Postgres SQLSTATE + PostgREST codes → friendly copy. Empty string means
// "prefer the error's own message" (e.g. RAISE EXCEPTION from a trigger).
const CODE_MESSAGES: Record<string, string> = {
  "23505": "Este registro já existe.",
  "23503": "Este item está vinculado a outros registros e não pode ser alterado ou removido.",
  "23502": "Preencha todos os campos obrigatórios.",
  "23514": "Alguns dados não atendem às regras de validação.",
  "22P02": "Formato de dado inválido.",
  "42501": "Você não tem permissão para realizar esta ação.",
  P0001: "",
  PGRST116: "Registro não encontrado.",
  PGRST204: "Registro não encontrado.",
  PGRST301: "Sua sessão expirou. Faça login novamente.",
};

// Supabase Auth returns these as plain English messages.
const AUTH_MESSAGES: Record<string, string> = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "User already registered": "Este e-mail já está cadastrado.",
  "Password should be at least 6 characters": "A senha deve ter pelo menos 6 caracteres.",
};

function extract(error: unknown): SupabaseErrorLike {
  if (!error || typeof error !== "object") return { message: String(error ?? "") };
  const e = error as Record<string, unknown>;
  return {
    message: typeof e.message === "string" ? e.message : undefined,
    code: typeof e.code === "string" ? e.code : undefined,
    details: typeof e.details === "string" ? e.details : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
    status: typeof e.status === "number" ? e.status : undefined,
    name: typeof e.name === "string" ? e.name : undefined,
  };
}

export function normalizeSupabaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = extract(error);
  const tech = e.message;

  // Network / offline (fetch throws a TypeError).
  if (e.name === "TypeError" && /fetch|network/i.test(e.message ?? "")) {
    return new AppError("Falha de conexão. Verifique sua internet e tente novamente.", {
      code: "network",
      technicalMessage: tech,
      original: error,
    });
  }

  if (e.code && e.code in CODE_MESSAGES) {
    const mapped = CODE_MESSAGES[e.code];
    return new AppError(mapped || e.message || GENERIC, {
      code: e.code,
      technicalMessage: tech,
      original: error,
    });
  }

  if (e.message && e.message in AUTH_MESSAGES) {
    return new AppError(AUTH_MESSAGES[e.message], {
      code: "auth",
      technicalMessage: tech,
      original: error,
    });
  }

  if (e.status === 401 || e.status === 403) {
    return new AppError("Você não tem permissão ou sua sessão expirou.", {
      code: String(e.status),
      technicalMessage: tech,
      original: error,
    });
  }

  return new AppError(GENERIC, { code: e.code, technicalMessage: tech, original: error });
}

/** Best-effort user-facing string for any thrown value. */
export function getFriendlyMessage(error: unknown): string {
  return normalizeSupabaseError(error).message;
}

/** Show a normalized error as a toast. Returns the AppError for optional rethrow. */
export function toastError(error: unknown, fallbackTitle = "Algo deu errado"): AppError {
  const appErr = normalizeSupabaseError(error);
  toast.error(fallbackTitle, { description: appErr.message });
  return appErr;
}

/** Throw a normalized AppError when a Supabase result carries an error, else return data. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw normalizeSupabaseError(result.error);
  return result.data;
}
