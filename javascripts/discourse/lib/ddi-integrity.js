import { isValidClassification } from "./ddi-classification";

const PASS = "PASS";
const WARN = "WARN";

// Exported so the Document Author Assistant (lib/ddi-document-author-
// assistant.js) can build its own new checks in the exact same
// { field, status, statusClass, detail } shape as the checks it reuses from
// this file below, instead of a second, independently-maintained copy of
// this formatting.
export function result(field, passed, passDetail, warnDetail) {
  return {
    field,
    status: passed ? PASS : WARN,
    statusClass: passed ? "pass" : "warn",
    detail: passed ? passDetail : warnDetail,
  };
}

// Individually exported (alongside the bundled verifyDocumentIntegrity()
// below) so the Document Author Assistant can reuse the exact same
// Classification/Department/Document Type/Lifecycle checks against a
// composer draft's not-yet-a-real-topic metadata shape, without pulling in
// checkMetadata() — which reads title/author/createdDate fields a draft
// doesn't meaningfully have yet — and without reimplementing any of this
// logic a second time. See ARCHITECTURE.md's "Document Author Assistant"
// section.
export function checkClassification(metadata) {
  const hasExplicitTag = (metadata.tags || []).some(isValidClassification);

  return result(
    "Classification",
    hasExplicitTag,
    "Explicit classification tag present.",
    `No classification tag found — defaulted to ${metadata.classification}.`
  );
}

export function checkDepartment(metadata) {
  return result(
    "Department",
    Boolean(metadata.department),
    "Category matches a recognized operational division.",
    `Category ("${metadata.departmentDisplay}") is not one of the 6 recognized divisions.`
  );
}

export function checkDocumentType(metadata) {
  return result(
    "Document Type",
    Boolean(metadata.documentType),
    "Recognized document-type tag present.",
    "No recognized document-type tag found."
  );
}

export function checkLifecycle(metadata) {
  return result(
    "Lifecycle",
    Boolean(metadata.lifecycle),
    "Recognized lifecycle tag present.",
    "No lifecycle tag found."
  );
}

function checkMetadata(metadata) {
  const missing = [];

  if (!metadata.title?.trim()) {
    missing.push("title");
  }

  if (metadata.author === "SYSTEM") {
    missing.push("author");
  }

  if (metadata.createdDate === "UNKNOWN") {
    missing.push("issued date");
  }

  return result(
    "Metadata",
    missing.length === 0,
    "Title, author, and issued date all resolved.",
    `Could not resolve: ${missing.join(", ")}.`
  );
}

export function verifyDocumentIntegrity(metadata) {
  if (!metadata) {
    return [];
  }

  return [
    checkClassification(metadata),
    checkDepartment(metadata),
    checkDocumentType(metadata),
    checkLifecycle(metadata),
    checkMetadata(metadata),
  ];
}
