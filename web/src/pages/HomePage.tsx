import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { fetchEditions } from "../api";
import type { Edition } from "../types";

export function HomePage() {
  const [editions, setEditions] = useState<Edition[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEditions().then(setEditions).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main className="page">
      <header>
        <p className="eyebrow">HSK Vocabulary Trainer</p>
        <h1>Choose an HSK edition</h1>
        <p className="lede">
          Version 2.0 and 3.0 stay in separate catalogs. Flashcards, pinyin dictation, and
          stroke animation all read from the local SQLite file.
        </p>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <section className="edition-grid">
        {editions.map((edition) => {
          const total = edition.levels.reduce((sum, item) => sum + item.wordCount, 0);
          return (
            <Link key={edition.code} className="card-link" to={`/edition/${edition.code}`}>
              <h2>HSK {edition.code}</h2>
              <p>
                Levels {edition.levels[0]?.level}–{edition.levels.at(-1)?.level}
              </p>
              <p className="count">{total} words</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
