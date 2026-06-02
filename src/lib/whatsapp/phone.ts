// Utilidades de telefone brasileiro para o módulo WhatsApp.
// Foco: normalizar para E.164 sem "+" (ex.: 5511987654321), validar de forma
// conservadora — sem inventar 9º dígito agressivamente.

const VALID_DDDS = new Set<number>([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/** Remove tudo que não é dígito e adiciona 55 se necessário. */
export function normalizeBrazilianPhone(phone: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D+/g, "");
  if (!digits) return "";
  // já com DDI Brasil
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  // sem DDI — assume Brasil
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  // outros formatos: devolve só dígitos
  return digits;
}

export interface PhoneValidation {
  valid: boolean;
  reason?: string;
}

/** Validação conservadora: DDI 55, DDD válido, comprimento 12 ou 13. */
export function validateBrazilianPhone(phone: string): PhoneValidation {
  const n = normalizeBrazilianPhone(phone);
  if (!n) return { valid: false, reason: "Telefone vazio" };
  if (!n.startsWith("55")) return { valid: false, reason: "DDI não é Brasil (+55)" };
  if (n.length !== 12 && n.length !== 13) {
    return { valid: false, reason: `Tamanho inválido (${n.length} dígitos)` };
  }
  const ddd = Number(n.slice(2, 4));
  if (!VALID_DDDS.has(ddd)) return { valid: false, reason: `DDD inválido (${ddd})` };
  // celular deve começar com 9 quando tem 13 dígitos
  if (n.length === 13 && n[4] !== "9") {
    return { valid: false, reason: "Celular sem 9 na posição correta" };
  }
  return { valid: true };
}

export function isLikelyValidBrazilianPhone(phone: string): boolean {
  return validateBrazilianPhone(phone).valid;
}

/** Formata para exibição: +55 (11) 98765-4321 */
export function formatPhoneBR(phone: string): string {
  const n = normalizeBrazilianPhone(phone);
  if (!n) return phone;
  if (n.length === 13) {
    return `+55 (${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`;
  }
  if (n.length === 12) {
    return `+55 (${n.slice(2, 4)}) ${n.slice(4, 8)}-${n.slice(8)}`;
  }
  return phone;
}
