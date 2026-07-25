import { formatDocumentId } from "./ddi-document-id";
import { getClassification } from "./ddi-classification";
import { formatRevision } from "./ddi-revision";
import { analyzeReadingTime } from "./ddi-reading-time";
import { UNCATEGORIZED_LABEL } from "./ddi-category";

export function buildDebugSnapshot(topic) {
  if (!topic) {
    return null;
  }

  const post = topic.postStream?.posts?.[0];
  const { classification } = getClassification(topic);
  const { wordCount, readingTime } = analyzeReadingTime(post?.cooked);

  return {
    documentId: formatDocumentId(topic.id),
    topicId: topic.id,
    category: topic.category?.name ?? UNCATEGORIZED_LABEL,
    classification,
    tags: topic.tags || [],
    revision: formatRevision(post?.version),
    wordCount,
    readingTime,
  };
}
