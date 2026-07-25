export const LIFECYCLE_STATES = Object.freeze([
  "draft",
  "active",
  "under-review",
  "archived",
  "superseded",
]);

export function isValidLifecycle(slug) {
  return LIFECYCLE_STATES.includes(slug);
}
