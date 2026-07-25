import { getOwner } from "@ember/owner";

export default {
  setupComponent(args, component) {
    const relationshipService = getOwner(component).lookup(
      "service:ddi-relationship"
    );

    component.setProperties({
      isLoading: true,
      relationships: [],
    });

    relationshipService.getRelationships(args.model).then((relationships) => {
      if (component.isDestroying || component.isDestroyed) {
        return;
      }

      component.setProperties({
        isLoading: false,
        relationships,
      });
    });
  },
};
