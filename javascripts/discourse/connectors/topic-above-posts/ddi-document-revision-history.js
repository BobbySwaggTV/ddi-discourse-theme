import { getOwner } from "@ember/owner";
import { parseCookedHtml } from "../../lib/ddi-cooked-parser";
import {
  parseCookedRevisionTable,
  getRevisionsNewestFirst,
} from "../../lib/ddi-revision-table";

export default {
  shouldRender() {
    return Boolean(settings.ddi_document_revision_history_enabled);
  },

  setupComponent(args, component) {
    const topic = args.model;
    const owner = getOwner(component);

    const metadata = owner
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    if (!topic || !metadata) {
      component.setProperties({ revisions: [], revisionCountLabel: "" });
      return;
    }

    // parseCookedHtml() is the same LRU-cached parser Document Relationships
    // and Intelligence Relationships already call for this exact topic's
    // first post — reuses whatever's already in that cache rather than
    // re-parsing the cooked HTML a second time.
    const post = topic.postStream?.posts?.[0];
    const parsed = parseCookedHtml(post?.cooked);
    const tableRows = parseCookedRevisionTable(parsed);

    // No "## Revision History" table in the body — every document
    // published before this feature existed, plus any that simply never
    // added one. Falls back to the single system-derived snapshot the
    // Metadata Engine already computes (`metadata.revision`, from
    // Discourse's own post-edit version counter) — the same fields this
    // connector displayed before this feature existed, so an existing
    // document's page looks exactly as it always has.
    const rows = tableRows.length
      ? tableRows
      : [
          {
            revisionNumber: metadata.revision,
            date: metadata.updatedDate,
            author: metadata.author,
            summary: "No revision notes recorded.",
            approvalStatus: metadata.status,
          },
        ];

    component.setProperties({
      revisions: getRevisionsNewestFirst(rows),
      revisionCountLabel: `${rows.length} revision${rows.length === 1 ? "" : "s"}`,
    });
  },
};
