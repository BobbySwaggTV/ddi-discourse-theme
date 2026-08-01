// Builds one `.ddi-search-badge` element — a plain DOM builder, since both
// call sites (Search Results, Document Quick Preview) mutate the live DOM
// directly rather than rendering through Ember. Previously duplicated
// verbatim in both api-initializers; both now import this instead.
export function createBadge(text, extraClass) {
  const badge = document.createElement("span");

  badge.className = extraClass
    ? `ddi-search-badge ${extraClass}`
    : "ddi-search-badge";
  badge.textContent = text;

  return badge;
}
