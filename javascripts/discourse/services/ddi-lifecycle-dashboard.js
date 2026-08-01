import Service, { service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import {
  toLifecycleDocument,
  buildLifecycleSections,
  buildLifecycleFilterOptions,
} from "../lib/ddi-lifecycle-dashboard";

const EMPTY_FILTER_OPTIONS = Object.freeze({
  departments: [],
  classifications: [],
  approvalStates: [],
  lifecycles: [],
});

export default class DdiLifecycleDashboardService extends Service {
  @service currentUser;
  @service ddiIntegrityDashboard;

  // Same "own the dialog's state on the service" shape
  // services/ddi-integrity-dashboard.js already established — lets a
  // future summary card or cross-link open this dashboard directly, the
  // same way System Status Dashboard already opens Integrity Dashboard.
  @tracked isOpen = false;
  @tracked isLoading = false;
  @tracked sections = [];
  @tracked filterOptions = EMPTY_FILTER_OPTIONS;
  @tracked filters = {};

  // The mapped document list and raw issues, kept between filter changes
  // so re-filtering never re-fetches or re-derives either — only
  // buildLifecycleSections() (a pure, synchronous regroup) reruns.
  _documents = [];
  _issues = [];

  async open() {
    this.isOpen = true;
    this.isLoading = true;
    this.filters = {};

    if (!this.currentUser?.staff) {
      this._documents = [];
      this._issues = [];
      this.filterOptions = EMPTY_FILTER_OPTIONS;
      this.sections = [];
      this.isLoading = false;
      return;
    }

    // Both calls share the exact same underlying archive scan —
    // services/ddi-integrity-dashboard.js#_scanArchive() is Promise-cached
    // for the session (v1.9) — so requesting both the document list and
    // the issue list here never triggers a second full-archive fetch,
    // regardless of whether the Integrity Dashboard has already been
    // opened this session or this is the very first scan triggered.
    const [rawDocuments, issues] = await Promise.all([
      this.ddiIntegrityDashboard.getDocuments(),
      this.ddiIntegrityDashboard.getIssues(),
    ]);

    this._documents = rawDocuments.map(toLifecycleDocument).filter(Boolean);
    this._issues = issues;
    this.filterOptions = buildLifecycleFilterOptions(this._documents);
    this._regroup();
    this.isLoading = false;
  }

  close() {
    this.isOpen = false;
  }

  // One generic setter for all 4 filter dimensions (department, approval
  // state, lifecycle, classification) rather than four near-identical
  // methods — each is just "replace one key in `filters`, regroup."
  // Regrouping is synchronous and local: no fetch, no re-validation, no
  // re-parsing, just lib/ddi-document-index.js#filterDocuments() (reused,
  // see that file) over the document list already held in memory.
  setFilter(key, value) {
    this.filters = { ...this.filters, [key]: value };
    this._regroup();
  }

  _regroup() {
    this.sections = buildLifecycleSections(
      this._documents,
      this._issues,
      this.filters
    );
  }
}
