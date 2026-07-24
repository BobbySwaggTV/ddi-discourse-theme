export function formatDocumentDate(date) {
  if (!date) {
    return "UNKNOWN";
  }

  return new Date(date)
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}
