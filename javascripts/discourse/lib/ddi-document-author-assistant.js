import { getClassification } from "./ddi-classification";
import { isValidDepartment } from "./ddi-department";
import { isValidDocumentType } from "./ddi-document-type";
import { isValidLifecycle } from "./ddi-lifecycle";
import { formatDocumentId } from "./ddi-document-id";
import { findDocumentReferences } from "./ddi-cross-reference";
import { findDocumentRelationships } from "./ddi-relationship";
import {
  result,
  checkClassification,
  checkDepartment,
  checkDocumentType,
  checkLifecycle,
} from "./ddi-integrity";
import { UNCATEGORIZED_LABEL } from "./ddi-category";

// A new topic has no Discourse topic id yet — Document Number is generated
// 1:1 from it (lib/ddi-document-id.js, docs/ddi-document-metadata-standard.md
// §4.1) and "is not manually assigned," so there's nothing to validate until
// the topic exists. Editing an existing document always has one already, and
// it can't be wrong (same source-of-truth guarantee), so this only ever
// distinguishes "not created yet" from "already assigned."
function checkDocumentNumber(topicId) {
  return result(
    "Document Number",
    Boolean(topicId),
    formatDocumentId(topicId),
    "Assigned automatically once this topic is created."
  );
}

// Mirrors what connectors/topic-above-posts/ddi-executive-summary.js treats
// as the Executive Summary — the first paragraph of body text — but against
// raw composer markdown rather than cooked HTML (a draft has no cooked HTML
// yet, and cooking it client-side just to re-derive the same thing this
// already answers directly would be new indirection for no benefit). A
// heading or list-item line alone doesn't count as a summary paragraph.
function hasProseParagraph(raw) {
  return (raw || "").split(/\r?\n/).some((line) => {
    const trimmed = line.trim();

    return (
      trimmed.length > 0 &&
      !/^#{1,6}\s/.test(trimmed) &&
      !/^([-*+]|\d+\.)\s/.test(trimmed)
    );
  });
}

function checkExecutiveSummary(raw) {
  return result(
    "Executive Summary",
    hasProseParagraph(raw),
    "A summary paragraph is present.",
    "No summary paragraph found — add a lead paragraph before the first section."
  );
}

// "## " is the same Markdown-to-h2 convention
// connectors/topic-above-post-stream/ddi-document-navigation-sidebar.js
// already relies on (`.cooked h2`) to build its outline from a published
// document.
function checkH2Sections(raw) {
  return result(
    "H2 Sections",
    /^##\s+\S/m.test(raw || ""),
    "At least one section heading is present.",
    "No \"## \" section headings found — break the document into sections."
  );
}

// findDocumentReferences()/findDocumentRelationships() never require a
// minimum count — many legitimate documents cite nothing and relate to
// nothing. These two rows are a soft completeness nudge, not a hard
// requirement (consistent with "Do not block publishing"): most DDI
// documents are expected to participate in the archive's cross-reference/
// relationship network (see docs/ddi-intelligence-network.md), so their
// absence is worth flagging even though it's never actually wrong.
function checkCrossReferences(raw) {
  const references = findDocumentReferences(raw);
  const count = references.length;

  return result(
    "Cross References",
    count > 0,
    `${count} document reference${count === 1 ? "" : "s"} found.`,
    "No DDI-NNNNNN cross references found — add any this document builds on."
  );
}

function checkRelatedDocuments(raw) {
  const relationships = findDocumentRelationships(raw);
  const count = relationships.length;

  return result(
    "Related Documents",
    count > 0,
    `${count} declared relationship${count === 1 ? "" : "s"} found.`,
    'No declared relationships found (e.g. "References: DDI-000123") — add any that apply.'
  );
}

// Adapts composer draft state into the same { tags, classification,
// department, departmentDisplay, documentType, lifecycle } shape
// services/ddi-document-metadata.js#_resolve() builds for a real topic, so
// checkClassification/checkDepartment/checkDocumentType/checkLifecycle
// (lib/ddi-integrity.js) run unmodified against a draft. checkMetadata()
// (title/author/createdDate) is deliberately not reused here — a draft has
// no resolved author or issued date yet, and none of those fields are part
// of what this panel is asked to validate.
export function buildAuthorAssistantChecks({
  topicId,
  raw,
  tags,
  categorySlug,
  categoryName,
} = {}) {
  const draftTags = tags || [];
  const { classification } = getClassification({ tags: draftTags });

  const draftMetadata = {
    tags: draftTags,
    classification,
    department: isValidDepartment(categorySlug) ? categorySlug : null,
    departmentDisplay: categoryName || UNCATEGORIZED_LABEL,
    documentType: draftTags.find((tag) => isValidDocumentType(tag)) || null,
    lifecycle: draftTags.find((tag) => isValidLifecycle(tag)) || null,
  };

  const checks = [
    checkDocumentNumber(topicId),
    checkClassification(draftMetadata),
    checkDepartment(draftMetadata),
    checkDocumentType(draftMetadata),
    checkLifecycle(draftMetadata),
    checkExecutiveSummary(raw),
    checkH2Sections(raw),
    checkCrossReferences(raw),
    checkRelatedDocuments(raw),
  ];

  // checkClassification/checkDepartment/checkDocumentType/checkLifecycle
  // (reused from lib/ddi-integrity.js) don't carry an `isValid` boolean —
  // only `status`/`statusClass` strings, since the Verification Panel that
  // already consumes them renders "PASS"/"WARN" text directly. Normalizing
  // every check (reused or new) to the same shape here keeps the template
  // a single, source-agnostic `{{if check.isValid}}` rather than one
  // branch per check origin.
  return checks.map((check) => ({ ...check, isValid: check.status === "PASS" }));
}
