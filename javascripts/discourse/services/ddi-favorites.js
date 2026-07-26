import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { parseTopicIdFromUrl } from "../lib/ddi-document-id";

// Discourse serves a maximum of 20 bookmarks per page
// (BOOKMARKS_LIMIT in UsersController#bookmarks) and signals another page
// via more_bookmarks_url. This caps how many pages a single getFavorites()
// call will follow — a safety bound against a runaway loop, not a feature.
const MAX_PAGES = 10;

export default class DdiFavoritesService extends Service {
  @service ddiCitationPreview;
  @service currentUser;

  async getFavorites() {
    const bookmarks = await this._fetchAllBookmarks();
    const topicBookmarks = this._uniqueTopicBookmarks(bookmarks);

    const citations = await Promise.all(
      topicBookmarks.map(async ({ bookmarkId, topicId }) => {
        const citation = await this.ddiCitationPreview
          .getCitationById(topicId)
          .catch(() => null);

        return citation ? { ...citation, bookmarkId } : null;
      })
    );

    return citations.filter(Boolean);
  }

  async removeFavorite(bookmarkId) {
    if (!bookmarkId) {
      return false;
    }

    return ajax(`/bookmarks/${bookmarkId}`, { type: "DELETE" })
      .then(() => true)
      .catch(() => false);
  }

  // GET /u/{username}/bookmarks.json — confirmed against Discourse's own
  // UsersController#bookmarks / config/routes.rb. Requires a logged-in
  // user (requires_login); for the current user's own bookmarks,
  // guardian.ensure_can_see_bookmarks! is satisfied by simply being that
  // user. Response is { bookmarks: [...], more_bookmarks_url } at the top
  // level (UserBookmarkListSerializer) — not nested under a
  // "user_bookmark_list" key.
  async _fetchAllBookmarks() {
    if (!this.currentUser) {
      return [];
    }

    const bookmarks = [];
    let url = `/u/${this.currentUser.username}/bookmarks.json`;
    let pagesFetched = 0;

    while (url && pagesFetched < MAX_PAGES) {
      const response = await ajax(url).catch(() => null);
      pagesFetched++;

      if (!response) {
        break;
      }

      bookmarks.push(...(response.bookmarks || []));
      url = response.more_bookmarks_url || null;
    }

    return bookmarks;
  }

  // Each bookmark's serialized shape (UserBookmarkBaseSerializer) has no
  // topic_id field — confirmed. It does expose bookmarkable_url, a real
  // link to the bookmarked topic or post, which the existing
  // parseTopicIdFromUrl() (already handles /t/{id}, /t/{slug}/{id}, and
  // .../{post_number} shapes) resolves to a topic id uniformly, for both
  // topic-level and post-level bookmarks — no need to branch on
  // bookmarkable_type at all.
  _uniqueTopicBookmarks(bookmarks) {
    const seen = new Set();
    const result = [];

    for (const bookmark of bookmarks || []) {
      const topicId = parseTopicIdFromUrl(bookmark.bookmarkable_url);

      if (!topicId || seen.has(topicId)) {
        continue;
      }

      seen.add(topicId);
      result.push({ bookmarkId: bookmark.id, topicId });
    }

    return result;
  }
}
