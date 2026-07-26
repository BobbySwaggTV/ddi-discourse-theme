import { getOwner } from "@ember/owner";

export default {
  shouldRender(args, component) {
    if (!settings.ddi_integrity_dashboard_enabled) {
      return false;
    }

    const currentUser = getOwner(component).lookup("service:current-user");

    return Boolean(currentUser?.staff);
  },

  setupComponent(args, component) {
    component.set(
      "ddiIntegrityDashboard",
      getOwner(component).lookup("service:ddi-integrity-dashboard")
    );
  },

  actions: {
    open() {
      this.ddiIntegrityDashboard.open();
    },

    close() {
      this.ddiIntegrityDashboard.close();
    },
  },
};
