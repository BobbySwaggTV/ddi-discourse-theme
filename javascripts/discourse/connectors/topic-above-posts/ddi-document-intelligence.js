import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    const topic = args.model;

    const metadata = getOwner(component)
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    component.setProperties({
      replies: topic.reply_count ?? 0,
      views: topic.views ?? 0,
      category: metadata.category,
      wordCount: metadata.wordCount,
      readingTime: metadata.readingTime,
      classification: metadata.classification,
      lastRevision: metadata.updatedDate,
      revision: metadata.revision,
    });
  },
};