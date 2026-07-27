import { apiInitializer } from "discourse/lib/api";
import { formatDocumentId, parseTopicIdFromUrl } from "../lib/ddi-document-id";
import { getClassification } from "../lib/ddi-classification";
import {
  isValidDocumentType,
  getDocumentTypeLabel,
} from "../lib/ddi-document-type";
import { isValidDepartment } from "../lib/ddi-department";

const RESULT_SELECTOR = ".fps-result";
const TOPIC_LINK_SELECTOR = "a.search-link";
const CATEGORY_BADGE_SELECTOR = ".badge-category";
const TAG_SELECTOR = ".discourse-tag";

function extractTopicId(result) {
  const href = result
    .querySelector(TOPIC_LINK_SELECTOR)
    ?.getAttribute("href");

  return parseTopicIdFromUrl(href);
}

function extractTagTexts(result) {
  return [...result.querySelectorAll(TAG_SELECTOR)].map((tag) =>
    tag.textContent.trim()
  );
}

function extractDepartment(result) {
  const badge = result.querySelector(CATEGORY_BADGE_SELECTOR);
  const slug = badge?.getAttribute("href")?.match(/\/c\/([^/]+)/)?.[1];

  if (!slug || !isValidDepartment(slug)) {
    return null;
  }

  return badge.textContent.trim();
}

function createBadge(text, extraClass) {
  const badge = document.createElement("span");

  badge.className = extraClass
    ? `ddi-search-badge ${extraClass}`
    : "ddi-search-badge";
  badge.textContent = text;

  return badge;
}

function decorateResult(result) {
  if (result.dataset.ddiSearchDecorated) {
    return;
  }

  result.dataset.ddiSearchDecorated = "true";

  const topicId = extractTopicId(result);
  const tags = extractTagTexts(result);
  const department = extractDepartment(result);

  const { classification, className: classificationClass } =
    getClassification({ tags });
  const documentType = tags.find((tag) => isValidDocumentType(tag)) || null;
  const documentTypeLabel = getDocumentTypeLabel(documentType);

  const badgeRow = document.createElement("div");
  badgeRow.className = "ddi-search-badges";

  if (topicId) {
    badgeRow.appendChild(createBadge(formatDocumentId(topicId)));
  }

  badgeRow.appendChild(createBadge(classification, classificationClass));

  if (department) {
    badgeRow.appendChild(createBadge(department));
  }

  if (documentTypeLabel) {
    badgeRow.appendChild(createBadge(documentTypeLabel));
  }

  result.classList.add("ddi-search-result");
  result.prepend(badgeRow);
}

function decorateVisibleResults(container) {
  container.querySelectorAll(RESULT_SELECTOR).forEach(decorateResult);
}

// decorateResult() itself prepending a badge row is a childList mutation —
// on a container-wide observer, that means every single result decorated
// re-triggers the observer callback for the whole batch. Re-running
// decorateVisibleResults() (a full container querySelectorAll) from that
// callback turns what should be O(results) work into roughly O(results²)
// on a page with many results, and it's largely wasted: decorateResult()
// is already idempotent (see the dataset.ddiSearchDecorated guard above),
// so nearly every one of those re-scans just re-visits already-decorated
// rows and skips them. Working from each mutation's own addedNodes instead
// means the callback only ever looks at what's actually new.
function decorateAddedNodes(mutations) {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      if (node.matches(RESULT_SELECTOR)) {
        decorateResult(node);
      }

      node.querySelectorAll?.(RESULT_SELECTOR).forEach(decorateResult);
    });
  });
}

export default apiInitializer("1.0", (api) => {
  let observer;

  api.onPageChange(() => {
    observer?.disconnect();

    const container = document.querySelector(".search-results");

    if (!container) {
      return;
    }

    decorateVisibleResults(container);

    observer = new MutationObserver(decorateAddedNodes);
    observer.observe(container, { childList: true, subtree: true });
  });
});
