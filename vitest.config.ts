import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "node:os";

// G100 — workers por execução: ~40% dos núcleos (mín. 4). Ver o comentário em `maxWorkers` abaixo.
const cores = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
const MAX_WORKERS = Math.max(4, Math.floor(cores * 0.4));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // O13: default de 5000ms flaca sob contenção real de CPU (várias lanes
    // rodando `vitest run` ao mesmo tempo em worktrees separadas — modo de
    // operação normal deste repo, não um caso raro). Reproduzido de forma
    // determinística rodando 3 suítes completas em paralelo: toda falha
    // observada foi "Test timed out in 5000ms", nunca um erro de asserção —
    // e o conjunto de arquivos afetados varia a cada rodada e não tem
    // relação com o domínio (CRM, Quotes, Projects, Contacts todos já
    // flacaram assim). Não é bug de teste nem de produção — é o teto global
    // curto demais pro modo de uso real. Ver docs/architecture/kora-hub-auditoria-e-plano.md O13.
    testTimeout: 20000,
    // G100 (docs/architecture/kora-hub-auditoria-e-plano.md): o default do vitest é (núcleos − 1) workers
    // POR execução — 19 numa máquina de 20 núcleos, cada um com seu jsdom (~170 MB). Como várias lanes
    // rodam a suíte ao mesmo tempo (§16), 3 execuções = 57 workers e ~13 GB de pico de RAM numa máquina
    // de 15,6 GB: o SO passa a paginar e UM teste qualquer (quase sempre o 1º de um arquivo) leva 6–18 s
    // em vez de ~1 s — estoura asserts de tempo (waitFor/findBy) e chega perto do testTimeout. Com 40%
    // dos núcleos (8 aqui) o pico por execução cai de ~4,3 GB para ~2,9 GB e, sob 3 execuções em
    // paralelo, o teste mais lento fica em ~3 s (antes 18 s) com 0 falhas; execução sozinha continua
    // ~30–50 s. `testTimeout` NÃO foi mexido: o problema era carga/memória, não teto curto.
    maxWorkers: MAX_WORKERS,
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      // supabase/functions/_shared: modulos puros (sem Deno.*/npm:) extraidos
      // de Edge Functions, testaveis aqui — ver docs/qa/etapa-6-g8-flownodes.md
      "supabase/functions/**/*.{test,spec}.ts",
      // G100: testes da lib do `npm run gates:quiet` (scripts/lib).
      "scripts/**/*.{test,spec}.mjs",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
