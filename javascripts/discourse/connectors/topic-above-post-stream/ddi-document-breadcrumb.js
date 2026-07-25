import { getOwner } from "@ember/owner";
import { getDocumentTypeLabel } from "../../lib/ddi-document-type";

const ARCHIVE_LABEL = "DDC Intelligence Archive";
const FALLBACK_DEPARTMENT_LABEL = "Unknown Department";
const FALLBACK_DOCUMENT_TYPE_LABEL = "Unknown Document Type";

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
        archiveLabel: ARCHIVE_LABEL,
        departmentLabel: metadata.department
          ? metadata.departmentDisplay
          : FALLBACK_DEPARTMENT_LABEL,
        documentTypeLabel:
          getDocumentTypeLabel(metadata.documentType) ||
          FALLBACK_DOCUMENT_TYPE_LABEL,
        documentTitle: metadata.title,
      });
    }

    updateDocument(args.model);
  },
};
