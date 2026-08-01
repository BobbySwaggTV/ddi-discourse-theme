import { getOwner } from "@ember/owner";
import { isExcludedRoute } from "../../lib/ddi-route-guard";
import { groupDocumentsByYear } from "../../lib/ddi-timeline-view";
import { filterDocuments } from "../../lib/ddi-document-index";
import { APPROVAL_STATES } from "../../lib/ddi-approval-state";

// Homepage UX cleanup (v1.1): merges what were two independent connectors
// (Intelligence Timeline and Intelligence Index) into one "Browse Archive"
// section with a tab switcher, instead of two always-visible cards showing
// the same document set in two different orders back to back. See
// ARCHITECTURE.md's "Homepage UX Cleanup" for the reasoning; both view
// modes — year-grouped and alphabetical — are fully preserved, just
// presented as tabs of one section rather than two stacked cards. As a
// direct side effect, this also fixes a real duplicate service call: the
// two former connectors each independently called
// ddiIntelligenceIndex.getIndex() with identical arguments; this one calls
// it exactly once and derives both views from that single result.
export default {
  shouldRender() {
    return Boolean(
      settings.ddi_timeline_view_enabled ||
        settings.ddi_intelligence_index_enabled
    );
  },

  setupComponent(args, component) {
    const owner = getOwner(component);
    const router = owner.lookup("service:router");

    if (isExcludedRoute(router.currentRouteName)) {
      component.setProperties({ isVisible: false });
      return;
    }

    const yearViewEnabled = Boolean(settings.ddi_timeline_view_enabled);
    const indexViewEnabled = Boolean(settings.ddi_intelligence_index_enabled);

    // Each tab remains independently gated by the exact setting that used
    // to control its old standalone card — an admin who had disabled one
    // before this merge still has it disabled after. If only one is on,
    // there's nothing to switch between, so the tab bar itself is hidden
    // rather than shown with a single, pointless option.
    function applyTab(tab) {
      component.setProperties({
        activeTab: tab,
        isYearTabActive: tab === "year",
        isIndexTabActive: tab === "index",
      });
    }

    // Applies the approval-state filter client-side over the already-
    // fetched, already-department-scoped document set, then re-derives
    // both tabs' views from the result — reuses lib/ddi-document-index.js's
    // own filterDocuments() (the same function department/classification
    // scoping already goes through elsewhere) rather than a second,
    // approval-specific filtering mechanism. Synchronous array filtering,
    // not a new fetch: getIndex() itself is called exactly once, still.
    function applyApprovalFilter(approvalState) {
      const documents = filterDocuments(
        component.allDocuments,
        approvalState ? { approvalState } : {}
      );

      const years = groupDocumentsByYear(documents).map((entry, index) => ({
        ...entry,
        isExpanded: index === 0,
      }));

      component.setProperties({ selectedApprovalState: approvalState, documents, years });
    }

    component.setProperties({
      isVisible: true,
      isLoading: true,
      allDocuments: [],
      documents: [],
      years: [],
      yearViewEnabled,
      indexViewEnabled,
      showTabs: yearViewEnabled && indexViewEnabled,
      approvalStateOptions: APPROVAL_STATES,
      selectedApprovalState: "",

      setTab: (tab) => applyTab(tab),

      setApprovalStateFilter: (event) =>
        applyApprovalFilter(event.target.value),

      // {{on "click"}}, not {{action}} — see ARCHITECTURE.md's Deprecated
      // Template Actions section for why this closes over `component`
      // rather than relying on `this`. Unchanged from the old
      // ddi-timeline-view.js's own toggleYear.
      toggleYear: (year) => {
        const years = component.years.map((entry) =>
          entry.year === year
            ? { ...entry, isExpanded: !entry.isExpanded }
            : entry
        );

        component.set("years", years);
      },
    });

    applyTab(yearViewEnabled ? "year" : "index");

    const department = owner
      .lookup("service:ddi-category-context")
      .getCurrentDepartment();

    owner
      .lookup("service:ddi-intelligence-index")
      .getIndex(department ? { department } : {})
      .then((documents) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        // documents is already alphabetically sorted by getIndex() itself
        // — the "All Documents" tab uses it directly, unchanged from how
        // ddi-intelligence-index.js always did.
        component.set("allDocuments", documents);
        applyApprovalFilter("");
        component.set("isLoading", false);
      });
  },
};
