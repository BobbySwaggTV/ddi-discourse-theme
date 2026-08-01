import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { getClassification } from "../lib/ddi-classification";
import { formatDocumentId } from "../lib/ddi-document-id";
import { formatRevision } from "../lib/ddi-revision";
import { formatDocumentDate } from "../lib/ddi-format-date";
import { isValidDocumentType, getDocumentTypeLabel } from "../lib/ddi-document-type";
import { getShortDescription } from "../lib/ddi-division-summary";
import { UNCATEGORIZED_LABEL } from "../lib/ddi-category";
import { parseCookedHtml } from "../lib/ddi-cooked-parser";
import { parseCookedRevisionTable } from "../lib/ddi-revision-table";
import { getCurrentApprovalState } from "../lib/ddi-approval-state";

export default class DdiCitationPreviewService extends Service {
  @service site;

  // Performance Audit (v1.1): getCitation(topic) used to recompute from
  // scratch on every call and never consulted this cache, even though it
  // wrote to it — only getCitationById() actually benefited from a repeat
  // call. That mattered more than it looked: getIndex()
  // (services/ddi-intelligence-index.js) calls getCitation() once per topic
  // in the *entire* archive, and up to 5 independent connectors/services on
  // a single homepage/category page (Browse Archive, Intelligence
  // Dashboard, Division Cards, Division Header, Archive Navigation on every
  // topic page view) each call getIndex() themselves — so the same topic's
  // citation, including _resolveRevision()'s own `/t/{id}.json` fallback
  // fetch (real for every /latest.json-sourced topic, which never carries
  // post_stream), was being rebuilt and re-fetched once per connector, per
  // page view. getCitation() and getCitationById() now both read/write the
  // same Map, keyed by topic id either way, via a shared _buildCitation()
  // that itself never touches the cache — avoiding the re-entrant deadlock
  // a naive "getCitation() calls getCitationById()'s cache" merge would
  // cause (_loadCitationById() already writes this exact key before it
  // resolves).
  _cache = new Map();

  async getCitationById(documentId) {
    if (!documentId) {
      return null;
    }

    const key = String(documentId);

    if (!this._cache.has(key)) {
      this._cache.set(key, this._loadCitationById(documentId));
    }

    return this._cache.get(key);
  }

  async _loadCitationById(documentId) {
    const topic = await ajax(`/t/${documentId}.json`).catch(() => null);

    if (!topic) {
      this._cache.delete(String(documentId));
      return null;
    }

    return this._buildCitation(topic);
  }

  async getCitation(topic) {
    if (!topic) {
      return null;
    }

    const key = String(topic.id);

    if (!this._cache.has(key)) {
      this._cache.set(key, this._buildCitation(topic));
    }

    return this._cache.get(key);
  }

  async _buildCitation(topic) {
    const { classification, className: classificationClass } =
      getClassification(topic);

    const department =
      this.site.categories?.find(
        (category) => category.id === topic.category_id
      )?.name || UNCATEGORIZED_LABEL;

    const documentType =
      (topic.tags || []).find((tag) => isValidDocumentType(tag)) || null;

    const updatedAt = topic.bumped_at || topic.created_at || null;

    const { revision, cooked } = await this._resolvePost(topic);

    const executiveSummary = getShortDescription(cooked);

    // parseCookedHtml() is LRU-cached by the exact cooked string —
    // getShortDescription() above already parsed this same string, so this
    // reuses that cached parse rather than re-parsing the cooked HTML a
    // second time (see lib/ddi-cooked-parser.js). Adding this field here,
    // once, is what makes every existing citation consumer (Intelligence
    // Relationships, Browse Archive, Archive Navigation, Knowledge Graph,
    // Document Quick Preview) able to show approval state without any of
    // them fetching or parsing anything new themselves.
    const approvalState = getCurrentApprovalState(
      parseCookedRevisionTable(parseCookedHtml(cooked))
    );

    return {
      id: topic.id,
      documentId: formatDocumentId(topic.id),
      title: topic.title,
      classification,
      classificationClass,
      department,
      documentType,
      documentTypeLabel: getDocumentTypeLabel(documentType),
      revision,
      approvalState,
      executiveSummary,
      updatedAt,
      updatedDate: formatDocumentDate(updatedAt),
      url: topic.slug ? `/t/${topic.slug}/${topic.id}` : `/t/${topic.id}`,
    };
  }

  // Bug fix (v1.9): this used to be _resolveRevision(), which fetched the
  // full topic when `post_stream` was missing (true for every topic that
  // reached getCitation() via ddiArchive.getTopics()'s /latest.json list,
  // which never carries post_stream) but only ever kept `version` from
  // that response, discarding the rest — including the exact cooked HTML
  // _buildCitation() needed for executiveSummary/approvalState, which it
  // was instead reading from the original (post_stream-less) `topic`
  // argument and getting `undefined` every time. That meant Browse
  // Archive's approval badges (v1.8) silently showed "Draft" for nearly
  // every document, and executive summaries were silently blank, despite
  // a full-topic fetch already having happened and paid for that data. Now
  // returns both fields from whichever post actually has them — no new
  // fetch, just no longer throwing away most of the response it already
  // fetched.
  async _resolvePost(topic) {
    let post = topic.post_stream?.posts?.[0];

    if (post?.version == null) {
      const response = await ajax(`/t/${topic.id}.json`).catch(() => null);
      post = response?.post_stream?.posts?.[0] || post;
    }

    return {
      revision: post?.version ? formatRevision(post.version) : "—",
      cooked: post?.cooked,
    };
  }
}
