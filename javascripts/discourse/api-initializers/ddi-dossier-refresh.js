import { apiInitializer } from "discourse/lib/api";

import { formatDocumentDate } from "../lib/ddi-format-date";
import { formatDocumentId } from "../lib/ddi-document-id";

export default apiInitializer("1.0", (api) => {
  api.onPageChange(() => {
    const topic = api.container.lookup("controller:topic")?.model;

    if (!topic) {
      return;
    }

    const header = document.querySelector(".ddi-dossier-header");

    if (!header) {
      return;
    }

    header.querySelector(".ddi-document-id")?.replaceChildren(
      formatDocumentId(topic.id)
    );

    header.querySelector(".ddi-issued-date")?.replaceChildren(
      `ISSUED • ${formatDocumentDate(topic.created_at)}`
    );
  });
});