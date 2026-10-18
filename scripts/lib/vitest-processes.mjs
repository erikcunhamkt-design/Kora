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
