import { buildDebugSnapshot } from "../../lib/ddi-debug";

export default {
  shouldRender() {
    return settings.ddi_debug_mode_enabled;
  },

  setupComponent(args, component) {
    const snapshot = buildDebugSnapshot(args.model);

    if (!snapshot) {
      return;
    }

    component.setProperties({
      documentId: snapshot.documentId,
      topicId: snapshot.topicId,
      category: snapshot.category,
      classification: snapshot.classification,
      detectedTags: snapshot.tags.length
        ? snapshot.tags.join(", ")
        : "None detected",
      revision: snapshot.revision,
      wordCount: snapshot.wordCount,
      readingTime: snapshot.readingTime,
    });
  },
};
