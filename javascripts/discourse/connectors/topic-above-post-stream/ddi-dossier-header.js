import { getClassification } from "../../lib/ddi-classification";

export default {
  setupComponent(args, component) {

    function updateDocument(topic) {

      if (!topic) {
        return;
      }

      const documentId = String(topic.id).padStart(6, "0");

      const issuedDate = new Date(topic.created_at)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();

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