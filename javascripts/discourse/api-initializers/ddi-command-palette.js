import { apiInitializer } from "discourse/lib/api";
import DiscourseURL from "discourse/lib/url";
import { isValidDepartment } from "../lib/ddi-department";
import {
  filterDocumentsByQuery,
  filterDepartmentsByQuery,
} from "../lib/ddi-command-palette";
import { readRecentlyViewed, recordVisit } from "../lib/ddi-recently-viewed";

export default apiInitializer("1.0", (api) => {
  let backdrop;
  let dialog;
  let input;
  let resultsEl;
  let liveRegion;
  let entries = [];
  let activeIndex = -1;
  let lastFocusedElement = null;

  let favoritesBackdrop;
  let favoritesDialog;
  let favoritesListEl;
  let favoritesLastFocusedElement = null;

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

  function buildEntry(type, label, sublabel, url, special) {
    return { type, label, sublabel, url, special };
  }

  async function buildEntries(query) {
    const normalized = query.trim();
    const staticActions = [
      buildEntry("action", "Open Homepage", null, "/"),
      buildEntry("action", "Open Category Pages", null, "/categories"),
      buildEntry("action", "Open Favorites", null, null, "favorites"),
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
      // entry.url is absent for entries that only trigger a special action
      // (e.g. "Open Favorites") rather than navigating — "#" avoids a
      // literal href="null" and any default-navigation side effect if a
      // click somehow bypasses the handler below (e.g. middle-click).
      row.href = entry.url || "#";
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

    if (entry.special === "favorites") {
      openFavorites();
      return;
    }

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

  function ensureFavoritesDialog() {
    if (favoritesDialog) {
      return;
    }

    favoritesBackdrop = document.createElement("div");
    favoritesBackdrop.className = "ddi-command-palette-backdrop";

    favoritesDialog = document.createElement("div");
    favoritesDialog.className = "ddi-card ddi-command-palette ddi-favorites-panel";
    favoritesDialog.setAttribute("role", "dialog");
    favoritesDialog.setAttribute("aria-modal", "true");
    favoritesDialog.setAttribute("aria-label", "Favorite documents");
    favoritesDialog.setAttribute("tabindex", "-1");

    const title = document.createElement("div");
    title.className = "ddi-card-title";
    title.textContent = "Favorites";
    favoritesDialog.appendChild(title);

    favoritesListEl = document.createElement("div");
    favoritesListEl.className = "ddi-command-palette-results";
    favoritesDialog.appendChild(favoritesListEl);

    favoritesBackdrop.appendChild(favoritesDialog);
    document.body.appendChild(favoritesBackdrop);

    favoritesBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === favoritesBackdrop) {
        closeFavorites();
      }
    });

    favoritesDialog.addEventListener("keydown", onFavoritesKeydown);
  }

  function renderFavoriteRow(favorite) {
    const row = document.createElement("div");
    row.className = "ddi-card ddi-favorites-item";

    const rowTitle = document.createElement("span");
    rowTitle.className = "ddi-toc-title";
    rowTitle.textContent = favorite.title;
    row.appendChild(rowTitle);

    const grid = document.createElement("div");
    grid.className = "ddi-dossier-grid ddi-favorites-grid";

    [
      ["Document Number", favorite.documentId],
      ["Classification", favorite.classification],
      ["Department", favorite.department],
      ["Document Type", favorite.documentTypeLabel],
      ["Last Updated", favorite.updatedDate],
    ].forEach(([label, value]) => {
      const cell = document.createElement("div");

      const cellLabel = document.createElement("span");
      cellLabel.textContent = label;
      cell.appendChild(cellLabel);

      const cellValue = document.createElement("strong");
      cellValue.textContent = value || "—";
      cell.appendChild(cellValue);

      grid.appendChild(cell);
    });

    row.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "ddi-favorites-actions";

    const openLink = document.createElement("a");
    openLink.className = "ddi-nav-link";
    openLink.href = favorite.url;
    openLink.textContent = "Open Document";
    openLink.addEventListener("click", (event) => {
      event.preventDefault();
      closeFavorites();
      DiscourseURL.routeTo(favorite.url);
    });
    actions.appendChild(openLink);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ddi-nav-link ddi-favorites-remove";
    removeButton.textContent = "Remove Bookmark";
    removeButton.addEventListener("click", () =>
      handleRemoveFavorite(favorite.bookmarkId)
    );
    actions.appendChild(removeButton);

    row.appendChild(actions);

    return row;
  }

  async function loadFavorites() {
    favoritesListEl.replaceChildren();

    const loading = document.createElement("div");
    loading.className = "ddi-card-body";
    loading.textContent = "LOADING FAVORITES…";
    favoritesListEl.appendChild(loading);

    const favorites = await api.container
      .lookup("service:ddi-favorites")
      .getFavorites()
      .catch(() => []);

    if (!isFavoritesOpen()) {
      // The user closed the panel while this was in flight.
      return;
    }

    favoritesListEl.replaceChildren();

    if (!favorites.length) {
      const empty = document.createElement("div");
      empty.className = "ddi-card-body";
      empty.textContent = "NO FAVORITES YET";
      favoritesListEl.appendChild(empty);
      return;
    }

    favorites.forEach((favorite) =>
      favoritesListEl.appendChild(renderFavoriteRow(favorite))
    );
  }

  async function handleRemoveFavorite(bookmarkId) {
    await api.container
      .lookup("service:ddi-favorites")
      .removeFavorite(bookmarkId);

    if (isFavoritesOpen()) {
      loadFavorites();
    }
  }

  function isFavoritesOpen() {
    return Boolean(
      favoritesBackdrop?.classList.contains("ddi-command-palette-open")
    );
  }

  function openFavorites() {
    ensureFavoritesDialog();

    if (isFavoritesOpen()) {
      return;
    }

    favoritesLastFocusedElement = document.activeElement;
    favoritesBackdrop.classList.add("ddi-command-palette-open");
    favoritesDialog.focus();
    loadFavorites();
  }

  function closeFavorites() {
    if (!isFavoritesOpen()) {
      return;
    }

    favoritesBackdrop.classList.remove("ddi-command-palette-open");
    favoritesLastFocusedElement?.focus?.();
    favoritesLastFocusedElement = null;
  }

  function onFavoritesKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeFavorites();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusable = [
      ...favoritesDialog.querySelectorAll(
        "a[href], button:not([disabled])"
      ),
    ];

    if (!focusable.length) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
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
    closeFavorites();

    const router = api.container.lookup("service:router");

    if (!router.currentRouteName?.startsWith("topic.")) {
      return;
    }

    const topic = api.container.lookup("controller:topic")?.model;
    recordVisit(topic);
  });
});
