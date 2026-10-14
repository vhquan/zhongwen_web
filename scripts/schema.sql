PRAGMA foreign_keys = ON;

CREATE TABLE word (
  id INTEGER PRIMARY KEY,
  edition TEXT NOT NULL CHECK (edition IN ('2.0', '3.0')),
  hsk_level INTEGER NOT NULL CHECK (hsk_level BETWEEN 1 AND 6),
  source_stt INTEGER,
  hanzi TEXT NOT NULL,
  pinyin TEXT NOT NULL,
  pinyin_numeric TEXT NOT NULL,
  pinyin_plain TEXT NOT NULL,
  hanviet TEXT,
  UNIQUE (edition, hsk_level, hanzi, pinyin)
);

CREATE TABLE sense (
  id INTEGER PRIMARY KEY,
  word_id INTEGER NOT NULL REFERENCES word(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  part_of_speech TEXT,
  meaning_vi TEXT
);

CREATE TABLE example (
  id INTEGER PRIMARY KEY,
  sense_id INTEGER NOT NULL REFERENCES sense(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  hanzi TEXT,
  pinyin TEXT,
  translation_vi TEXT
);

CREATE TABLE progress (
  word_id INTEGER NOT NULL REFERENCES word(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('flashcard', 'dictation')),
  seen_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  last_result TEXT CHECK (last_result IN ('correct', 'wrong')),
  last_reviewed_at TEXT,
  PRIMARY KEY (word_id, mode)
);

CREATE INDEX idx_word_edition_level ON word (edition, hsk_level);
CREATE INDEX idx_sense_word ON sense (word_id);
CREATE INDEX idx_example_sense ON example (sense_id);
