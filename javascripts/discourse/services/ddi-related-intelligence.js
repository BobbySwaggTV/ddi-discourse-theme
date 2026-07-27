import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import { getClassification } from "../lib/ddi-classification";

const CATEGORY_MATCH_SCORE = 100;
const CLASSIFICATION_MATCH_SCORE = 50;
const SHARED_TAG_SCORE = 25;
const MAX_RESULTS = 5;

export default class DdiRelatedIntelligenceService extends Service {
  @service ddiCitationPreview;

  // Intelligence Network and Knowledge Graph Viewer are both
  // topic-below-post-stream connectors that call findRelated() for the
  // *same* current topic on every single topic page view — without this,
  // that's two independent category-topics fetches plus one tag-topics
  // fetch per tag, doubled, every time. Same Promise-as-cache-value
  // technique as ddi-citation-preview.js's per-document cache: the topic's
  // own related set can't change within one page view, so caching it for
  // the life of this service (a session-lived singleton) is safe.
  _cache = new Map();

  async findRelated(topic) {
    if (!topic) {
      return [];
    }

    const key = topic.id;

    if (!this._cache.has(key)) {
      this._cache.set(key, this._findRelated(topic));
    }

    return this._cache.get(key);
  }

  async _findRelated(topic) {
    const candidates = await this._fetchCandidates(topic);

    const topResults = this._rank(topic, candidates).slice(0, MAX_RESULTS);

    return Promise.all(topResults.map((candidate) => this._present(candidate)));
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
    return this.ddiCitationPreview.getCitation(candidate);
  }
}
