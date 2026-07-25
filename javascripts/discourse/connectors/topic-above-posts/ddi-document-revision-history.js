import { formatDocumentDate } from "../../lib/ddi-format-date";
import { formatRevision } from "../../lib/ddi-revision";
import { formatDocumentAuthor } from "../../lib/ddi-author";

export default {
  setupComponent(args, component) {
    const topic = args.model;
    const post = topic.postStream?.posts?.[0];

    const revisionNumber = formatRevision(post?.version);

    const lastUpdated = formatDocumentDate(
      post?.updated_at || post?.created_at
    );

    const author = formatDocumentAuthor(post?.username);

    const revisionStatus = topic.closed ? "LOCKED" : "ACTIVE";

    component.setProperties({
      revisionNumber,
      lastUpdated,
      author,
      revisionStatus,
      revisionNotes: "No revision notes recorded.",
    });
  },
};
