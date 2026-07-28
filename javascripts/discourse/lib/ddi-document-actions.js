// Pure presentation-shaping for the Document Actions bar's reading-list
// picker — the same "reshape already-fetched data for the template" role
// lib/ddi-timeline-view.js's groupDocumentsByYear() plays for Timeline.
// Reuses ddi-reading-lists.js's own `lists` array (documentIds as numbers,
// see lib/ddi-reading-list.js) unchanged — no new storage, no new document
// lookup, just a membership check per list.
export function buildReadingListOptions(lists, documentId) {
  return (lists || []).map((list) => ({
    id: list.id,
    name: list.name,
    inList: list.documentIds.includes(documentId),
  }));
}
