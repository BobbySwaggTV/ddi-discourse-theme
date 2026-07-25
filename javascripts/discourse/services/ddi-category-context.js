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
    // full reload) to /categories, which has no single category of its own.
    // The route check must win over whatever the controller happens to hold.
    if (this.isCategoriesIndexRoute()) {
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
