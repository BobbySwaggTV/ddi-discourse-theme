import { parseDocumentId } from "./ddi-document-id";

const REFERENCE_PATTERN = /\bDDI-\d{6}(?!\d)/g;

export function findDocumentReferences(text) {
  if (!text) {
    return [];
  }

  return [...text.matchAll(REFERENCE_PATTERN)].map((match) => ({
    raw: match[0],
    documentId: parseDocumentId(match[0]),
    index: match.index,
  }));
}

export function linkifyDocumentReferences(text) {
  const references = findDocumentReferences(text);

  if (!references.length) {
    return [{ type: "text", value: text }];
  }

  const segments = [];
  let cursor = 0;

  references.forEach((reference) => {
    if (reference.index > cursor) {
      segments.push({
        type: "text",
        value: text.slice(cursor, reference.index),
      });
    }

    segments.push({
      type: "reference",
      raw: reference.raw,
      documentId: reference.documentId,
    });

    cursor = reference.index + reference.raw.length;
  });

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  return segments;
}
