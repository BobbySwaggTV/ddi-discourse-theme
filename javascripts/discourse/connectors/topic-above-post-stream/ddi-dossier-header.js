import { getClassification } from "../../lib/ddi-classification";
import { formatDocumentDate } from "../../lib/ddi-format-date";

export default {
  setupComponent(args, component) {
    function updateDocument(topic) {
      if (!topic) {
        return;
      }

      const documentId = String(topic.id).padStart(6, "0");

      const issuedDate = formatDocumentDate(topic.created_at);

      const author =
        (args.model.postStream?.posts?.[0]?.username || "SYSTEM").toUpperCase();

      const status = topic.closed ? "LOCKED" : "ACTIVE";

      const {
        classification,
        className: classificationClass,
      } = getClassification(topic);

      component.setProperties({
        documentId,
        issuedDate,
        author,
        status,
        classification,
        classificationClass,
      });
    }

    updateDocument(args.model);
  },
};