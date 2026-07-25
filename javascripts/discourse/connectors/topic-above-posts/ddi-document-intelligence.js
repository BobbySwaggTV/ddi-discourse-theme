import { getClassification } from "../../lib/ddi-classification";
import { analyzeReadingTime } from "../../lib/ddi-reading-time";
import { formatRevision } from "../../lib/ddi-revision";
import { UNCATEGORIZED_LABEL } from "../../lib/ddi-category";

export default {
  setupComponent(args, component) {
    const topic = args.model;
    const post = topic.postStream?.posts?.[0];

    const { wordCount, readingTime } = analyzeReadingTime(post?.cooked);

    const lastRevision = new Date(
      post?.updated_at || post?.created_at
    )
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase();

    const revision = formatRevision(post?.version);

    const { classification } = getClassification(topic);

    component.setProperties({
      replies: topic.reply_count ?? 0,
      views: topic.views ?? 0,
      category: topic.category?.name ?? UNCATEGORIZED_LABEL,
      wordCount,
      readingTime,
      classification,
      lastRevision,
      revision,
    });
  },
};