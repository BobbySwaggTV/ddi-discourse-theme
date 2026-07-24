export default {
  setupComponent(args, component) {
    const cooked = args.model.postStream.posts[0].cooked;

    const parser = new DOMParser();
    const doc = parser.parseFromString(cooked, "text/html");

    const headings = [];

    doc.querySelectorAll("h2").forEach((heading, index) => {
      headings.push({
        number: String(index + 1).padStart(2, "0"),
        title: heading.textContent.trim(),
        id: heading.id,
      });
    });

    component.set("headings", headings);
  },
};
