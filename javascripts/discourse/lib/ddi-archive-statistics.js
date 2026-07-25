function countBy(documents, keyFn) {
  const counts = new Map();

  for (const document of documents || []) {
    const key = keyFn(document);

    if (!key) {
      continue;
    }

    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function countByDepartment(documents) {
  return countBy(documents, (document) => document.department);
}

export function countByDocumentType(documents) {
  return countBy(documents, (document) => document.documentTypeLabel);
}

export function countByClassification(documents) {
  return countBy(documents, (document) => document.classification);
}

export function selectRecentlyUpdated(documents, limit) {
  return [...(documents || [])]
    .filter((document) => document.updatedAt)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, limit);
}

export function buildArchiveStatistics(documents, recentLimit) {
  const safeDocuments = documents || [];

  return {
    totalDocuments: safeDocuments.length,
    departments: countByDepartment(safeDocuments),
    documentTypes: countByDocumentType(safeDocuments),
    classifications: countByClassification(safeDocuments),
    recentlyUpdated: selectRecentlyUpdated(safeDocuments, recentLimit),
  };
}
