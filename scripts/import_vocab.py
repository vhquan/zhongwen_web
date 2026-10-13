#!/usr/bin/env python3
"""Import HSK 2.0 / 3.0 vocabulary from the workbook into SQLite."""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
XLSX = next(
    (
        path
        for path in (
            ROOT / "resources" / "vocabulary_hsk1-3_3.0_and_hsk1-6_2.0.xlsx",
            ROOT / "vocabulary_hsk1-3_3.0_and_hsk1-6_2.0.xlsx",
        )
        if path.exists()
    ),
    ROOT / "resources" / "vocabulary_hsk1-3_3.0_and_hsk1-6_2.0.xlsx",
)
DB_PATH = ROOT / "data" / "zhongwen.sqlite"
SCHEMA_PATH = ROOT / "scripts" / "schema.sql"

TONE_TO_DIGIT = {
    "ā": ("a", "1"),
    "á": ("a", "2"),
    "ǎ": ("a", "3"),
    "à": ("a", "4"),
    "ē": ("e", "1"),
    "é": ("e", "2"),
    "ě": ("e", "3"),
    "è": ("e", "4"),
    "ī": ("i", "1"),
    "í": ("i", "2"),
    "ǐ": ("i", "3"),
    "ì": ("i", "4"),
    "ō": ("o", "1"),
    "ó": ("o", "2"),
    "ǒ": ("o", "3"),
    "ò": ("o", "4"),
    "ū": ("u", "1"),
    "ú": ("u", "2"),
    "ǔ": ("u", "3"),
    "ù": ("u", "4"),
    "ǖ": ("ü", "1"),
    "ǘ": ("ü", "2"),
    "ǚ": ("ü", "3"),
    "ǜ": ("ü", "4"),
    "Ā": ("a", "1"),
    "Á": ("a", "2"),
    "Ǎ": ("a", "3"),
    "À": ("a", "4"),
    "Ē": ("e", "1"),
    "É": ("e", "2"),
    "Ě": ("e", "3"),
    "È": ("e", "4"),
    "Ī": ("i", "1"),
    "Í": ("i", "2"),
    "Ǐ": ("i", "3"),
    "Ì": ("i", "4"),
    "Ō": ("o", "1"),
    "Ó": ("o", "2"),
    "Ǒ": ("o", "3"),
    "Ò": ("o", "4"),
    "Ū": ("u", "1"),
    "Ú": ("u", "2"),
    "Ǔ": ("u", "3"),
    "Ù": ("u", "4"),
    "Ǖ": ("ü", "1"),
    "Ǘ": ("ü", "2"),
    "Ǚ": ("ü", "3"),
    "Ǜ": ("ü", "4"),
    "ń": ("n", "2"),
    "ň": ("n", "3"),
    "ǹ": ("n", "4"),
    "m̄": ("m", "1"),
    "ḿ": ("m", "2"),
    "m̀": ("m", "4"),
}

V2_SHEETS = {
    "HSK1": 1,
    "HSK2": 2,
    "HSK3": 3,
    "HSK4": 4,
    "HSK5": 5,
    "HSK6": 6,
}

V3_SHEETS = {
    "HSK1 (3.0)": 1,
    "HSK2 (3.0)": 2,
    "HSK3 (3.0)": 3,
}


def cell_str(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    text = str(value).strip()
    return text or None


def cell_int(value) -> int | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def collapse_spaces(text: str) -> str:
    return " ".join(text.split())


def unify_u(text: str) -> str:
    return text.replace("u:", "ü").replace("U:", "ü").replace("v", "ü").replace("V", "ü")


_VOWELS = set("aeiouü")
_CODA = set("ngr")


def pinyin_numeric(pinyin: str) -> str:
    """Tone-marked vowels become base + digit after that syllable chunk."""
    chunks: list[str] = []
    current: list[str] = []
    tone = ""
    has_vowel = False

    def flush() -> None:
        nonlocal tone, has_vowel
        if not current:
            tone = ""
            has_vowel = False
            return
        chunks.append("".join(current) + tone)
        current.clear()
        tone = ""
        has_vowel = False

    for ch in collapse_spaces(pinyin):
        if ch.isspace() or ch in "-'":
            flush()
            continue
        mapped = TONE_TO_DIGIT.get(ch)
        raw = mapped[0] if mapped else (ch.lower() if ch.isalpha() else ch)
        if mapped:
            tone = mapped[1]
        elif ch.isdigit() and current:
            tone = ch
            continue
        if has_vowel and raw.isalpha() and raw not in _VOWELS and raw not in _CODA:
            flush()
        current.append(raw)
        if raw in _VOWELS:
            has_vowel = True
    flush()
    return unify_u(" ".join(chunks))


def pinyin_plain(pinyin: str) -> str:
    numeric = pinyin_numeric(pinyin)
    letters: list[str] = []
    for ch in numeric:
        if ch.isdigit():
            continue
        letters.append(ch)
    return collapse_spaces("".join(letters))


def find_col(columns: list[str], *predicates) -> str | None:
    for col in columns:
        for pred in predicates:
            if pred(col):
                return col
    return None


def load_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))


def upsert_word(
    conn: sqlite3.Connection,
    edition: str,
    level: int,
    source_stt: int | None,
    hanzi: str,
    pinyin: str,
) -> int:
    numeric = pinyin_numeric(pinyin)
    plain = pinyin_plain(pinyin)
    existing = conn.execute(
        """
        SELECT id FROM word
        WHERE edition = ? AND hsk_level = ? AND hanzi = ? AND pinyin = ?
        """,
        (edition, level, hanzi, pinyin),
    ).fetchone()
    if existing:
        return existing[0]
    cur = conn.execute(
        """
        INSERT INTO word (
            edition, hsk_level, source_stt, hanzi, pinyin, pinyin_numeric, pinyin_plain
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (edition, level, source_stt, hanzi, pinyin, numeric, plain),
    )
    return int(cur.lastrowid)


def insert_sense(
    conn: sqlite3.Connection,
    word_id: int,
    sort_order: int,
    part_of_speech: str | None,
    meaning_vi: str | None,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO sense (word_id, sort_order, part_of_speech, meaning_vi)
        VALUES (?, ?, ?, ?)
        """,
        (word_id, sort_order, part_of_speech, meaning_vi),
    )
    return int(cur.lastrowid)


def insert_example(
    conn: sqlite3.Connection,
    sense_id: int,
    sort_order: int,
    hanzi: str | None,
    pinyin: str | None,
    translation_vi: str | None,
) -> None:
    if not hanzi and not pinyin and not translation_vi:
        return
    conn.execute(
        """
        INSERT INTO example (sense_id, sort_order, hanzi, pinyin, translation_vi)
        VALUES (?, ?, ?, ?, ?)
        """,
        (sense_id, sort_order, hanzi, pinyin, translation_vi),
    )


def import_v2(conn: sqlite3.Connection, xlsx: pd.ExcelFile) -> None:
    for sheet, level in V2_SHEETS.items():
        df = pd.read_excel(xlsx, sheet_name=sheet)
        df.columns = [str(c).strip() for c in df.columns]
        cols = list(df.columns)
        hanzi_col = find_col(cols, lambda c: c == "Từ mới")
        pinyin_col = find_col(cols, lambda c: c == "Phiên âm")
        meaning_col = find_col(cols, lambda c: c == "Giải thích")
        ex_hanzi_col = find_col(cols, lambda c: "Ví dụ" in c)
        ex_pinyin_col = find_col(
            cols,
            lambda c: c in {"Phiên âm 2", "Phiên âm.1"},
        )
        trans_col = find_col(cols, lambda c: c == "Dịch")
        stt_col = find_col(cols, lambda c: c == "STT")
        if not all([hanzi_col, pinyin_col, meaning_col]):
            raise RuntimeError(f"Missing required columns on {sheet}: {cols}")

        for _, row in df.iterrows():
            hanzi = cell_str(row[hanzi_col])
            pinyin = cell_str(row[pinyin_col])
            if not hanzi or not pinyin:
                continue
            pinyin = collapse_spaces(pinyin)
            word_id = upsert_word(
                conn,
                "2.0",
                level,
                cell_int(row[stt_col]) if stt_col else None,
                hanzi,
                pinyin,
            )
            sense_id = insert_sense(
                conn,
                word_id,
                0,
                None,
                cell_str(row[meaning_col]),
            )
            insert_example(
                conn,
                sense_id,
                0,
                cell_str(row[ex_hanzi_col]) if ex_hanzi_col else None,
                cell_str(row[ex_pinyin_col]) if ex_pinyin_col else None,
                cell_str(row[trans_col]) if trans_col else None,
            )


def split_v3_examples(raw: str | None) -> list[str]:
    if not raw:
        return []
    parts = [part.strip() for part in raw.split("/")]
    return [part for part in parts if part]


def import_v3(conn: sqlite3.Connection, xlsx: pd.ExcelFile) -> None:
    for sheet, level in V3_SHEETS.items():
        df = pd.read_excel(xlsx, sheet_name=sheet, header=2)
        df.columns = [str(c).strip() for c in df.columns]
        last_hanzi = last_pinyin = None
        last_stt = None
        last_word_id = None
        sense_order = 0

        for _, row in df.iterrows():
            hanzi = cell_str(row.get("TỪ MỚI"))
            pinyin = cell_str(row.get("PHIÊN ÂM"))
            pos = cell_str(row.get("TỪ LOẠI"))
            meaning = cell_str(row.get("NGHĨA"))
            examples = cell_str(row.get("VÍ DỤ"))
            stt = cell_int(row.get("STT"))

            if hanzi:
                last_hanzi = hanzi
                last_pinyin = collapse_spaces(pinyin) if pinyin else last_pinyin
                last_stt = stt if stt is not None else last_stt
                last_word_id = None
                sense_order = 0
            elif pos or meaning:
                if not last_hanzi or not last_pinyin:
                    continue
            else:
                continue

            if not last_hanzi or not last_pinyin:
                continue

            if last_word_id is None:
                last_word_id = upsert_word(
                    conn, "3.0", level, last_stt, last_hanzi, last_pinyin
                )

            sense_id = insert_sense(conn, last_word_id, sense_order, pos, meaning)
            for i, ex in enumerate(split_v3_examples(examples)):
                insert_example(conn, sense_id, i, ex, None, None)
            sense_order += 1


def main() -> int:
    if not XLSX.exists():
        print(f"Missing workbook: {XLSX}", file=sys.stderr)
        return 1
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    try:
        load_schema(conn)
        xlsx = pd.ExcelFile(XLSX)
        import_v2(conn, xlsx)
        import_v3(conn, xlsx)
        conn.commit()

        v2 = conn.execute("SELECT COUNT(*) FROM word WHERE edition = '2.0'").fetchone()[0]
        v3 = conn.execute("SELECT COUNT(*) FROM word WHERE edition = '3.0'").fetchone()[0]
        senses = conn.execute("SELECT COUNT(*) FROM sense").fetchone()[0]
        print(f"Imported words 2.0={v2} 3.0={v3} senses={senses} -> {DB_PATH}")
        ba = conn.execute(
            """
            SELECT w.hanzi, w.pinyin, s.part_of_speech, s.meaning_vi
            FROM word w JOIN sense s ON s.word_id = w.id
            WHERE w.edition = '3.0' AND w.hanzi = '把'
            """
        ).fetchall()
        print("把 senses:", ba)
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
