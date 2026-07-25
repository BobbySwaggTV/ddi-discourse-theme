import { getOwner } from "@ember/owner";

const EXCLUDED_ROUTE_PREFIXES = ["topic.", "admin"];

function isExcludedRoute(routeName) {
  return EXCLUDED_ROUTE_PREFIXES.some((prefix) =>
    routeName?.startsWith(prefix)
  );
}

export default {
  shouldRender() {
    return settings.ddi_intelligence_index_enabled;
  },

  setupComponent(args, component) {
    const owner = getOwner(component);
    const router = owner.lookup("service:router");

    if (isExcludedRoute(router.currentRouteName)) {
      component.setProperties({ isVisible: false });
      return;
    }

    component.setProperties({
      isVisible: true,
      isLoading: true,
      documents: [],
    });

    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex()
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({ isLoading: false, documents });
      });
  },
};
