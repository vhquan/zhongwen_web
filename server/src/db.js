import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dbPath = resolve(root, "data/zhongwen.sqlite");
const seedPath = resolve(root, "seed/zhongwen.sqlite");

const SQL = await initSqlJs({
  wasmBinary: readFileSync(require.resolve("sql.js/dist/sql-wasm.wasm")),
});

const raw = new SQL.Database(readFileSync(dbPath));
raw.run("PRAGMA foreign_keys = ON");

function tableHasColumn(table, column) {
  const stmt = raw.prepare(`PRAGMA table_info(${table})`);
  let found = false;
  while (stmt.step()) {
    if (stmt.getAsObject().name === column) found = true;
  }
  stmt.free();
  return found;
}

function migrateHanviet() {
  if (!tableHasColumn("word", "hanviet")) {
    raw.run("ALTER TABLE word ADD COLUMN hanviet TEXT");
    console.log("Added missing word.hanviet column");
  }

  const filled = raw.exec(
    "SELECT COUNT(*) AS n FROM word WHERE hanviet IS NOT NULL AND hanviet != ''",
  );
  const filledCount = filled[0]?.values?.[0]?.[0] ?? 0;
  if (filledCount > 0 || !existsSync(seedPath)) return;

  const seed = new SQL.Database(readFileSync(seedPath));
  try {
    const stmt = seed.prepare(
      `SELECT edition, hsk_level, hanzi, pinyin, hanviet FROM word
       WHERE hanviet IS NOT NULL AND hanviet != ''`,
    );
    const update = raw.prepare(
      `UPDATE word SET hanviet = ?
       WHERE edition = ? AND hsk_level = ? AND hanzi = ? AND pinyin = ?
         AND (hanviet IS NULL OR hanviet = '')`,
    );
    let copied = 0;
    while (stmt.step()) {
      const row = stmt.getAsObject();
      update.bind([row.hanviet, row.edition, row.hsk_level, row.hanzi, row.pinyin]);
      update.step();
      update.reset();
      copied += 1;
    }
    stmt.free();
    update.free();
    if (copied) console.log(`Copied ${copied} Hán Việt readings from seed database`);
  } catch (err) {
    console.warn("Could not copy Hán Việt from seed:", err.message);
  } finally {
    seed.close();
  }
}

migrateHanviet();
writeFileSync(dbPath, Buffer.from(raw.export()));

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
