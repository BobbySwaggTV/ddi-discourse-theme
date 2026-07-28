import { getOwner } from "@ember/owner";
import { buildReadingListOptions } from "../../lib/ddi-document-actions";

// Feature-detects Discourse's own bookmark-creation entry point on the
// topic's first post rather than reimplementing bookmark creation —
// consistent with how ddi-favorites.js deliberately never built an "add"
// path of its own, relying entirely on Discourse's native bookmark UI.
// toggleBookmark()/toggleBookmarkWithReminder() are the Post model methods
// the native bookmark button itself calls, based on general knowledge of
// Discourse's client-side API — not confirmed against a live instance (see
// ARCHITECTURE.md). If neither exists, favoriting an unfavorited document
// simply isn't offered here rather than risking a broken or duplicate
// bookmark flow.
function findBookmarkToggle(post) {
  return post?.toggleBookmark || post?.toggleBookmarkWithReminder || null;
}

export default {
  shouldRender() {
    return settings.ddi_document_actions_enabled;
  },

  setupComponent(args, component) {
    const topic = args.model;

    if (!topic) {
      component.setProperties({ isVisible: false });
      return;
    }

    const owner = getOwner(component);
    const currentUser = owner.lookup("service:current-user");
    const ddiReadingLists = owner.lookup("service:ddi-reading-lists");
    const ddiFavorites = owner.lookup("service:ddi-favorites");
    const firstPost = topic.postStream?.posts?.[0];

    component.setProperties({
      isVisible: true,
      documentId: topic.id,
      documentUrl: `${window.location.origin}${
        topic.slug ? `/t/${topic.slug}/${topic.id}` : `/t/${topic.id}`
      }`,
      ddiReadingLists,
      ddiFavorites,
      firstPost,

      readingListsEnabled: Boolean(settings.ddi_reading_lists_enabled),
      knowledgeGraphEnabled: Boolean(
        settings.ddi_knowledge_graph_viewer_enabled
      ),

      // Read directly off the already-loaded topic model — the same
      // "no new fetch" reuse ddi-document-metadata.js and friends already
      // apply to other topic-model fields (e.g. `.closed`).
      isFavorited: Boolean(topic.bookmarked),
      canAddFavorite: Boolean(currentUser) && Boolean(findBookmarkToggle(firstPost)),
      isFavoriteVisible: Boolean(currentUser),

      isReadingListMenuOpen: false,
      readingListOptions: [],
      favoriteError: null,
      shareStatus: null,

      // {{action}} is deprecated (discourse.template-action) — replaced
      // with {{on "click"}} (plus {{fn}} for the one that takes arguments)
      // in the template. {{on}} needs a plain function reference rather
      // than an `actions` hash entry and doesn't auto-bind `this`, so each
      // of these closes over `component` (and the already-captured
      // `ddiReadingLists`/`ddiFavorites`/`firstPost`) directly instead —
      // the same free-function, no-`this` pattern this theme already uses
      // for did-insert/did-update/will-destroy handlers. Bodies are
      // otherwise unchanged from the old `actions` hash (`this.` ->
      // `component.`, or the already-captured local variable, only).
      toggleReadingListMenu: () => {
        if (component.isReadingListMenuOpen) {
          component.set("isReadingListMenuOpen", false);
          return;
        }

        component.setProperties({
          isReadingListMenuOpen: true,
          readingListOptions: buildReadingListOptions(
            ddiReadingLists.lists,
            component.documentId
          ),
        });
      },

      toggleReadingListMembership: async (listId, inList) => {
        if (inList) {
          await ddiReadingLists.removeDocument(listId, component.documentId);
        } else {
          await ddiReadingLists.addDocument(
            listId,
            String(component.documentId)
          );
        }

        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({
          isReadingListMenuOpen: false,
          readingListOptions: buildReadingListOptions(
            ddiReadingLists.lists,
            component.documentId
          ),
        });
      },

      manageReadingLists: () => {
        component.set("isReadingListMenuOpen", false);
        ddiReadingLists.open();
      },

      toggleFavorite: async () => {
        component.set("favoriteError", null);

        if (component.isFavorited) {
          const favorites = await ddiFavorites.getFavorites();

          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          const match = favorites.find(
            (favorite) => favorite.id === component.documentId
          );

          if (!match) {
            component.set(
              "favoriteError",
              "Could not find this favorite to remove."
            );
            return;
          }

          const removed = await ddiFavorites.removeFavorite(
            match.bookmarkId
          );

          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          if (removed) {
            component.set("isFavorited", false);
          } else {
            component.set("favoriteError", "Could not remove favorite.");
          }

          return;
        }

        const toggle = findBookmarkToggle(component.firstPost);

        if (!toggle) {
          component.set(
            "favoriteError",
            "Favoriting isn't available for this document."
          );
          return;
        }

        try {
          // Hands off to Discourse's own bookmark flow (which may itself
          // open a dialog for reminder options) rather than assuming a
          // synchronous toggle — this component intentionally does not
          // guess at the outcome by flipping isFavorited here; the topic
          // model's own `bookmarked` flag is the source of truth again on
          // next visit.
          await toggle.call(component.firstPost);
        } catch {
          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          component.set(
            "favoriteError",
            "Could not open the favorite option for this document."
          );
        }
      },

      share: async () => {
        component.set("shareStatus", null);

        try {
          await navigator.clipboard.writeText(component.documentUrl);

          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          component.set("shareStatus", "Link copied to clipboard.");
        } catch {
          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          component.set(
            "shareStatus",
            `Could not copy automatically — copy this link: ${component.documentUrl}`
          );
        }
      },

      openKnowledgeGraph: () => {
        document
          .getElementById("ddi-knowledge-graph-viewer")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    });
  },
};
