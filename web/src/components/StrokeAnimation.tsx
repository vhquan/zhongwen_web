import HanziWriter from "hanzi-writer";
import { useEffect, useRef } from "react";
import { hanziCharacters } from "../pinyin";

type Props = {
  hanzi: string;
  size?: number;
};

export function StrokeAnimation({ hanzi, size = 112 }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const writersRef = useRef<HanziWriter[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    host.replaceChildren();
    writersRef.current = [];

    const chars = hanziCharacters(hanzi);
    for (const ch of chars) {
      const target = document.createElement("div");
      target.className = "stroke-cell";
      host.appendChild(target);
      const writer = HanziWriter.create(target, ch, {
        width: size,
        height: size,
        padding: 4,
        strokeAnimationSpeed: 1,
        delayBetweenStrokes: 120,
        delayBetweenLoops: 900,
        strokeColor: "#1f2937",
        outlineColor: "#d6d3d1",
        radicalColor: "#b45309",
        showCharacter: false,
        showOutline: true,
      });
      writer.loopCharacterAnimation();
      writersRef.current.push(writer);
    }

    return () => {
      writersRef.current = [];
      host.replaceChildren();
    };
  }, [hanzi, size]);

  function replay() {
    for (const writer of writersRef.current) {
      writer.loopCharacterAnimation();
    }
  }

  if (hanziCharacters(hanzi).length === 0) {
    return <p className="muted">No hanzi strokes to animate.</p>;
  }

  return (
    <div className="stroke-wrap">
      <div ref={hostRef} className="stroke-row" />
      <button type="button" className="ghost" onClick={replay}>
        Replay strokes
      </button>
    </div>
  );
}
