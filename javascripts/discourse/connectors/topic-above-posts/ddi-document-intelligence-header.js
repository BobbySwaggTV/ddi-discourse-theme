import { getOwner } from "@ember/owner";
import { getLifecycleLabel } from "../../lib/ddi-lifecycle";
import { parseCookedHtml } from "../../lib/ddi-cooked-parser";
import { parseCookedRevisionTable } from "../../lib/ddi-revision-table";
import { getCurrentApprovalState } from "../../lib/ddi-approval-state";

// Same fallback Dossier Header already uses for an untagged document's
// lifecycle — kept as the same literal value for consistency across the
// page, not extracted to lib/ for one shared string (this codebase's own
// threshold for lib extraction is genuine multi-step logic, not a single
// default literal — see ARCHITECTURE.md's Debug Mode section).
const FALLBACK_LIFECYCLE_LABEL = "ACTIVE";

export default {
  shouldRender() {
    return Boolean(settings.ddi_document_intelligence_header_enabled);
  },

  setupComponent(args, component) {
    const topic = args.model;
    const owner = getOwner(component);

    const metadata = owner
      .lookup("service:ddi-document-metadata")
      .getMetadata(topic);

    if (!topic || !metadata) {
      component.setProperties({ isVisible: false });
      return;
    }

    // parseCookedHtml() is the same LRU-cached parser the Revision History
    // panel already calls for this exact post — reuses whatever's already
    // in that cache rather than re-parsing the cooked HTML a second time.
    const post = topic.postStream?.posts?.[0];
    const revisionRows = parseCookedRevisionTable(
      parseCookedHtml(post?.cooked)
    );

    component.setProperties({
      isVisible: true,
      title: metadata.title,
      classification: metadata.classification,
      classificationClass: metadata.classificationClass,
      documentNumber: metadata.documentNumber,
      department: metadata.departmentDisplay,
      lifecycleLabel:
        getLifecycleLabel(metadata.lifecycle) || FALLBACK_LIFECYCLE_LABEL,
      revision: metadata.revision,
      approvalState: getCurrentApprovalState(revisionRows),
      // "Last Reviewed" has no field of its own — docs/ddi-document-
      // metadata-standard.md §4.8 documents it as optional and "not yet
      // stored," the same open question ddi-timeline.js's own "Reviewed"
      // lifecycle event already flagged and resolved the same way: reuse
      // updatedDate as the best available proxy, rather than inventing a
      // new topic custom field or body convention just to back a display
      // task. Same known simplification, not a new one.
      lastReviewed: metadata.updatedDate,
      readingTime: metadata.readingTime,
      // Split into a count plus an explicit "has it loaded" flag rather
      // than using relatedCount's own truthiness as the loading check —
      // a document with genuinely zero related documents (a real, common
      // case) would otherwise be indistinguishable from "still loading"
      // in the template, since 0 is falsy.
      relatedCount: 0,
      isRelatedCountLoaded: false,
    });

    // Reuses the exact same cached call Intelligence Network already makes
    // for this topic — see services/ddi-related-intelligence.js's own
    // per-topic Promise cache. No new fetch, no second scoring pass.
    owner
      .lookup("service:ddi-related-intelligence")
      .findRelated(topic)
      .then((related) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({
          relatedCount: related.length,
          isRelatedCountLoaded: true,
        });
      });
  },
};
