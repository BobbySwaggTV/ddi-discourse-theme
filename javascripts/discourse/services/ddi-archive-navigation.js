import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import {
  findAdjacentDocuments,
  selectRecentDocuments,
} from "../lib/ddi-document-order";

const MAX_RECENT = 5;

export default class DdiArchiveNavigationService extends Service {
  @service ddiDocumentMetadata;
  @service ddiCitationPreview;

  async getNavigation(topic) {
    const category = topic?.category;

    const department = {
      name: this.ddiDocumentMetadata.getMetadata(topic)?.departmentDisplay,
      url: category ? `/c/${category.slug}/${category.id}` : null,
    };

    if (!topic || !category) {
      return { department, previous: null, next: null, recent: [] };
    }

    const departmentTopics = await this._fetchDepartmentTopics(category);

    const { previous, next } = findAdjacentDocuments(
      departmentTopics,
      topic.id
    );
    const recentCandidates = selectRecentDocuments(
      departmentTopics,
      topic.id,
      MAX_RECENT
    );

    const [previousDoc, nextDoc, recentDocs] = await Promise.all([
      previous ? this.ddiCitationPreview.getCitation(previous) : null,
      next ? this.ddiCitationPreview.getCitation(next) : null,
      Promise.all(
        recentCandidates.map((candidate) =>
          this.ddiCitationPreview.getCitation(candidate)
        )
      ),
    ]);

    return { department, previous: previousDoc, next: nextDoc, recent: recentDocs };
  }

  async _fetchDepartmentTopics(category) {
    const response = await ajax(
      `/c/${category.slug}/${category.id}.json`
    ).catch(() => null);

    return response?.topic_list?.topics || [];
  }
}
