function collapseSpaces(text: string): string {
  return text.trim().split(/\s+/).join(" ");
}

function unifyU(text: string): string {
  return text.replace(/u:/gi, "ü").replace(/v/gi, "ü");
}

export function normalizeAnswer(input: string): string {
  return unifyU(collapseSpaces(input.toLowerCase()));
}

export function stripTonesAndNumbers(input: string): string {
  return normalizeAnswer(input)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[1-5]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function compact(input: string): string {
  return stripTonesAndNumbers(input).replace(/\s+/g, "");
}

export function checkPinyin(
  input: string,
  word: { pinyin: string; pinyinNumeric: string; pinyinPlain: string },
  ignoreTones: boolean,
): boolean {
  const typed = normalizeAnswer(input);
  if (!typed) return false;

  const marked = normalizeAnswer(word.pinyin);
  const numeric = normalizeAnswer(word.pinyinNumeric);
  const plain = normalizeAnswer(word.pinyinPlain);

  const typedCompact = typed.replace(/\s+/g, "");
  const markedCompact = marked.replace(/\s+/g, "");
  const numericCompact = numeric.replace(/\s+/g, "");

  if (typed === marked || typedCompact === markedCompact) return true;
  if (typed === numeric || typedCompact === numericCompact) return true;

  if (ignoreTones) {
    return compact(typed) === compact(plain) || compact(typed) === compact(marked);
  }
  return false;
}

export function hanziCharacters(hanzi: string): string[] {
  return Array.from(hanzi).filter((ch) => /\p{Script=Han}/u.test(ch));
}
