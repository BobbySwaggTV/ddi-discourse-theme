export default {
  setupComponent(args, component) {
    // Wait until Discourse has rendered the cooked post
    requestAnimationFrame(() => {
      const headings = [];

      document
        .querySelectorAll(".topic-post:first-child .cooked h2")
        .forEach((heading, index) => {
          const id = heading.textContent
            .trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, "")
            .replace(/\s+/g, "-");

          heading.id = id;

          headings.push({
            number: String(index + 1).padStart(2, "0"),
            title: heading.textContent.trim(),
            id,
          });
        });

      component.setProperties({
        headings,
      });
    });
  },
};