export function sortDocumentsAlphabetically(documents) {
  return [...(documents || [])].sort((a, b) =>
    (a?.title || "").localeCompare(b?.title || "")
  );
}

export function filterDocuments(documents, filters = {}) {
  const { department, classification } = filters;

  return (documents || []).filter((document) => {
    if (department && document.department !== department) {
      return false;
    }

    if (classification && document.classification !== classification) {
      return false;
    }

    return true;
  });
}
