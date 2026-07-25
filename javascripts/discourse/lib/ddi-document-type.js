export const DOCUMENT_TYPES = Object.freeze([
  "directive",
  "strategic-plan",
  "briefing",
  "intel-report",
  "threat-assessment",
  "incident-report",
  "after-action-report",
  "survey-report",
  "technical-spec",
  "production-record",
  "contract",
  "statement-of-work",
  "logistics-report",
  "press-release",
  "public-statement",
  "meeting-minutes",
  "correspondence",
  "charter",
  "policy",
  "manual",
  "procedure",
  "reference",
  "training-guide",
]);

export function isValidDocumentType(slug) {
  return DOCUMENT_TYPES.includes(slug);
}
