import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";
import { parseCookedHtml } from "../../lib/ddi-cooked-parser";
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

    const doc = parseCookedHtml(category.description);
    const paragraphs = [...doc.querySelectorAll("p")];
    const bodyText = doc.body?.textContent?.trim() || "";

    component.setProperties({
      isVisible: true,
      isLoading: true,
      divisionName: category.name,
      divisionDescription: paragraphs[0]?.textContent.trim() || null,
      missionStatement: bodyText || FALLBACK_MISSION_STATEMENT,
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
