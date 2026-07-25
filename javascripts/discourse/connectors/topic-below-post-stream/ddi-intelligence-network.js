import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    const relatedIntelligence = getOwner(component).lookup(
      "service:ddi-related-intelligence"
    );

    component.setProperties({
      isLoading: true,
      relatedDocuments: [],
    });

    relatedIntelligence.findRelated(args.model).then((relatedDocuments) => {
      if (component.isDestroying || component.isDestroyed) {
        return;
      }

      component.setProperties({
        isLoading: false,
        relatedDocuments,
      });
    });
  },
};
