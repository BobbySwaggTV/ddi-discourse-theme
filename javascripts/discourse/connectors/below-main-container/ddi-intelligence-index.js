import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";

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

    const department = owner
      .lookup("service:ddi-category-context")
      .getCurrentDepartment();

    component.setProperties({
      isVisible: true,
      isLoading: true,
      documents: [],
    });

    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex(department ? { department } : {})
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({ isLoading: false, documents });
      });
  },
};
