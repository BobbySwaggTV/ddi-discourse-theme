export function formatDocumentId(id) {
  return `DDI-${String(id).padStart(6, "0")}`;
}
