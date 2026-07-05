import { formatDate as intlDate } from "@/lib/format";

export const TEMPLATE_VARIABLES = [
  { key: "nome", label: "Nome completo", sample: "Erik Souza" },
  { key: "primeiro_nome", label: "Primeiro nome", sample: "Erik" },
  { key: "empresa", label: "Empresa", sample: "Estúdio Orbyt" },
  { key: "serviço", label: "Serviço", sample: "Branding" },
  { key: "data", label: "Data", sample: intlDate(new Date()) },
  { key: "link", label: "Link", sample: "https://orbyt.studio/proposta" },
] as const;

export type TemplateVariableKey = (typeof TEMPLATE_VARIABLES)[number]["key"];

const VAR_PATTERN = /\{\{\s*([a-zA-ZÀ-ÿ_]+)\s*\}\}/g;

export function extractVariables(body: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = VAR_PATTERN.exec(body))) found.add(m[1]);
  return Array.from(found);
}

export function renderTemplatePreview(
  body: string,
  values: Partial<Record<string, string>> = {},
): string {
  return body.replace(VAR_PATTERN, (_, key: string) => {
    if (values[key] !== undefined) return values[key] as string;
    const seed = TEMPLATE_VARIABLES.find((v) => v.key === key);
    return seed ? seed.sample : `{{${key}}}`;
  });
}

export function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  current: string,
  insert: string,
): { value: string; cursor: number } {
  if (!textarea) return { value: current + insert, cursor: current.length + insert.length };
  const start = textarea.selectionStart ?? current.length;
  const end = textarea.selectionEnd ?? current.length;
  const value = current.slice(0, start) + insert + current.slice(end);
  return { value, cursor: start + insert.length };
}
