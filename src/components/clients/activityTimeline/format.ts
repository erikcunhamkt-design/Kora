import { formatDate as intlDate } from "@/lib/format";

export const fmtDate = (iso: string) => {
  try {
    return intlDate(iso, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
};

export const parseDate = (s?: string): string | null => {
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  return null;
};
