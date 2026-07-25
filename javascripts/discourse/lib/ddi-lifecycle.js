export const LIFECYCLE_STATES = Object.freeze([
  "draft",
  "active",
  "under-review",
  "archived",
  "superseded",
]);

const LIFECYCLE_LABELS = Object.freeze({
  draft: "DRAFT",
  active: "ACTIVE",
  "under-review": "REVIEW",
  archived: "ARCHIVED",
  superseded: "DEPRECATED",
});

export function isValidLifecycle(slug) {
  return LIFECYCLE_STATES.includes(slug);
}

export function getLifecycleLabel(slug) {
  return LIFECYCLE_LABELS[slug] || null;
}
