// Centralized Supabase/PostgREST error normalization — locale-aware (A4).
//
// Repositories throw normalizeSupabaseError(err) so every downstream catch
// receives an AppError whose `.message` is already a user-safe, localized
// string — no raw "duplicate key value violates unique constraint ..." ever
// reaches the UI. UI catch blocks can also call toastError()/getFriendlyMessage().
//
// This layer runs outside React context (deep in repositories), so it resolves
// the active locale from localStorage via the shared resolver rather than the
// useTranslation hook.
import { toast } from "sonner";
import { resolveLang, type Lang } from "@/lib/i18n/locale";

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

type LocaleMap = Record<Lang, string>;

const GENERIC: LocaleMap = {
  "pt-BR": "Ocorreu um erro inesperado. Tente novamente.",
  "pt-PT": "Ocorreu um erro inesperado. Tente novamente.",
  en: "An unexpected error occurred. Please try again.",
  es: "Ocurrió un error inesperado. Inténtalo de nuevo.",
};

const NETWORK: LocaleMap = {
  "pt-BR": "Falha de conexão. Verifique sua internet e tente novamente.",
  "pt-PT": "Falha de ligação. Verifique a sua internet e tente novamente.",
  en: "Connection failed. Check your internet and try again.",
  es: "Error de conexión. Revisa tu internet e inténtalo de nuevo.",
};

const NO_PERMISSION_OR_SESSION: LocaleMap = {
  "pt-BR": "Você não tem permissão ou sua sessão expirou.",
  "pt-PT": "Não tem permissão ou a sua sessão expirou.",
  en: "You don't have permission, or your session expired.",
  es: "No tienes permiso o tu sesión expiró.",
};

const DEFAULT_TITLE: LocaleMap = {
  "pt-BR": "Algo deu errado",
  "pt-PT": "Algo correu mal",
  en: "Something went wrong",
  es: "Algo salió mal",
};

// Postgres SQLSTATE + PostgREST codes → friendly copy. `null` means "prefer the
// error's own message" (e.g. a RAISE EXCEPTION message from a trigger).
const CODE_MESSAGES: Record<string, LocaleMap | null> = {
  "23505": {
    "pt-BR": "Este registro já existe.",
    "pt-PT": "Este registo já existe.",
    en: "This record already exists.",
    es: "Este registro ya existe.",
  },
  "23503": {
    "pt-BR": "Este item está vinculado a outros registros e não pode ser alterado ou removido.",
    "pt-PT": "Este item está associado a outros registos e não pode ser alterado ou removido.",
    en: "This item is linked to other records and can't be changed or removed.",
    es: "Este elemento está vinculado a otros registros y no puede modificarse ni eliminarse.",
  },
  "23502": {
    "pt-BR": "Preencha todos os campos obrigatórios.",
    "pt-PT": "Preencha todos os campos obrigatórios.",
    en: "Please fill in all required fields.",
    es: "Completa todos los campos obligatorios.",
  },
  "23514": {
    "pt-BR": "Alguns dados não atendem às regras de validação.",
    "pt-PT": "Alguns dados não cumprem as regras de validação.",
    en: "Some data doesn't meet the validation rules.",
    es: "Algunos datos no cumplen las reglas de validación.",
  },
  "22P02": {
    "pt-BR": "Formato de dado inválido.",
    "pt-PT": "Formato de dados inválido.",
    en: "Invalid data format.",
    es: "Formato de datos no válido.",
  },
  "42501": {
    "pt-BR": "Você não tem permissão para realizar esta ação.",
    "pt-PT": "Não tem permissão para realizar esta ação.",
    en: "You don't have permission to perform this action.",
    es: "No tienes permiso para realizar esta acción.",
  },
  P0001: null,
  PGRST116: {
    "pt-BR": "Registro não encontrado.",
    "pt-PT": "Registo não encontrado.",
    en: "Record not found.",
    es: "Registro no encontrado.",
  },
  PGRST204: {
    "pt-BR": "Registro não encontrado.",
    "pt-PT": "Registo não encontrado.",
    en: "Record not found.",
    es: "Registro no encontrado.",
  },
  PGRST301: {
    "pt-BR": "Sua sessão expirou. Faça login novamente.",
    "pt-PT": "A sua sessão expirou. Inicie sessão novamente.",
    en: "Your session expired. Please sign in again.",
    es: "Tu sesión expiró. Inicia sesión de nuevo.",
  },
};

// Supabase Auth returns these as plain English messages.
const AUTH_MESSAGES: Record<string, LocaleMap> = {
  "Invalid login credentials": {
    "pt-BR": "E-mail ou senha incorretos.",
    "pt-PT": "E-mail ou palavra-passe incorretos.",
    en: "Incorrect email or password.",
    es: "Correo o contraseña incorrectos.",
  },
  "Email not confirmed": {
    "pt-BR": "Confirme seu e-mail antes de entrar.",
    "pt-PT": "Confirme o seu e-mail antes de entrar.",
    en: "Confirm your email before signing in.",
    es: "Confirma tu correo antes de iniciar sesión.",
  },
  "User already registered": {
    "pt-BR": "Este e-mail já está cadastrado.",
    "pt-PT": "Este e-mail já está registado.",
    en: "This email is already registered.",
    es: "Este correo ya está registrado.",
  },
  "Password should be at least 6 characters": {
    "pt-BR": "A senha deve ter pelo menos 6 caracteres.",
    "pt-PT": "A palavra-passe deve ter pelo menos 6 caracteres.",
    en: "The password must be at least 6 characters.",
    es: "La contraseña debe tener al menos 6 caracteres.",
  },
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
  const lang = resolveLang();

  // Network / offline (fetch throws a TypeError).
  if (e.name === "TypeError" && /fetch|network/i.test(e.message ?? "")) {
    return new AppError(NETWORK[lang], { code: "network", technicalMessage: tech, original: error });
  }

  if (e.code && e.code in CODE_MESSAGES) {
    const map = CODE_MESSAGES[e.code];
    const msg = map ? map[lang] : e.message || GENERIC[lang];
    return new AppError(msg || e.message || GENERIC[lang], {
      code: e.code,
      technicalMessage: tech,
      original: error,
    });
  }

  if (e.message && e.message in AUTH_MESSAGES) {
    return new AppError(AUTH_MESSAGES[e.message][lang], {
      code: "auth",
      technicalMessage: tech,
      original: error,
    });
  }

  if (e.status === 401 || e.status === 403) {
    return new AppError(NO_PERMISSION_OR_SESSION[lang], {
      code: String(e.status),
      technicalMessage: tech,
      original: error,
    });
  }

  return new AppError(GENERIC[lang], { code: e.code, technicalMessage: tech, original: error });
}

/** Best-effort user-facing string for any thrown value. */
export function getFriendlyMessage(error: unknown): string {
  return normalizeSupabaseError(error).message;
}

/** Show a normalized error as a toast. Returns the AppError for optional rethrow. */
export function toastError(error: unknown, fallbackTitle?: string): AppError {
  const appErr = normalizeSupabaseError(error);
  toast.error(fallbackTitle ?? DEFAULT_TITLE[resolveLang()], { description: appErr.message });
  return appErr;
}

/** Throw a normalized AppError when a Supabase result carries an error, else return data. */
export function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw normalizeSupabaseError(result.error);
  return result.data;
}
