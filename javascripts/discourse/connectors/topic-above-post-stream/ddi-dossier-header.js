export default {
  setupComponent(args, component) {

    function updateDocument(topic) {

      if (!topic) {
        return;
      }

      const documentId = String(topic.id).padStart(6, "0");

      const issuedDate = new Date(topic.created_at)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();

      const author =
        (args.model.postStream?.posts?.[0]?.username || "SYSTEM").toUpperCase();

      const status = topic.closed ? "LOCKED" : "ACTIVE";

      // DDI Classification Engine
      const tags = topic.tags || [];

      let classification = "PUBLIC RELEASE";
      let classificationClass = "ddi-public";

      const hasTag = (slug) => tags.some(tag => tag.slug === slug);

      if (hasTag("internal")) {
      classification = "INTERNAL";
      classificationClass = "ddi-internal";
    }

      if (hasTag("confidential")) {
      classification = "CONFIDENTIAL";
      classificationClass = "ddi-confidential";
    }

      if (hasTag("restricted")) {
      classification = "RESTRICTED";
      classificationClass = "ddi-restricted";
    }

      if (hasTag("top-secret")) {
      classification = "TOP SECRET";
      classificationClass = "ddi-top-secret";
    }

      component.setProperties({
        documentId,
        issuedDate,
        author,
        status,
        classification,
        classificationClass,
      });
    }

    updateDocument(args.model);

  },
};