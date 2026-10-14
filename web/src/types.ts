export type EditionCode = "2.0" | "3.0";
export type StudyMode = "flashcard" | "dictation";
export type ReviewResult = "correct" | "wrong";

export type EditionLevel = {
  level: number;
  wordCount: number;
};

export type Edition = {
  code: EditionCode;
  levels: EditionLevel[];
};

export type Example = {
  id: number;
  hanzi: string | null;
  pinyin: string | null;
  translationVi: string | null;
};

export type Sense = {
  id: number;
  partOfSpeech: string | null;
  meaningVi: string | null;
  examples: Example[];
};

export type ModeProgress = {
  seenCount: number;
  correctCount: number;
  wrongCount: number;
  lastResult: ReviewResult | null;
  lastReviewedAt: string | null;
};

export type Word = {
  id: number;
  edition: EditionCode;
  hskLevel: number;
  sourceStt: number | null;
  hanzi: string;
  pinyin: string;
  pinyinNumeric: string;
  pinyinPlain: string;
  hanviet: string | null;
  senses: Sense[];
  progress: {
    flashcard: ModeProgress | null;
    dictation: ModeProgress | null;
  };
};

export type Stats = {
  edition: EditionCode;
  level: number;
  wordCount: number;
  modes: {
    mode: StudyMode;
    reviewed: number;
    correct: number;
    wrong: number;
    accuracy: number;
  }[];
};
