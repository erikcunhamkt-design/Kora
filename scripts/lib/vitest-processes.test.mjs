// G100 — testes da detecção de outro vitest (lib pura de `npm run gates:quiet`).
import { describe, it, expect } from "vitest";
import {
  describeProc,
  findOtherVitest,
  isVitestCommand,
  ownTreePids,
  parsePsOutput,
  parseWindowsProcessJson,
} from "./vitest-processes.mjs";

const VITEST_MAIN = "C:\\Program Files\\nodejs\\node.exe C:\\repo\\node_modules\\vitest\\vitest.mjs run";
const VITEST_WORKER = "node --conditions node C:\\repo\\node_modules\\vitest\\dist\\workers\\forks.js";
const VITE_DEV = "node C:\\repo\\node_modules\\vite\\bin\\vite.js";
const NPM = "node C:\\npm\\node_modules\\npm\\bin\\npm-cli.js run gates:quiet";
const SELF = "node scripts/gates-quiet.mjs";

const procs = [
  { pid: 10, ppid: 1, command: NPM },
  { pid: 11, ppid: 10, command: SELF },
  { pid: 20, ppid: 1, command: VITEST_MAIN },
  { pid: 21, ppid: 20, command: VITEST_WORKER },
  { pid: 30, ppid: 1, command: VITE_DEV },
];

describe("isVitestCommand", () => {
  it("reconhece o runner e os workers do vitest", () => {
    expect(isVitestCommand(VITEST_MAIN)).toBe(true);
    expect(isVitestCommand(VITEST_WORKER)).toBe(true);
  });
  it("não confunde outros processos node (vite dev, npm) nem o próprio gates-quiet", () => {
    expect(isVitestCommand(VITE_DEV)).toBe(false);
    expect(isVitestCommand(NPM)).toBe(false);
    expect(isVitestCommand("node scripts/gates-quiet.mjs --force vitest")).toBe(false);
    expect(isVitestCommand("")).toBe(false);
  });
});

describe("findOtherVitest", () => {
  it("acha o outro vitest (runner + worker) e ignora vite dev, npm e o próprio script", () => {
    const others = findOtherVitest(procs, 11);
    expect(others.map((p) => p.pid)).toEqual([20, 21]);
  });
  it("máquina quieta: lista vazia", () => {
    expect(findOtherVitest(procs.filter((p) => p.pid < 20), 11)).toEqual([]);
  });
  it("o vitest que é ANCESTRAL do próprio processo (ex.: rodando dentro de um teste) não conta como outro", () => {
    const tree = [
      { pid: 20, ppid: 1, command: VITEST_MAIN },
      { pid: 21, ppid: 20, command: VITEST_WORKER },
    ];
    expect(findOtherVitest(tree, 21)).toEqual([]);
    expect([...ownTreePids(tree, 21)].sort()).toEqual([1, 20, 21]);
  });
});

describe("parsers de listagem de processos", () => {
  it("Windows: lista JSON", () => {
    const json = JSON.stringify([
      { ProcessId: 20, ParentProcessId: 1, CommandLine: VITEST_MAIN },
      { ProcessId: 30, ParentProcessId: 1, CommandLine: null },
    ]);
    expect(parseWindowsProcessJson(json)).toEqual([
      { pid: 20, ppid: 1, command: VITEST_MAIN },
      { pid: 30, ppid: 1, command: "" },
    ]);
  });
  it("Windows: um único processo vem como objeto, não como lista", () => {
    expect(parseWindowsProcessJson(JSON.stringify({ ProcessId: 7, ParentProcessId: 2, CommandLine: "node x" }))).toEqual([
      { pid: 7, ppid: 2, command: "node x" },
    ]);
  });
  it("Windows: saída vazia (nenhum node) → lista vazia", () => {
    expect(parseWindowsProcessJson("")).toEqual([]);
    expect(parseWindowsProcessJson("   \n")).toEqual([]);
  });
  it("ps: pid, ppid e args", () => {
    const out = "  20     1 node /repo/node_modules/vitest/vitest.mjs run\n  21    20 node forks.js\n";
    expect(parsePsOutput(out)).toEqual([
      { pid: 20, ppid: 1, command: "node /repo/node_modules/vitest/vitest.mjs run" },
      { pid: 21, ppid: 20, command: "node forks.js" },
    ]);
  });
});

describe("describeProc", () => {
  it("corta linhas de comando longas", () => {
    const text = describeProc({ pid: 5, ppid: 1, command: `node ${"x".repeat(300)}` });
    expect(text.startsWith("pid 5: node ")).toBe(true);
    expect(text.length).toBeLessThan(130);
  });
});
