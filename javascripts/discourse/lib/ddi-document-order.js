import { parseDocumentId } from "./ddi-document-id";

function byDocumentNumberAscending(a, b) {
  return parseDocumentId(a.documentId) - parseDocumentId(b.documentId);
}

export function findAdjacentDocuments(documents, currentDocumentId) {
  const sorted = [...(documents || [])].sort(byDocumentNumberAscending);
  const index = sorted.findIndex((doc) => doc.id === currentDocumentId);

  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: index > 0 ? sorted[index - 1] : null,
    next: index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}

export function selectRecentDocuments(documents, currentDocumentId, limit) {
  return [...(documents || [])]
    .filter((doc) => doc.id !== currentDocumentId)
    .sort((a, b) => byDocumentNumberAscending(b, a))
    .slice(0, limit);
}
