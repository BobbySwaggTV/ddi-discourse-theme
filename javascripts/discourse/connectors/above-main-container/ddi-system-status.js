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
    const ddiSystemStatus = owner.lookup("service:ddi-system-status");
    const ddiIntegrityDashboard = owner.lookup(
      "service:ddi-integrity-dashboard"
    );

    component.setProperties({
      ddiSystemStatus,
      ddiIntegrityDashboard,

      // {{action}} is deprecated (discourse.template-action) — replaced
      // with {{on "click"}} in the template, which needs a plain function
      // reference rather than an `actions` hash entry and doesn't
      // auto-bind `this`. Closing over the two services captured above is
      // the same free-function, no-`this` pattern the did-insert/
      // did-update/will-destroy handlers below already use for the
      // identical reason.
      open: () => ddiSystemStatus.open(),
      close: () => ddiSystemStatus.close(),
      openIntegrityDashboard: () => {
        ddiSystemStatus.close();
        ddiIntegrityDashboard.open();
      },

      // Same free-function pattern as the Integrity Dashboard connector —
      // see its setupModal for why these can't be `this`-bound methods.
      // isOpen now lives on the service (not this component), the same
      // move Integrity Dashboard's own connector already made, so onClose
      // closes it via the service rather than local component state.
      setupModal: (element) => {
        element._ddiModal = createModal(element, {
          labelledBy: "ddi-system-status-title",
          onClose: () => ddiSystemStatus.close(),
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
