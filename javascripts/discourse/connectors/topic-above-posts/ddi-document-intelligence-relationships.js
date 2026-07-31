import { getOwner } from "@ember/owner";
import { buildRelationshipGroups } from "../../lib/ddi-intelligence-relationships";

export default {
  shouldRender() {
    return Boolean(settings.ddi_intelligence_relationships_enabled);
  },

  setupComponent(args, component) {
    const topic = args.model;
    const owner = getOwner(component);

    component.setProperties({ isVisible: false, groups: [] });

    if (!topic) {
      return;
    }

    const metadata = owner
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    if (!metadata) {
      return;
    }

    // Both calls are the exact ones Document Relationships and Intelligence
    // Network already made for this topic — services/ddi-relationship.js
    // and services/ddi-related-intelligence.js each cache their result by
    // topic id, so this never triggers a second lookup or a second scoring
    // pass, only reads whatever is already resolved/in flight for the
    // current page view.
    Promise.all([
      owner.lookup("service:ddi-relationship").getRelationships(topic),
      owner.lookup("service:ddi-related-intelligence").findRelated(topic),
    ]).then(([relationships, related]) => {
      if (component.isDestroying || component.isDestroyed) {
        return;
      }

      const groups = buildRelationshipGroups(relationships, related, metadata);

      component.setProperties({
        isVisible: groups.length > 0,
        groups,
      });
    });
  },
};
