// Etapa 5 · Tarefas Fase B (Pacote do Flip, §7 B4, 22/ago/2026) — prova a
// guarda contra disparo repetido em loop: o único caller hoje (Tarefas.tsx)
// já passa `tasks` bifurcado (useBifurcatedTasks, desde 16ca588); uma
// tarefa só-nuvem tem `id` uuid contrabandeado como number, e onMarkSent
// grava reminderSentAt via o mutator LOCAL de useTasks() — sem a guarda,
// esse write é um no-op silencioso (nenhuma tarefa local bate o id), e o
// lembrete dispararia de novo a cada tick (30s) pra sempre.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useTaskReminders } from "@/hooks/useTaskReminders";
import type { Task } from "@/hooks/useTasks";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const baseTask: Partial<Task> = {
  title: "Tarefa com lembrete",
  status: "a_fazer",
  archived: false,
  reminderEnabled: true,
  reminderAt: new Date(Date.now() - 1000).toISOString(), // já venceu
  reminderSentAt: undefined,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useTaskReminders · guarda contra loop de disparo pra tarefa só-nuvem (§7 B4)", () => {
  it("NÃO dispara lembrete pra tarefa com id uuid (só-nuvem) — evita loop a cada 30s", () => {
    const cloudTask: Task = {
      ...baseTask,
      id: "22222222-2222-2222-2222-222222222222" as unknown as number,
    } as Task;
    const onMarkSent = vi.fn();

    renderHook(() => useTaskReminders([cloudTask], onMarkSent));

    expect(onMarkSent).not.toHaveBeenCalled();
  });

  it("continua disparando lembrete pra tarefa local (id numérico) — regressão", () => {
    const localTask: Task = { ...baseTask, id: 7 } as Task;
    const onMarkSent = vi.fn();

    renderHook(() => useTaskReminders([localTask], onMarkSent));

    expect(onMarkSent).toHaveBeenCalledWith(7, expect.any(String));
  });
});

// Etapa 5 · Tarefas Fase C (G77, 23/ago/2026) — completeTask da Central do
// Dia agora tem um caminho NATIVO (moveTask de useSupabaseTasksAll) pra
// tarefa só-nuvem em modo Supabase com a flag de escrita ligada — a prova
// de que o G30 (cache) propaga corretamente é indireta aqui: uma vez que a
// tarefa reflete status "concluido" (id uuid, veio da nuvem), o lembrete
// dela some — mesmo guard de status já existente (`t.status === "concluido"`),
// agora exercitado especificamente contra o caso que o G77 destravou.
describe("useTaskReminders · lembrete de tarefa concluída some, mesmo pra tarefa só-nuvem (G77)", () => {
  it("tarefa da nuvem (id uuid) já concluída não dispara lembrete — o guard de status cobre o caminho nativo novo", () => {
    const completedCloudTask: Task = {
      ...baseTask,
      id: "33333333-3333-3333-3333-333333333333" as unknown as number,
      status: "concluido",
    } as Task;
    const onMarkSent = vi.fn();

    renderHook(() => useTaskReminders([completedCloudTask], onMarkSent));

    expect(onMarkSent).not.toHaveBeenCalled();
  });
});
