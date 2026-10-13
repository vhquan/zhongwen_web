import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dbPath = resolve(root, "data/zhongwen.sqlite");

if (existsSync(dbPath)) {
  process.exit(0);
}

const result = spawnSync("python3", ["scripts/import_vocab.py"], {
  cwd: root,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
