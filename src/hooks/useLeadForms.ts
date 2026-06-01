import { useEffect, useState, useCallback } from "react";

export interface LeadFormField {
  id: string;
  label: string;
  type: "text" | "email" | "phone" | "textarea" | "select";
  required: boolean;
  options?: string[];
}

export interface LeadForm {
  id: string;
  name: string;
  description: string;
  fields: LeadFormField[];
  active: boolean;
  submissions: number;
  isDemo?: boolean;
}

const KEY = "orbyt.leadForms.v1";

const DEFAULT_FIELDS: LeadFormField[] = [
  { id: "f1", label: "Nome", type: "text", required: true },
  { id: "f2", label: "E-mail", type: "email", required: true },
  { id: "f3", label: "WhatsApp", type: "phone", required: false },
  { id: "f4", label: "Conte sobre o projeto", type: "textarea", required: true },
];

const SEEDS: LeadForm[] = [
  { id: "lf1", name: "Formulário de orçamento", description: "Captação inicial para novos orçamentos.", fields: DEFAULT_FIELDS, active: true, submissions: 14, isDemo: true },
  { id: "lf2", name: "Briefing inicial", description: "Coleta de informações para iniciar projeto.", fields: DEFAULT_FIELDS, active: true, submissions: 6, isDemo: true },
  { id: "lf3", name: "Diagnóstico de projeto", description: "Triagem para diagnóstico estratégico.", fields: DEFAULT_FIELDS, active: false, submissions: 3, isDemo: true },
];

export function useLeadForms() {
  const [forms, setForms] = useState<LeadForm[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setForms(JSON.parse(raw));
      else { setForms(SEEDS); localStorage.setItem(KEY, JSON.stringify(SEEDS)); }
    } catch { setForms(SEEDS); }
  }, []);

  const add = useCallback((f: Omit<LeadForm, "id" | "submissions" | "fields" | "isDemo"> & { fields?: LeadFormField[] }) => {
    setForms((prev) => {
      const next = [...prev, { ...f, id: crypto.randomUUID(), submissions: 0, fields: f.fields ?? DEFAULT_FIELDS, isDemo: false }];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* intentionally empty */ }
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setForms((prev) => {
      const next = prev.map((x) => x.id === id ? { ...x, active: !x.active } : x);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* intentionally empty */ }
      return next;
    });
  }, []);

  const submit = useCallback((id: string) => {
    setForms((prev) => {
      const next = prev.map((x) => x.id === id ? { ...x, submissions: x.submissions + 1 } : x);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* intentionally empty */ }
      return next;
    });
  }, []);

  return { forms, add, toggle, submit };
}
