import { isValidClassification } from "./ddi-classification";

const PASS = "PASS";
const WARN = "WARN";

function result(field, passed, passDetail, warnDetail) {
  return {
    field,
    status: passed ? PASS : WARN,
    statusClass: passed ? "pass" : "warn",
    detail: passed ? passDetail : warnDetail,
  };
}

function checkClassification(metadata) {
  const hasExplicitTag = (metadata.tags || []).some(isValidClassification);

  return result(
    "Classification",
    hasExplicitTag,
    "Explicit classification tag present.",
    `No classification tag found — defaulted to ${metadata.classification}.`
  );
}

function checkDepartment(metadata) {
  return result(
    "Department",
    Boolean(metadata.department),
    "Category matches a recognized operational division.",
    `Category ("${metadata.departmentDisplay}") is not one of the 6 recognized divisions.`
  );
}

function checkDocumentType(metadata) {
  return result(
    "Document Type",
    Boolean(metadata.documentType),
    "Recognized document-type tag present.",
    "No recognized document-type tag found."
  );
}

function checkLifecycle(metadata) {
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
