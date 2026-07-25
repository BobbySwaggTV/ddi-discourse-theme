import { parseCookedHtml } from "./ddi-cooked-parser";

export function getShortDescription(descriptionHtml) {
  const doc = parseCookedHtml(descriptionHtml);
  const firstParagraph = doc.querySelector("p");

  return firstParagraph?.textContent.trim() || null;
}

export function getFullDescriptionText(descriptionHtml) {
  const doc = parseCookedHtml(descriptionHtml);

  return doc.body?.textContent?.trim() || "";
}
