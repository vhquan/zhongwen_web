import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchWords, postProgress } from "../api";
import { StrokeAnimation } from "../components/StrokeAnimation";
import { WordDetails } from "../components/WordDetails";
import { checkPinyin } from "../pinyin";
import type { StudyMode, Word } from "../types";

type DictationResult = null | "correct" | "wrong" | "revealed" | "unknown";
type Gif = { embed: string; title: string };

const MAX_FAILS = 3;

const SUCCESS_GIFS: Gif[] = [
  { embed: "https://giphy.com/embed/l2Sq5GffrCyUMEXjW", title: "celebration" },
  { embed: "https://giphy.com/embed/tIeCLkB8geYtW", title: "shaun the sheep" },
  { embed: "https://giphy.com/embed/26tknCqiJrBQG6bxC", title: "debate clap" },
  { embed: "https://giphy.com/embed/rkAzGXnC7gogtbhY5L", title: "cute cat" },
  { embed: "https://giphy.com/embed/ummeQH0c3jdm2o3Olp", title: "bingo" },
  { embed: "https://giphy.com/embed/E99OMc6pkdvGw", title: "snl" },
  { embed: "https://giphy.com/embed/yJFeycRK2DB4c", title: "happy" },
  { embed: "https://giphy.com/embed/IcJ6n6VJNjRNS", title: "dancing cat" },
  { embed: "https://giphy.com/embed/KnK7ZMiTmgcxnod3nA", title: "yes" },
  { embed: "https://giphy.com/embed/gZFHLPFHNpjwaondsz", title: "good vibes" },
  { embed: "https://giphy.com/embed/A0Zt7yuDULiy4ofmVD", title: "happy cat" },
  { embed: "https://giphy.com/embed/2wuzQFlpBSpZnyRgy3", title: "surprised kid" },
  { embed: "https://giphy.com/embed/mBcAMbc1Nu3UDYd9l4", title: "sus cat" },
  { embed: "https://giphy.com/embed/PdZj33WnsGgV5lo5vU", title: "sticker" },
];

function pickGif(gifs: Gif[]): Gif {
  return gifs[Math.floor(Math.random() * gifs.length)];
}

const UNKNOWN_GIFS: Gif[] = [
  { embed: "https://giphy.com/embed/pCL5Jri5hwA1TluGep", title: "dog drawing" },
  { embed: "https://giphy.com/embed/oqbf0ikONmtxrjsQnD", title: "write that down" },
  { embed: "https://giphy.com/embed/8dYmJ6Buo3lYY", title: "baby reading" },
  { embed: "https://giphy.com/embed/xUXCTpkqwLeh2SrZ4T", title: "kid learning" },
  { embed: "https://giphy.com/embed/dvtl5jBWB35pC", title: "writers block" },
  { embed: "https://giphy.com/embed/NFA61GS9qKZ68", title: "reading" },
];

const FAIL_GIFS: Record<number, Gif> = {
  1: { embed: "https://giphy.com/embed/ZJieMJ372LLjXsInfV", title: "side-eye sad cat" },
  2: { embed: "https://giphy.com/embed/f54Or4wFysQ7vVGeKb", title: "angry cat" },
};

const REVEAL_GIF: Gif = {
  embed: "https://giphy.com/embed/eEg1ziKuWI9m9jVv2a",
  title: "sad cat",
};

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
  const [result, setResult] = useState<DictationResult>(null);
  const [failCount, setFailCount] = useState(0);
  const [successGif, setSuccessGif] = useState<Gif | null>(null);
  const [unknownGif, setUnknownGif] = useState<Gif | null>(null);
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
        setResult(null);
        setFailCount(0);
        setSuccessGif(null);
        setUnknownGif(null);
        setShowHint(false);
      })
      .catch((err: Error) => setError(err.message));
  }, [edition, level]);

  const word = words[index];
  const remaining = useMemo(() => Math.max(words.length - index, 0), [words.length, index]);
  const locked = result === "correct" || result === "revealed" || result === "unknown";

  function nextCard() {
    setIndex((current) => current + 1);
    setFlipped(false);
    setAnswer("");
    setResult(null);
    setFailCount(0);
    setSuccessGif(null);
    setUnknownGif(null);
    setShowHint(false);
  }

  async function record(review: "correct" | "wrong") {
    if (!word || busy) return;
    setBusy(true);
    try {
      await postProgress(word.id, studyMode, review);
      nextCard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setBusy(false);
    }
  }

  async function markUnknown() {
    if (!word || busy || locked) return;
    setUnknownGif(pickGif(UNKNOWN_GIFS));
    setResult("unknown");
    setBusy(true);
    try {
      await postProgress(word.id, "dictation", "wrong");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save progress");
    } finally {
      setBusy(false);
    }
  }

  async function submitDictation(event: FormEvent) {
    event.preventDefault();
    if (!word) return;
    if (locked) {
      nextCard();
      return;
    }
    if (!answer.trim() || busy) return;
    const ok = checkPinyin(answer, word, ignoreTones);
    if (ok) {
      setSuccessGif(pickGif(SUCCESS_GIFS));
      setResult("correct");
      setBusy(true);
      try {
        await postProgress(word.id, "dictation", "correct");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save progress");
      } finally {
        setBusy(false);
      }
      return;
    }
    const nextFails = failCount + 1;
    setFailCount(nextFails);
    if (nextFails >= MAX_FAILS) {
      setResult("revealed");
      setBusy(true);
      try {
        await postProgress(word.id, "dictation", "wrong");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save progress");
      } finally {
        setBusy(false);
      }
      return;
    }
    setResult("wrong");
  }

  if (studyMode !== "flashcard" && studyMode !== "dictation") {
    return <main className="page">Unknown study mode.</main>;
  }

  const dictationClass = [
    "card",
    result === "correct" ? "feedback-ok" : "",
    result === "wrong" || result === "revealed" || result === "unknown" ? "feedback-wrong" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const reactionGif =
    result === "correct"
      ? successGif
      : result === "unknown"
        ? unknownGif
        : result === "revealed"
          ? REVEAL_GIF
          : FAIL_GIFS[failCount];

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
        <section className={dictationClass}>
          <p className="prompt-hanzi">{word.hanzi}</p>
          {result === "correct" ? (
            <div className="result-banner result-banner--ok" role="status">
              Correct
            </div>
          ) : null}
          {result === "wrong" || result === "revealed" ? (
            <div className="result-banner result-banner--bad" role="status">
              Wrong
            </div>
          ) : null}
          <form className="dictation" onSubmit={submitDictation}>
            <label>
              Type pinyin
              <input
                autoFocus
                value={answer}
                onChange={(event) => {
                  setAnswer(event.target.value);
                  if (result === "wrong") setResult(null);
                }}
                readOnly={locked}
                className={
                  result === "correct"
                    ? "input-ok"
                    : result === "wrong" || result === "revealed" || result === "unknown"
                      ? "input-wrong"
                      : undefined
                }
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
            {locked ? (
              <button type="submit" className="button">
                Next
              </button>
            ) : (
              <button type="submit" className="button" disabled={busy || !answer.trim()}>
                Check
              </button>
            )}
            {!locked ? (
              <button type="button" className="button secondary" disabled={busy} onClick={markUnknown}>
                Don't know
              </button>
            ) : null}
          </form>
          <div className="actions">
            <button type="button" className="ghost" onClick={() => setShowHint((value) => !value)}>
              {showHint ? "Hide strokes" : "Show stroke hint"}
            </button>
          </div>
          {showHint ? <StrokeAnimation hanzi={word.hanzi} /> : null}
          {reactionGif ? (
            <div className="tease-row">
              <div className="tease-gif">
                <iframe src={reactionGif.embed} title={reactionGif.title} allowFullScreen />
              </div>
              {result === "revealed" ? <p className="tease">你真傻，答案是</p> : null}
            </div>
          ) : null}
          {result === "correct" || result === "revealed" || result === "unknown" ? (
            <WordDetails word={word} />
          ) : null}
        </section>
      )}
    </main>
  );
}
