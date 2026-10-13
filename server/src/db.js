import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = resolve(root, "data/zhongwen.sqlite");

const SQL = await initSqlJs({
  wasmBinary: readFileSync(require.resolve("sql.js/dist/sql-wasm.wasm")),
});

const raw = new SQL.Database(readFileSync(dbPath));
raw.run("PRAGMA foreign_keys = ON");

function persist() {
  writeFileSync(dbPath, Buffer.from(raw.export()));
}

function statement(sql) {
  return {
    all(...params) {
      const stmt = raw.prepare(sql);
      if (params.length) stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },
    get(...params) {
      return this.all(...params)[0];
    },
    run(...params) {
      raw.run(sql, params);
      persist();
      return { changes: raw.getRowsModified() };
    },
  };
}

export const db = {
  prepare: statement,
  pragma() {},
};
