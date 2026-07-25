import { apiInitializer } from "discourse/lib/api";
import { parseTopicIdFromUrl } from "../lib/ddi-document-id";

const LINK_SELECTOR = "a[href*='/t/']";
const HOVER_DELAY_MS = 350;
const FALLBACK_SUMMARY = "No summary available.";

export default apiInitializer("1.0", (api) => {
  let card;
  let showTimer;
  let hoveredLink;
  let requestToken = 0;

  function ensureCard() {
    if (!card) {
      card = document.createElement("div");
      card.className = "ddi-card ddi-document-preview";
      document.body.appendChild(card);
    }

    return card;
  }

  function createBadge(text, extraClass) {
    const badge = document.createElement("span");

    badge.className = extraClass
      ? `ddi-search-badge ${extraClass}`
      : "ddi-search-badge";
    badge.textContent = text;

    return badge;
  }

  function hideCard() {
    card?.classList.remove("ddi-document-preview-visible");
    hoveredLink = null;
  }

  function positionCard(link) {
    const rect = link.getBoundingClientRect();
    const el = ensureCard();

    const top = rect.bottom + 8;
    const maxLeft = window.innerWidth - el.offsetWidth - 12;
    const left = Math.max(12, Math.min(rect.left, maxLeft));

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }

  function renderCard(citation) {
    const el = ensureCard();
    el.replaceChildren();

    const title = document.createElement("div");
    title.className = "ddi-card-title";
    title.textContent = citation.title;
    el.appendChild(title);

    const badgeRow = document.createElement("div");
    badgeRow.className = "ddi-search-badges";
    badgeRow.appendChild(createBadge(citation.documentId));
    badgeRow.appendChild(
      createBadge(citation.classification, citation.classificationClass)
    );
    badgeRow.appendChild(createBadge(citation.department));

    if (citation.documentTypeLabel) {
      badgeRow.appendChild(createBadge(citation.documentTypeLabel));
    }

    badgeRow.appendChild(createBadge(citation.revision));
    el.appendChild(badgeRow);

    const summary = document.createElement("div");
    summary.className = "ddi-card-body";
    summary.textContent = citation.executiveSummary || FALLBACK_SUMMARY;
    el.appendChild(summary);
  }

  function scheduleShow(link) {
    const topicId = parseTopicIdFromUrl(link.getAttribute("href"));

    if (!topicId) {
      return;
    }

    hoveredLink = link;

    const token = ++requestToken;

    showTimer = setTimeout(() => {
      api.container
        .lookup("service:ddi-citation-preview")
        .getCitationById(topicId)
        .then((citation) => {
          if (token !== requestToken || hoveredLink !== link || !citation) {
            return;
          }

          renderCard(citation);
          positionCard(link);
          ensureCard().classList.add("ddi-document-preview-visible");
        })
        .catch(() => {
          // Fail gracefully — no preview, no error surfaced to the user.
        });
    }, HOVER_DELAY_MS);
  }

  document.addEventListener("mouseover", (event) => {
    const link = event.target.closest?.(LINK_SELECTOR);

    if (!link || link === hoveredLink) {
      return;
    }

    clearTimeout(showTimer);
    hideCard();
    scheduleShow(link);
  });

  document.addEventListener("mouseout", (event) => {
    const link = event.target.closest?.(LINK_SELECTOR);

    if (!link || link !== hoveredLink) {
      return;
    }

    if (link.contains(event.relatedTarget)) {
      // Still inside the same link — moved between its own child nodes,
      // not actually left it.
      return;
    }

    clearTimeout(showTimer);
    hideCard();
  });

  api.onPageChange(() => {
    clearTimeout(showTimer);
    hideCard();
  });
});
