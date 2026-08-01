import { getOwner } from "@ember/owner";
import { DOCUMENT_TEMPLATES, getDocumentTemplate } from "../../lib/ddi-document-templates";
import { isValidDocumentType } from "../../lib/ddi-document-type";

export default {
  shouldRender() {
    return Boolean(settings.ddi_document_template_library_enabled);
  },

  setupComponent(args, component) {
    const owner = getOwner(component);
    const composer = owner.lookup("service:composer");
    const model = composer?.model;

    // Only a brand-new topic has nothing yet to protect — editing an
    // existing document's first post always has real content already.
    // "Only prefill new documents" is satisfied by never rendering the
    // picker at all in that case, not by a runtime overwrite check.
    if (!model?.creatingTopic) {
      component.setProperties({ isVisible: false });
      return;
    }

    const applyTemplate = (type) => {
      const template = getDocumentTemplate(type);

      if (!template) {
        return;
      }

      // Reuses the same "one Document Type tag" convention the Metadata
      // Engine and Author Assistant already read
      // (`tags.find((tag) => isValidDocumentType(tag))`) — swapping the
      // tag rather than appending a second, conflicting one.
      const otherTags = (model.tags || []).filter(
        (tag) => !isValidDocumentType(tag)
      );
      model.set("tags", [...otherTags, template.type]);

      if ((model.reply || "").trim().length > 0) {
        component.set(
          "statusMessage",
          `"${template.label}" tagged — not inserted, this document already has content.`
        );
        return;
      }

      model.set("reply", template.body);
      component.set("statusMessage", `"${template.label}" template inserted.`);
    };

    component.setProperties({
      isVisible: true,
      templates: DOCUMENT_TEMPLATES,
      statusMessage: null,
      handleSelectChange: (event) => applyTemplate(event.target.value),
    });
  },
};
