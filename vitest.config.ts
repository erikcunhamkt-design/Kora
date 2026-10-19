import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import os from "node:os";

// G100 — workers por execução: ~40% dos núcleos (mín. 4). Ver o comentário em `maxWorkers` abaixo.
const cores = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
const MAX_WORKERS = Math.max(4, Math.floor(cores * 0.4));

// G100-b — testes PUROS rodam em `environment: "node"` (sem jsdom, sem setup de DOM): ~1 s de custo
// de ambiente por arquivo que eles não usam. Lista POSITIVA: um teste só entra aqui se (a) a pasta é
// pura por natureza (mappers, repositórios com supabase mockado, funções de `supabase/functions`,
// modelos puros do canvas/simulador) E (b) foi medido passando em `node`. Teste novo cai em jsdom por
// padrão (o lado seguro). Cada arquivo roda em EXATAMENTE um dos dois projetos: o projeto `jsdom`
// exclui esta mesma lista. Quem usa `localStorage`/`window`/React fica de fora (a medição de
// 2026-10 achou 109 de 164 arquivos nessa condição) — ver G100 no catálogo.
const PURE_NODE_TESTS = [
  // funções de edge puras (sem Deno.*/npm:) — docs/qa/etapa-6-g8-flownodes.md
  "supabase/functions/**/*.{test,spec}.ts",
  // lib do `npm run gates:quiet`
  "scripts/**/*.{test,spec}.mjs",
  // repositórios (supabase mockado) — exceto catalogErrorMessage, que lê localStorage
  "src/repositories/__tests__/!(catalogErrorMessage).test.ts",
  // modelos puros do construtor de fluxo do bot (sem React)
  "src/components/whatsapp/__tests__/{flowCanvasModel,flowCanvasModel.destinos,flowExample,flowSimulatorModel,flowSimulatorModel.ai-mode,flowSimulatorModel.knowledge,flowSimulatorModel.retorno,flowValidation,WhatsAppBotConfig.menu-node-types}.test.ts",
  // libs puras
  "src/lib/format/**/*.test.ts",
  "src/lib/whatsapp/**/*.test.ts",
  "src/lib/supabase/**/*.test.ts",
  // mappers sem import-map em localStorage
  "src/services/projects/__tests__/projectsMapper.test.ts",
  "src/services/catalog/__tests__/catalogMapper.test.ts",
  "src/services/catalog/__tests__/catalogProductPlanMapper.test.ts",
  "src/services/technicalSheets/__tests__/technicalSheetMapper.test.ts",
  "src/services/tasks/__tests__/tasksMapper.test.ts",
  "src/services/finance/__tests__/financeMapper.test.ts",
  "src/services/quotes/__tests__/quoteMoney.test.ts",
  "src/test/example.test.ts",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
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
    projects: [
      {
        extends: true,
        test: {
          name: "node-puros",
          environment: "node",
          include: PURE_NODE_TESTS,
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          setupFiles: ["./src/test/setup.ts"],
          include: [
            "src/**/*.{test,spec}.{ts,tsx}",
            // supabase/functions/_shared: modulos puros (sem Deno.*/npm:) extraidos
            // de Edge Functions, testaveis aqui — ver docs/qa/etapa-6-g8-flownodes.md
            "supabase/functions/**/*.{test,spec}.ts",
            // G100: testes da lib do `npm run gates:quiet` (scripts/lib).
            "scripts/**/*.{test,spec}.mjs",
          ],
          exclude: [...configDefaults.exclude, ...PURE_NODE_TESTS],
        },
      },
    ],
  },
});
