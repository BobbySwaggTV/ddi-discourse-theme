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

      // {{action}} is deprecated (discourse.template-action) — replaced with
      // {{on "click" (fn this.toggleYear entry.year)}} in the template.
      // {{on}} doesn't auto-bind `this` the way {{action}} did, so this
      // closes over `component` directly instead (the same pattern used
      // throughout this theme for did-insert/will-destroy handlers, which
      // have the identical no-`this`-guarantee constraint).
      toggleYear: (year) => {
        const years = component.years.map((entry) =>
          entry.year === year
            ? { ...entry, isExpanded: !entry.isExpanded }
            : entry
        );

        component.set("years", years);
      },
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
};
