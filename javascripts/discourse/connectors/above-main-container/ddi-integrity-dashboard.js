import { getOwner } from "@ember/owner";
import { buildDialogHandlers } from "../../lib/ddi-dialog-connector";

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

      // Shared dialog-connector wiring (lib/ddi-dialog-connector.js) —
      // see that file for the reasoning behind each of these three.
      ...buildDialogHandlers(ddiIntegrityDashboard, {
        labelledBy: "ddi-integrity-dashboard-title",
      }),
    });
  },
};
