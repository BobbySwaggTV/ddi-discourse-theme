export function getClassification(topic) {
  const tags = topic?.tags || [];

  const hasTag = (slug) =>
    tags.some((tag) => tag.slug === slug);

  if (hasTag("top-secret")) {
    return {
      classification: "TOP SECRET",
      className: "ddi-top-secret",
      message: "Command Authority clearance required.",
    };
  }

  if (hasTag("restricted")) {
    return {
      classification: "RESTRICTED",
      className: "ddi-restricted",
      message: "Restricted operational information.",
    };
  }

  if (hasTag("confidential")) {
    return {
      classification: "CONFIDENTIAL",
      className: "ddi-confidential",
      message:
        "Disclosure outside authorized personnel is prohibited.",
    };
  }

  if (hasTag("internal")) {
    return {
      classification: "INTERNAL",
      className: "ddi-internal",
      message: "Distribution limited to DDI personnel.",
    };
  }

  return {
    classification: "PUBLIC RELEASE",
    className: "ddi-public",
    message: "Approved for unrestricted public distribution.",
  };
}
