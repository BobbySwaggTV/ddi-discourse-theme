import { getCurrentApprovalState, APPROVAL_STATES } from "./ddi-approval-state";
import { filterDocuments } from "./ddi-document-index";
import { selectRecentlyUpdated } from "./ddi-archive-statistics";
import { ISSUE_TYPES } from "./ddi-integrity-issues";
import { LIFECYCLE_STATES, getLifecycleLabel } from "./ddi-lifecycle";
import { CLASSIFICATIONS, getClassification } from "./ddi-classification";

const RECENTLY_UPDATED_LIMIT = 10;

// The one place a scanned document (services/ddi-integrity-dashboard.js's
// own { topicId, title, url, metadata, revisions } shape — reused as-is,
// not re-fetched) becomes a display row. Every field here is already
// computed by an existing service: metadata.* comes from the Metadata
// Engine, approvalState from lib/ddi-approval-state.js (itself built on
// the v1.7 Revision Table parser) against the same doc.revisions the
// Integrity Dashboard already parsed once. No new parsing, no new
// validation — this only reshapes already-derived fields into one row
// shape every section below shares.
export function toLifecycleDocument(doc) {
  const metadata = doc?.metadata;

  if (!metadata) {
    return null;
  }

  return {
    topicId: doc.topicId,
    documentNumber: metadata.documentNumber,
    title: doc.title,
    department: metadata.departmentDisplay,
    classification: metadata.classification,
    classificationClass: metadata.classificationClass,
    lifecycle: metadata.lifecycle,
    revision: metadata.revision,
    approvalState: getCurrentApprovalState(doc.revisions),
    updatedAt: metadata.updatedAt,
    updatedDate: metadata.updatedDate,
    url: doc.url,
  };
}

function byApprovalState(documents, state) {
  return documents.filter((document) => document.approvalState === state);
}

function groupIssuesByDocumentNumber(issues) {
  const byNumber = new Map();

  (issues || []).forEach((issue) => {
    if (!issue.documentNumber) {
      return;
    }

    if (!byNumber.has(issue.documentNumber)) {
      byNumber.set(issue.documentNumber, []);
    }

    byNumber.get(issue.documentNumber).push(issue);
  });

  return byNumber;
}

function byIssueType(documents, issuesByDocumentNumber, issueType) {
  return documents.filter((document) =>
    (issuesByDocumentNumber.get(document.documentNumber) || []).some(
      (issue) => issue.issueType === issueType
    )
  );
}

function withAnyIssue(documents, issuesByDocumentNumber) {
  return documents.filter(
    (document) =>
      (issuesByDocumentNumber.get(document.documentNumber) || []).length > 0
  );
}

// Every section below is a pure grouping of the same already-built
// document list and the same already-computed issues (services/ddi-
// integrity-dashboard.js#getIssues(), itself reusing verifyDocumentIntegrity/
// the Revision Table parser/lib/ddi-approval-state.js — not re-validated
// here). Filtering happens once, up front, via lib/ddi-document-index.js's
// existing filterDocuments() (extended with a `lifecycle` key — see that
// file), so every section reflects the active filters consistently rather
// than each re-filtering independently.
export function buildLifecycleSections(documents, issues, filters = {}) {
  const filtered = filterDocuments(documents, filters);
  const issuesByDocumentNumber = groupIssuesByDocumentNumber(issues);

  return [
    {
      key: "draft",
      label: "Draft Documents",
      documents: byApprovalState(filtered, "Draft"),
    },
    {
      key: "pending-review",
      label: "Pending Review",
      documents: byApprovalState(filtered, "Pending Review"),
    },
    {
      key: "recently-updated",
      label: "Recently Updated",
      documents: selectRecentlyUpdated(filtered, RECENTLY_UPDATED_LIMIT),
    },
    {
      key: "superseded",
      label: "Superseded Documents",
      documents: byApprovalState(filtered, "Superseded"),
    },
    {
      key: "archived",
      label: "Archived Documents",
      documents: byApprovalState(filtered, "Archived"),
    },
    {
      key: "missing-approval-state",
      label: "Missing Approval State",
      documents: byIssueType(
        filtered,
        issuesByDocumentNumber,
        ISSUE_TYPES.MISSING_APPROVAL_STATE
      ),
    },
    {
      key: "missing-revision-history",
      label: "Missing Revision History",
      documents: byIssueType(
        filtered,
        issuesByDocumentNumber,
        ISSUE_TYPES.MISSING_REVISION_HISTORY
      ),
    },
    {
      key: "integrity-warnings",
      label: "Documents with Integrity Warnings",
      documents: withAnyIssue(filtered, issuesByDocumentNumber),
    },
  ];
}

// Filter option lists reuse each dimension's own existing closed
// vocabulary — lib/ddi-approval-state.js#APPROVAL_STATES, lib/ddi-
// lifecycle.js#LIFECYCLE_STATES, lib/ddi-classification.js#CLASSIFICATIONS
// — rather than deriving them from whichever values happen to be present,
// so every possible value is always offered (a department/classification/
// state with zero current documents is itself diagnostically relevant on a
// maintenance dashboard, not something to hide). Department has no such
// self-contained vocabulary in this codebase (DEPARTMENTS in lib/ddi-
// department.js is slugs only; display names live on live Discourse
// category data) — reusing that would need a `site` service lookup this
// pure function can't make, so department options are the distinct
// display names actually present in the scanned set instead.
export function buildLifecycleFilterOptions(documents) {
  const departments = [
    ...new Set((documents || []).map((document) => document.department).filter(Boolean)),
  ].sort();

  const { classification: defaultClassification } = getClassification({
    tags: [],
  });
  const classifications = [
    defaultClassification,
    ...CLASSIFICATIONS.map((entry) => entry.classification),
  ];

  const lifecycles = LIFECYCLE_STATES.map((slug) => ({
    value: slug,
    label: getLifecycleLabel(slug),
  }));

  return {
    departments,
    classifications,
    approvalStates: APPROVAL_STATES,
    lifecycles,
  };
}
