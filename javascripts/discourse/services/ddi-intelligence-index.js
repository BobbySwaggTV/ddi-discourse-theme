import Service, { service } from "@ember/service";
import { ajax } from "discourse/lib/ajax";
import {
  sortDocumentsAlphabetically,
  filterDocuments,
} from "../lib/ddi-document-index";

export default class DdiIntelligenceIndexService extends Service {
  @service ddiCitationPreview;

  async getIndex(filters = {}) {
    const topics = await this._fetchArchiveTopics();

    const documents = await Promise.all(
      topics.map((topic) => this.ddiCitationPreview.getCitation(topic))
    );

    return filterDocuments(sortDocumentsAlphabetically(documents), filters);
  }

  async _fetchArchiveTopics() {
    const response = await ajax("/latest.json").catch(() => null);
    return response?.topic_list?.topics || [];
  }
}
