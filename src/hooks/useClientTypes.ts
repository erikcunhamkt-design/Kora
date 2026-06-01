import { useCallback, useEffect, useMemo, useState } from "react";

export interface ClientType {
  id: string;
  name: string;
  color?: string;
  isDefault: boolean;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kora.clientTypes.v1";
const MAX_NAME = 40;

const DEFAULT_NAMES = ["Branding", "Social Media", "Web Design", "Design Gráfico"];

function makeId() {
  return `ct_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function buildSeeds(): ClientType[] {
  const now = new Date().toISOString();
  return DEFAULT_NAMES.map((name) => ({
    id: `default_${normalize(name).replace(/\s/g, "_")}`,
    name,
    isDefault: true,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }));
}

function ensureDefaults(list: ClientType[]): ClientType[] {
  const seeds = buildSeeds();
  const existingKeys = new Set(list.map((t) => normalize(t.name)));
  const missing = seeds.filter((s) => !existingKeys.has(normalize(s.name)));
  return [...missing, ...list];
}

export function useClientTypes() {
  const [types, setTypes] = useState<ClientType[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ClientType[];
        if (Array.isArray(parsed)) return ensureDefaults(parsed);
      }
    } catch { /* intentionally empty */ }
    return buildSeeds();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
    } catch { /* intentionally empty */ }
  }, [types]);

  const activeTypes = useMemo(() => types.filter((t) => !t.archived), [types]);

  const addType = useCallback(
    (name: string, color?: string): { ok: true; type: ClientType } | { ok: false; error: string } => {
      const trimmed = name.trim().slice(0, MAX_NAME);
      if (!trimmed) return { ok: false, error: "Informe um nome." };
      const norm = normalize(trimmed);
      const exists = types.find((t) => normalize(t.name) === norm && !t.archived);
      if (exists) return { ok: false, error: "Já existe um tipo com esse nome." };
      const now = new Date().toISOString();
      const created: ClientType = {
        id: makeId(),
        name: trimmed,
        color,
        isDefault: false,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      setTypes((prev) => [...prev, created]);
      return { ok: true, type: created };
    },
    [types]
  );

  const renameType = useCallback(
    (id: string, name: string): { ok: boolean; error?: string } => {
      const trimmed = name.trim().slice(0, MAX_NAME);
      if (!trimmed) return { ok: false, error: "Informe um nome." };
      const target = types.find((t) => t.id === id);
      if (!target) return { ok: false, error: "Tipo não encontrado." };
      if (target.isDefault) return { ok: false, error: "Tipos padrão não podem ser renomeados." };
      const norm = normalize(trimmed);
      const exists = types.find((t) => t.id !== id && normalize(t.name) === norm && !t.archived);
      if (exists) return { ok: false, error: "Já existe um tipo com esse nome." };
      setTypes((prev) =>
        prev.map((t) => (t.id === id ? { ...t, name: trimmed, updatedAt: new Date().toISOString() } : t))
      );
      return { ok: true };
    },
    [types]
  );

  const archiveType = useCallback((id: string) => {
    setTypes((prev) =>
      prev.map((t) => (t.id === id ? { ...t, archived: true, updatedAt: new Date().toISOString() } : t))
    );
  }, []);

  const deleteType = useCallback(
    (id: string): { ok: boolean; error?: string } => {
      const target = types.find((t) => t.id === id);
      if (!target) return { ok: false, error: "Tipo não encontrado." };
      if (target.isDefault) return { ok: false, error: "Tipos padrão não podem ser excluídos." };
      setTypes((prev) => prev.filter((t) => t.id !== id));
      return { ok: true };
    },
    [types]
  );

  return {
    types,
    activeTypes,
    addType,
    renameType,
    archiveType,
    deleteType,
    MAX_NAME,
  };
}
