import { RELATIONSHIP_TYPES } from "./ddi-relationship";

const SAME_DEPARTMENT_LABEL = "Same Department";
const SAME_CLASSIFICATION_LABEL = "Same Classification";

function buildAriaLabel({ title, documentNumber, classification, department }, relationshipLabel) {
  return [title, relationshipLabel, documentNumber, classification, department]
    .filter(Boolean)
    .join(", ");
}

// Accepts either a resolved relationship (services/ddi-relationship.js,
// `documentNumber`) or a citation (services/ddi-citation-preview.js,
// `documentId`) — the two shapes this panel's inputs already come in.
function toRelationshipItem(source, relationshipLabel) {
  const documentNumber = source.documentNumber ?? source.documentId;

  return {
    title: source.title,
    documentNumber,
    classification: source.classification,
    classificationClass: source.classificationClass,
    department: source.department,
    url: source.url,
    relationshipLabel,
    ariaLabel: buildAriaLabel(
      { title: source.title, documentNumber, classification: source.classification, department: source.department },
      relationshipLabel
    ),
  };
}

// Pure grouping over data callers already fetched — no API calls, no
// re-parsing. `relationships` is services/ddi-relationship.js#getRelationships()'s
// own resolved, cached result; `related` is services/ddi-related-intelligence.js
// #findRelated()'s own resolved, cached result. Both are the exact calls
// Document Relationships/Intelligence Network and Document Intelligence
// Header already make for the current topic, so this panel rides their
// existing per-topic Promise cache rather than triggering new work.
//
// "Referenced By" has no group here — there is no reverse index of which
// documents cite this one, and building one would mean scanning every other
// document's body archive-wide, not reusing an existing service (ruled out
// deliberately, see conversation history / AskUserQuestion decision).
// "Parent Document"/"Child Documents" likewise have no group — the user
// chose to keep Supersedes/Superseded By/Related Intelligence/Required
// Reading/Supporting Documentation under their own existing declared names
// rather than remap any of them to a Parent/Child concept that doesn't
// otherwise exist in this codebase.
export function buildRelationshipGroups(relationships, related, metadata) {
  const groups = [];

  RELATIONSHIP_TYPES.forEach((type) => {
    const items = relationships
      .filter((relationship) => relationship.type === type)
      .map((relationship) => toRelationshipItem(relationship, type));

    if (items.length) {
      groups.push({ label: type, items });
    }
  });

  const sameDepartment = related
    .filter((candidate) => candidate.department === metadata.departmentDisplay)
    .map((candidate) => toRelationshipItem(candidate, SAME_DEPARTMENT_LABEL));

  if (sameDepartment.length) {
    groups.push({ label: SAME_DEPARTMENT_LABEL, items: sameDepartment });
  }

  const sameClassification = related
    .filter((candidate) => candidate.classification === metadata.classification)
    .map((candidate) => toRelationshipItem(candidate, SAME_CLASSIFICATION_LABEL));

  if (sameClassification.length) {
    groups.push({ label: SAME_CLASSIFICATION_LABEL, items: sameClassification });
  }

  return groups;
}
