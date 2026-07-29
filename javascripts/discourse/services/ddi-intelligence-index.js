import Service, { service } from "@ember/service";
import {
  sortDocumentsAlphabetically,
  filterDocuments,
} from "../lib/ddi-document-index";

export default class DdiIntelligenceIndexService extends Service {
  @service ddiCitationPreview;
  @service ddiArchive;

  // Performance Audit (v1.1): up to 5 independent connectors/services call
  // getIndex() with the same filters on a single page view today — Browse
  // Archive and Intelligence Dashboard both on the homepage/category pages,
  // Division Cards and Division Header both on a category page, and Archive
  // Navigation on every single topic page view. Before this cache, every one
  // of those repeated the full archive-wide Promise.all(getCitation) pass
  // and re-sorted/re-filtered the result, even once ddiCitationPreview's own
  // cache (see that service) made the individual citations cheap to
  // re-fetch — the sort/filter/array-construction work itself was still
  // being redone. Filters only ever vary by `department` in practice (no
  // caller passes `classification` today — see lib/ddi-document-index.js),
  // but the key includes both for correctness if that ever changes. Cache
  // for the session, same tradeoff as ddiArchive.getTopics() underneath it,
  // which never invalidates either.
  _cache = new Map();

  async getIndex(filters = {}) {
    const key = `${filters.department || ""}::${filters.classification || ""}`;

    if (!this._cache.has(key)) {
      this._cache.set(key, this._buildIndex(filters));
    }

    return this._cache.get(key);
  }

  async _buildIndex(filters) {
    const topics = await this.ddiArchive.getTopics();

    const documents = await Promise.all(
      topics.map((topic) => this.ddiCitationPreview.getCitation(topic))
    );

    return filterDocuments(sortDocumentsAlphabetically(documents), filters);
  }
}
