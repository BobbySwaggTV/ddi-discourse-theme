import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";
import {
  getShortDescription,
  getFullDescriptionText,
} from "../../lib/ddi-division-summary";
import { buildArchiveStatistics } from "../../lib/ddi-archive-statistics";

const FALLBACK_MISSION_STATEMENT = "No mission statement available.";
const RECENT_LIMIT = 1;

export default {
  setupComponent(args, component) {
    const owner = getOwner(component);
    const router = owner.lookup("service:router");

    if (isExcludedRoute(router.currentRouteName)) {
      component.setProperties({ isVisible: false });
      return;
    }

    const category = owner
      .lookup("service:ddi-category-context")
      .getCurrentCategory();

    if (!category) {
      component.setProperties({ isVisible: false });
      return;
    }

    component.setProperties({
      isVisible: true,
      isLoading: true,
      divisionName: category.name,
      divisionDescription: getShortDescription(category.description),
      missionStatement:
        getFullDescriptionText(category.description) ||
        FALLBACK_MISSION_STATEMENT,
      statistics: null,
      lastUpdated: "—",
    });

    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex({ department: category.name })
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        const statistics = buildArchiveStatistics(documents, RECENT_LIMIT);

        component.setProperties({
          isLoading: false,
          statistics,
          lastUpdated: statistics.recentlyUpdated[0]?.updatedDate || "—",
        });
      });
  },
};
