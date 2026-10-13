import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchEditions, fetchStats } from "../api";
import type { Edition, EditionCode, Stats } from "../types";

export function EditionPage() {
  const { edition } = useParams();
  const [catalog, setCatalog] = useState<Edition | null>(null);
  const [stats, setStats] = useState<Record<number, Stats>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!edition) return;
    fetchEditions()
      .then((items) => {
        const found = items.find((item) => item.code === edition);
        if (!found) throw new Error("Unknown edition");
        setCatalog(found);
        return Promise.all(
          found.levels.map((level) => fetchStats(found.code, level.level)),
        );
      })
      .then((rows) => {
        const next: Record<number, Stats> = {};
        for (const row of rows) next[row.level] = row;
        setStats(next);
      })
      .catch((err: Error) => setError(err.message));
  }, [edition]);

  if (!edition) return null;

  return (
    <main className="page">
      <p>
        <Link to="/">All editions</Link>
      </p>
      <header>
        <p className="eyebrow">HSK {edition}</p>
        <h1>Choose a level</h1>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <section className="level-list">
        {catalog?.levels.map((level) => {
          const row = stats[level.level];
          const flash = row?.modes.find((mode) => mode.mode === "flashcard");
          const dict = row?.modes.find((mode) => mode.mode === "dictation");
          return (
            <article key={level.level} className="level-card">
              <div>
                <h2>HSK {level.level}</h2>
                <p className="count">{level.wordCount} words</p>
                <p className="muted">
                  Flashcards {flash ? `${flash.accuracy}%` : "—"} · Dictation{" "}
                  {dict ? `${dict.accuracy}%` : "—"}
                </p>
              </div>
              <div className="actions">
                <Link
                  className="button"
                  to={`/edition/${edition as EditionCode}/level/${level.level}/flashcard`}
                >
                  Flashcards
                </Link>
                <Link
                  className="button secondary"
                  to={`/edition/${edition as EditionCode}/level/${level.level}/dictation`}
                >
                  Dictation
                </Link>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
