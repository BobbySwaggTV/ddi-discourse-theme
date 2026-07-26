import { getOwner } from "@ember/owner";

export default {
  shouldRender(args, component) {
    if (!settings.ddi_system_status_enabled) {
      return false;
    }

    const currentUser = getOwner(component).lookup("service:current-user");

    return Boolean(currentUser?.staff);
  },

  setupComponent(args, component) {
    const owner = getOwner(component);

    component.setProperties({
      isOpen: false,
      isLoading: false,
      status: null,
      ddiSystemStatus: owner.lookup("service:ddi-system-status"),
      ddiIntegrityDashboard: owner.lookup("service:ddi-integrity-dashboard"),
    });
  },

  actions: {
    open() {
      this.setProperties({ isOpen: true, isLoading: true });

      this.ddiSystemStatus.getStatus().then((status) => {
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        this.setProperties({ isLoading: false, status });
      });
    },

    close() {
      this.setProperties({ isOpen: false });
    },

    openIntegrityDashboard() {
      this.setProperties({ isOpen: false });
      this.ddiIntegrityDashboard.open();
    },
  },
};
