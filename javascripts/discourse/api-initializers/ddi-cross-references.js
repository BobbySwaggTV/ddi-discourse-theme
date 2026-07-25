import { apiInitializer } from "discourse/lib/api";
import { linkifyDocumentReferences } from "../lib/ddi-cross-reference";

export default apiInitializer("1.0", (api) => {
  api.decorateCookedElement(
    (element, helper) => {
      const post = helper?.getModel();

      if (post?.post_number !== 1) {
        return;
      }

      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const textNodes = [];

      let node;
      while ((node = walker.nextNode())) {
        if (!node.parentElement?.closest("a, code, pre")) {
          textNodes.push(node);
        }
      }

      textNodes.forEach((textNode) => {
        const segments = linkifyDocumentReferences(textNode.textContent);

        if (segments.length === 1 && segments[0].type === "text") {
          return;
        }

        const fragment = document.createDocumentFragment();

        segments.forEach((segment) => {
          if (segment.type === "text") {
            fragment.appendChild(document.createTextNode(segment.value));
            return;
          }

          const link = document.createElement("a");
          link.href = `/t/${segment.documentId}`;
          link.className = "ddi-cross-reference";
          link.dataset.ddiDocumentId = segment.documentId;
          link.textContent = segment.raw;
          fragment.appendChild(link);
        });

        textNode.replaceWith(fragment);
      });
    },
    { onlyStream: true }
  );
});
