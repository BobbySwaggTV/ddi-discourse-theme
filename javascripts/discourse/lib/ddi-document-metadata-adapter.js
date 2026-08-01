// Adapts a raw /t/{id}.json payload (snake_case, no resolved category
// object) into the shape services/ddi-document-metadata.js#getMetadata()
// expects from a live Ember Topic model (camelCase `postStream`, a
// resolved `category` object) — shape translation only, none of the
// Metadata Engine's own resolution/validation logic is reimplemented here.
// Previously duplicated near-verbatim as a private `_adaptTopic()` method
// in both services/ddi-integrity-dashboard.js and
// services/ddi-reading-lists.js; both now call this instead.
export function adaptRawTopic(topic, categories) {
  return {
    id: topic.id,
    title: topic.title,
    tags: topic.tags || [],
    created_at: topic.created_at,
    closed: topic.closed,
    category: (categories || []).find((c) => c.id === topic.category_id) || null,
    postStream: { posts: topic.post_stream?.posts || [] },
  };
}
