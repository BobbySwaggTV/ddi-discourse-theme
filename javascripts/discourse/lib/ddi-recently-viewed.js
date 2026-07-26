// Extracted from api-initializers/ddi-command-palette.js (the only
// consumer until Reading Lists needed the same "has this document actually
// been opened" signal for Completion Progress) — behavior unchanged, just
// hoisted so a second consumer doesn't have to duplicate it.
const RECENT_STORAGE_KEY = "ddi-recently-viewed";
const MAX_RECENT = 8;

export function readRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function recordVisit(topic) {
  if (!topic?.id || !topic?.title) {
    return;
  }

  try {
    const existing = readRecentlyViewed().filter(
      (entry) => entry.id !== topic.id
    );
    const updated = [{ id: topic.id, title: topic.title }, ...existing].slice(
      0,
      MAX_RECENT
    );

    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (privacy mode, quota, disabled) — no tracking,
    // not a crash.
  }
}
