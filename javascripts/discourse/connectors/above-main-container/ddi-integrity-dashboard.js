import { getOwner } from "@ember/owner";
import { createModal } from "../../lib/ddi-modal";

export default {
  shouldRender(args, component) {
    if (!settings.ddi_integrity_dashboard_enabled) {
      return false;
    }

    const currentUser = getOwner(component).lookup("service:current-user");

    return Boolean(currentUser?.staff);
  },

  setupComponent(args, component) {
    const ddiIntegrityDashboard = getOwner(component).lookup(
      "service:ddi-integrity-dashboard"
    );

    component.setProperties({
      ddiIntegrityDashboard,

      // Free functions, not component methods — did-insert/did-update/
      // will-destroy invoke whatever they're given with the element as the
      // first argument but don't guarantee `this` inside it is the
      // component (see the Knowledge Graph Viewer's setupGraphCanvas for
      // the same lesson). These close over `ddiIntegrityDashboard` directly
      // instead, and stash the modal controller on the element itself.
      setupModal: (element) => {
        element._ddiModal = createModal(element, {
          labelledBy: "ddi-integrity-dashboard-title",
          onClose: () => ddiIntegrityDashboard.close(),
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
      this.ddiIntegrityDashboard.open();
    },

    close() {
      this.ddiIntegrityDashboard.close();
    },
  },
};
