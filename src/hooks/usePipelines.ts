import { useCallback, useEffect, useState } from "react";

export type StageType = "open" | "won" | "lost";

export interface PipelineStage {
  id: string;
  name: string;
  color: string; // hex
  order: number;
  type?: StageType;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault?: boolean;
  stages: PipelineStage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "kora.crm.pipelines.v1";
const ACTIVE_KEY = "kora.crm.activePipeline.v1";

export const DEFAULT_PIPELINE_ID = "default";

const now = () => new Date().toISOString();

export const defaultPipeline = (): Pipeline => ({
  id: DEFAULT_PIPELINE_ID,
  name: "Pipeline Principal",
  isDefault: true,
  createdAt: now(),
  updatedAt: now(),
  stages: [
    { id: "lead", name: "Novo Lead", color: "#F81040", order: 0, type: "open" },
    { id: "contato", name: "Em Contato", color: "#8B5CF6", order: 1, type: "open" },
    { id: "proposta", name: "Proposta Enviada", color: "#F59E0B", order: 2, type: "open" },
    { id: "negociacao", name: "Em Negociação", color: "#3B82F6", order: 3, type: "open" },
    { id: "fechado", name: "Fechado", color: "#10B981", order: 4, type: "won" },
    { id: "perdido", name: "Perdido", color: "#EF4444", order: 5, type: "lost" },
  ],
});

export const newStageId = () => `s_${Math.random().toString(36).slice(2, 9)}`;
export const newPipelineId = () => `p_${Math.random().toString(36).slice(2, 9)}`;

function load(): Pipeline[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Pipeline[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // ensure default exists
        if (!parsed.some((p) => p.isDefault)) parsed.unshift(defaultPipeline());
        return parsed;
      }
    }
  } catch {}
  return [defaultPipeline()];
}

export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>(() => load());
  const [activePipelineId, setActivePipelineIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(ACTIVE_KEY) || DEFAULT_PIPELINE_ID;
    } catch {
      return DEFAULT_PIPELINE_ID;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines));
    } catch {}
  }, [pipelines]);

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_KEY, activePipelineId);
    } catch {}
  }, [activePipelineId]);

  const setActivePipelineId = useCallback((id: string) => {
    setActivePipelineIdState(id);
  }, []);

  const activePipeline =
    pipelines.find((p) => p.id === activePipelineId) || pipelines[0];

  const addPipeline = useCallback(
    (data: Omit<Pipeline, "id" | "createdAt" | "updatedAt" | "isDefault">) => {
      const p: Pipeline = {
        ...data,
        id: newPipelineId(),
        createdAt: now(),
        updatedAt: now(),
      };
      setPipelines((prev) => [...prev, p]);
      return p;
    },
    []
  );

  const updatePipeline = useCallback((id: string, patch: Partial<Pipeline>) => {
    setPipelines((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, id: p.id, updatedAt: now() } : p
      )
    );
  }, []);

  const deletePipeline = useCallback((id: string) => {
    setPipelines((prev) => {
      const target = prev.find((p) => p.id === id);
      if (!target || target.isDefault) return prev;
      return prev.filter((p) => p.id !== id);
    });
    setActivePipelineIdState((curr) =>
      curr === id ? DEFAULT_PIPELINE_ID : curr
    );
  }, []);

  const restoreDefault = useCallback(() => {
    setPipelines((prev) => {
      const others = prev.filter((p) => !p.isDefault);
      return [defaultPipeline(), ...others];
    });
  }, []);

  return {
    pipelines,
    activePipeline,
    activePipelineId,
    setActivePipelineId,
    addPipeline,
    updatePipeline,
    deletePipeline,
    restoreDefault,
  };
}
