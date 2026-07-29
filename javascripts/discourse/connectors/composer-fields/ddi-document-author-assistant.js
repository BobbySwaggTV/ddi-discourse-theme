import { getOwner } from "@ember/owner";
import { addObserver, removeObserver } from "@ember/object/observers";
import { buildAuthorAssistantChecks } from "../../lib/ddi-document-author-assistant";
import { UNCATEGORIZED_LABEL } from "../../lib/ddi-category";

// The properties that can change what the panel should show. `tags` is
// reassigned wholesale (not mutated) by Discourse's tag chooser, so an
// observer on it fires the same way `reply`/`title`/`categoryId` do.
const WATCHED_PROPERTIES = ["reply", "title", "categoryId", "tags"];

// Confidence caveat (same class as Post's toggleBookmark feature-detection
// and addKeyboardShortcut elsewhere in this theme): `creatingTopic`,
// `editingPost`, and `editingFirstPost` are long-standing Composer model
// properties, but this is the first time this theme has touched the
// composer at all, so none of the three has been confirmed against a live
// instance. The fallback (`post.post_number === 1`) degrades to the same
// answer `editingFirstPost` is documented to compute if that property is
// ever absent, rather than assuming and failing closed/open incorrectly.
function isDocumentComposerContext(model) {
  if (!model) {
    return false;
  }

  if (model.creatingTopic) {
    return true;
  }

  if (!model.editingPost) {
    return false;
  }

  return model.editingFirstPost !== undefined
    ? Boolean(model.editingFirstPost)
    : model.post?.post_number === 1;
}

export default {
  shouldRender() {
    return Boolean(settings.ddi_document_author_assistant_enabled);
  },

  setupComponent(args, component) {
    const owner = getOwner(component);
    const composer = owner.lookup("service:composer");
    const model = composer?.model;

    if (!isDocumentComposerContext(model)) {
      component.setProperties({ isVisible: false });
      return;
    }

    const site = owner.lookup("service:site");

    const recompute = () => {
      if (component.isDestroying || component.isDestroyed) {
        return;
      }

      const category = (site.categories || []).find(
        (candidate) => candidate.id === model.categoryId
      );

      component.setProperties({
        checks: buildAuthorAssistantChecks({
          topicId: model.topic?.id || null,
          raw: model.reply,
          tags: model.tags || [],
          categorySlug: category?.slug || null,
          categoryName: category?.name || UNCATEGORIZED_LABEL,
        }),
      });
    };

    WATCHED_PROPERTIES.forEach((property) =>
      addObserver(model, property, recompute)
    );

    component.setProperties({
      isVisible: true,
      checks: [],

      // {{will-destroy}}, not a component willDestroy() override — same
      // free-function lifecycle wiring already established for Knowledge
      // Graph Viewer's teardownGraphCanvas and Modal Accessibility's
      // teardownModal. Without this, every composer open/close cycle would
      // leave one more observer registered on the (session-lived) composer
      // model, since the model itself outlives any single connector
      // component instance.
      teardown: () => {
        WATCHED_PROPERTIES.forEach((property) =>
          removeObserver(model, property, recompute)
        );
      },
    });

    recompute();
  },
};
