export const TIMELINE_EVENT_TYPES = Object.freeze([
  { key: "created", label: "Created" },
  { key: "approved", label: "Approved" },
  { key: "revised", label: "Revised" },
  { key: "reviewed", label: "Reviewed" },
  { key: "deprecated", label: "Deprecated" },
  { key: "archived", label: "Archived" },
]);

const LIFECYCLE_TIMELINE_EVENT = Object.freeze({
  active: "approved",
  "under-review": "reviewed",
  superseded: "deprecated",
  archived: "archived",
});

export function buildTimeline(metadata) {
  if (!metadata) {
    return [];
  }

  const eventDates = { created: metadata.createdDate };

  if (metadata.updatedDate && metadata.updatedDate !== metadata.createdDate) {
    eventDates.revised = metadata.updatedDate;
  }

  const lifecycleEvent = LIFECYCLE_TIMELINE_EVENT[metadata.lifecycle];
  if (lifecycleEvent) {
    eventDates[lifecycleEvent] = metadata.updatedDate;
  }

  return TIMELINE_EVENT_TYPES.filter((type) => eventDates[type.key]).map(
    (type) => ({
      key: type.key,
      label: type.label,
      date: eventDates[type.key],
    })
  );
}
