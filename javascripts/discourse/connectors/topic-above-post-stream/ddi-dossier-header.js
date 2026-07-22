export default {
  setupComponent(args, component) {

    function updateDocument(topic) {

      if (!topic) {
        return;
      }

      const documentId = String(topic.id).padStart(6, "0");

      const issuedDate = new Date(topic.created_at)
        .toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();

      const author =
        (args.model.postStream?.posts?.[0]?.username || "SYSTEM").toUpperCase();

      component.setProperties({
        documentId,
        issuedDate,
        author,
      });
    }

    updateDocument(args.model);

  },
};