import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0", (api) => {

  api.onPageChange((url, title) => {

    const topicController = api.container.lookup("controller:topic");

    if (!topicController?.model) {
      return;
    }

    const topic = topicController.model;

    const documentId = String(topic.id).padStart(6, "0");

    const issuedDate = new Date(topic.created_at)
      .toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      .toUpperCase();


    const header = document.querySelector(".ddi-dossier-header");

    if (!header) {
      return;
    }


    const idElement = header.querySelector(".ddi-document-id");

    if (idElement) {
      idElement.textContent = `DDI-${documentId}`;
    }


    const dateElement = header.querySelector(".ddi-issued-date");

    if (dateElement) {
      dateElement.textContent = `ISSUED • ${issuedDate}`;
    }

  });

});
