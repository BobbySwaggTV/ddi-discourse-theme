import Service, { service } from "@ember/service";
import {
  findAdjacentDocuments,
  selectRecentDocuments,
} from "../lib/ddi-document-order";

const MAX_RECENT = 5;

export default class DdiArchiveNavigationService extends Service {
  @service ddiDocumentMetadata;
  @service ddiIntelligenceIndex;

  async getNavigation(topic) {
    const category = topic?.category;
    const metadata = this.ddiDocumentMetadata.getMetadata(topic);

    const department = {
      name: metadata?.departmentDisplay,
      url: category ? `/c/${category.slug}/${category.id}` : null,
    };

    if (!topic || !category) {
      return { department, previous: null, next: null, recent: [] };
    }

    const departmentDocuments = await this.ddiIntelligenceIndex.getIndex({
      department: metadata.departmentDisplay,
    });

    const { previous, next } = findAdjacentDocuments(
      departmentDocuments,
      topic.id
    );
    const recent = selectRecentDocuments(departmentDocuments, topic.id, MAX_RECENT);

    return { department, previous, next, recent };
  }
}
