import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    function updateDocument(topic) {
      if (!topic) {
        return;
      }

      const metadata = getOwner(component)
        .lookup("service:ddi-document-metadata")
        .getMetadata(topic);

      component.setProperties({
        author: metadata.author,
        status: metadata.status,
        classification: metadata.classification,
        classificationClass: metadata.classificationClass,
      });
    }

    updateDocument(args.model);
  },
};