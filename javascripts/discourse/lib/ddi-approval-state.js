import { getRevisionsNewestFirst } from "./ddi-revision-table";

export const APPROVAL_STATES = Object.freeze([
  "Draft",
  "Pending Review",
  "Approved",
  "Superseded",
  "Archived",
]);

const DEFAULT_APPROVAL_STATE = "Draft";

function findMatchingState(value) {
  const normalized = (value || "").trim().toLowerCase();

  return (
    APPROVAL_STATES.find((state) => state.toLowerCase() === normalized) ||
    null
  );
}

export function isValidApprovalState(value) {
  return Boolean(findMatchingState(value));
}

// Coerces any raw Approval Status cell value to one of the 5 recognized
// states, defaulting unknown or missing values to Draft — "treat unknown
// values as Draft" applies wherever this is called for display.
// isValidApprovalState() above is the separate, stricter check Author
// Assistant/Integrity Dashboard use to WARN that a value needs correcting;
// a document flagged by that warning still gets a sane default here in the
// meantime, rather than displaying nothing or raw garbage text. Not
// exported — getCurrentApprovalState() below is the only caller anywhere
// in this theme, so this stays a private helper rather than speculative
// API surface with no consumer (see CODING_STANDARDS.md/ARCHITECTURE.md's
// isValidRelationshipType() precedent).
function normalizeApprovalState(value) {
  return findMatchingState(value) || DEFAULT_APPROVAL_STATE;
}

// The single place "which row is this document's latest revision" is
// answered — reuses lib/ddi-revision-table.js#getRevisionsNewestFirst()
// (v1.7) rather than re-deriving it a second way.
export function getLatestRevision(rows) {
  return getRevisionsNewestFirst(rows)[0] || null;
}

// The single place "this document's current approval state" is computed
// from a revision table. Every consumer (citation building, the Document
// Intelligence Header, Author Assistant, Integrity Dashboard) calls this
// exact function against rows already parsed by lib/ddi-revision-table.js
// — never a second, independent derivation.
export function getCurrentApprovalState(rows) {
  return normalizeApprovalState(getLatestRevision(rows)?.approvalStatus);
}

// Every row (not just the latest) whose approval state normalizes to
// "Approved" — used by the Integrity Dashboard's "Multiple current
// approved revisions" check. Only the latest revision is expected to
// carry that state; earlier rows still marked Approved usually mean an
// author forgot to update them when a new revision was added.
export function findApprovedRevisions(rows) {
  return (rows || []).filter(
    (row) => findMatchingState(row.approvalStatus) === "Approved"
  );
}
