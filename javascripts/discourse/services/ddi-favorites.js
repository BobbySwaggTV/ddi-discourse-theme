import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";

export default class DdiFavoritesService extends Service {
  @service ddiCitationPreview;

  async getFavorites() {
    const bookmarks = await this._fetchBookmarks();
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

  async _fetchBookmarks() {
    const response = await ajax("/bookmarks.json").catch(() => null);

    return (
      response?.user_bookmark_list?.bookmarks || response?.bookmarks || []
    );
  }

  _uniqueTopicBookmarks(bookmarks) {
    const seen = new Set();
    const result = [];

    for (const bookmark of bookmarks || []) {
      const topicId =
        bookmark.topic_id ??
        (bookmark.bookmarkable_type === "Topic"
          ? bookmark.bookmarkable_id
          : null);

      if (!topicId || seen.has(topicId)) {
        continue;
      }

      seen.add(topicId);
      result.push({ bookmarkId: bookmark.id, topicId });
    }

    return result;
  }
}
