import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    const topic = args.model;

    const metadata = getOwner(component)
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    component.setProperties({
      revisionNumber: metadata.revision,
      lastUpdated: metadata.updatedDate,
      author: metadata.author,
      revisionStatus: metadata.status,
      revisionNotes: "No revision notes recorded.",
    });
  },
};
