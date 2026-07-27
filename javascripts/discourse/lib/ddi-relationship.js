import { findDocumentReferences } from "./ddi-cross-reference";

export const RELATIONSHIP_TYPES = Object.freeze([
  "References",
  "Supersedes",
  "Superseded By",
  "Related Intelligence",
  "Required Reading",
  "Supporting Documentation",
]);

const TYPE_ALTERNATION = RELATIONSHIP_TYPES.map((type) =>
  type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
).join("|");

const RELATIONSHIP_LINE_PATTERN = new RegExp(
  `^\\s*(${TYPE_ALTERNATION})\\s*:\\s*(.+)$`,
  "gim"
);

export function findDocumentRelationships(text) {
  if (!text) {
    return [];
  }

  const relationships = [];

  for (const match of text.matchAll(RELATIONSHIP_LINE_PATTERN)) {
    const type = RELATIONSHIP_TYPES.find(
      (candidate) => candidate.toLowerCase() === match[1].toLowerCase()
    );

    findDocumentReferences(match[2]).forEach((reference) => {
      relationships.push({ type, documentId: reference.documentId });
    });
  }

  return relationships;
}
