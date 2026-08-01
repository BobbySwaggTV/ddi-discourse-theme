import { getOwner } from "@ember/owner";
import { buildDialogHandlers } from "../../lib/ddi-dialog-connector";

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

      // Shared dialog-connector wiring (lib/ddi-dialog-connector.js) —
      // see that file for the reasoning behind each of these three.
      ...buildDialogHandlers(ddiSystemStatus, {
        labelledBy: "ddi-system-status-title",
      }),
    });
  },
};
