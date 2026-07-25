import { parseCookedHtml } from "./ddi-cooked-parser";

export function analyzeReadingTime(cooked) {
  const doc = parseCookedHtml(cooked);
  const text = doc.body.textContent.trim();

  const wordCount = text ? text.split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return { wordCount, readingTime };
}
