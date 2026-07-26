// Pure helpers for reading-list data. A reading list stores only document
// *references* (topic ids) — never document content, titles, or any other
// duplicated data; everything displayable is re-resolved through Citation
// Preview / the Metadata Engine each time a list is opened (see
// services/ddi-reading-lists.js).
function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createReadingList({ name, description }) {
  return {
    id: generateId(),
    name: (name || "").trim() || "Untitled Reading List",
    description: (description || "").trim(),
    documentIds: [],
    createdAt: new Date().toISOString(),
  };
}

export function addDocumentToList(list, documentId) {
  if (!list || !documentId || list.documentIds.includes(documentId)) {
    return list;
  }

  return { ...list, documentIds: [...list.documentIds, documentId] };
}

export function removeDocumentFromList(list, documentId) {
  if (!list) {
    return list;
  }

  return {
    ...list,
    documentIds: list.documentIds.filter((id) => id !== documentId),
  };
}

export function computeCompletionProgress(documentIds, recentlyViewedIds) {
  const total = documentIds?.length || 0;

  if (!total) {
    return { completed: 0, total: 0 };
  }

  const viewed = new Set(recentlyViewedIds || []);
  const completed = documentIds.filter((id) => viewed.has(id)).length;

  return { completed, total };
}

export function encodeShareableList(list) {
  const payload = {
    name: list.name,
    description: list.description,
    documentIds: list.documentIds,
  };

  return btoa(encodeURIComponent(JSON.stringify(payload)));
}

export function decodeShareableList(encoded) {
  try {
    const payload = JSON.parse(decodeURIComponent(atob(encoded)));

    if (!Array.isArray(payload?.documentIds)) {
      return null;
    }

    return {
      name: typeof payload.name === "string" ? payload.name : "Shared Reading List",
      description: typeof payload.description === "string" ? payload.description : "",
      documentIds: payload.documentIds.filter((id) => Number.isFinite(id)),
    };
  } catch {
    return null;
  }
}
