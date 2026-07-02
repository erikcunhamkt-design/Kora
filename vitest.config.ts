import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: [
      ...configDefaults.exclude,
      // Teste legado escrito para Jest (usa jest.mock + @testing-library/react-hooks,
      // pacote deprecado e nao instalado). Nunca rodou sob o Vitest. Colocado em
      // quarentena na Etapa 0 ate ser migrado para Vitest (vi.mock + renderHook do
      // @testing-library/react). Ver docs/qa/etapa-0-rede-de-seguranca.md.
      "src/hooks/__tests__/useLocalQuotesImport.test.ts",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
