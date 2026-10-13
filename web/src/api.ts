import type { Edition, ReviewResult, Stats, StudyMode, Word } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchEditions() {
  return request<Edition[]>("/api/editions");
}

export function fetchWords(edition: string, level: number) {
  return request<Word[]>(`/api/words?edition=${encodeURIComponent(edition)}&level=${level}`);
}

export function fetchStats(edition: string, level: number) {
  return request<Stats>(`/api/stats?edition=${encodeURIComponent(edition)}&level=${level}`);
}

export function postProgress(wordId: number, mode: StudyMode, result: ReviewResult) {
  return request(`/api/progress`, {
    method: "POST",
    body: JSON.stringify({ wordId, mode, result }),
  });
}
