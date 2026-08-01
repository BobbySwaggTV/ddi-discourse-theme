import { isValidDocumentType } from "./ddi-document-type";

// The single place every template's boilerplate is assembled — one string
// builder, not a templating engine (no variable interpolation beyond the
// document type's own label, no conditionals, no loops a document author
// would ever author against). Adding a future template means adding one
// entry to TEMPLATE_DEFINITIONS below; nothing here needs to change.
function buildTemplateBody({ label, sections }) {
  const sectionBlocks = sections
    .map((heading) => `## ${heading}\n\n_(Add ${heading.toLowerCase()} content here.)_`)
    .join("\n\n");

  return [
    "## Executive Summary",
    "",
    "_(Replace this paragraph with a one-paragraph summary of this document's purpose and scope.)_",
    "",
    "## Required Metadata",
    "",
    "Confirm before publishing — these are set via the composer's own Category and Tags fields, " +
      "not read from this text:",
    "",
    "- Classification: _(select a classification tag, or leave unset for PUBLIC RELEASE)_",
    "- Department: _(select the owning division as this topic's category)_",
    `- Document Type: _(this template already applied the "${label}" tag — confirm it's still correct)_`,
    "- Lifecycle: _(select a lifecycle tag, e.g. \"draft\")_",
    "",
    sectionBlocks,
    "",
    "## Cross References",
    "",
    "_(Cite other DDI documents inline by document number as you write — any DDI-NNNNNN mention " +
      "anywhere in this document is linked automatically. No action needed here if this document " +
      "doesn't cite anything.)_",
    "",
    "## Related Documents",
    "",
    "_(Declare this document's relationships to others below, one per line, using the labels " +
      "already recognized archive-wide. Delete any label that doesn't apply — an unused label " +
      "with no document number after it is ignored.)_",
    "",
    "References: DDI-NNNNNN",
    "Supersedes: DDI-NNNNNN",
    "Superseded By: DDI-NNNNNN",
    "Related Intelligence: DDI-NNNNNN",
    "Required Reading: DDI-NNNNNN",
    "Supporting Documentation: DDI-NNNNNN",
    "",
    "## Revision History",
    "",
    "| Revision Number | Date | Author | Summary | Approval Status |",
    "|---|---|---|---|---|",
    "| R1.0 | _(issue date)_ | _(author)_ | Initial publication. | _(status)_ |",
    "",
    "## Approval",
    "",
    "| Role | Name | Date |",
    "|---|---|---|",
    "| Prepared By | | |",
    "| Reviewed By | | |",
    "| Approved By | | |",
  ].join("\n");
}

// One entry per official DDI document type this library ships a template
// for. `type` is one of lib/ddi-document-type.js's own DOCUMENT_TYPES
// slugs — reused directly, not a parallel vocabulary — so selecting a
// template and tagging a document with its type are the same closed list.
// `sections` are each template's own standard section headings, beyond the
// shared Executive Summary/Required Metadata/Cross References/Related
// Documents/Revision History/Approval boilerplate every template gets from
// buildTemplateBody() above.
const TEMPLATE_DEFINITIONS = Object.freeze([
  {
    type: "briefing",
    label: "Intelligence Brief",
    sections: ["Situation Overview", "Key Findings", "Assessment", "Recommendations"],
  },
  {
    type: "procedure",
    label: "Standard Operating Procedure (SOP)",
    sections: ["Purpose & Scope", "Responsibilities", "Procedure Steps", "Safety & Compliance Notes"],
  },
  {
    type: "policy",
    label: "Policy Directive",
    sections: ["Policy Statement", "Scope & Applicability", "Requirements", "Enforcement & Exceptions"],
  },
  {
    type: "manual",
    label: "Operations Manual",
    sections: ["Overview", "Roles & Responsibilities", "Operating Procedures", "Equipment & Resources"],
  },
  {
    type: "incident-report",
    label: "Incident Report",
    sections: ["Incident Summary", "Timeline of Events", "Impact Assessment", "Corrective Actions"],
  },
  {
    type: "training-guide",
    label: "Training Manual",
    sections: ["Learning Objectives", "Prerequisites", "Training Content", "Assessment & Certification"],
  },
  {
    type: "technical-spec",
    label: "Technical Specification",
    sections: ["Overview", "Requirements", "Technical Details", "Testing & Validation"],
  },
  {
    type: "directive",
    label: "Executive Order",
    sections: ["Order", "Authority & Justification", "Scope & Applicability", "Implementation"],
  },
  {
    type: "charter",
    label: "Corporate Charter",
    sections: ["Mission & Purpose", "Governance Structure", "Authority & Powers", "Amendment Procedure"],
  },
]);

// Every DOCUMENT_TEMPLATES.type is guaranteed to be a real, current
// DOCUMENT_TYPES slug — checked once here, at module load, rather than
// trusting the hand-authored list above to stay in sync silently. Throwing
// immediately surfaces a typo the same session it's introduced, not the
// first time some unrelated code happens to call isValidDocumentType() on
// a template's own type.
TEMPLATE_DEFINITIONS.forEach((definition) => {
  if (!isValidDocumentType(definition.type)) {
    throw new Error(
      `ddi-document-templates: "${definition.type}" is not a valid DOCUMENT_TYPES slug`
    );
  }
});

export const DOCUMENT_TEMPLATES = Object.freeze(
  TEMPLATE_DEFINITIONS.map((definition) =>
    Object.freeze({
      type: definition.type,
      label: definition.label,
      body: buildTemplateBody(definition),
    })
  )
);

export function getDocumentTemplate(type) {
  return DOCUMENT_TEMPLATES.find((template) => template.type === type) || null;
}
