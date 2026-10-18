// `npm run gates:quiet` — roda `npm run gates` só se NÃO houver outro vitest ativo (G100).
//
// Regra O13 (atualizada, docs/architecture/kora-hub-auditoria-e-plano.md): gates com outro vitest
// ativo = resultado NÃO vale; re-rodar em máquina quieta. Este wrapper não muda o que os gates
// checam (é o mesmo `npm run gates`: tsc → lint → vitest) — só recusa/avisa quando a carga
// externa torna o resultado não conclusivo.
//
// Uso:
//   npm run gates:quiet                  recusa (exit 2) se houver outro vitest ativo
//   npm run gates:quiet -- --wait        espera ficar quieto (até 10 min, confere a cada 5 s) e roda
//   npm run gates:quiet -- --wait=120    idem, com limite de 120 s
//   npm run gates:quiet -- --force       roda mesmo assim, MAS avisa que o resultado não vale
//
// Códigos de saída: 0/1/… = os do `npm run gates`; 2 = recusado por haver outro vitest ativo.

import { spawn } from "node:child_process";
import { describeProc, findOtherVitest, listProcesses } from "./lib/vitest-processes.mjs";

const args = process.argv.slice(2);
const force = args.includes("--force");
const waitArg = args.find((a) => a === "--wait" || a.startsWith("--wait="));
const waitSeconds = waitArg ? (waitArg.includes("=") ? Number(waitArg.split("=")[1]) : 600) : 0;

function othersNow() {
  try {
    return findOtherVitest(listProcesses(), process.pid);
  } catch (err) {
    console.warn(`[gates:quiet] não consegui listar processos (${err instanceof Error ? err.message : err}) — seguindo sem a checagem.`);
    return [];
  }
}

function warn(others, header) {
  console.warn(`\n[gates:quiet] ${header}`);
  others.slice(0, 8).forEach((p) => console.warn(`  - ${describeProc(p)}`));
  if (others.length > 8) console.warn(`  … e mais ${others.length - 8}`);
}

let others = othersNow();
if (others.length > 0 && waitSeconds > 0) {
  warn(others, `outro vitest ativo (${others.length} processo(s)) — esperando ficar quieto (até ${waitSeconds}s)…`);
  const deadline = Date.now() + waitSeconds * 1000;
  while (others.length > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    others = othersNow();
  }
}

if (others.length > 0) {
  warn(others, "OUTRO vitest está ativo nesta máquina.");
  if (!force) {
    console.warn(
      "[gates:quiet] Gates com outro vitest ativo = resultado NÃO vale (os testes ficam 6–18× mais lentos e estouram waitFor/timeout sem haver regressão — G100/O13).\n" +
        "  Espere o outro terminar (ou use `npm run gates:quiet -- --wait`) e rode de novo. Para rodar assim mesmo: `-- --force` (e NÃO use o resultado como gate de merge).",
    );
    process.exit(2);
  }
  console.warn("[gates:quiet] --force: rodando mesmo assim — o resultado deste run NÃO vale como gate de merge.");
}

// comando único (string) com shell: no Windows `npm` é `npm.cmd` e exige shell; sem array de args não há aviso DEP0190.
const child = spawn("npm run gates", { stdio: "inherit", shell: true });
child.on("exit", (code, signal) => {
  const lateOthers = othersNow();
  if (lateOthers.length > 0) {
    warn(lateOthers, "outro vitest apareceu DURANTE a execução — se algo falhou por timeout/waitFor, o resultado não vale: re-rode em máquina quieta.");
  }
  process.exit(signal ? 1 : (code ?? 1));
});
