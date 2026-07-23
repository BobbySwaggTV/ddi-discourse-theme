export default {
  setupComponent(args, component) {
    const tags = args.model.tags || [];

    const hasTag = (slug) => tags.some(tag => tag.slug === slug);

    let classification = "PUBLIC RELEASE";
    let classificationClass = "ddi-public";

    let message =
      "Approved for unrestricted distribution.";

    if (hasTag("internal")) {
      classification = "INTERNAL";
      classificationClass = "ddi-internal";
      message = "Distribution limited to DDI personnel.";
    }

    if (hasTag("confidential")) {
      classification = "CONFIDENTIAL";
      classificationClass = "ddi-confidential";
      message =
        "Disclosure outside authorized personnel is prohibited.";
    }

    if (hasTag("restricted")) {
      classification = "RESTRICTED";
      classificationClass = "ddi-restricted";
      message =
        "Restricted operational information.";
    }

    if (hasTag("top-secret")) {
      classification = "TOP SECRET";
      classificationClass = "ddi-top-secret";
      message =
        "Command Authority clearance required.";
    }

    component.setProperties({
      classification,
      classificationClass,
      message,
    });
  },
};
