// Shared by 7+ call sites (Executive Summary, Document Footer/reading time,
// Document Relationships, Knowledge Graph, Integrity Dashboard, Division
// Header/Cards) — a single-slot memo only helps two *consecutive* calls on
// the exact same string, and in practice these call sites are spread across
// independent connectors/services that don't run back-to-back, so the one
// slot was almost always evicted by someone else's cooked HTML before the
// next same-document call arrived, silently defeating the memo. A real
// cache fixes that; it's kept small and LRU-evicted (not "cache for the
// session" like ddi-document-metadata.js's Map) because the value here is a
// full parsed DOM Document, not a handful of strings — an archive-wide scan
// (Integrity Dashboard) can touch hundreds of documents' cooked HTML in one
// pass, and holding every one of those parsed trees for the rest of the
// session would be a real memory cost for no benefit (each is visited once
// per scan either way). 30 entries comfortably covers one topic page's
// worth of same-document calls plus headroom, without growing unbounded.
const MAX_CACHE_ENTRIES = 30;
const cache = new Map();

export function parseCookedHtml(cooked) {
  const input = cooked || "";

  if (cache.has(input)) {
    // Re-insert to mark as most-recently-used (Map iteration/eviction order
    // follows insertion order, so this is what makes the eviction below LRU
    // rather than FIFO).
    const parsed = cache.get(input);
    cache.delete(input);
    cache.set(input, parsed);

    return parsed;
  }

  const parsed = new DOMParser().parseFromString(input, "text/html");
  cache.set(input, parsed);

  if (cache.size > MAX_CACHE_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }

  return parsed;
}
