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

    return this.getCitation(topic);
  }

  async getCitation(topic) {
    if (!topic) {
      return null;
    }

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

    const citation = {
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

    this._cache.set(String(topic.id), Promise.resolve(citation));

    return citation;
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
