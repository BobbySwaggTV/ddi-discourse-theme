import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    const metadata = getOwner(component)
      .lookup("service:ddi-document-metadata")
      .getMetadata(args.model);

    component.setProperties({
      timelineEvents: metadata.timeline,
    });
  },
};
