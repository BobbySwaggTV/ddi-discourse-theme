import { getClassification } from "../../lib/ddi-classification";
import { formatDocumentId } from "../../lib/ddi-document-id";
import { formatDocumentDate } from "../../lib/ddi-format-date";
import { formatRevision } from "../../lib/ddi-revision";
import { formatDocumentAuthor } from "../../lib/ddi-author";
import { UNCATEGORIZED_LABEL } from "../../lib/ddi-category";

export default {
  setupComponent(args, component) {
    const topic = args.model;
    const post = topic.postStream?.posts?.[0];

    const { classification, className: classificationClass } =
      getClassification(topic);

    component.setProperties({
      documentId: formatDocumentId(topic.id),
      classification,
      classificationClass,
      revision: formatRevision(post?.version),
      department: topic.category?.name ?? UNCATEGORIZED_LABEL,
      lastUpdated: formatDocumentDate(post?.updated_at || post?.created_at),
      author: formatDocumentAuthor(post?.username),
    });
  },
};
