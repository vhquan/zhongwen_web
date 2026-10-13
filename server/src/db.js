import Database from "better-sqlite3";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = resolve(root, "data/zhongwen.sqlite");

export const db = new Database(dbPath);
db.pragma("foreign_keys = ON");
