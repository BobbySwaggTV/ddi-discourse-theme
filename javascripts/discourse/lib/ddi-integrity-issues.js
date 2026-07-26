export const ISSUE_TYPES = Object.freeze({
  MISSING_CLASSIFICATION: "Missing Classification",
  MISSING_DEPARTMENT: "Missing Department",
  MISSING_DOCUMENT_TYPE: "Missing Document Type",
  MISSING_LIFECYCLE: "Missing Lifecycle",
  DUPLICATE_DOCUMENT_NUMBER: "Duplicate Document Number",
  INVALID_CROSS_REFERENCE: "Invalid Cross Reference",
  BROKEN_RELATED_LINK: "Broken Related Document Link",
});

const SEVERITY = {
  [ISSUE_TYPES.MISSING_CLASSIFICATION]: "Critical",
  [ISSUE_TYPES.MISSING_DEPARTMENT]: "High",
  [ISSUE_TYPES.MISSING_DOCUMENT_TYPE]: "Medium",
  [ISSUE_TYPES.MISSING_LIFECYCLE]: "Low",
  [ISSUE_TYPES.DUPLICATE_DOCUMENT_NUMBER]: "Critical",
  [ISSUE_TYPES.INVALID_CROSS_REFERENCE]: "Medium",
  [ISSUE_TYPES.BROKEN_RELATED_LINK]: "Medium",
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
