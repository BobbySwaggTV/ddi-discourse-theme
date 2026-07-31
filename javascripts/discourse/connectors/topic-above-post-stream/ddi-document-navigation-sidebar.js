const HEADING_SELECTOR = ".topic-post:first-child .cooked h2, .topic-post:first-child .cooked h3";

// Same slug algorithm the retired ddi-document-toc.js already used
// (lowercase, strip punctuation, spaces to hyphens) — this connector is
// that component's direct successor (H2-only, flat, no active tracking),
// not a second, independent heading scanner. Extended with a uniqueness
// suffix, since a real gap in the original algorithm — two same-named
// sections silently colliding on one #id — becomes far more likely once
// H3s multiply the number of headings on the page.
function slugify(text) {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-") || "section"
  );
}

function assignUniqueId(heading, usedIds) {
  const base = slugify(heading.textContent);
  let id = base;
  let suffix = 2;

  while (usedIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix++;
  }

  usedIds.add(id);
  heading.id = id;

  return id;
}

// Reads the already-rendered document once and returns both the outline
// (for the template) and the raw heading elements (for the
// IntersectionObserver below) — nothing here runs again after this.
function buildOutline() {
  const headingElements = [...document.querySelectorAll(HEADING_SELECTOR)];
  const usedIds = new Set();
  const sections = [];
  let currentSection = null;

  headingElements.forEach((heading) => {
    const id = assignUniqueId(heading, usedIds);

    if (heading.tagName === "H2") {
      currentSection = { id, title: heading.textContent.trim(), subheadings: [] };
      sections.push(currentSection);
    } else if (heading.tagName === "H3" && currentSection) {
      currentSection.subheadings.push({ id, title: heading.textContent.trim() });
    }
    // An H3 before any H2 has no section to nest under yet — skipped
    // rather than guessing a parent, the same fail-gracefully convention
    // used throughout this theme.
  });

  return {
    outline: sections.map((section, index) => ({
      ...section,
      number: String(index + 1).padStart(2, "0"),
    })),
    headingElements,
  };
}

// Recomputes only the isActive flags against the already-built outline —
// the outline's own structure (ids, titles, numbering) never changes after
// buildOutline() runs once, so this never re-touches the DOM.
function applyActiveState(outline, activeId) {
  return outline.map((section) => ({
    ...section,
    isActive: section.id === activeId,
    subheadings: section.subheadings.map((sub) => ({
      ...sub,
      isActive: sub.id === activeId,
    })),
  }));
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export default {
  shouldRender() {
    return Boolean(settings.ddi_document_navigation_sidebar_enabled);
  },

  setupComponent(args, component) {
    if (!args.model) {
      component.setProperties({ isVisible: false });
      return;
    }

    let rawOutline = [];

    component.setProperties({
      isVisible: false, // flips true only once buildOutline() actually finds headings
      outline: [],
      isMobileExpanded: false,
      teardownObserver: () => {}, // replaced below once the real observer exists

      // href="#id" stays on every link regardless (so it still works with
      // JS disabled, a new-tab open, or "copy link") — this only replaces
      // the browser's own instant jump with a smooth one, and closes the
      // mobile disclosure after navigating.
      handleHeadingClick: (id, event) => {
        event.preventDefault();

        document.getElementById(id)?.scrollIntoView({
          behavior: prefersReducedMotion() ? "auto" : "smooth",
          block: "start",
        });

        component.set("isMobileExpanded", false);
      },

      toggleMobileExpanded: () => {
        component.set("isMobileExpanded", !component.isMobileExpanded);
      },
    });

    // Wait until Discourse has rendered the cooked post — the identical
    // "wait for render" technique ddi-document-toc.js (this connector's
    // retired predecessor) and ddi-document-author-assistant.js's own
    // comment both already cite for this exact selector.
    requestAnimationFrame(() => {
      if (component.isDestroying || component.isDestroyed) {
        return;
      }

      const built = buildOutline();
      rawOutline = built.outline;

      if (!rawOutline.length) {
        // No headings at all — stay hidden entirely, per spec. Nothing
        // else to set up.
        return;
      }

      component.setProperties({
        isVisible: true,
        outline: applyActiveState(rawOutline, rawOutline[0].id),
      });

      const observer = new IntersectionObserver(
        (entries) => {
          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          const visible = entries.filter((entry) => entry.isIntersecting);

          if (!visible.length) {
            return;
          }

          // Entries aren't guaranteed to arrive in document order — pick
          // whichever intersecting heading is physically highest on screen.
          const topMost = visible.reduce((a, b) =>
            a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
          );

          component.set("outline", applyActiveState(rawOutline, topMost.target.id));
        },
        // A heading counts as "current" once it's within the top 30% of the
        // viewport, not merely anywhere on screen — the standard technique
        // for tracking which section is actually being read right now.
        { rootMargin: "0px 0px -70% 0px" }
      );

      built.headingElements.forEach((heading) => observer.observe(heading));

      component.set("teardownObserver", () => observer.disconnect());
    });
  },
};
