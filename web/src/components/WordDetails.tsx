import type { Word } from "../types";

export function WordDetails({ word }: { word: Word }) {
  return (
    <div className="details">
      <p className="pinyin">{word.pinyin}</p>
      <ul className="senses">
        {word.senses.map((sense) => (
          <li key={sense.id}>
            {sense.partOfSpeech ? <span className="pos">{sense.partOfSpeech}</span> : null}
            <span>{sense.meaningVi || "—"}</span>
            {sense.examples.length > 0 ? (
              <ul className="examples">
                {sense.examples.map((example) => (
                  <li key={example.id}>
                    {example.hanzi ? <div className="ex-hanzi">{example.hanzi}</div> : null}
                    {example.pinyin ? <div className="muted">{example.pinyin}</div> : null}
                    {example.translationVi ? (
                      <div className="muted">{example.translationVi}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
