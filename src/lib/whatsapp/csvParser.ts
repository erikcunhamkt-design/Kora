// Parser CSV simples sem dependência externa, com suporte a aspas duplas.
// Cabeçalhos esperados (case-insensitive, acentos removidos):
// nome, telefone, empresa, tag, origem, observacao, opt_in

export interface ParsedContactRow {
  name?: string;
  phone: string;
  company?: string;
  tag?: string;
  origin?: string;
  notes?: string;
  hasOptIn?: boolean;
}

const FIELD_ALIASES: Record<string, keyof ParsedContactRow> = {
  nome: "name",
  name: "name",
  telefone: "phone",
  phone: "phone",
  whatsapp: "phone",
  celular: "phone",
  empresa: "company",
  company: "company",
  tag: "tag",
  origem: "origin",
  origin: "origin",
  observacao: "notes",
  observacoes: "notes",
  notes: "notes",
  opt_in: "hasOptIn",
  optin: "hasOptIn",
};

function normHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === "," || ch === ";") {
        out.push(cur);
        cur = "";
      } else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): ParsedContactRow[] {
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) return [];

  const headers = parseLine(rawLines[0]).map(normHeader);
  const rows: ParsedContactRow[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const cells = parseLine(rawLines[i]);
    const row: Partial<ParsedContactRow> = {};
    headers.forEach((h, idx) => {
      const key = FIELD_ALIASES[h];
      if (!key) return;
      const value = cells[idx] ?? "";
      if (key === "hasOptIn") {
        const v = value.toLowerCase();
        row.hasOptIn = ["1", "sim", "true", "yes", "y", "s"].includes(v);
      } else {
        (row as Record<string, string>)[key] = value;
      }
    });
    if (row.phone) rows.push(row as ParsedContactRow);
  }

  return rows;
}

/** Parse a partir de números colados (um por linha ou separados por vírgula). */
export function parsePastedPhones(text: string): ParsedContactRow[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((phone) => ({ phone }));
}

export const CSV_TEMPLATE =
  "nome,telefone,empresa,tag,origem,observacao,opt_in\n" +
  'João Silva,11987654321,Acme,vip,site,"Cliente recorrente",sim\n' +
  "Maria Souza,11912345678,,,,,nao\n";
