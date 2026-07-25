import { parseCookedHtml } from "../../lib/ddi-cooked-parser";

export default {
  setupComponent(args, component) {
    const cooked = args.model.postStream?.posts?.[0]?.cooked;

    const doc = parseCookedHtml(cooked);

    const firstParagraph = doc.querySelector("p");

    component.setProperties({
      summary: firstParagraph
        ? firstParagraph.textContent.trim()
        : "No summary available.",
    });
  },
};