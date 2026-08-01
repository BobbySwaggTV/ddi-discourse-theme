export const ISSUE_TYPES = Object.freeze({
  MISSING_CLASSIFICATION: "Missing Classification",
  MISSING_DEPARTMENT: "Missing Department",
  MISSING_DOCUMENT_TYPE: "Missing Document Type",
  MISSING_LIFECYCLE: "Missing Lifecycle",
  DUPLICATE_DOCUMENT_NUMBER: "Duplicate Document Number",
  INVALID_CROSS_REFERENCE: "Invalid Cross Reference",
  BROKEN_RELATED_LINK: "Broken Related Document Link",
  MISSING_REVISION_HISTORY: "Missing Revision History",
  DUPLICATE_REVISION_NUMBER: "Duplicate Revision Numbers",
  INVALID_REVISION_ORDER: "Invalid Revision Ordering",
  MISSING_APPROVAL_STATE: "Missing Approval State",
  INVALID_APPROVAL_VALUE: "Invalid Approval Value",
  MULTIPLE_APPROVED_REVISIONS: "Multiple Current Approved Revisions",
});

const SEVERITY = {
  [ISSUE_TYPES.MISSING_CLASSIFICATION]: "Critical",
  [ISSUE_TYPES.MISSING_DEPARTMENT]: "High",
  [ISSUE_TYPES.MISSING_DOCUMENT_TYPE]: "Medium",
  [ISSUE_TYPES.MISSING_LIFECYCLE]: "Low",
  [ISSUE_TYPES.DUPLICATE_DOCUMENT_NUMBER]: "Critical",
  [ISSUE_TYPES.INVALID_CROSS_REFERENCE]: "Medium",
  [ISSUE_TYPES.BROKEN_RELATED_LINK]: "Medium",
  // Version 1.7's own 3 checks are explicitly "non-blocking informational"
  // per the task that requested them — the least severe existing tier
  // ("Low", already used by Missing Lifecycle above) rather than a new
  // 5th tier invented just for these three.
  [ISSUE_TYPES.MISSING_REVISION_HISTORY]: "Low",
  [ISSUE_TYPES.DUPLICATE_REVISION_NUMBER]: "Low",
  [ISSUE_TYPES.INVALID_REVISION_ORDER]: "Low",
  // Version 1.8's own 3 checks are the same "informational" tier as
  // v1.7's revision checks above — "Low", not a new tier.
  [ISSUE_TYPES.MISSING_APPROVAL_STATE]: "Low",
  [ISSUE_TYPES.INVALID_APPROVAL_VALUE]: "Low",
  [ISSUE_TYPES.MULTIPLE_APPROVED_REVISIONS]: "Low",
};

const SUGGESTED_FIX = {
  [ISSUE_TYPES.MISSING_CLASSIFICATION]:
    "Add a classification tag (e.g. restricted, confidential, top-secret).",
  [ISSUE_TYPES.MISSING_DEPARTMENT]:
    "Move the document into a recognized operational division category.",
  [ISSUE_TYPES.MISSING_DOCUMENT_TYPE]: "Add a recognized document-type tag.",
  [ISSUE_TYPES.MISSING_LIFECYCLE]:
    "Add a lifecycle tag (e.g. draft, active, archived).",
  [ISSUE_TYPES.DUPLICATE_DOCUMENT_NUMBER]:
    "Investigate — two documents resolved to the same document number.",
  [ISSUE_TYPES.INVALID_CROSS_REFERENCE]:
    "Correct or remove the reference — the cited document number does not exist.",
  [ISSUE_TYPES.BROKEN_RELATED_LINK]:
    "Correct or remove the declared relationship — the target document does not exist.",
  [ISSUE_TYPES.MISSING_REVISION_HISTORY]:
    'Add a "## Revision History" section with a Revision Number/Date/Author/Summary/Approval Status table.',
  [ISSUE_TYPES.DUPLICATE_REVISION_NUMBER]:
    "Give each revision row a unique revision number.",
  [ISSUE_TYPES.INVALID_REVISION_ORDER]:
    "Reorder or correct the revision numbers so they increase from top to bottom.",
  [ISSUE_TYPES.MISSING_APPROVAL_STATE]:
    "Add an Approval Status value to the latest revision (Draft, Pending Review, Approved, Superseded, or Archived).",
  [ISSUE_TYPES.INVALID_APPROVAL_VALUE]:
    "Correct the latest revision's Approval Status to one of the 5 recognized values.",
  [ISSUE_TYPES.MULTIPLE_APPROVED_REVISIONS]:
    "Update earlier revisions' Approval Status — only the current revision should be marked Approved.",
};

const SEVERITY_ORDER = ["Critical", "High", "Medium", "Low"];

export function buildIssue({ documentNumber, title, url, issueType, detail }) {
  const severity = SEVERITY[issueType] || "Medium";

  return {
    documentNumber,
    title,
    url,
    issueType,
    severity,
    severityClass: severity.toLowerCase(),
    suggestedFix:
      detail || SUGGESTED_FIX[issueType] || "Review this document's metadata.",
  };
}

export function sortIssuesBySeverity(issues) {
  return [...(issues || [])].sort((a, b) => {
    const bySeverity =
      SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);

    return bySeverity !== 0
      ? bySeverity
      : (a.documentNumber || "").localeCompare(b.documentNumber || "");
  });
}
