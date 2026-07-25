export function formatRevision(version) {
  return "R" + String(version || 1).padStart(2, "0");
}
