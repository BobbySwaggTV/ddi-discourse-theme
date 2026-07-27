import { getOwner } from "@ember/owner";
import { createModal } from "../../lib/ddi-modal";

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

      // Same free-function pattern as the Integrity Dashboard connector —
      // see its setupModal for why these can't be `this`-bound methods.
      // isOpen lives on this component (not a service), so onClose closes
      // it via the component directly rather than a service reference.
      setupModal: (element) => {
        element._ddiModal = createModal(element, {
          labelledBy: "ddi-system-status-title",
          onClose: () => component.set("isOpen", false),
        });
      },

      onOpenChange: (element, [isOpen]) => {
        if (isOpen) {
          element._ddiModal?.activate();
        } else {
          element._ddiModal?.deactivate();
        }
      },

      teardownModal: (element) => {
        element._ddiModal?.destroy();
      },
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
