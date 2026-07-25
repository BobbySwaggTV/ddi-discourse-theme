import Service from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { getClassification } from "../lib/ddi-classification";
import { formatDocumentId } from "../lib/ddi-document-id";

const CATEGORY_MATCH_SCORE = 100;
const CLASSIFICATION_MATCH_SCORE = 50;
const SHARED_TAG_SCORE = 25;
const MAX_RESULTS = 5;

export default class DdiRelatedIntelligenceService extends Service {
  async findRelated(topic) {
    if (!topic) {
      return [];
    }

    const candidates = await this._fetchCandidates(topic);

    return this._rank(topic, candidates)
      .slice(0, MAX_RESULTS)
      .map((candidate) => this._present(candidate));
  }

  async _fetchCandidates(topic) {
    const pools = await Promise.all([
      this._fetchCategoryTopics(topic).catch(() => []),
      ...this._fetchTagTopics(topic).map((promise) => promise.catch(() => [])),
    ]);

    const byId = new Map();

    pools
      .flat()
      .filter((candidate) => candidate && candidate.id !== topic.id)
      .forEach((candidate) => byId.set(candidate.id, candidate));

    return [...byId.values()];
  }

  async _fetchCategoryTopics(topic) {
    const category = topic.category;

    if (!category) {
      return [];
    }

    const response = await ajax(`/c/${category.slug}/${category.id}.json`);
    return response?.topic_list?.topics || [];
  }

  _fetchTagTopics(topic) {
    const tags = topic.tags || [];

    return tags.map(async (tag) => {
      const response = await ajax(`/tag/${tag}.json`);
      return response?.topic_list?.topics || [];
    });
  }

  _rank(topic, candidates) {
    const categoryId = topic.category_id ?? topic.category?.id;
    const { classification } = getClassification(topic);
    const tags = new Set(topic.tags || []);

    return candidates
      .map((candidate) => ({
        candidate,
        score: this._score(candidate, categoryId, classification, tags),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.candidate.created_at || "").localeCompare(
            a.candidate.created_at || ""
          )
      )
      .map((entry) => entry.candidate);
  }

  _score(candidate, categoryId, classification, tags) {
    let score = 0;

    if (candidate.category_id === categoryId) {
      score += CATEGORY_MATCH_SCORE;
    }

    const { classification: candidateClassification } =
      getClassification(candidate);

    if (candidateClassification === classification) {
      score += CLASSIFICATION_MATCH_SCORE;
    }

    const sharedTagCount = (candidate.tags || []).filter((tag) =>
      tags.has(tag)
    ).length;

    score += sharedTagCount * SHARED_TAG_SCORE;

    return score;
  }

  _present(candidate) {
    const { classification, className: classificationClass } =
      getClassification(candidate);

    return {
      id: candidate.id,
      title: candidate.title,
      url: `/t/${candidate.slug}/${candidate.id}`,
      documentId: formatDocumentId(candidate.id),
      classification,
      classificationClass,
    };
  }
}
