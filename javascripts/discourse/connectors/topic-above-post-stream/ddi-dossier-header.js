import { getClassification } from "../../lib/ddi-classification";
import { formatDocumentAuthor } from "../../lib/ddi-author";

export default {
  setupComponent(args, component) {
    function updateDocument(topic) {
      if (!topic) {
        return;
      }

      const author = formatDocumentAuthor(
        args.model.postStream?.posts?.[0]?.username
      );

      const status = topic.closed ? "LOCKED" : "ACTIVE";

      const {
        classification,
        className: classificationClass,
      } = getClassification(topic);

      component.setProperties({
        author,
        status,
        classification,
        classificationClass,
      });
    }

    updateDocument(args.model);
  },
};