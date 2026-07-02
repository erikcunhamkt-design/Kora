// Workspace localization controls (Batch 4c): currency + time zone, persisted to
// the workspace row. A live preview shows how money/dates will render so the
// choice is unambiguous. Language stays in the existing language card; saving
// here also stamps the current language into workspace.locale.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/contexts/LanguageContext";
import { useWorkspaceSettings } from "@/hooks/useWorkspaceSettings";
import { formatCurrency, formatDate } from "@/lib/format";

const CURRENCIES: { code: string; label: string }[] = [
  { code: "BRL", label: "Real brasileiro (R$)" },
  { code: "USD", label: "US Dollar ($)" },
  { code: "EUR", label: "Euro (€)" },
  { code: "GBP", label: "British Pound (£)" },
  { code: "MXN", label: "Peso mexicano (MX$)" },
  { code: "ARS", label: "Peso argentino (AR$)" },
  { code: "CLP", label: "Peso chileno (CLP$)" },
  { code: "COP", label: "Peso colombiano (COL$)" },
  { code: "CAD", label: "Canadian Dollar (C$)" },
  { code: "AUD", label: "Australian Dollar (A$)" },
  { code: "JPY", label: "Japanese Yen (¥)" },
];

const BROWSER_LOCAL = "__local__";
const TIMEZONES: { value: string; label: string }[] = [
  { value: BROWSER_LOCAL, label: "Local do navegador" },
  { value: "America/Sao_Paulo", label: "América / São Paulo (BRT)" },
  { value: "America/New_York", label: "America / New York (ET)" },
  { value: "America/Los_Angeles", label: "America / Los Angeles (PT)" },
  { value: "America/Mexico_City", label: "América / Ciudad de México" },
  { value: "America/Buenos_Aires", label: "América / Buenos Aires" },
  { value: "Europe/London", label: "Europe / London (GMT)" },
  { value: "Europe/Lisbon", label: "Europa / Lisboa (WET)" },
  { value: "Europe/Madrid", label: "Europa / Madrid (CET)" },
  { value: "Europe/Paris", label: "Europe / Paris (CET)" },
  { value: "UTC", label: "UTC" },
];

export function WorkspaceLocalizationCard() {
  const { t, language } = useTranslation();
  const { currency, timezone, save, saving, loading, workspace } = useWorkspaceSettings();

  const [currencyDraft, setCurrencyDraft] = useState(currency);
  const [tzDraft, setTzDraft] = useState<string>(timezone ?? BROWSER_LOCAL);

  // Re-sync drafts when the workspace finishes loading / changes.
  useEffect(() => {
    setCurrencyDraft(currency);
    setTzDraft(timezone ?? BROWSER_LOCAL);
  }, [currency, timezone]);

  const dirty = currencyDraft !== currency || tzDraft !== (timezone ?? BROWSER_LOCAL);
  const previewTz = tzDraft === BROWSER_LOCAL ? undefined : tzDraft;

  async function handleSave() {
    const ok = await save({
      currency: currencyDraft,
      timezone: tzDraft === BROWSER_LOCAL ? null : tzDraft,
      locale: language,
    }).catch((err) => {
      toast.error(t("settings.localization.error", "Não foi possível salvar"), {
        description: err instanceof Error ? err.message : undefined,
      });
      return false;
    });
    if (ok) toast.success(t("settings.localization.saved", "Preferências salvas"));
  }

  return (
    <SettingsCard
      title={t("settings.localization.title", "Moeda e fuso horário")}
      description={t(
        "settings.localization.subtitle",
        "Como valores e datas são exibidos para este workspace.",
      )}
      className="mt-4"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settings.currency", "Moeda")}
          </label>
          <Select value={currencyDraft} onValueChange={setCurrencyDraft} disabled={loading || !workspace}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("settings.timezone", "Fuso horário")}
          </label>
          <Select value={tzDraft} onValueChange={setTzDraft} disabled={loading || !workspace}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>
                  {tz.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span>{t("settings.localization.preview", "Prévia")}:</span>
        <span className="font-medium text-foreground">
          {formatCurrency(1234.56, { locale: language, currency: currencyDraft })}
        </span>
        <span className="font-medium text-foreground">
          {formatDate(new Date(), { locale: language, timeZone: previewTz })}
        </span>
      </div>

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving || !workspace}>
          {saving ? t("common.saving", "Salvando…") : t("common.save", "Salvar")}
        </Button>
      </div>
    </SettingsCard>
  );
}
