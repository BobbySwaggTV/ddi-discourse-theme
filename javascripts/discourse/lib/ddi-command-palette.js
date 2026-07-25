const MAX_DOCUMENT_RESULTS = 8;
const MAX_DEPARTMENT_RESULTS = 6;

function matchesQuery(text, query) {
  return (text || "").toLowerCase().includes(query);
}

export function filterDocumentsByQuery(documents, query) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return [];
  }

  return (documents || [])
    .filter(
      (document) =>
        matchesQuery(document.title, normalized) ||
        matchesQuery(document.documentId, normalized) ||
        matchesQuery(document.department, normalized) ||
        matchesQuery(document.classification, normalized) ||
        matchesQuery(document.documentTypeLabel, normalized)
    )
    .slice(0, MAX_DOCUMENT_RESULTS);
}

export function filterDepartmentsByQuery(departments, query) {
  const normalized = query.trim().toLowerCase();

  const matches = normalized
    ? (departments || []).filter((department) =>
        matchesQuery(department.name, normalized)
      )
    : departments || [];

  return matches.slice(0, MAX_DEPARTMENT_RESULTS);
}
