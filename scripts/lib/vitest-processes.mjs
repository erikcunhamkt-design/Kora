// G100 — detecção de OUTRO `vitest` ativo na máquina (usado por `npm run gates:quiet`).
//
// Por quê: várias lanes rodam a suíte ao mesmo tempo (protocolo §16). Com outro vitest ativo, o
// resultado dos gates DEPENDE da carga (testes que levam ~1 s a quente passam a levar 6–18 s,
// waitFor/findBy estouram) — um gate vermelho nessas condições não prova regressão e um verde
// também não vale como medida de tempo. A regra O13 (atualizada) é: gates com outro vitest ativo =
// resultado não vale; re-rodar em máquina quieta.
//
// Tudo aqui é puro/injetável (a listagem de processos entra por parâmetro) pra ser testado sem
// depender do SO. `listProcesses` é a única parte que toca o sistema.

import { execFileSync } from "node:child_process";

/** @typedef {{ pid: number, ppid: number, command: string }} Proc */

/** Linha de comando de um processo do vitest (runner principal OU worker/fork). */
export function isVitestCommand(command) {
  if (!command) return false;
  // o próprio script do gate e esta lib citam "vitest" no caminho/argumentos mas não são o runner
  if (/gates-quiet|vitest-processes/i.test(command)) return false;
  return /vitest/i.test(command);
}

/** PIDs do próprio processo e dos seus ancestrais (npm → node), que nunca contam como "outro". */
export function ownTreePids(procs, selfPid) {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const own = new Set([selfPid]);
  let cur = byPid.get(selfPid);
  while (cur && cur.ppid && !own.has(cur.ppid)) {
    own.add(cur.ppid);
    cur = byPid.get(cur.ppid);
  }
  return own;
}

/** @param {Proc[]} procs @param {number} selfPid */
export function findOtherVitest(procs, selfPid) {
  const own = ownTreePids(procs, selfPid);
  return procs.filter((p) => !own.has(p.pid) && isVitestCommand(p.command));
}

/** Normaliza a saída do `Get-CimInstance Win32_Process | ConvertTo-Json` (objeto único ou lista). */
export function parseWindowsProcessJson(json) {
  if (!json || !json.trim()) return [];
  const parsed = JSON.parse(json);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((p) => ({
    pid: Number(p.ProcessId),
    ppid: Number(p.ParentProcessId || 0),
    command: String(p.CommandLine ?? ""),
  }));
}

/** Normaliza a saída de `ps -eo pid=,ppid=,args=`. */
export function parsePsOutput(text) {
  return String(text)
    .split("\n")
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3] }));
}

/** @returns {Proc[]} processos `node` em execução (Windows: CIM; demais: ps). */
export function listProcesses(platform = process.platform) {
  if (platform === "win32") {
    const out = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress",
      ],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
    );
    return parseWindowsProcessJson(out);
  }
  const out = execFileSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  return parsePsOutput(out);
}

/** Resumo curto de um processo pra mensagem de aviso (corta a linha de comando). */
export function describeProc(p) {
  const cmd = p.command.replace(/\s+/g, " ").trim();
  return `pid ${p.pid}: ${cmd.length > 110 ? `${cmd.slice(0, 107)}…` : cmd}`;
}

export const GATES_QUIET_USAGE = [
  "Uso: npm run gates:quiet [-- opções]",
  "",
  "Roda `npm run gates` (tsc → lint → vitest) só se NÃO houver outro vitest ativo na máquina (G100/O13).",
  "",
  "Opções:",
  "  --wait[=segundos]  espera ficar quieto (padrão 600 s, confere a cada 5 s) e então roda",
  "  --force            roda mesmo com outro vitest ativo, mas avisa que o resultado NÃO vale",
  "  -h, --help         mostra este texto e sai SEM rodar os gates",
  "",
  "Códigos de saída: os do `npm run gates`; 2 = recusado (outro vitest ativo); 64 = opção desconhecida.",
].join("\n");

/**
 * Interpreta os argumentos do `gates:quiet`. Opção desconhecida NUNCA cai em "rodar os gates":
 * volta em `unknown` e o script recusa (exit 64) — um `--help` que rodasse a suíte inteira foi
 * justamente o incidente que motivou isto.
 * @param {string[]} argv
 * @returns {{ help: boolean, force: boolean, waitSeconds: number, unknown: string[] }}
 */
export function parseGatesQuietArgs(argv) {
  const out = { help: false, force: false, waitSeconds: 0, unknown: [] };
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") out.help = true;
    else if (arg === "--force") out.force = true;
    else if (arg === "--wait") out.waitSeconds = 600;
    else if (/^--wait=\d+$/.test(arg)) out.waitSeconds = Number(arg.split("=")[1]);
    else out.unknown.push(arg);
  }
  return out;
}
