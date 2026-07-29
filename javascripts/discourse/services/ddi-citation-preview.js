import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { getClassification } from "../lib/ddi-classification";
import { formatDocumentId } from "../lib/ddi-document-id";
import { formatRevision } from "../lib/ddi-revision";
import { formatDocumentDate } from "../lib/ddi-format-date";
import { isValidDocumentType, getDocumentTypeLabel } from "../lib/ddi-document-type";
import { getShortDescription } from "../lib/ddi-division-summary";
import { UNCATEGORIZED_LABEL } from "../lib/ddi-category";

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

    const revision = await this._resolveRevision(topic);

    const executiveSummary = getShortDescription(
      topic.post_stream?.posts?.[0]?.cooked
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
      executiveSummary,
      updatedAt,
      updatedDate: formatDocumentDate(updatedAt),
      url: topic.slug ? `/t/${topic.slug}/${topic.id}` : `/t/${topic.id}`,
    };
  }

  async _resolveRevision(topic) {
    let version = topic.post_stream?.posts?.[0]?.version;

    if (version == null) {
      const response = await ajax(`/t/${topic.id}.json`).catch(() => null);
      version = response?.post_stream?.posts?.[0]?.version;
    }

    return version ? formatRevision(version) : "—";
  }
}
