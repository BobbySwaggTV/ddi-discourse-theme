export default {
  setupComponent(args, component) {
    const cooked = args.model.postStream.posts?.[0]?.cooked || "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(cooked, "text/html");

    const firstParagraph = doc.querySelector("p");

    component.set(
      "summary",
      firstParagraph
        ? firstParagraph.textContent.trim()
        : "No summary available."
    );
  },
};