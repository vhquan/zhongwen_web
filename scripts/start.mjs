import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = resolve(root, "data/zhongwen.sqlite");
const API_PORT = Number(process.env.PORT || 3001);
const WEB_PORT = Number(process.env.WEB_PORT || 5173);

function portOpen(port) {
  return new Promise((done) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.end();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

async function alreadyServing() {
  if (!(await portOpen(WEB_PORT))) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${WEB_PORT}/`);
    return response.ok;
  } catch {
    return false;
  }
}

function freePort(port) {
  try {
    const out = execSync(`ss -lntp | grep ':${port} ' || true`, {
      encoding: "utf8",
    });
    for (const pid of new Set([...out.matchAll(/pid=(\d+)/g)].map((m) => m[1]))) {
      try {
        process.kill(Number(pid));
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* ss may be unavailable */
  }
}

function ensureDb() {
  if (existsSync(dbPath)) return Promise.resolve();
  return new Promise((resolveImport, reject) => {
    const child = spawn("python3", ["scripts/import_vocab.py"], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolveImport();
      else reject(new Error(`Vocabulary import failed (exit ${code})`));
    });
  });
}

function run(command, args, cwd, name) {
  const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    if (signal === "SIGTERM" || signal === "SIGINT") return;
    if (code) console.error(`${name} exited with code ${code}`);
  });
  return child;
}

const viteBin = resolve(root, "web/node_modules/.bin/vite");
const sqlJs = resolve(root, "server/node_modules/sql.js");
if (!existsSync(viteBin) || !existsSync(sqlJs)) {
  console.error("Dependencies are missing. From the repo root run:\n  npm install");
  process.exit(1);
}

await ensureDb();

if (await alreadyServing()) {
  console.log(`App is already running at http://localhost:${WEB_PORT}/`);
  process.exit(0);
}

if ((await portOpen(WEB_PORT)) || (await portOpen(API_PORT))) {
  console.log("Freeing ports 5173 and 3001 so a new server can start...");
  freePort(WEB_PORT);
  freePort(API_PORT);
  await new Promise((r) => setTimeout(r, 400));
}

const children = [
  run(process.execPath, ["src/index.js"], resolve(root, "server"), "API"),
  run(
    resolve(root, "web/node_modules/.bin/vite"),
    ["--host", "0.0.0.0", "--port", String(WEB_PORT)],
    resolve(root, "web"),
    "Web",
  ),
];

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
