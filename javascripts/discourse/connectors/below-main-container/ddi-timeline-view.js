import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";
import { groupDocumentsByYear } from "../../lib/ddi-timeline-view";

export default {
  shouldRender() {
    return settings.ddi_timeline_view_enabled;
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
      years: [],
    });

    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex(department ? { department } : {})
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        const years = groupDocumentsByYear(documents).map((entry, index) => ({
          ...entry,
          isExpanded: index === 0,
        }));

        component.setProperties({ isLoading: false, years });
      });
  },

  actions: {
    toggleYear(year) {
      const years = this.years.map((entry) =>
        entry.year === year
          ? { ...entry, isExpanded: !entry.isExpanded }
          : entry
      );

      this.set("years", years);
    },
  },
};
