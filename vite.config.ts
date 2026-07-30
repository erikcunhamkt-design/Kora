import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "child_process";

// Etapa 5 · Fatia 10 · Fase D (incidente #3) — prova de correspondência
// código↔servidor por hash de commit, não por texto de feature. Um dev
// server pode ficar servindo um bundle velho (processo antigo ainda vivo,
// HMR que não recarregou, worktree errada) sem nenhum sinal visual óbvio —
// já aconteceu 2x nesta fatia (incidente #1: worktree errada; incidente #3:
// bundle velho na worktree certa). Calculado uma vez quando o vite.config
// carrega (no boot do dev server) — não reavalia em runtime, então só é
// confiável logo após (re)iniciar o servidor, não como prova de HMR ao vivo.
function readGitCommit(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

function readGitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD").toString().trim();
  } catch {
    return "unknown";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  define: {
    __KORA_BUILD_COMMIT__: JSON.stringify(readGitCommit()),
    __KORA_BUILD_BRANCH__: JSON.stringify(readGitBranch()),
  },
}));
