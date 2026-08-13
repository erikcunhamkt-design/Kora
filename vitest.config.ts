import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      // supabase/functions/_shared: modulos puros (sem Deno.*/npm:) extraidos
      // de Edge Functions, testaveis aqui — ver docs/qa/etapa-6-g8-flownodes.md
      "supabase/functions/**/*.{test,spec}.ts",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
