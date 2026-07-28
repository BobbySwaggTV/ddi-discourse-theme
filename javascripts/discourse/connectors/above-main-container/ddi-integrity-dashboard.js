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

      // {{action}} is deprecated (discourse.template-action) — replaced
      // with {{on "click"}} in the template, which needs a plain function
      // reference rather than an `actions` hash entry and doesn't
      // auto-bind `this`. Closing over `ddiIntegrityDashboard` directly
      // (already captured above) is the same free-function, no-`this`
      // pattern the did-insert/did-update/will-destroy handlers below
      // already use for the identical reason.
      open: () => ddiIntegrityDashboard.open(),
      close: () => ddiIntegrityDashboard.close(),

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
};
