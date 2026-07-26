import Service from "@ember/service";
import { ajax } from "discourse/lib/ajax";

// Discourse paginates /latest.json via topic_list.more_topics_url, the same
// "follow the link until absent" shape already confirmed for bookmarks
// (more_bookmarks_url — see ARCHITECTURE.md's Favorites Panel section). A
// safety bound against a runaway loop, not a feature — at Discourse's
// default page size this covers roughly 1,500 topics.
const MAX_PAGES = 50;

export default class DdiArchiveService extends Service {
  // Stores the in-flight/completed Promise itself, not its resolved value —
  // so two features looking this service up in the same tick (e.g. System
  // Status opening while Integrity Dashboard is still loading) share the
  // same fetch instead of each starting an independent one. Cleared never:
  // "cache for the session" means exactly one fetch per page load.
  _cache = null;

  async getTopics() {
    if (!this._cache) {
      this._cache = this._fetchAllTopics();
    }

    return this._cache;
  }

  async _fetchAllTopics() {
    const topics = [];
    let url = "/latest.json";
    let pagesFetched = 0;

    while (url && pagesFetched < MAX_PAGES) {
      const response = await ajax(url).catch(() => null);
      pagesFetched++;

      if (!response) {
        break;
      }

      topics.push(...(response.topic_list?.topics || []));
      url = response.topic_list?.more_topics_url || null;
    }

    return topics;
  }
}
