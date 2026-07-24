const DEFAULT_CLASSIFICATION = Object.freeze({
  classification: "PUBLIC RELEASE",
  className: "ddi-public",
  message: "Approved for unrestricted public distribution.",
});

const CLASSIFICATIONS = Object.freeze([
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
    tags.some((tag) => tag.slug === classification.slug)
  );

  return match || DEFAULT_CLASSIFICATION;
}