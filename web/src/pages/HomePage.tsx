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
        <p className="eyebrow">Illiteracy eradication</p>
        <h1>A modest campaign against staring blankly at Chinese</h1>
        <p className="lede">
          This site exists so 汉字 stop looking like decorative wallpaper. You will flip
          cards, write pinyin, and trace strokes until a character is a word again, not a
          mysterious drawing. That is the whole program: wipe out a little illiteracy each
          day, before it gets too comfortable.
        </p>
        <p className="lede">
          Pick an HSK edition below. We provide the characters. You provide the stubbornness.
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
