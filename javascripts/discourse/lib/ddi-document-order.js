function byCreatedAtAscending(a, b) {
  return new Date(a.created_at) - new Date(b.created_at);
}

export function findAdjacentDocuments(topics, currentTopicId) {
  const sorted = [...(topics || [])].sort(byCreatedAtAscending);
  const index = sorted.findIndex((topic) => topic.id === currentTopicId);

  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: index > 0 ? sorted[index - 1] : null,
    next: index < sorted.length - 1 ? sorted[index + 1] : null,
  };
}

export function selectRecentDocuments(topics, currentTopicId, limit) {
  return [...(topics || [])]
    .filter((topic) => topic.id !== currentTopicId)
    .sort((a, b) => byCreatedAtAscending(b, a))
    .slice(0, limit);
}
