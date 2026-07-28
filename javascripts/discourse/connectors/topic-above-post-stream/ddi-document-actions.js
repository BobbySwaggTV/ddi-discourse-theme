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
    });
  },

  actions: {
    toggleReadingListMenu() {
      if (this.isReadingListMenuOpen) {
        this.set("isReadingListMenuOpen", false);
        return;
      }

      this.setProperties({
        isReadingListMenuOpen: true,
        readingListOptions: buildReadingListOptions(
          this.ddiReadingLists.lists,
          this.documentId
        ),
      });
    },

    async toggleReadingListMembership(listId, inList) {
      if (inList) {
        await this.ddiReadingLists.removeDocument(listId, this.documentId);
      } else {
        await this.ddiReadingLists.addDocument(listId, String(this.documentId));
      }

      if (this.isDestroying || this.isDestroyed) {
        return;
      }

      this.setProperties({
        isReadingListMenuOpen: false,
        readingListOptions: buildReadingListOptions(
          this.ddiReadingLists.lists,
          this.documentId
        ),
      });
    },

    manageReadingLists() {
      this.set("isReadingListMenuOpen", false);
      this.ddiReadingLists.open();
    },

    async toggleFavorite() {
      this.set("favoriteError", null);

      if (this.isFavorited) {
        const favorites = await this.ddiFavorites.getFavorites();

        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        const match = favorites.find(
          (favorite) => favorite.id === this.documentId
        );

        if (!match) {
          this.set("favoriteError", "Could not find this favorite to remove.");
          return;
        }

        const removed = await this.ddiFavorites.removeFavorite(
          match.bookmarkId
        );

        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        if (removed) {
          this.set("isFavorited", false);
        } else {
          this.set("favoriteError", "Could not remove favorite.");
        }

        return;
      }

      const toggle = findBookmarkToggle(this.firstPost);

      if (!toggle) {
        this.set("favoriteError", "Favoriting isn't available for this document.");
        return;
      }

      try {
        // Hands off to Discourse's own bookmark flow (which may itself open
        // a dialog for reminder options) rather than assuming a synchronous
        // toggle — this component intentionally does not guess at the
        // outcome by flipping isFavorited here; the topic model's own
        // `bookmarked` flag is the source of truth again on next visit.
        await toggle.call(this.firstPost);
      } catch {
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        this.set("favoriteError", "Could not open the favorite option for this document.");
      }
    },

    async share() {
      this.set("shareStatus", null);

      try {
        await navigator.clipboard.writeText(this.documentUrl);

        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        this.set("shareStatus", "Link copied to clipboard.");
      } catch {
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        this.set(
          "shareStatus",
          `Could not copy automatically — copy this link: ${this.documentUrl}`
        );
      }
    },

    openKnowledgeGraph() {
      document
        .getElementById("ddi-knowledge-graph-viewer")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  },
};
