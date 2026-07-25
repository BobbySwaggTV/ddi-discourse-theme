import { getOwner } from "@ember/owner";
import { getDocumentTypeLabel } from "../../lib/ddi-document-type";
import { getLifecycleLabel } from "../../lib/ddi-lifecycle";

const FALLBACK_DOCUMENT_TYPE_LABEL = "INTELLIGENCE BRIEF";
const FALLBACK_LIFECYCLE_LABEL = "ACTIVE";

export default {
  setupComponent(args, component) {
    function updateDocument(topic) {
      if (!topic) {
        return;
      }

      const metadata = getOwner(component)
        .lookup("service:ddi-document-metadata")
        .getMetadata(topic);

      component.setProperties({
        author: metadata.author,
        status: metadata.status,
        classification: metadata.classification,
        classificationClass: metadata.classificationClass,
        documentTypeLabel:
          getDocumentTypeLabel(metadata.documentType) ||
          FALLBACK_DOCUMENT_TYPE_LABEL,
        lifecycleLabel:
          getLifecycleLabel(metadata.lifecycle) || FALLBACK_LIFECYCLE_LABEL,
      });
    }

    updateDocument(args.model);
  },
};