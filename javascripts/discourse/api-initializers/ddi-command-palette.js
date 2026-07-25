import { apiInitializer } from "discourse/lib/api";
import DiscourseURL from "discourse/lib/url";
import { isValidDepartment } from "../lib/ddi-department";
import {
  filterDocumentsByQuery,
  filterDepartmentsByQuery,
} from "../lib/ddi-command-palette";

const RECENT_STORAGE_KEY = "ddi-recently-viewed";
const MAX_RECENT = 8;

function readRecentlyViewed() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function recordVisit(topic) {
  if (!topic?.id || !topic?.title) {
    return;
  }

  try {
    const existing = readRecentlyViewed().filter(
      (entry) => entry.id !== topic.id
    );
    const updated = [{ id: topic.id, title: topic.title }, ...existing].slice(
      0,
      MAX_RECENT
    );

    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable (privacy mode, quota, disabled) — no tracking,
    // not a crash.
  }
}

export default apiInitializer("1.0", (api) => {
  let backdrop;
  let dialog;
  let input;
  let resultsEl;
  let liveRegion;
  let entries = [];
  let activeIndex = -1;
  let lastFocusedElement = null;

  let allDocuments = null;
  let allDepartments = null;

  async function loadDocuments() {
    if (allDocuments) {
      return allDocuments;
    }

    allDocuments = await api.container
      .lookup("service:ddi-intelligence-index")
      .getIndex()
      .catch(() => []);

    return allDocuments;
  }

  function loadDepartments() {
    if (allDepartments) {
      return allDepartments;
    }

    const site = api.container.lookup("service:site");

    allDepartments = (site.categories || [])
      .filter((category) => isValidDepartment(category.slug))
      .map((category) => ({
        name: category.name,
        url: `/c/${category.slug}/${category.id}`,
      }));

    return allDepartments;
  }

  async function loadRecentlyViewed() {
    const citationPreview = api.container.lookup(
      "service:ddi-citation-preview"
    );

    const citations = await Promise.all(
      readRecentlyViewed().map((entry) =>
        citationPreview.getCitationById(entry.id).catch(() => null)
      )
    );

    return citations.filter(Boolean);
  }

  function buildEntry(type, label, sublabel, url) {
    return { type, label, sublabel, url };
  }

  async function buildEntries(query) {
    const normalized = query.trim();
    const staticActions = [
      buildEntry("action", "Open Homepage", null, "/"),
      buildEntry("action", "Open Category Pages", null, "/categories"),
    ].filter((entry) => entry.label.toLowerCase().includes(normalized.toLowerCase()));

    const departments = filterDepartmentsByQuery(
      loadDepartments(),
      normalized
    ).map((department) =>
      buildEntry("department", department.name, "Department", department.url)
    );

    if (!normalized) {
      const recent = (await loadRecentlyViewed()).map((doc) =>
        buildEntry(
          "recent",
          doc.title,
          `${doc.documentId} · ${doc.department}`,
          doc.url
        )
      );

      return [...staticActions, ...departments, ...recent];
    }

    const documents = filterDocumentsByQuery(
      await loadDocuments(),
      normalized
    ).map((doc) =>
      buildEntry(
        "document",
        doc.title,
        `${doc.documentId} · ${doc.department} · ${doc.classification}`,
        doc.url
      )
    );

    return [...staticActions, ...departments, ...documents];
  }

  function ensureDialog() {
    if (dialog) {
      return;
    }

    backdrop = document.createElement("div");
    backdrop.className = "ddi-command-palette-backdrop";

    dialog = document.createElement("div");
    dialog.className = "ddi-card ddi-command-palette";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Archive command palette");

    input = document.createElement("input");
    input.type = "text";
    input.className = "ddi-command-palette-input";
    input.setAttribute("aria-label", "Search the archive");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", "ddi-command-palette-results");
    input.placeholder = "SEARCH DOCUMENTS, DEPARTMENTS, OR JUMP TO A PAGE…";

    resultsEl = document.createElement("div");
    resultsEl.className = "ddi-command-palette-results";
    resultsEl.id = "ddi-command-palette-results";
    resultsEl.setAttribute("role", "listbox");
    resultsEl.setAttribute("aria-label", "Results");

    liveRegion = document.createElement("div");
    liveRegion.className = "sr-only";
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");

    dialog.appendChild(input);
    dialog.appendChild(resultsEl);
    dialog.appendChild(liveRegion);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        close();
      }
    });

    input.addEventListener("input", () => refresh(input.value));
    input.addEventListener("keydown", onInputKeydown);
  }

  function renderEntries() {
    resultsEl.replaceChildren();

    if (!entries.length) {
      const empty = document.createElement("div");
      empty.className = "ddi-card-body";
      empty.textContent = "NO MATCHES FOUND";
      resultsEl.appendChild(empty);
      return;
    }

    let lastType = null;

    entries.forEach((entry, index) => {
      if (entry.type !== lastType) {
        const label = document.createElement("div");
        label.className = "ddi-nav-section-label";
        label.textContent = sectionLabel(entry.type);
        resultsEl.appendChild(label);
        lastType = entry.type;
      }

      const row = document.createElement("a");
      row.className = "ddi-toc-item ddi-command-palette-item";
      row.href = entry.url;
      row.id = `ddi-command-palette-item-${index}`;
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(index === activeIndex));
      // Selection is via aria-activedescendant on the input (a virtual
      // cursor over this listbox) — these rows aren't independent Tab
      // stops, so the input stays the one focusable control in the dialog.
      row.setAttribute("tabindex", "-1");

      const title = document.createElement("span");
      title.className = "ddi-toc-title";
      title.textContent = entry.label;
      row.appendChild(title);

      if (entry.sublabel) {
        const sub = document.createElement("span");
        sub.className = "ddi-command-palette-item-sublabel";
        sub.textContent = entry.sublabel;
        row.appendChild(sub);
      }

      if (index === activeIndex) {
        row.classList.add("ddi-command-palette-item-active");
      }

      row.addEventListener("mouseenter", () => setActiveIndex(index));
      row.addEventListener("click", (event) => {
        event.preventDefault();
        activate(entry);
      });

      resultsEl.appendChild(row);
    });
  }

  function sectionLabel(type) {
    switch (type) {
      case "action":
        return "Navigate";
      case "department":
        return "Departments";
      case "recent":
        return "Recently Viewed";
      default:
        return "Documents";
    }
  }

  function setActiveIndex(index) {
    activeIndex = index;

    [...resultsEl.querySelectorAll(".ddi-command-palette-item")].forEach(
      (row, rowIndex) => {
        row.classList.toggle(
          "ddi-command-palette-item-active",
          rowIndex === index
        );
        row.setAttribute("aria-selected", String(rowIndex === index));
      }
    );

    input.setAttribute(
      "aria-activedescendant",
      index >= 0 ? `ddi-command-palette-item-${index}` : ""
    );
  }

  async function refresh(query) {
    entries = await buildEntries(query);
    setActiveIndex(entries.length ? 0 : -1);
    renderEntries();
    liveRegion.textContent = entries.length
      ? `${entries.length} result${entries.length === 1 ? "" : "s"}`
      : "No results";
  }

  function activate(entry) {
    if (!entry) {
      return;
    }

    close();
    DiscourseURL.routeTo(entry.url);
  }

  function onInputKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(Math.min(activeIndex + 1, entries.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setActiveIndex(Math.max(activeIndex - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      activate(entries[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if (event.key === "Tab") {
      // Single focusable control while open — keep focus trapped on it
      // rather than letting Tab escape to the page behind the dialog.
      event.preventDefault();
    }
  }

  function isOpen() {
    return Boolean(backdrop?.classList.contains("ddi-command-palette-open"));
  }

  function open() {
    ensureDialog();

    if (isOpen()) {
      input.focus();
      return;
    }

    lastFocusedElement = document.activeElement;
    backdrop.classList.add("ddi-command-palette-open");
    input.value = "";
    input.focus();
    refresh("");
  }

  function close() {
    if (!isOpen()) {
      return;
    }

    backdrop.classList.remove("ddi-command-palette-open");
    lastFocusedElement?.focus?.();
    lastFocusedElement = null;
  }

  function toggle() {
    if (isOpen()) {
      close();
    } else {
      open();
    }
  }

  try {
    api.addKeyboardShortcut("ctrl+k", toggle, { global: true });
    api.addKeyboardShortcut("meta+k", toggle, { global: true });
  } catch {
    // Older Discourse API without addKeyboardShortcut support — the
    // palette simply isn't reachable by keyboard; fail gracefully rather
    // than breaking theme initialization.
  }

  api.onPageChange(() => {
    close();

    const router = api.container.lookup("service:router");

    if (!router.currentRouteName?.startsWith("topic.")) {
      return;
    }

    const topic = api.container.lookup("controller:topic")?.model;
    recordVisit(topic);
  });
});
