import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
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
