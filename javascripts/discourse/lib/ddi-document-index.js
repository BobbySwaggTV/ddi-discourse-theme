export function sortDocumentsAlphabetically(documents) {
  return [...(documents || [])].sort((a, b) =>
    (a?.title || "").localeCompare(b?.title || "")
  );
}

export function filterDocuments(documents, filters = {}) {
  const { department, classification, approvalState, lifecycle } = filters;

  return (documents || []).filter((document) => {
    if (department && document.department !== department) {
      return false;
    }

    if (classification && document.classification !== classification) {
      return false;
    }

    if (approvalState && document.approvalState !== approvalState) {
      return false;
    }

    if (lifecycle && document.lifecycle !== lifecycle) {
      return false;
    }

    return true;
  });
}
