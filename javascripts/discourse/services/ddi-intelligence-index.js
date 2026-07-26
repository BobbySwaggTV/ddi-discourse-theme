import Service, { service } from "@ember/service";
import {
  sortDocumentsAlphabetically,
  filterDocuments,
} from "../lib/ddi-document-index";

export default class DdiIntelligenceIndexService extends Service {
  @service ddiCitationPreview;
  @service ddiArchive;

  async getIndex(filters = {}) {
    const topics = await this.ddiArchive.getTopics();

    const documents = await Promise.all(
      topics.map((topic) => this.ddiCitationPreview.getCitation(topic))
    );

    return filterDocuments(sortDocumentsAlphabetically(documents), filters);
  }
}
