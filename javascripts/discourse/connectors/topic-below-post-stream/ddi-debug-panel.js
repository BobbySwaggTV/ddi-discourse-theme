import { getOwner } from "@ember/owner";

export default {
  shouldRender() {
    return settings.ddi_debug_mode_enabled;
  },

  setupComponent(args, component) {
    const topic = args.model;

    const metadata = getOwner(component)
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    if (!metadata) {
      return;
    }

    component.setProperties({
      documentId: metadata.documentNumber,
      topicId: topic.id,
      category: metadata.category,
      classification: metadata.classification,
      detectedTags: metadata.tags.length
        ? metadata.tags.join(", ")
        : "None detected",
      revision: metadata.revision,
      wordCount: metadata.wordCount,
      readingTime: metadata.readingTime,
    });
  },
};
