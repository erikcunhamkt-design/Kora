// Password rules aligned with Supabase Auth config.
// Supabase is the final authority — these client-side checks are only for UX.
export const PASSWORD_MIN_LENGTH = 8;

export interface PasswordRule {
  id: string;
  label: string;
  test: (pwd: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { id: "len", label: `Mínimo de ${PASSWORD_MIN_LENGTH} caracteres`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { id: "lower", label: "Uma letra minúscula (a-z)", test: (p) => /[a-z]/.test(p) },
  { id: "upper", label: "Uma letra maiúscula (A-Z)", test: (p) => /[A-Z]/.test(p) },
  { id: "digit", label: "Um número (0-9)", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", label: "Um símbolo (!@#$%...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function validatePassword(pwd: string): { valid: boolean; failing: string[] } {
  const failing = PASSWORD_RULES.filter((r) => !r.test(pwd)).map((r) => r.label);
  return { valid: failing.length === 0, failing };
}

/**
 * Traduz mensagens comuns do Supabase Auth para PT-BR amigável.
 * Mantém genérico para erros desconhecidos — não vazar detalhes sensíveis.
 */
export function translateAuthError(message: string | undefined | null): string {
  const m = (message || "").toLowerCase();

  if (!m) return "Ocorreu um erro inesperado. Tente novamente.";

  if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
    return "Email ou senha incorretos.";
  if (m.includes("email not confirmed") || m.includes("not confirmed"))
    return "Email ainda não confirmado. Verifique sua caixa de entrada (e spam) e confirme antes de entrar.";
  if (m.includes("user already registered") || m.includes("already registered") || m.includes("already exists"))
    return "Já existe uma conta com este email. Tente entrar ou recuperar a senha.";
  if (m.includes("pwned") || m.includes("leaked") || m.includes("compromised"))
    return "Esta senha apareceu em vazamentos públicos conhecidos. Escolha uma senha diferente e única.";
  if (m.includes("weak password") || m.includes("password should") || m.includes("password is too") || m.includes("password requirements"))
    return "Senha fraca. Use ao menos 8 caracteres com maiúscula, minúscula, número e símbolo.";
  if (m.includes("same password") || m.includes("new password should be different"))
    return "A nova senha deve ser diferente da anterior.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (m.includes("reauthentication") || m.includes("recent login") || m.includes("session"))
    return "Por segurança, faça login novamente antes de continuar.";
  if (m.includes("invalid email"))
    return "Email inválido.";
  if (m.includes("token") && (m.includes("expired") || m.includes("invalid")))
    return "Link expirado ou inválido. Solicite um novo email.";

  return "Não foi possível concluir a ação. Verifique os dados e tente novamente.";
}
