import { getOwner } from "@ember/owner";
import { buildDialogHandlers } from "../../lib/ddi-dialog-connector";

export default {
  shouldRender(args, component) {
    if (!settings.ddi_lifecycle_dashboard_enabled) {
      return false;
    }

    const currentUser = getOwner(component).lookup("service:current-user");

    return Boolean(currentUser?.staff);
  },

  setupComponent(args, component) {
    const ddiLifecycleDashboard = getOwner(component).lookup(
      "service:ddi-lifecycle-dashboard"
    );

    component.setProperties({
      ddiLifecycleDashboard,

      // Same free-function, no-`this` pattern established by the
      // Integrity/System Status Dashboard connectors — see either for why
      // ({{action}} deprecation, did-insert/did-update/will-destroy not
      // guaranteeing `this`).
      open: () => ddiLifecycleDashboard.open(),
      close: () => ddiLifecycleDashboard.close(),

      setDepartmentFilter: (event) =>
        ddiLifecycleDashboard.setFilter("department", event.target.value),
      setApprovalStateFilter: (event) =>
        ddiLifecycleDashboard.setFilter("approvalState", event.target.value),
      setLifecycleFilter: (event) =>
        ddiLifecycleDashboard.setFilter("lifecycle", event.target.value),
      setClassificationFilter: (event) =>
        ddiLifecycleDashboard.setFilter("classification", event.target.value),

      // Shared dialog-connector wiring (lib/ddi-dialog-connector.js) —
      // see that file for the reasoning behind each of these three.
      ...buildDialogHandlers(ddiLifecycleDashboard, {
        labelledBy: "ddi-lifecycle-dashboard-title",
      }),
    });
  },
};
