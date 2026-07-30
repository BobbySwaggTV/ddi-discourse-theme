import Service from "@ember/service";
import { getOwner } from "@ember/owner";

const CATEGORIES_INDEX_ROUTE_NAME = "discovery.categories";

export default class DdiCategoryContextService extends Service {
  isCategoriesIndexRoute() {
    return (
      getOwner(this).lookup("service:router").currentRouteName ===
      CATEGORIES_INDEX_ROUTE_NAME
    );
  }

  getCurrentDepartment() {
    return this.getCurrentCategory()?.name || null;
  }

  getCurrentCategory() {
    // controller:discovery/category is an Ember singleton — its .category can
    // still hold the last-viewed division after navigating (client-side, no
    // full reload) away from a category page, whether to /categories (no
    // single category of its own) or all the way back to the homepage
    // (no category at all). The route check must win over whatever the
    // controller happens to hold in both cases — checking only the first
    // let the second slip through, since a category page's own route name
    // (`discovery.category*`) was never actually confirmed before trusting
    // the controller.
    const currentRouteName = getOwner(this).lookup("service:router")
      .currentRouteName;

    if (
      this.isCategoriesIndexRoute() ||
      !currentRouteName?.startsWith("discovery.category")
    ) {
      return null;
    }

    try {
      return (
        getOwner(this).lookup("controller:discovery/category")?.category ||
        null
      );
    } catch {
      return null;
    }
  }
}
