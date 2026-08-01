const DEFAULT_CLASSIFICATION = Object.freeze({
  classification: "PUBLIC RELEASE",
  className: "ddi-public",
  message: "Approved for unrestricted public distribution.",
});

// Exported (v1.9) for the Document Lifecycle Dashboard's classification
// filter, the first consumer that needs the full list rather than a
// single lookup — the same closed-vocabulary-array-export pattern
// DOCUMENT_TYPES/LIFECYCLE_STATES/DEPARTMENTS/RELATIONSHIP_TYPES already
// use in their own files. Purely additive; getClassification()/
// isValidClassification() are unchanged and still the only way anything
// else in this theme resolves or validates a classification.
export const CLASSIFICATIONS = Object.freeze([
  {
    slug: "top-secret",
    classification: "TOP SECRET",
    className: "ddi-top-secret",
    message: "Command Authority clearance required.",
  },
  {
    slug: "restricted",
    classification: "RESTRICTED",
    className: "ddi-restricted",
    message: "Restricted operational information.",
  },
  {
    slug: "confidential",
    classification: "CONFIDENTIAL",
    className: "ddi-confidential",
    message:
      "Disclosure outside authorized personnel is prohibited.",
  },
  {
    slug: "internal",
    classification: "INTERNAL",
    className: "ddi-internal",
    message: "Distribution limited to DDI personnel.",
  },
]);

export function getClassification(topic) {
  const tags = topic?.tags || [];

  const match = CLASSIFICATIONS.find((classification) =>
    tags.some((tag) => tag === classification.slug)
  );

  return match || DEFAULT_CLASSIFICATION;
}

export function isValidClassification(slug) {
  return CLASSIFICATIONS.some((classification) => classification.slug === slug);
}