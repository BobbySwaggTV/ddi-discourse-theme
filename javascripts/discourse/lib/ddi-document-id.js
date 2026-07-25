export function formatDocumentId(id) {
  return `DDI-${String(id).padStart(6, "0")}`;
}

export function parseDocumentId(input) {
  if (!input) {
    return null;
  }

  const match = String(input).match(/^(?:DDI-)?(\d+)$/i);

  if (!match) {
    return null;
  }

  return parseInt(match[1], 10);
}
