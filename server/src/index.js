import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./db.js";

const PORT = Number(process.env.PORT || 3001);
const app = express();
const webDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../web/dist");

app.use(cors());
app.use(express.json());

const EDITIONS = [
  { code: "2.0", levels: [1, 2, 3, 4, 5, 6] },
  { code: "3.0", levels: [1, 2, 3] },
];

function requireEditionLevel(req, res) {
  const edition = String(req.query.edition || "");
  const level = Number(req.query.level);
  const spec = EDITIONS.find((item) => item.code === edition);
  if (!spec || !spec.levels.includes(level)) {
    res.status(400).json({ error: "Invalid edition or level" });
    return null;
  }
  return { edition, level };
}

app.get("/api/editions", (_req, res) => {
  const counts = db
    .prepare(
      `SELECT edition, hsk_level AS level, COUNT(*) AS wordCount
       FROM word GROUP BY edition, hsk_level`,
    )
    .all();
  const byKey = new Map(
    counts.map((row) => [`${row.edition}:${row.level}`, row.wordCount]),
  );
  res.json(
    EDITIONS.map((edition) => ({
      code: edition.code,
      levels: edition.levels.map((level) => ({
        level,
        wordCount: byKey.get(`${edition.code}:${level}`) ?? 0,
      })),
    })),
  );
});

app.get("/api/stats", (req, res) => {
  const parsed = requireEditionLevel(req, res);
  if (!parsed) return;
  const { edition, level } = parsed;

  const total = db
    .prepare(
      `SELECT COUNT(*) AS n FROM word WHERE edition = ? AND hsk_level = ?`,
    )
    .get(edition, level).n;

  const modes = ["flashcard", "dictation"].map((mode) => {
    const row = db
      .prepare(
        `SELECT
           COUNT(*) AS reviewed,
           COALESCE(SUM(correct_count), 0) AS correct,
           COALESCE(SUM(wrong_count), 0) AS wrong
         FROM progress p
         JOIN word w ON w.id = p.word_id
         WHERE w.edition = ? AND w.hsk_level = ? AND p.mode = ?`,
      )
      .get(edition, level, mode);
    const attempts = Number(row.correct) + Number(row.wrong);
    return {
      mode,
      reviewed: row.reviewed,
      correct: row.correct,
      wrong: row.wrong,
      accuracy: attempts === 0 ? 0 : Math.round((row.correct / attempts) * 100),
    };
  });

  res.json({ edition, level, wordCount: total, modes });
});

app.get("/api/words", (req, res) => {
  const parsed = requireEditionLevel(req, res);
  if (!parsed) return;
  const { edition, level } = parsed;

  const words = db
    .prepare(
      `SELECT id, edition, hsk_level AS hskLevel, source_stt AS sourceStt,
              hanzi, pinyin, pinyin_numeric AS pinyinNumeric, pinyin_plain AS pinyinPlain,
              hanviet
       FROM word
       WHERE edition = ? AND hsk_level = ?
       ORDER BY source_stt IS NULL, source_stt, id`,
    )
    .all(edition, level);

  const ids = words.map((word) => word.id);
  if (ids.length === 0) {
    res.json([]);
    return;
  }

  const placeholders = ids.map(() => "?").join(",");
  const senses = db
    .prepare(
      `SELECT id, word_id AS wordId, sort_order AS sortOrder,
              part_of_speech AS partOfSpeech, meaning_vi AS meaningVi
       FROM sense WHERE word_id IN (${placeholders})
       ORDER BY word_id, sort_order, id`,
    )
    .all(...ids);

  const senseIds = senses.map((sense) => sense.id);
  const examples = senseIds.length
    ? db
        .prepare(
          `SELECT id, sense_id AS senseId, sort_order AS sortOrder,
                  hanzi, pinyin, translation_vi AS translationVi
           FROM example WHERE sense_id IN (${senseIds.map(() => "?").join(",")})
           ORDER BY sense_id, sort_order, id`,
        )
        .all(...senseIds)
    : [];

  const progressRows = db
    .prepare(
      `SELECT word_id AS wordId, mode, seen_count AS seenCount,
              correct_count AS correctCount, wrong_count AS wrongCount,
              last_result AS lastResult, last_reviewed_at AS lastReviewedAt
       FROM progress WHERE word_id IN (${placeholders})`,
    )
    .all(...ids);

  const examplesBySense = new Map();
  for (const example of examples) {
    const list = examplesBySense.get(example.senseId) ?? [];
    list.push(example);
    examplesBySense.set(example.senseId, list);
  }

  const sensesByWord = new Map();
  for (const sense of senses) {
    const list = sensesByWord.get(sense.wordId) ?? [];
    list.push({
      id: sense.id,
      partOfSpeech: sense.partOfSpeech,
      meaningVi: sense.meaningVi,
      examples: examplesBySense.get(sense.id) ?? [],
    });
    sensesByWord.set(sense.wordId, list);
  }

  const progressByWord = new Map();
  for (const row of progressRows) {
    const current = progressByWord.get(row.wordId) ?? {
      flashcard: null,
      dictation: null,
    };
    current[row.mode] = {
      seenCount: row.seenCount,
      correctCount: row.correctCount,
      wrongCount: row.wrongCount,
      lastResult: row.lastResult,
      lastReviewedAt: row.lastReviewedAt,
    };
    progressByWord.set(row.wordId, current);
  }

  res.json(
    words.map((word) => ({
      ...word,
      senses: sensesByWord.get(word.id) ?? [],
      progress: progressByWord.get(word.id) ?? {
        flashcard: null,
        dictation: null,
      },
    })),
  );
});

app.post("/api/progress", (req, res) => {
  const wordId = Number(req.body?.wordId);
  const mode = req.body?.mode;
  const result = req.body?.result;
  if (!Number.isInteger(wordId) || wordId <= 0) {
    res.status(400).json({ error: "Invalid wordId" });
    return;
  }
  if (mode !== "flashcard" && mode !== "dictation") {
    res.status(400).json({ error: "Invalid mode" });
    return;
  }
  if (result !== "correct" && result !== "wrong") {
    res.status(400).json({ error: "Invalid result" });
    return;
  }

  const exists = db.prepare("SELECT id FROM word WHERE id = ?").get(wordId);
  if (!exists) {
    res.status(404).json({ error: "Word not found" });
    return;
  }

  db.prepare(
    `INSERT INTO progress (
        word_id, mode, seen_count, correct_count, wrong_count, last_result, last_reviewed_at
     ) VALUES (?, ?, 1, ?, ?, ?, datetime('now'))
     ON CONFLICT(word_id, mode) DO UPDATE SET
        seen_count = seen_count + 1,
        correct_count = correct_count + excluded.correct_count,
        wrong_count = wrong_count + excluded.wrong_count,
        last_result = excluded.last_result,
        last_reviewed_at = excluded.last_reviewed_at`,
  ).run(wordId, mode, result === "correct" ? 1 : 0, result === "wrong" ? 1 : 0, result);

  const row = db
    .prepare(
      `SELECT seen_count AS seenCount, correct_count AS correctCount,
              wrong_count AS wrongCount, last_result AS lastResult,
              last_reviewed_at AS lastReviewedAt
       FROM progress WHERE word_id = ? AND mode = ?`,
    )
    .get(wordId, mode);

  res.json({ wordId, mode, ...row });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    res.sendFile(resolve(webDist, "index.html"));
  });
}

const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});
