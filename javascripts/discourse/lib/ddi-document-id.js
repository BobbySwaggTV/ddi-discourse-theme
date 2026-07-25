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

export function parseTopicIdFromUrl(url) {
  // Handles both /t/{id} and /t/{slug}/{id} (either optionally followed by
  // /{post_number}) — without a slug, the topic id is the segment right
  // after /t/; with one, it's the segment after that. A non-anchored
  // "first digits after an optional slug" match would mis-parse /t/{id}/
  // {post_number} (no slug) by treating {id} itself as the "slug".
  const match = String(url || "").match(
    /\/t\/(?:(\d+)(?=\/|$|\?|#)|[^/]+\/(\d+))/
  );

  if (!match) {
    return null;
  }

  return parseInt(match[1] || match[2], 10);
}
