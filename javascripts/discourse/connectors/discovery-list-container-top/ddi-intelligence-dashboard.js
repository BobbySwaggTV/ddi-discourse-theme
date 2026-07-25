import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";
import { buildArchiveStatistics } from "../../lib/ddi-archive-statistics";

const RECENT_LIMIT = 5;

export default {
  shouldRender() {
    return settings.ddi_homepage_dashboard_enabled;
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
      statistics: null,
    });

    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex()
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({
          isLoading: false,
          statistics: buildArchiveStatistics(documents, RECENT_LIMIT),
        });
      });
  },
};
