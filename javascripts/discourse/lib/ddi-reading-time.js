export function analyzeReadingTime(cooked) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(cooked || "", "text/html");
  const text = doc.body.textContent.trim();

  const wordCount = text ? text.split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return { wordCount, readingTime };
}
