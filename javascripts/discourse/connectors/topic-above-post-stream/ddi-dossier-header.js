export default {
  setupComponent(args, component) {

    function updateDocument(topic) {

      if (!topic) {
        return;
      }

      const documentId = String(topic.id).padStart(6, "0");

      const issuedDate = new Date(topic.created_at)
        .toLocaleDateString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();

      component.setProperties({
        documentId,
        issuedDate,
      });
    }

    updateDocument(args.model);

  },
};