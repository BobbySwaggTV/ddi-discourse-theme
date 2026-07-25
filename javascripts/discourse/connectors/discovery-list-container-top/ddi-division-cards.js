import { getOwner } from "@ember/owner";
import { isValidDepartment } from "../../lib/ddi-department";
import { getShortDescription } from "../../lib/ddi-division-summary";
import { buildArchiveStatistics } from "../../lib/ddi-archive-statistics";

const RECENT_LIMIT = 1;

export default {
  setupComponent(args, component) {
    const owner = getOwner(component);

    if (
      !owner.lookup("service:ddi-category-context").isCategoriesIndexRoute()
    ) {
      component.setProperties({ isVisible: false });
      return;
    }

    const site = owner.lookup("service:site");
    const divisions = (site.categories || []).filter((category) =>
      isValidDepartment(category.slug)
    );

    if (!divisions.length) {
      component.setProperties({ isVisible: false });
      return;
    }

    component.setProperties({
      isVisible: true,
      isLoading: true,
      cards: [],
    });

    const intelligenceIndex = owner.lookup("service:ddi-intelligence-index");

    Promise.all(
      divisions.map((category) =>
        intelligenceIndex
          .getIndex({ department: category.name })
          .then((documents) => {
            const statistics = buildArchiveStatistics(documents, RECENT_LIMIT);

            return {
              id: category.id,
              name: category.name,
              description: getShortDescription(category.description),
              totalDocuments: statistics.totalDocuments,
              lastUpdated: statistics.recentlyUpdated[0]?.updatedDate || "—",
              primaryClassification:
                statistics.classifications[0]?.name || "—",
              url: `/c/${category.slug}/${category.id}`,
            };
          })
      )
    ).then((cards) => {
      if (component.isDestroying || component.isDestroyed) {
        return;
      }

      component.setProperties({ isLoading: false, cards });
    });
  },
};
