import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchWords, postProgress } from "../api";
import { StrokeAnimation } from "../components/StrokeAnimation";
import { WordDetails } from "../components/WordDetails";
import { checkPinyin } from "../pinyin";
import type { StudyMode, Word } from "../types";

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function SessionPage() {
  const { edition, level, mode } = useParams();
  const studyMode = mode as StudyMode;
  const [words, setWords] = useState<Word[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answer, setAnswer] = useState("");
  const [ignoreTones, setIgnoreTones] = useState(false);
  const [checked, setChecked] = useState<null | boolean>(null);
  const [showHint, setShowHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!edition || !level) return;
    fetchWords(edition, Number(level))
      .then((rows) => {
        setWords(shuffle(rows));
        setIndex(0);
        setFlipped(false);
        setAnswer("");
        setChecked(null);
        setShowHint(false);
      })
      .catch((err: Error) => setError(err.message));
  }, [edition, level]);

  const word = words[index];
  const remaining = useMemo(() => Math.max(words.length - index, 0), [words.length, index]);

  function nextCard() {
    setIndex((current) => current + 1);
    setFlipped(false);
    setAnswer("");
    setChecked(null);
    setShowHint(false);
  }

  async function record(result: "correct" | "wrong") {
    if (!word || busy) return;
    setBusy(true);
    try {
      await postProgress(word.id, studyMode, result);
      nextCard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setBusy(false);
    }
  }

  async function submitDictation(event: FormEvent) {
    event.preventDefault();
    if (!word || checked !== null) return;
    const ok = checkPinyin(answer, word, ignoreTones);
    setChecked(ok);
    setBusy(true);
    try {
      await postProgress(word.id, "dictation", ok ? "correct" : "wrong");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setBusy(false);
    }
  }

  if (studyMode !== "flashcard" && studyMode !== "dictation") {
    return <main className="page">Unknown study mode.</main>;
  }

  return (
    <main className="page">
      <p>
        <Link to={`/edition/${edition}`}>HSK {edition}</Link>
      </p>
      <header className="session-head">
        <div>
          <p className="eyebrow">
            HSK {edition} · Level {level} · {studyMode === "flashcard" ? "Flashcards" : "Dictation"}
          </p>
          <h1>{word ? word.hanzi : "Session complete"}</h1>
        </div>
        <p className="count">{remaining} left</p>
      </header>
      {error ? <p className="error">{error}</p> : null}

      {!word ? (
        <section className="card">
          <p>You finished this deck. Progress is saved in the local database.</p>
          <Link className="button" to={`/edition/${edition}`}>
            Back to levels
          </Link>
        </section>
      ) : studyMode === "flashcard" ? (
        <section className="card">
          <StrokeAnimation hanzi={word.hanzi} />
          {flipped ? <WordDetails word={word} /> : <p className="muted">Flip to see pinyin and meaning.</p>}
          <div className="actions">
            {!flipped ? (
              <button type="button" className="button" onClick={() => setFlipped(true)}>
                Show answer
              </button>
            ) : (
              <>
                <button type="button" className="button secondary" disabled={busy} onClick={() => record("wrong")}>
                  Again
                </button>
                <button type="button" className="button" disabled={busy} onClick={() => record("correct")}>
                  Got it
                </button>
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="card">
          <p className="prompt-hanzi">{word.hanzi}</p>
          <form className="dictation" onSubmit={submitDictation}>
            <label>
              Type pinyin
              <input
                autoFocus
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                disabled={checked !== null}
                placeholder="nǐ / ni3 / ni"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={ignoreTones}
                onChange={(event) => setIgnoreTones(event.target.checked)}
              />
              Ignore tones
            </label>
            {checked === null ? (
              <button type="submit" className="button" disabled={busy || !answer.trim()}>
                Check
              </button>
            ) : (
              <button type="button" className="button" onClick={nextCard}>
                Next
              </button>
            )}
          </form>
          {checked !== null ? (
            <p className={checked ? "ok" : "error"}>{checked ? "Correct" : "Not quite"}</p>
          ) : null}
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setShowHint((value) => !value)}>
              {showHint ? "Hide strokes" : "Show stroke hint"}
            </button>
          </div>
          {showHint || checked !== null ? (
            <>
              {showHint ? <StrokeAnimation hanzi={word.hanzi} /> : null}
              {checked !== null ? <WordDetails word={word} /> : null}
            </>
          ) : null}
        </section>
      )}
    </main>
  );
}
