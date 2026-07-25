import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    const topic = args.model;

    const metadata = getOwner(component)
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    component.setProperties({
      documentId: metadata.documentNumber,
      classification: metadata.classification,
      classificationClass: metadata.classificationClass,
      revision: metadata.revision,
      department: metadata.departmentDisplay,
      lastUpdated: metadata.updatedDate,
      author: metadata.author,
    });
  },
};
