export async function getRelatedTopics(categoryId) {
  const response = await fetch(`/c/${categoryId}.json`);

  if (!response.ok) {
    throw new Error("Failed to fetch related topics.");
  }

  return response.json();
}
