import Service from "@ember/service";
import { getOwner } from "@ember/owner";

export default class DdiCategoryContextService extends Service {
  getCurrentDepartment() {
    return this._getCurrentCategory()?.name || null;
  }

  _getCurrentCategory() {
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
