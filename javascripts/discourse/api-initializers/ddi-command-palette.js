import { apiInitializer } from "discourse/lib/api";
import DiscourseURL from "discourse/lib/url";
import { isValidDepartment } from "../lib/ddi-department";
import {
  filterDocumentsByQuery,
  filterDepartmentsByQuery,
} from "../lib/ddi-command-palette";
import { readRecentlyViewed, recordVisit } from "../lib/ddi-recently-viewed";
import { createModal } from "../lib/ddi-modal";

// Un-debounced, every keystroke ran a full filter pass over the entire
// cached document list plus a full result-row DOM rebuild — for a fast
// typist that's one full pass per character instead of roughly one per
// completed word, and it only gets more noticeable as the archive grows.
// 120ms is short enough that the palette still feels instant, but long
// enough to collapse a normal typing burst into a single pass.
const REFRESH_DEBOUNCE_MS = 120;

export default apiInitializer("1.0", (api) => {
  let backdrop;
  let dialog;
  let input;
  let resultsEl;
  let liveRegion;
  let entries = [];
  let activeIndex = -1;
  let modal;
  let refreshDebounceTimer;

  let favoritesBackdrop;
  let favoritesDialog;
  let favoritesListEl;
  let favoritesModal;

  let allDocuments = null;
  let allDepartments = null;

  // Set by openBrowseArchive() when Browse Archive isn't on the current
  // page and has to be navigated to first — consumed by the
  // api.onPageChange() handler below once the new page has settled, the
  // same "wait for the route transition, then act" shape recordVisit()
  // already uses in that same handler.
  let pendingScrollId = null;

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

  // The one "is this a topic route" check, used both to gate "Open
  // Knowledge Graph" (only makes sense for the document currently being
  // viewed — there's no page-agnostic graph to jump to the way
  // Browse Archive/Reading Lists/Favorites/the staff dashboards are each
  // one fixed destination regardless of where you are) and by
  // api.onPageChange() below for recordVisit(), which used to inline this
  // exact same check independently.
  function isTopicRoute() {
    const router = api.container.lookup("service:router");
    return Boolean(router.currentRouteName?.startsWith("topic."));
  }

  function buildToolAndStaffEntries() {
    const currentUser = api.container.lookup("service:current-user");
    const isStaff = Boolean(currentUser?.staff);

    const toolEntries = [
      settings.ddi_reading_lists_enabled &&
        buildEntry("tool", "Open Reading Lists", null, null, "reading-lists"),
      buildEntry("tool", "Open Favorites", null, null, "favorites"),
      // Homepage UX cleanup (v1.1) merged the old standalone Timeline and
      // Intelligence Index cards into one "Browse Archive" section with a
      // tab switcher — this entry now points there, available whenever
      // either of the two underlying view settings is on (the section
      // itself renders under the same condition; see
      // ddi-browse-archive.js's own shouldRender()).
      (settings.ddi_timeline_view_enabled ||
        settings.ddi_intelligence_index_enabled) &&
        buildEntry("tool", "Browse Archive", null, null, "browse-archive"),
      settings.ddi_knowledge_graph_viewer_enabled &&
        isTopicRoute() &&
        buildEntry(
          "tool",
          "Open Knowledge Graph",
          null,
          null,
          "knowledge-graph"
        ),
    ].filter(Boolean);

    // Mirrors the exact double gate (setting + currentUser.staff) each
    // staff dashboard's own connector already applies in its
    // shouldRender() — a non-staff user never sees these entries exist,
    // the same way they never see the trigger buttons.
    const staffEntries = isStaff
      ? [
          settings.ddi_integrity_dashboard_enabled &&
            buildEntry(
              "staff",
              "Open Integrity Dashboard",
              null,
              null,
              "integrity-dashboard"
            ),
          settings.ddi_system_status_enabled &&
            buildEntry(
              "staff",
              "Open System Status Dashboard",
              null,
              null,
              "system-status"
            ),
        ].filter(Boolean)
      : [];

    return [...toolEntries, ...staffEntries];
  }

  async function buildEntries(query) {
    const normalized = query.trim();
    const matchesQuery = (entry) =>
      entry.label.toLowerCase().includes(normalized.toLowerCase());

    const staticActions = [
      buildEntry("action", "Open Homepage", null, "/"),
      buildEntry("action", "Open Category Pages", null, "/categories"),
      ...buildToolAndStaffEntries(),
    ].filter(matchesQuery);

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

    modal = createModal(dialog, {
      label: "Archive command palette",
      initialFocus: () => input,
      onClose: close,
    });

    backdrop.addEventListener("mousedown", (event) => {
      if (event.target === backdrop) {
        close();
      }
    });

    input.addEventListener("input", () => scheduleRefresh(input.value));
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
      case "tool":
        return "Archive Tools";
      case "staff":
        return "Staff Tools";
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

  // With Navigate/Archive Tools/Staff Tools/Departments/Documents all
  // potentially present at once now, arrowing one row at a time through
  // every entry to reach a later section is real friction — Tab/Shift+Tab
  // jump straight to the next/previous section's first entry instead,
  // wrapping at either end. Only meaningful improvement available here:
  // Tab was already a no-op inside the palette (the shared modal utility's
  // trap just cycles back to this same input, the only real Tab stop), so
  // this replaces "does nothing new" with a genuine navigation aid rather
  // than taking over a key that previously did something else.
  function jumpToAdjacentSection(direction) {
    const sectionStarts = [];
    let lastType = null;

    entries.forEach((entry, index) => {
      if (entry.type !== lastType) {
        sectionStarts.push(index);
        lastType = entry.type;
      }
    });

    if (!sectionStarts.length) {
      return;
    }

    if (direction > 0) {
      const next = sectionStarts.find((index) => index > activeIndex);
      setActiveIndex(next !== undefined ? next : sectionStarts[0]);
    } else {
      const previous = [...sectionStarts]
        .reverse()
        .find((index) => index < activeIndex);
      setActiveIndex(
        previous !== undefined
          ? previous
          : sectionStarts[sectionStarts.length - 1]
      );
    }
  }

  async function refresh(query) {
    entries = await buildEntries(query);
    setActiveIndex(entries.length ? 0 : -1);
    renderEntries();
    liveRegion.textContent = entries.length
      ? `${entries.length} result${entries.length === 1 ? "" : "s"}`
      : "No results";
  }

  function scheduleRefresh(query) {
    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = setTimeout(() => {
      refreshDebounceTimer = null;
      refresh(query);
    }, REFRESH_DEBOUNCE_MS);
  }

  // Returns whether an element was actually found and scrolled to — lets
  // callers fall back to navigating first when the target isn't on the
  // current page (see openBrowseArchive()) instead of silently doing
  // nothing.
  function scrollToElement(id) {
    const element = document.getElementById(id);

    if (!element) {
      return false;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }

  // Browse Archive is a section on the homepage/category pages, not a
  // dialog — "opening" it means scrolling to it if it's already on the
  // current page, or navigating to the homepage first if it isn't. Reuses
  // DiscourseURL.routeTo() (the same navigation already used for every
  // other entry) rather than a new routing mechanism; the actual scroll
  // after navigating is deferred to api.onPageChange() below. Targets
  // #ddi-browse-archive — the merged Timeline/Index section's own id (see
  // ddi-browse-archive.hbs) — since the Homepage UX cleanup folded the
  // standalone Timeline card this used to scroll to into that section.
  function openBrowseArchive() {
    if (scrollToElement("ddi-browse-archive")) {
      return;
    }

    pendingScrollId = "ddi-browse-archive";
    DiscourseURL.routeTo("/");
  }

  function activate(entry) {
    if (!entry) {
      return;
    }

    close();

    switch (entry.special) {
      case "favorites":
        openFavorites();
        return;
      case "reading-lists":
        api.container.lookup("service:ddi-reading-lists").open();
        return;
      case "integrity-dashboard":
        api.container.lookup("service:ddi-integrity-dashboard").open();
        return;
      case "system-status":
        api.container.lookup("service:ddi-system-status").open();
        return;
      case "browse-archive":
        openBrowseArchive();
        return;
      case "knowledge-graph":
        // Only ever offered as an entry while already on a topic route
        // (see isTopicRoute() above), so the anchor is always on the
        // current page — no navigation needed, unlike Browse Archive.
        scrollToElement("ddi-knowledge-graph-viewer");
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

      if (refreshDebounceTimer) {
        // A refresh for the just-typed character(s) is still pending —
        // without this, Enter pressed quickly enough after typing would
        // activate whatever the *previous* query's results were, not the
        // current input value. Flush immediately instead of waiting out
        // the debounce.
        clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = null;
        refresh(input.value).then(() => activate(entries[activeIndex]));
        return;
      }

      activate(entries[activeIndex]);
      return;
    }

    if (event.key === "Tab") {
      // Overrides the shared modal utility's generic Tab-trap (which would
      // otherwise just cycle back to this same input, the only real Tab
      // stop — a no-op) with a section jump instead. Focus never leaves
      // the input either way, so the trap's actual safety property is
      // unchanged; this only replaces what Tab does while it's here.
      event.preventDefault();
      event.stopPropagation();
      jumpToAdjacentSection(event.shiftKey ? -1 : 1);
      return;
    }

    // Escape is handled by the shared modal utility.
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

    backdrop.classList.add("ddi-command-palette-open");
    input.value = "";
    refresh("");
    modal.activate();
  }

  function close() {
    if (!isOpen()) {
      return;
    }

    clearTimeout(refreshDebounceTimer);
    refreshDebounceTimer = null;

    backdrop.classList.remove("ddi-command-palette-open");
    modal.deactivate();
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

    const title = document.createElement("div");
    title.className = "ddi-card-title";
    title.id = "ddi-favorites-title";
    title.textContent = "Favorites";
    favoritesDialog.appendChild(title);

    favoritesListEl = document.createElement("div");
    favoritesListEl.className = "ddi-command-palette-results";
    favoritesDialog.appendChild(favoritesListEl);

    favoritesBackdrop.appendChild(favoritesDialog);
    document.body.appendChild(favoritesBackdrop);

    favoritesModal = createModal(favoritesDialog, {
      labelledBy: "ddi-favorites-title",
      onClose: closeFavorites,
    });

    favoritesBackdrop.addEventListener("mousedown", (event) => {
      if (event.target === favoritesBackdrop) {
        closeFavorites();
      }
    });
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

    favoritesBackdrop.classList.add("ddi-command-palette-open");
    favoritesModal.activate();
    loadFavorites();
  }

  function closeFavorites() {
    if (!isFavoritesOpen()) {
      return;
    }

    favoritesBackdrop.classList.remove("ddi-command-palette-open");
    favoritesModal.deactivate();
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

    if (pendingScrollId) {
      const id = pendingScrollId;
      pendingScrollId = null;

      // Waits one frame for the new route's connectors to render — the
      // same reason ddi-document-toc.js defers its own post-render DOM
      // work with requestAnimationFrame ("wait until Discourse has
      // rendered the cooked post"); the target element's wrapper renders
      // synchronously once its connector mounts, but that mount itself
      // happens as part of this same page-change cycle.
      requestAnimationFrame(() => scrollToElement(id));
    }

    if (!isTopicRoute()) {
      return;
    }

    const topic = api.container.lookup("controller:topic")?.model;
    recordVisit(topic);
  });
});
