import { getClassification } from "../../lib/ddi-classification";

export default {
  setupComponent(args, component) {
    const topic = args.model;

    const cooked = topic.postStream?.posts?.[0]?.cooked || "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(cooked, "text/html");

    const text = doc.body.textContent.trim();

    const wordCount = text
      ? text.split(/\s+/).length
      : 0;

    const readingTime = Math.max(
      1,
      Math.ceil(wordCount / 200)
    );

    const post = topic.postStream?.posts?.[0];

    const lastRevision = new Date(
      post?.updated_at || post?.created_at
    )
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase();

    const revision =
      "R" + String(post?.version || 1).padStart(2, "0");

    const { classification } = getClassification(topic);

    component.setProperties({
      replies: topic.reply_count ?? 0,
      views: topic.views ?? 0,
      category: topic.category?.name ?? "Uncategorized",
      wordCount,
      readingTime,
      classification,
      lastRevision,
      revision,
    });
  },
};