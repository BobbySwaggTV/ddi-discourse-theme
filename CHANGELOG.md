# Changelog

This changelog is derived from the project's git history, grouped by development session (date).

**A note on versioning:** early commit messages embed ad hoc version labels (`v0.1.0` through
`v0.3.0`), but these were never consistently reflected in `about.json` — `about.json` currently
declares `version`/`theme_version` `0.2.1`, and the labels don't even increase monotonically over
time in the commit history. They should not be read as an authoritative release history. This
changelog uses dates instead, since those are verifiable.

## 2026-07-26 — Reading Lists: reusable, shareable document reading lists

- New member-facing feature (own trigger button, bottom-left, distinct from the staff-only triggers):
  create named reading lists, add/remove documents by number or link, view Documents, Estimated
  Reading Time, and Completion Progress per list, Open All Documents, and Share.
- Stores only document references — `{ id, name, description, documentIds: [] }` — in `localStorage`,
  the only persistence mechanism available to a theme with no backend of its own. Every displayed
  field is re-resolved from that id list on each open; nothing about a document's content or metadata
  is duplicated into storage.
- Reuses `ddiCitationPreview.getCitationById()` for Document Number, Title, Classification, Document
  Type, Revision, and the Open link — the same cached call Favorites/Command Palette/Document Preview
  already make.
- Reuses the Metadata Engine for Estimated Reading Time (the one field Citation Preview doesn't
  carry), via the same raw-topic-to-Metadata-Engine-shape adapter technique the Integrity Dashboard
  and System Status services already established.
- Completion Progress reuses the *existing* "recently viewed" tracking rather than inventing a new
  read/unread toggle — the task's own required actions have no "mark as read" step, so a document
  counts complete once its id appears in the existing recently-viewed history. Extracted
  `lib/ddi-recently-viewed.js` out of `api-initializers/ddi-command-palette.js` (previously the sole,
  private consumer) so both features share the one implementation.
- Add Document reuses `parseTopicIdFromUrl()`/`parseDocumentId()` (both pre-existing) rather than a
  new document picker UI; Open/hover reuse real `<a href>` navigation and the existing Document
  Preview hover listener, same as the Knowledge Graph Viewer.
- Share encodes `{ name, description, documentIds }` into a URL (base64, Unicode-safe) since there's
  no backend to publish a shareable list to; copies via the clipboard API with a visible-URL fallback
  if that's denied. Importing a shared list always creates a new list named `"{name} (Shared)"` — it
  never overwrites an existing one.
- No delete-list action — not in the task's required action list, so not added; documented as a
  known, stated gap rather than silently left unaddressed or silently added unasked-for.
- Fails gracefully throughout: `localStorage` unavailable/corrupt, an unresolvable document
  number/link, or a tampered share payload all degrade to an empty/unchanged state, never a thrown
  error.
- Verified the full lifecycle directly: create → persist → reload → add (both input forms) → remove →
  Completion Progress recomputing as the list changes → share/decode (including a Unicode name) →
  import as an independent new list, plus corrupt/non-array storage fallback cases.
- New `ddi_reading_lists_enabled` setting (default on).

## 2026-07-26 — Knowledge Graph Viewer: interactive per-document relationship graph

- New topic-page connector (`topic-below-post-stream`): current document at the center, with Parent
  Documents, Child Documents, Cross References, and Related Documents arranged around it in four
  fixed sectors. Click a node to open it, hover to trigger the existing Document Preview, pan/zoom
  the canvas, Reset View.
- Zero fetches of its own: calls `service:ddi-knowledge-graph`'s existing `getDocumentGraph(topic)`
  exactly once and renders what comes back. That service (built in an earlier session, previously
  unconsumed — see **Knowledge Graph** in ARCHITECTURE.md) already composes Relationships, Cross
  References, and Related Documents internally; none of that was touched or duplicated.
- New `lib/ddi-knowledge-graph-view.js` (pure): `buildGraphView()` sorts the graph's edges into the
  4 requested display buckets — a stated judgment call, not a discovered fact, since the graph's 6
  underlying relationship-type labels don't map 1:1 onto 4 buckets (documented in full in
  ARCHITECTURE.md). `layoutGraphView()` places nodes via a fixed 4-sector radial layout (no
  force-directed simulation, no runtime graphing dependency) in a normalized 0–100 space.
- Click and hover needed no new code: nodes are real `<a href>` elements, so Discourse's own routing
  handles clicks and the existing `ddi-document-preview.js` global hover listener (matches any
  `a[href*='/t/']` anywhere in the document) handles hover, unmodified.
- Pan/zoom implemented as plain DOM event listeners updating a CSS transform directly (not routed
  through Ember state, deliberately, for per-pixel-drag performance) via `{{did-insert}}`/
  `{{will-destroy}}` from `@ember/render-modifiers` — genuinely new to this codebase; flagged as an
  unverified-against-a-live-instance assumption, safe-failure-mode being "doesn't pan/zoom," not a
  broken page.
- Node color reuses the existing classification-driven `--ddi-accent` pattern (same as Document
  Relationships, Intelligence Network, Intelligence Index, Timeline) rather than inventing a new
  relationship-type color palette; category is instead conveyed by sector position, quadrant labels,
  and edge line style (solid/dashed/dotted).
- Fails gracefully: no topic loaded, no relationships at all, or the graph service rejecting all
  result in no broken canvas — a plain "no relationships" message or nothing rendered at all.
- Verified categorization (all 6 relationship-type labels routing correctly, edges not sourced from
  center ignored, dangling edge targets skipped, missing center handled) and layout (deterministic
  finite positions, single-node sectors centering exactly, empty views producing no edges/labels
  while keeping the fixed center) directly against mock graph data.
- New `ddi_knowledge_graph_viewer_enabled` setting (default on).
- Corrected the **Knowledge Graph** section's "no visualization is built here" note in
  ARCHITECTURE.md, since that's no longer true, and closed out that section's Future Roadmap item 2.

## 2026-07-26 — Intelligence Timeline: chronological, year-grouped browse view

- New member-facing view, rendered alongside Intelligence Index on `below-main-container`: every
  archive document (or every document in the current department, on a category page) grouped by
  year, most recent year first, each year collapsible (most recent expanded by default). Per
  document: Document Number, Title, Document Type, Classification, Revision, Last Updated.
- Performs zero fetches of its own — reuses `service:ddi-intelligence-index`'s existing `getIndex()`
  verbatim (same department scoping via `ddi-category-context`, same route guard via
  `lib/ddi-route-guard.js#isExcludedRoute()` as Intelligence Index's own connector), and groups
  whatever it returns.
- New `lib/ddi-timeline-view.js#groupDocumentsByYear()` (pure): derives each document's year from the
  citation's existing `updatedAt` field, skips documents with a missing or unparseable date rather
  than mis-bucketing them, returns years sorted descending with each year's documents sorted
  descending by the same date.
- Deliberately did not reuse `lib/ddi-timeline.js#buildTimeline()` — that function builds one
  document's own event history for the per-topic Document Timeline connector, a different problem
  than grouping many documents by year for browsing.
- Verified chronological ordering directly: year-descending order, within-year document-descending
  order, and three "no date" cases (`null`, unparseable string, field absent entirely) all excluded
  cleanly rather than crashing or producing a wrong bucket, plus empty/`null` input handled gracefully.
- Reuses `.ddi-card`, `.ddi-toc-item`/`.ddi-toc-title`, `.ddi-dossier-grid`, and `.ddi-favorites-grid`
  (the Favorites Panel's 5-column variant) verbatim for the per-document rows; only the year
  toggle row (caret, label, document count) is new markup and CSS.
- New `ddi_timeline_view_enabled` setting (default on), matching `ddi_intelligence_index_enabled`'s
  own opt-out convention.

## 2026-07-26 — DDI System Status Dashboard: staff-only archive health summary

- New staff/admin-only, read-only summary card dashboard: Total Documents, Documents Missing
  Metadata, Broken Cross References, Broken Related Documents, Duplicate Document Numbers, Draft
  Documents, Archived Documents, Public/Internal/Restricted/Top Secret Documents. The four
  issue-derived cards open the Document Integrity Dashboard directly.
- New `services/ddi-system-status.js` derives every figure from two existing sources, adding no new
  archive scanning or validation of its own: `ddiIntelligenceIndex.getIndex()` +
  `lib/ddi-archive-statistics.js#buildArchiveStatistics()` for totals and classification counts (same
  call Homepage Dashboard already makes); `ddiIntegrityDashboard.getSummary()` for everything else.
- Extended `services/ddi-integrity-dashboard.js` with `getSummary()` (returns `{ issues,
  lifecycleCounts }` from a single scan) rather than having the new service duplicate its
  scan-and-adapt-to-Metadata-Engine logic to reach lifecycle data. `getIssues()`'s own behavior and
  return shape are unchanged — both methods now share one internal `_buildIssues()`.
- Also moved the Integrity Dashboard's `isOpen`/`isLoading`/`issues` state from local
  connector-component state onto the service itself (`@tracked` fields, `open()`/`close()` methods) —
  needed so System Status's cards can open that same dialog via a plain service call. The Integrity
  Dashboard connector's own visible behavior is unchanged; only where its state lives moved.
- "Documents Missing Metadata" and "Duplicate Document Numbers" count unique documents (a document
  with two missing fields, or a duplicate-number pair, counts once); "Broken Cross References" and
  "Broken Related Documents" count issue rows directly (two broken references in one document are two
  problems, not one) — verified with a mock scenario covering both collapsing behaviors plus an
  empty-archive case (all-zero, no throw).
- New `ddi_system_status_enabled` setting (default on); gated the same way as the Integrity
  Dashboard — connector `shouldRender()` staff check plus a second `currentUser?.staff` check inside
  the service.
- Reuses `.ddi-stat-grid`/`.ddi-stat-tile`/`.ddi-stat-tile-total` (Homepage Dashboard/Division
  Header/Division Cards' own stat-card styling) and `.ddi-integrity-trigger`/`.ddi-command-palette-
  backdrop` verbatim; only a `.ddi-stat-tile-link` clickable-card modifier and a
  `.ddi-system-status-trigger` position modifier (so the two staff corner buttons stack instead of
  overlapping) are new CSS.

## 2026-07-26 — Document Integrity Dashboard: staff-only archive-wide audit table

- New staff/admin-only, read-only dashboard: one table row per detected issue across the whole
  archive — Missing Document Type, Missing Classification, Missing Lifecycle, Missing Department,
  Duplicate Document Numbers, Invalid Cross References, Broken Related Document links. Each row shows
  Document Number, Title, Issue Type, Severity, Suggested Fix, and an Open Document link.
- Reuses existing validation wholesale rather than duplicating it: the four "missing metadata" checks
  run the exact same `lib/ddi-integrity.js#verifyDocumentIntegrity()` and `ddi-document-metadata.js`
  Metadata Engine already used by the per-topic Verification Panel, just against every document in the
  archive instead of only the current topic. The two reference checks run the exact same
  `lib/ddi-cross-reference.js#findDocumentReferences()` and `lib/ddi-relationship.js#findDocumentRelationships()`
  Knowledge Graph and the Relationships panel already use.
- New `lib/ddi-integrity-issues.js` (pure) adds only what didn't already exist: a severity rating and
  a suggested-fix string per issue type, plus severity-order sorting.
- New `services/ddi-integrity-dashboard.js` orchestrates the scan: fetches `/latest.json` (the same
  single-page definition of "the archive" Intelligence Index and Archive Navigation already use),
  fetches each document's full topic JSON, adapts it into the shape the Metadata Engine expects
  (shape translation only — no validation logic reimplemented), runs all six checks, and resolves any
  reference/relationship pointing outside the scanned page through the existing cached
  `ddiCitationPreview.getCitationById()` before calling it broken.
- New connector `connectors/above-main-container/ddi-integrity-dashboard.js` renders a small, fixed
  corner trigger button — gated twice: `shouldRender()` checks `service:current-user`'s `.staff` so it
  never mounts for non-staff, and the service checks `currentUser?.staff` again internally. A new
  `ddi_integrity_dashboard_enabled` setting (default on) controls visibility on top of that, not
  instead of it.
- Reuses `.ddi-card`, `.ddi-card-title`, `.ddi-card-body`, `.ddi-command-palette-backdrop`/`-open`,
  `.ddi-nav-link`, and `.ddi-favorites-actions` verbatim for the dialog shell; only the corner trigger
  button, the data table, and the severity badges are new CSS.
- Verified all seven checks with direct logic simulation: clean document (no issues), each of the
  four missing-metadata cases individually, cross-reference extraction and dedup, relationship
  declaration extraction, broken-vs-resolvable-outside-page reference resolution, duplicate document
  number detection (including a forced-collision scenario, since the real ID scheme can't produce one
  naturally), and severity-order sorting.
- Known, stated limitation: only scans the single `/latest.json` page — an archive with more
  documents than that page holds is only partially scanned. This matches the same limitation already
  present in Intelligence Index and Archive Navigation; fixing it needs real pagination, which exists
  nowhere in this theme yet.

## 2026-07-26 — Favorites Panel: API verification pass, two real bugs fixed

- Verified `services/ddi-favorites.js`'s Discourse bookmark API integration against Discourse's
  actual source (`discourse/discourse` on GitHub — `bookmarks_controller.rb`, `routes.rb`,
  `users_controller.rb`, `user_bookmark_list_serializer.rb`, `user_bookmark_base_serializer.rb`),
  not general knowledge. Found and fixed two genuine defects; confirmed one thing was already right.
- **List endpoint was wrong**: `/bookmarks.json` doesn't exist as a listing route. The real route
  is `GET /u/:username/bookmarks`, a per-user resource. Now builds
  `/u/${currentUser.username}/bookmarks.json` and skips the request entirely if there's no
  `currentUser` (confirmed via `requires_login`), rather than firing a doomed anonymous request.
- **Topic-id resolution was wrong, and would have silently dropped post-level bookmarks.** The
  `topic_id` field it relied on doesn't exist on a bookmark item at all; the fallback
  (`bookmarkable_type === "Topic"`) only handled topic-level bookmarks, meaning any document
  bookmarked via a specific *post* (a common, real case) would never have appeared in Favorites.
  Fixed by reusing `bookmarkable_url` — a real, confirmed field — through the existing
  `parseTopicIdFromUrl()`, which already handles every `/t/...` URL shape. Resolves both topic- and
  post-level bookmarks uniformly, no branching on `bookmarkable_type` needed.
- **Pagination was entirely missing.** Confirmed 20 bookmarks per page, with `more_bookmarks_url`
  signaling another page. A user with more than 20 bookmarks would have silently seen only the most
  recent 20. `_fetchAllBookmarks()` now follows `more_bookmarks_url` until absent, capped at
  `MAX_PAGES = 10` as a runaway-loop safety bound, not a new feature — no caching added.
- **Confirmed already correct:** the deletion endpoint, `DELETE /bookmarks/:id`
  (`BookmarksController#destroy`), matched the real implementation exactly — no change needed.
- `ddi-command-palette.js` needed zero changes — the service's public interface
  (`getFavorites()`/`removeFavorite()`) is unchanged, so the correction is fully contained.
- Verified the corrected logic directly: topic-level bookmarks, post-level bookmarks (including
  dedup when both point at the same topic), a non-topic bookmarkable gracefully skipped, and a
  simulated 3-page/45-bookmark pagination sequence terminating correctly, plus the `MAX_PAGES` cap
  under a simulated runaway-pagination response.
- `ARCHITECTURE.md`'s **Favorites Panel** section corrected in place (not left as a superseded
  note) to describe the verified, current implementation.

## 2026-07-26 — Favorites Panel: quick access to native bookmarks

- Added `services/ddi-favorites.js` and extended `api-initializers/ddi-command-palette.js` with a
  new "Open Favorites" action, opening a panel of the current user's bookmarked documents (Document
  Number, Title, Classification, Department, Document Type, Last Updated, plus Open Document and
  Remove Bookmark per row).
- **No favorites database.** Reading always calls Discourse's own bookmark-list endpoint fresh (not
  cached across opens, unlike the Command Palette's own document/department lists — bookmarks can
  change from any page via Discourse's native bookmark button, so staying synchronized mattered
  more than caching here); removing calls Discourse's own bookmark-delete endpoint directly. A
  removal here is a genuine Discourse bookmark removal, visible (as gone) from Discourse's own
  native bookmarks page too.
- **Confidence caveat, more significant than most:** no prior use of Discourse's bookmark API in
  this theme. The list endpoint (`/bookmarks.json`) and response shape are based on general
  Discourse knowledge, not confirmed live — tried against two plausible envelope shapes, falling
  back to an empty list (indistinguishable from "no bookmarks") if neither matches. Flagged as the
  one part of this feature most needing live verification. The removal endpoint
  (`DELETE /bookmarks/{id}`) is a more standard, higher-confidence REST convention.
- Each bookmark resolves to its topic (handles both topic- and post-level bookmarks), deduplicated
  per topic, then goes through `ddi-citation-preview.js`'s existing `getCitationById()` unchanged —
  the same call Document Quick Preview and Recently Viewed already make, already cached by document
  id. No duplicate metadata logic anywhere in this feature.
- The favorites panel is a second dialog inside the same command-palette initializer (not a
  separate file), sharing the palette's existing backdrop styling and letting `activate()` trigger
  it directly without a cross-initializer communication mechanism. It uses a simpler Tab-trap than
  the search palette's combobox pattern, since it's a plain list of independently-focusable buttons,
  not a single-input virtual-cursor list.
- New `.ddi-favorites-grid` modifier overrides just `grid-template-columns` (5 cells via
  `auto-fit`, vs `.ddi-dossier-grid`'s existing 4-column default) while still inheriting its
  label/value typography — the many other existing consumers of the 4-column layout are untouched.
- Fixed one thing caught in self-review: entries with no real URL (the new "Open Favorites" action)
  would have rendered `href="null"` on their row otherwise — falls back to `"#"` now, since the
  activation logic is handled in JS regardless, but a literal `href="null"` would still have been
  wrong for middle-click/right-click.
- Stated, not silently accepted: two narrow focus-management rough edges (Shift+Tab in the instant
  before the list finishes loading; focus resets to the document body after removing a bookmark
  rather than a nearby control) — judged disproportionate to fully solve for a quick-access panel.
- Verified the pure topic-resolution/dedup logic directly: `topic_id` present, `bookmarkable_type
  === "Topic"` fallback, post-level bookmarks with neither field gracefully skipped, and two
  bookmarks in the same topic correctly collapsing to one entry.

## 2026-07-26 — Deprecated Ember Native Array Extensions audit and fix

- Discourse admin was warning: `Theme "DDI Internal Command Network" contains code which needs
  updating. (id: discourse.native-array-extensions.findBy)`.
- Audited the entire repository (`grep -rn` across all `.js`/`.hbs` files) for all eleven deprecated
  Ember Native Array Extension names (`findBy`, `filterBy`, `mapBy`, `sortBy`, `rejectBy`, `isAny`,
  `isEvery`, `any`, `everyBy`, `firstObject`, `lastObject`). Found exactly one occurrence:
  `services/ddi-citation-preview.js:50`, `this.site.categories?.findBy("id", topic.category_id)`.
- Replaced with the native equivalent: `this.site.categories?.find((category) => category.id ===
  topic.category_id)`. Verified behaviorally identical (matching id, no match, and
  undefined-array short-circuit via `?.` all produce the same result as before) before and after.
  No other line in the file, or anywhere else in the repo, changed.
- Re-ran the same repo-wide audit after the fix: zero remaining occurrences of any of the eleven
  names.
- Added a rule to `CODING_STANDARDS.md`'s JavaScript Style section recording this as a standing
  constraint (with the native replacement for each of the eleven names), so it doesn't reappear
  unnoticed in future work.

## 2026-07-25 — Command Palette: Ctrl+K / Cmd+K archive navigation

- Added `api-initializers/ddi-command-palette.js` — a floating palette opened via `Ctrl+K`/`Cmd+K`
  supporting document search, department search, Open Homepage, Open Category Pages, and recently
  viewed documents. Fully keyboard-navigable (arrows, Enter, Escape) with mouse support too.
- Registered through Discourse's own `api.addKeyboardShortcut()` rather than a raw `keydown`
  listener — the real mechanism behind "preserve native Discourse shortcuts." No history of using
  this API in the theme before, so its exact shape is based on general Discourse API knowledge, not
  confirmed live; wrapped in `try`/`catch` so a wrong assumption fails gracefully (palette just isn't
  keyboard-reachable) rather than breaking theme init. As far as could be checked, Discourse's
  documented default shortcuts don't use Ctrl+K/Cmd+K; some browsers reserve it at the chrome level
  regardless, which is inherent to the shortcut choice, not something a page script controls.
- **No duplicate search logic:** document search reuses `ddi-intelligence-index.js`'s `getIndex()`
  unchanged; a new, narrow `lib/ddi-command-palette.js` does free-text substring matching (title/
  Document Number/department/classification/type) — a genuinely different concern from
  `lib/ddi-document-index.js`'s existing exact-match `filterDocuments()`, not a re-implementation of
  it. Discourse's own search ranking at `/search` is untouched and not reimplemented here.
- **Two real caches, not one generic one:** the full document/department lists are fetched once per
  page session and reused across every palette open (client-side filtering against the cached copy,
  not re-fetched per keystroke); recently viewed documents are tracked via `localStorage` (capped at
  8, deduplicated) and hydrated through Citation Preview's own `getCitationById()`, already cached by
  document ID.
- Recently-viewed tracking is genuinely new (no existing feature tracks per-user browsing history —
  Dashboard/Index's "Recently Updated" is archive-wide by edit time, a different concept). Reuses
  `ddi-dossier-refresh.js`'s established `controller:topic` lookup pattern to detect the current
  topic; wrapped in `try`/`catch` so a `localStorage`-unavailable environment just means no tracking.
- Navigation uses `DiscourseURL.routeTo()` — Discourse's own utility for this. An earlier draft
  called `service:router`'s `transitionTo()` directly with a manual fallback; caught in self-review
  and replaced with the actual established utility before this shipped.
- Accessibility is a real combobox/listbox pattern: `role="combobox"` + `aria-activedescendant` on
  the input, `role="listbox"`/`role="option"` on results (rows are `tabindex="-1"`, not independently
  tabbable, by design), a visually-hidden `aria-live="polite"` region announcing result counts, focus
  moved to the input on open and restored to the previously-focused element on close. Stated
  limitation: background content isn't `aria-hidden` while the palette is open — judged out of scope
  for "keep lightweight."
- New CSS reuses `.ddi-card` (dialog shell), `.ddi-toc-item`/`.ddi-toc-title` (result rows), and
  `.ddi-nav-section-label` (section headers) verbatim; only the backdrop, input, and active-row
  highlight are new.
- Verified the pure filtering logic directly: title/Document Number/department/classification/type
  matching, empty-query behavior (departments and actions shown, documents withheld until typing),
  and no-match cases — plus the full entry-building flow end-to-end against simulated site
  categories and documents, including a non-division category correctly excluded from department
  results.

## 2026-07-25 — Document Quick Preview: global hover card

- Added `api-initializers/ddi-document-preview.js` — a floating hover card (Document Number, Title,
  Classification, Department, Document Type, Revision, Executive Summary) shown after a short delay
  when hovering any `a[href*='/t/']` anywhere on the page. One generic listener, not six
  per-connector integrations: every named surface (Intelligence Index, Search Results, Related
  Documents, Archive Navigation, Homepage Dashboard) already builds its document links through
  `ddi-citation-preview.js`'s `/t/{slug}/{id}` convention, so nothing in any of those connectors
  needed to change.
- **Verified against each surface, not assumed:** grepped every named connector's template. Found a
  genuine gap — **Division Cards has no document link at all**, only a link to its division/category
  page (`/c/{slug}/{id}`). Flagged rather than silently claimed as covered or worked around with an
  invented document link.
- No new fetch, no new service: reuses `ddi-citation-preview.js`'s existing `getCitationById()`
  (already caches by document ID) unchanged. Citation Preview gained one new field,
  `executiveSummary`, reusing the existing `getShortDescription()` (first added for Division Header)
  against `topic.post_stream.posts[0].cooked` — purely additive, every existing consumer unaffected.
  Noted, not silently glossed over: that function's name was written for category descriptions, a
  slightly awkward fit for "first paragraph of a post," but renaming it was judged out of scope here.
- `lib/ddi-document-id.js` gained `parseTopicIdFromUrl()`, shared by this feature and by
  `ddi-search-results.js` (refactored to use it instead of its own copy). Along the way, found and
  fixed a real bug in the original regex: it mis-parsed `/t/{id}/{post_number}` (no slug) by treating
  the topic id itself as a slug segment. Fixed before either consumer shipped the corrected version.
- Fails gracefully at every stage: no parseable topic ID → nothing scheduled; `getCitationById()`
  resolving to `null` → nothing rendered; the user moving to a different link before the delay/fetch
  completes → a request-token check discards the stale response; missing Executive Summary → falls
  back to `"No summary available."`, matching Executive Summary's own existing fallback text.
- Deliberate simplification, stated plainly: the card hides immediately on leaving the link, rather
  than staying open if the mouse moves onto the card itself — a full hover-intent state machine was
  judged unnecessary complexity for "keep the preview lightweight."
- New CSS is minimal: `.ddi-document-preview` only adds fixed positioning and an opacity/visibility
  toggle. The card's shell reuses `.ddi-card` verbatim; its metadata row reuses `.ddi-search-badge`
  (including the same classification color-coding) exactly as Search Results Phase 1 established.

## 2026-07-25 — Intelligence Search Results, Phase 1: badge-annotated search results

- Added `api-initializers/ddi-search-results.js`, decorating Discourse's own native search results
  with a badge row per result — Document Number, Classification (color-coded), Department, Document
  Type. Native title, excerpt/blurb, highlighted matched terms, ranking, permissions, and pagination
  are completely untouched; this only reads already-rendered DOM and prepends new content.
- Not a plugin-outlet connector: search results have no DDI-controlled outlet, so this follows the
  same DOM-decoration technique `ddi-cross-references.js`/`ddi-dossier-refresh.js` already use, now
  applied to a third surface.
- `api.onPageChange` sets up a `MutationObserver` on `.search-results` (recreated per navigation) to
  also catch in-place result updates (new query, pagination) that may not fire a full route
  transition — genuinely uncertain without a live instance, so covered generically rather than
  guessed at. `decorateResult()` is idempotent (`dataset.ddiSearchDecorated`, same pattern Cross
  References already established) specifically because the observer would otherwise re-trigger on
  its own decorations.
- **No new services, no new fetches.** Document Number is the existing `formatDocumentId()` applied
  to a topic ID parsed from each result's own title link. Classification and Document Type are
  derived by handing each result's already-rendered tag text to the *existing*
  `getClassification()`/`isValidDocumentType()`/`getDocumentTypeLabel()` unmodified — `{ tags }` from
  parsed text satisfies `getClassification()`'s signature exactly. Department reads the rendered
  category badge's slug (from its `href`), validated through the existing `isValidDepartment()`.
- Classification color reuses the existing `--ddi-accent` mechanism (classificationClass sets it,
  `.ddi-search-badge` reads it with a neutral fallback) — no new color logic. New CSS was written
  independently of the visually-similar `.ddi-lifecycle-badge` rather than sharing its selector,
  specifically to avoid silently recoloring the existing Lifecycle badge on the topic page (which
  already sits inside a `classificationClass`-scoped ancestor).
- Confidence caveat: `.fps-result`/`a.search-link`/`.badge-category`/`.discourse-tag`/
  `.search-results` are based on general Discourse knowledge, not confirmed against a live instance.
  Failure mode is safe — a wrong selector just means a skipped badge, never broken native behavior.
- Verified the pure extraction/derivation logic directly: topic ID parsing across several href
  shapes, classification/document-type resolution from rendered tag text (including graceful default
  to `PUBLIC RELEASE` when no tag matches), and department slug validation (including correct
  rejection of a non-division category).

## 2026-07-25 — Division Command Center: Directory vs. Division page routing fix

- Fixed a real bug: `ddi-category-context.js`'s `getCurrentCategory()` trusted
  `controller:discovery/category`'s `.category` unconditionally, but that controller is an Ember
  singleton that doesn't reset on route change — after visiting a division page and then navigating
  client-side to `/categories`, it could still hold the previous division, wrongly showing Division
  Header there and wrongly making Dashboard department-scoped instead of archive-wide.
- Added `isCategoriesIndexRoute()` to the service (exact match on `router.currentRouteName ===
  "discovery.categories"`); `getCurrentCategory()` now checks it first and returns `null` on
  `/categories` regardless of stale controller state.
- **Division Header and Intelligence Dashboard needed zero changes** — both already went through
  `getCurrentCategory()`/`getCurrentDepartment()` rather than reading the controller directly, so
  both inherited the fix automatically. Confirmed via `git diff` showing zero delta on either file.
- Division Cards refactored to call the service's `isCategoriesIndexRoute()` instead of keeping its
  own separate `CATEGORIES_ROUTE_NAME` constant and route check — the `"discovery.categories"`
  string now exists in exactly one place instead of two. This also removed Division Cards' own
  `service:router` lookup, since checking the route was its only use for it.
- No new connectors, no CSS changes. Verified by simulating the exact stale-controller scenario
  against fake owner/router objects: a fresh division-page visit still resolves correctly; a
  `/categories` visit with a stale controller correctly resolves to `null`; the homepage is
  unaffected; Division Cards' own route gate is unchanged in behavior.

## 2026-07-25 — Division Command Center, Phase 4: Division Cards

- Replaced the stock `.category-list` grid on `/categories` with DDI-styled Division Cards —
  `connectors/discovery-list-container-top/ddi-division-cards.*` — one per division, showing
  Division Name, Short Description, Total Documents, Last Updated, Primary Classification, and a
  View Division button. Renders only on the `discovery.categories` route.
- Divisions are enumerated from `site.categories` (already-loaded Discourse data, the same source
  Citation Preview already reads) filtered through `lib/ddi-department.js`'s `isValidDepartment()` —
  no new fetch for the category list itself, and non-division categories never get a card.
- Per-division stats are the exact same `getIndex({ department })` + `buildArchiveStatistics()`
  calls Phase 1/3 already make, run once per division in parallel. Primary Classification is
  `statistics.classifications[0]?.name` — the existing sorted breakdown's first entry, not a new
  computation. A division with zero documents shows `"—"`/`"—"`/`0`, gracefully, by the same
  construction as every other statistics consumer here.
- Extracted Division Header's inline paragraph-extraction into a new, shared
  `lib/ddi-division-summary.js` (`getShortDescription()`/`getFullDescriptionText()`), and refactored
  Division Header to use it — avoids duplicating that logic now that Division Cards needs it too.
  Zero behavior change for Division Header.
- View Division links to `/c/{slug}/{id}` — the identical URL expression
  `ddi-archive-navigation.js` already uses for Department Home. No routing changes.
- `.category-list { display: none; }` added to `common.scss`, hiding the stock grid unconditionally
  (a documented trade-off: the only realistic way both the stock grid and Division Cards end up
  hidden is if `site.categories` has none of the six recognized division slugs at all — a
  site-configuration issue, not a transient failure).
- **Dead-code cleanup, direct consequence of hiding `.category-list`:** removed `.category-box` from
  the shared topic/category card-treatment rule (added in Phase 2, no longer reachable), removed
  `.category-list-item` from the shared border-color rule, and removed every
  `.category-list`/`.category-box`/`.categories-list` selector from `desktop.scss`/`mobile.scss`'s
  responsive rules — `.topic-list-item`/`.latest-topic-list-item` entries in those same shared rules
  were kept, since they remain genuinely live.
- Verified: `isValidDepartment` correctly filters out a non-division category in a simulated
  `site.categories` list; per-division stats correctly reflect only that division's documents
  (confirmed against a multi-department test set, including correct "most common classification"
  selection and correct newest-first date picking); a zero-document division degrades gracefully;
  View Division URLs build correctly for every card.

## 2026-07-25 — Division Command Center, Phase 3: Division Header

- Added a new card at the top of every individual category page —
  `connectors/discovery-list-container-top/ddi-division-header.*` — showing Division Name, Division
  Description, Mission Statement, Total Documents, and Last Updated, all scoped to that division.
- `services/ddi-category-context.js`'s private `_getCurrentCategory()` (Phase 1) made public as
  `getCurrentCategory()` instead of duplicating the lookup a second time — `getCurrentDepartment()`
  now calls it. Pure, backward-compatible rename; verified by grep that nothing external referenced
  the private name.
- Mission Statement and Division Description both derive from `category.description` via
  `lib/ddi-cooked-parser.js`'s existing `parseCookedHtml()` — the same HTML-to-text mechanism
  Executive Summary already uses for post content — rather than guessing at unconfirmed Discourse
  plain-text category field names. Division Description is the first paragraph's text; Mission
  Statement is the full parsed body's text. Falls back to `"No mission statement available."`
  (matching Executive Summary's own `"No summary available."` convention) when there's no text.
- Total Documents and Last Updated reuse `buildArchiveStatistics()` completely — same `getIndex({
  department })` call Phase 1 already made, `recentLimit: 1` since only the single most recent
  document is needed. Falls back to `"—"` for a division with no documents; fails gracefully by the
  same construction as Dashboard (`getIndex()` never rejects), no new error handling added.
- **Total Documents now appears twice on a category page** (Dashboard's tile, this card's tile) —
  by the letter of the request, which explicitly asked for it here while explicitly saying to
  preserve Dashboard unchanged. The *computation* isn't duplicated (both call the same
  `buildArchiveStatistics()`), only the display of one number is. Flagged, not silently resolved.
- Zero new CSS — reuses `.ddi-card`/`.ddi-card-title`/`.ddi-card-body`/`.ddi-nav-section-label`/
  `.ddi-stat-grid`/`.ddi-stat-tile`/`.ddi-stat-tile-total` verbatim.
- No dedicated enable/disable setting, matching Archive Navigation's precedent (no per-component
  toggle for topic-page components that weren't explicitly asked to have one).
- `ddi-intelligence-dashboard.js`/`.hbs` confirmed untouched (`git diff` shows zero delta on both).
- Connector named `ddi-division-header` specifically to sort alphabetically before
  `ddi-intelligence-dashboard` within their shared outlet, in case intra-outlet ordering there turns
  out to be filename-based — unconfirmed for this specific outlet (see `ARCHITECTURE.md`'s
  **Division Header** section for the full caveat).

## 2026-07-25 — Division Command Center, Phase 2: Categories page layout

- Restyled the stock `/categories` page (previously: Category list left, Latest topics right,
  unstyled and mostly empty) into a vertical DDI stack: Intelligence Dashboard (Total Documents /
  Document Types / Classification Levels / Recently Updated, archive-wide here since no single
  division is being viewed) on top, then Category Navigation, then Latest Intelligence below it.
- **CSS-only — no new connector, no new JS.** The "Division Information / Recent Intelligence" zone
  at the top needed nothing new: Intelligence Dashboard already renders there via the
  `discovery-list-container-top` outlet (Phase 1), and already shows archive-wide stats on any route
  that isn't a single category page.
- `.categories-and-latest` (confirmed present in this theme's own `desktop.scss`/`mobile.scss`, not
  guessed) forced to `display: flex !important; flex-direction: column !important;` in
  `common/common.scss`, replacing Discourse's native side-by-side layout at every viewport width —
  this redesign is the point, not an accidental desktop change. Category Navigation renders above
  Latest Intelligence because that's already their DOM order; no reordering needed.
- `.category-box` and `.latest-topic-list-item` (both real, previously-unstyled Discourse classes)
  added to the existing card-treatment rule that already styles `.topic-list-item`, rather than
  duplicating that ruleset. Renamed that rule's section comment from "DDI Intelligence Index" (it
  was never specific to that feature) to reflect its actual, broader scope.
- Split one line in `desktop/desktop.scss`: `.categories-and-latest` no longer shares a `gap: 1rem`
  rule with `.category-list` — that gap was sized for the old side-by-side columns, and would have
  silently overridden the new vertical-stack spacing at desktop widths.
- No new media queries; existing desktop/mobile breakpoint overrides for category/topic rows were
  left untouched and continue to apply unmodified.

## 2026-07-25 — Division Command Center, Phase 1: department-aware Dashboard and Index

- Intelligence Dashboard and Intelligence Index now automatically scope themselves to the current
  department when rendered on a category page. Homepage behavior is unchanged — both only apply a
  filter when a category is actually detected.
- New `services/ddi-category-context.js` — `getCurrentDepartment()` looks up
  `controller:discovery/category` (wrapped in a `try`/`catch`, since this is the one lookup in this
  change that isn't already proven elsewhere in this codebase) and returns the category's display
  name, or `null` on the homepage/any non-category route.
- **No new filtering logic.** Both connectors now call the existing
  `ddi-intelligence-index.js`'s `getIndex(department ? { department } : {})` instead of `getIndex()`
  — `lib/ddi-document-index.js`'s `filterDocuments()` is completely unchanged, and passing `{}` is
  behaviorally identical to omitting the argument (the function's own default). `lib/ddi-archive-
  statistics.js` is equally untouched.
- Dashboard hides its Departments breakdown tile when department-scoped (a one-entry "this
  department" tile would be redundant) via a new `isDepartmentScoped` flag and a template
  `{{#unless}}` — not by changing `buildArchiveStatistics()`'s return shape, which stays
  context-independent for its one existing homepage caller.
- Intelligence Index's template was not touched at all — only the data feeding it changed.
- **Discrepancy flagged, not silently resolved:** the request said Intelligence Index should
  "preserve sorting by Document Number," but Intelligence Index has always sorted alphabetically by
  title (Document Number ordering is Archive Navigation's behavior, not this feature's). Changing the
  sort algorithm was out of scope for a filtering task, so it was left as-is rather than guessed at
  either way — see `ARCHITECTURE.md`'s **Department-Aware on Category Pages** section.
- Verified: homepage passes `{}` (identical to the prior no-argument call); a simulated category
  page correctly returns only that department's documents, with statistics computed from the
  filtered set; a department with zero documents gracefully degrades to all-empty statistics, same
  as an archive-wide fetch failure already does.

## 2026-07-25 — Intelligence Dashboard relocated to achieve true between-placement

- Moved `connectors/above-main-container/ddi-intelligence-dashboard.*` to
  `connectors/discovery-list-container-top/ddi-intelligence-dashboard.*` — a pure outlet-folder
  rename via `git mv`, zero changes to the connector's `.js`/`.hbs` contents, the
  `ddi_homepage_dashboard_enabled` setting gate, or the `isExcludedRoute()` route guard. Component
  logic is outlet-agnostic, the same precedent already established when Intelligence Index moved
  from `above-main-container` to `below-main-container`.
- This resolves the previous session's explicitly-flagged placement gap: `above-main-container`
  renders before the *entire* routed template (before the Search Banner too), so it could never
  achieve "directly beneath the Search Banner, before the Topic List" no matter how it was combined
  with `below-main-container`. `discovery-list-container-top` is a different kind of outlet — one
  Discourse core defines *inside* the discovery/topic-list template, specifically above the topic
  list, in the same template region the native Search Banner renders in.
- **Confidence caveat, unchanged in kind from before:** this outlet has no prior use in this project
  and is not verified against a live instance (none available this session). The failure mode if the
  name is wrong is safe — Discourse's plugin-outlet system silently doesn't mount a connector for a
  nonexistent outlet, so worst case the card just doesn't appear, with no error and no effect on the
  rest of the page. `above-main-container` remains the documented, proven fallback if live testing
  shows the new outlet doesn't render.
- Route guard deliberately left in place rather than removed, even though the new outlet is likely
  already discovery-scoped on its own: "likely" isn't "confirmed," and the guard costs nothing to
  keep. See `ARCHITECTURE.md`'s **Intelligence Dashboard** section for the full reasoning.
- No second dashboard created, no logic duplicated, no styling changed — verified via `git status`
  that only the two files' paths changed.

## 2026-07-25 — Intelligence Dashboard: live archive statistics on the homepage

- Added a new homepage card — Total Documents, a Departments breakdown, a Document Types breakdown,
  a Classification Levels breakdown, and up to 5 Recently Updated Documents — as
  `connectors/above-main-container/ddi-intelligence-dashboard.*`. This is a scoped implementation of
  5 sections from the much larger, still-mostly-unbuilt design in
  `docs/ddi-intelligence-archive-dashboard.md` (v0.4.0), not the full 7-section homepage replacement
  that document describes; Search Intelligence, Operational Divisions, Recent Intelligence, and
  Recent Revisions were not built.
- **No new fetch.** All 5 sections are derived from one call to the existing
  `ddi-intelligence-index.js`'s `getIndex()` — the same archive-wide document list Intelligence Index
  itself renders — aggregated by a new pure `lib/ddi-archive-statistics.js`
  (`countByDepartment`/`countByDocumentType`/`countByClassification`/`selectRecentlyUpdated`/
  `buildArchiveStatistics`). Confirmed before relying on it that `getClassification()`'s tag-shape bug
  the design doc flagged as a blocker for classification statistics was already fixed in an earlier
  session.
- `ddi-citation-preview.js`'s `getCitation()` extended with two new field pairs —
  `documentType`/`documentTypeLabel` (reusing `lib/ddi-document-type.js`, same as the Dossier Header)
  and `updatedAt`/`updatedDate` (reusing `lib/ddi-format-date.js`, sourced from `topic.bumped_at`,
  the topic-list-level activity timestamp) — purely additive; every existing consumer (Intelligence
  Index, Archive Navigation, Intelligence Network, Knowledge Graph) is unaffected.
- Gated by `ddi_homepage_dashboard_enabled` (already defined in `settings.yml`, unused until now —
  its description was corrected to describe what it actually gates) and a route guard extracted from
  Intelligence Index's connector into a new shared `lib/ddi-route-guard.js`, so both connectors import
  one `isExcludedRoute()` instead of each carrying their own copy.
- **Placement caveat, stated plainly:** requested "between the Search Banner and the Topic List," but
  this project has only two proven "renders on every route" outlets — `above-main-container` (before
  the routed template, i.e. before the Search Banner too) and `below-main-container` (after both,
  where Intelligence Index lives). Neither is literally "between." Used `above-main-container` — the
  exact outlet the pre-existing design doc specifies for this feature, and already proven in this
  codebase — rather than an unverified, more specific outlet name that could cause the feature to
  silently not render at all. See `ARCHITECTURE.md`'s **Intelligence Dashboard** section for the full
  reasoning and a concrete outlet candidate if literal between-placement is confirmed later.
- Reuses `.ddi-card`/`.ddi-card-title`/`.ddi-card-body`/`.ddi-toc-item`/`.ddi-nav-section-label`
  verbatim; four new CSS rules (`.ddi-stat-grid`, `.ddi-stat-tile`, `.ddi-stat-list`,
  `.ddi-stat-updated-date`) for the one visual element with no prior equivalent in this theme (a
  count breakdown / big-number tile), built entirely from existing `:root` tokens.
- Fails gracefully by construction: `getIndex()` already resolves to `[]` on fetch failure rather than
  rejecting, so the aggregator naturally produces an all-empty statistics object with no new
  error-handling path; verified this explicitly, along with every real aggregation case, against
  simulated document sets.
- Topic page not touched, per instruction.

## 2026-07-25 — Document Navigation: reworked Archive Navigation's ordering and data source

- A "Document Navigation" task was requested with a spec that substantially overlapped the existing
  Archive Navigation component (same three links, plus an unrequested "Recent Documents" section) but
  differed in two concrete ways: ordering by Document Number instead of creation date, and reusing the
  Intelligence Index service instead of a direct category fetch. Rather than ship a second, competing
  navigation widget on the same page, the user chose to rework Archive Navigation in place.
- `lib/ddi-document-order.js`'s `findAdjacentDocuments()`/`selectRecentDocuments()` now sort by
  `parseDocumentId(doc.documentId)` (reusing the existing parser in `lib/ddi-document-id.js`) instead
  of `created_at`, and operate on Citation-Preview-shaped documents instead of raw topics.
- `services/ddi-archive-navigation.js` now calls `ddi-intelligence-index.js`'s
  `getIndex({ department: metadata.departmentDisplay })` — the department filter
  `lib/ddi-document-index.js` already supported end-to-end but had no caller — instead of its own
  `/c/{slug}/{id}.json` fetch. Because `getIndex()` already shapes every result through Citation
  Preview, the service no longer needs its own `ddiCitationPreview` injection or a second shaping
  pass; the now-unused `ajax` import was also removed.
- `connectors/topic-below-post-stream/ddi-navigation.*` renamed to `ddi-document-navigation.*` so its
  filename sorts between `ddi-document-footer` and `ddi-document-relationships` — using this outlet's
  already-established, deliberately-engineered filename-ordering mechanism (see `ARCHITECTURE.md`) to
  render the card directly beneath Document Footer, per the new spec. The service class/file
  (`ddi-archive-navigation.js`) and card title (`ARCHIVE NAVIGATION`) were left unchanged; only the
  connector's outlet position changed.
- Missing Previous/Next now hide entirely instead of rendering a disabled "No earlier/later document"
  placeholder, matching the new spec's explicit fallback behavior. The now-dead
  `.ddi-nav-link-disabled` CSS rule was removed. Added `←`/`→`/`↑` glyphs to the existing labels.
- Verified adjacency/recency ordering against an out-of-order document list (unsorted input sorts
  correctly by Document Number) and edge cases: first document (no previous), last document (no
  next), current document missing from the list, a single-document list, and an empty/null list — all
  fall back to `null`/`[]` gracefully.

## 2026-07-25 — Document Breadcrumb component

- Added a Document Breadcrumb — `DDC Intelligence Archive → Department → Document Type → (current
  title)` — as a new connector,
  `connectors/topic-above-post-stream/ddi-document-breadcrumb.*`, placed in the same outlet as
  Dossier Header (`topic-above-post-stream`) to render directly beneath it. Department and Document
  Type both come from `ddi-document-metadata.js`'s already-resolved fields
  (`metadata.department`/`metadata.departmentDisplay`) and `lib/ddi-document-type.js`'s
  `getDocumentTypeLabel()` (added earlier this session for the Dossier Header) — no new metadata
  resolution, no new validation calls. Falls back to `"Unknown Department"` /
  `"Unknown Document Type"` when the corresponding metadata field is unrecognized. All segments
  render uppercase via one new CSS rule (`.ddi-document-breadcrumb`), matching the Dossier Header and
  Discourse's own themed `.category-breadcrumb`; no existing CSS rule was modified.
- **Caveat, stated plainly:** intra-outlet render order between Dossier Header and Breadcrumb
  (both `topic-above-post-stream`) has not been confirmed against a live Discourse instance — none
  was available this session. If Breadcrumb renders above Dossier Header instead of below, see
  `ARCHITECTURE.md`'s **Topic Page Components** item 2 for the fix, which is localized to this one
  connector's outlet placement and doesn't touch any other component.
- Verified all 6 `DEPARTMENTS` slugs and all 23 `DOCUMENT_TYPES` slugs resolve to their correct
  breadcrumb label, and that unrecognized/missing input for either correctly falls back.

## 2026-07-25 — Dynamic Document Lifecycle badge in the Dossier Header

- The Dossier Header now shows a small lifecycle badge beside the document type, reading
  `metadata.lifecycle` (already resolved by `ddi-document-metadata.js`) through a new
  `getLifecycleLabel(slug)` in `lib/ddi-lifecycle.js` — the existing lifecycle library, extended
  rather than duplicated. `LIFECYCLE_STATES`/`isValidLifecycle()` are unchanged, so
  `ddi-document-metadata.js`, `ddi-integrity.js`, and `ddi-timeline.js` — the library's other three
  consumers — are unaffected.
- **Requested labels didn't match the existing vocabulary 1:1**, and this was resolved with the user
  before implementing rather than guessed: `under-review` → `"REVIEW"` and `superseded` →
  `"DEPRECATED"` are display-label renames only (the underlying slugs, and everything else that reads
  them, are untouched). The sixth requested value, `"Approved"`, has no corresponding slug in
  `LIFECYCLE_STATES` — the user chose to keep the vocabulary closed rather than add a new tag as part
  of a display task, so `getLifecycleLabel()` returns `null` for it like any other unrecognized input,
  and the badge shows the fallback (`"ACTIVE"`) instead. Adding a real `approved` state (and its
  Discourse admin tag) is a follow-up, not done here.
- Badge is inline text inside the existing `DOCUMENT TYPE` grid cell, not a new grid column —
  `.ddi-dossier-grid`'s `repeat(4, 1fr)` is untouched. One new, additive CSS rule
  (`.ddi-lifecycle-badge`) was added using only existing design tokens (`--ddi-border`,
  `--ddi-text-muted`); no existing rule was modified.
- Verified all 5 real lifecycle states produce the correct label, and that `null`/invalid/unrecognized
  input (including the unsupported `"approved"`) all correctly fall back to `"ACTIVE"`.

## 2026-07-25 — Dynamic Document Type display in the Dossier Header

- The Dossier Header's `DOCUMENT TYPE` field displayed the hardcoded literal string
  `INTELLIGENCE BRIEF` for every document, regardless of its actual tag. Replaced with
  `metadata.documentType` (already resolved by `ddi-document-metadata.js`) run through a new
  `getDocumentTypeLabel(slug)` in `lib/ddi-document-type.js` — the existing document type library,
  extended rather than duplicated — which derives the display label straight from the slug
  (`"intel-report"` → `"INTEL REPORT"`) instead of maintaining a separate label table that could
  drift out of sync with `DOCUMENT_TYPES`. Falls back to `"INTELLIGENCE BRIEF"` only when
  `metadata.documentType` is `null` (untagged topic) or fails `isValidDocumentType()`. Three files
  touched: `lib/ddi-document-type.js` (new function), `ddi-dossier-header.js` (compute the label),
  `ddi-dossier-header.hbs` (one line, hardcoded text → `{{documentTypeLabel}}`). No styling changed,
  no new service introduced. Verified all 23 Document Type slugs resolve to correct labels and that
  every invalid/missing input correctly falls back.

## 2026-07-25 — Document Type vocabulary expansion

- Added six Document Type slugs — `charter`, `policy`, `manual`, `procedure`, `reference`,
  `training-guide` — to `lib/ddi-document-type.js`'s `DOCUMENT_TYPES` (17 → 23; `directive`,
  `strategic-plan`, and `threat-assessment` were already present and untouched). Purely additive,
  appended after the existing 17. No other file changed: `ddi-document-metadata.js` and Document
  Integrity Verification both already read `isValidDocumentType()`/`metadata.documentType`
  generically, so they recognize the six new types with zero edits. Required Discourse admin tags
  documented in `docs/ddi-archive-information-architecture.md` §4.

## 2026-07-25 — Post-RC homepage hierarchy pass

- Moved Intelligence Index from `above-main-container` to `below-main-container`
  (`connectors/below-main-container/ddi-intelligence-index.*`, a pure outlet/folder rename — no
  logic changed). `above-main-container` rendering *before* the routed template meant a full,
  alphabetical archive listing was the first thing on the homepage, ahead of Discourse's native
  Search Banner and topic list. The new order — Search Banner, then topic list, then the Index —
  matches how an intelligence archive should read: fastest path to a known document first,
  recent-activity browsing second, full reference index last. The Index remains fully visible and
  is not collapsed.
- Removed seven CSS rules confirmed to target nothing: `.welcome-banner`, `.welcome-banner h1`/`p`,
  `.welcome-banner__wrap`, `.welcome-banner__title` (and its `::after` tagline), and
  `.welcome-banner__search-menu` — leftover styling for `common/homepage.html`, deleted in RC
  cleanup, previously documented in `CODING_STANDARDS.md` as an intentional-but-dead BEM exception.
  `.custom-search-banner-wrap` (the live styling for the native Search Banner) was confirmed
  separate and left untouched.
- Updated `CODING_STANDARDS.md` to drop the now-resolved `.welcome-banner__*` exception note.

## 2026-07-25 — CSS token consolidation, related-documents feature, intelligence timeline, classification watermark, archive navigation, intelligence index, document integrity verification, document relationships, knowledge graph

- Added the DDI Knowledge Graph: `services/ddi-knowledge-graph.js`'s `getDocumentGraph(topic)`
  composes four existing services (`ddi-document-metadata`, `ddi-relationship`,
  `ddi-related-intelligence`, `ddi-citation-preview`) into one typed node/edge graph — Metadata as
  node fields, declared Relationships and Cross References as distinct edge types, Categories/Tags
  reused as-is from Intelligence Network's own scoring as `"related"` edges (not re-scored). New
  pure `lib/ddi-graph.js` (`createNode`/`createEdge`/`mergeNodes`, the latter gap-filling rather than
  overwriting when the same document is found by more than one signal). Backend-only — no
  connector, no template, no CSS, no UI; a reusable data model for a future visualization to
  consume. See `ARCHITECTURE.md`'s **Knowledge Graph** section for the full Architecture Review and
  Future Roadmap.
- Committed the pre-existing Document Relationships feature (`services/ddi-relationship.js`,
  `lib/ddi-relationship.js`, `connectors/topic-below-post-stream/ddi-document-relationships.*`) —
  written in an earlier session and left uncommitted since, now landed unmodified as groundwork for
  the Knowledge Graph's Relationships edge source.
- Added Document Integrity Verification: five PASS/WARN checks (Classification, Department,
  Document Type, Lifecycle, Metadata) against each document, visible only when
  `ddi_debug_mode_enabled` is on (no new setting). `lib/ddi-integrity.js` reads
  `ddi-document-metadata.js`'s already-resolved fields directly rather than re-running
  `isValidDepartment`/`isValidDocumentType`/`isValidLifecycle` a second time — this is their first
  real consumer, closing the gap `ARCHITECTURE.md`'s Metadata Validation section had flagged since
  those functions were added. Implemented as
  `connectors/topic-below-post-stream/ddi-verification-panel.*`, reusing
  `.ddi-card.ddi-restricted`/`.ddi-intel-grid` from Debug Mode's own panel verbatim.
- Added the Intelligence Index: an alphabetical, archive-wide list of every document (Document
  Number, Title, Department, Classification, Revision), rendered above the page content on browsing
  routes only (hidden on document and admin pages). The theme's first `above-main-container`
  connector — new opt-out setting `ddi_intelligence_index_enabled` (default `true`).
  `services/ddi-intelligence-index.js` fetches `/latest.json` and shapes every result through the
  existing `ddi-citation-preview.js` (zero new "topic to display fields" logic); sorting and
  filtering are new pure functions in `lib/ddi-document-index.js`, with filtering fully wired
  end-to-end (`getIndex(filters)`) even though no filter UI is built yet. Implemented as
  `connectors/above-main-container/ddi-intelligence-index.*`.
- Added Archive Navigation: Previous Document, Next Document, Department Home, and Recent Documents
  in Department on every document page. `services/ddi-archive-navigation.js` reuses
  `ddi-document-metadata.js` for department identity, the existing `/c/{slug}/{id}.json` category-
  topics fetch already established by Intelligence Network, and `ddi-citation-preview.js` to present
  each linked document — no new "topic to display fields" mapping. Prev/next/recent ordering is a
  new pure `lib/ddi-document-order.js`. Implemented as
  `connectors/topic-below-post-stream/ddi-navigation.*`.
- Added the Classification Watermark: a fixed, full-viewport, low-opacity classification label
  (PUBLIC RELEASE / INTERNAL / CONFIDENTIAL / RESTRICTED / TOP SECRET) rendered behind the open
  document. Reuses `metadata.classification`/`metadata.classificationClass` from
  `ddi-document-metadata.js` (same fields Security Banner already consumes) and the existing
  `--ddi-accent` color set by the Classification Levels CSS — no new classification logic, no new
  color palette. Implemented as `connectors/topic-above-post-stream/ddi-classification-watermark.*`.
- Added the Intelligence Timeline: a vertical, document-page list of lifecycle events (Created,
  Approved, Revised, Reviewed, Deprecated, Archived), derived entirely from existing
  `ddi-document-metadata.js` fields with no new tags or fetches. Implemented as
  `lib/ddi-timeline.js`'s `buildTimeline()`, composed into the metadata service, and rendered by
  `connectors/topic-above-posts/ddi-document-timeline.*`.
- Refactored `common/common.scss`: extended the `:root` custom-property system with a full
  color/border/shadow token scale and replaced repeated raw hex/rgba literals throughout the file
  with references to it.
- Removed several selectors that had been accidentally declared more than once in the file (e.g.
  `.d-header`, `.topic-list thead`, `.fancy-title`, `.topic-list .topic-list-item:hover`), collapsing
  each down to the single rule that was actually taking effect.
- Added the Intelligence Network feature: a "related documents" panel on the topic page, ranked by
  shared category (+100), classification (+50), and tags (+25 each), returning the top 5 matches.
  Implemented as `services/ddi-related-intelligence.js` plus a
  `connectors/topic-below-post-stream/ddi-intelligence-network.*` connector/template pair.
- Added design documents: `docs/ddi-archive-information-architecture.md` (proposed category/tag
  taxonomy), `docs/ddi-intelligence-network.md` (related-documents design), and
  `docs/ddi-intelligence-archive-dashboard.md` (homepage dashboard roadmap — not yet implemented).

## 2026-07-24 — Classification refactor and architecture cleanup

- Converted the classification engine to a data-driven configuration
  (`lib/ddi-classification.js`'s `CLASSIFICATIONS` array).
- Centralized classification logic so all topic-page components resolve classification through the
  shared `getClassification()` helper instead of each computing it separately.
- Introduced a shared document date formatter (`lib/ddi-format-date.js`), removing duplicate
  date-formatting code from individual connectors.
- General architecture cleanup and document-navigation finalization.

## 2026-07-23 — Document Intelligence panel and classification engine

- Added the Document Intelligence panel (reading time, word count, category, replies, views, last
  revision) and its supporting metadata computation.
- Built out the classification engine and its security-classification display.

## 2026-07-22 — Dossier metadata fields

- Added document type, author, and status metadata to the Dossier Header.
- Finalized dynamic document ID and issued-date computation on the Dossier Header connector (later
  found in review to be dead — see `ARCHITECTURE.md`'s Known Gaps section; the values actually
  rendered come from a separate initializer added in this same period).

## 2026-07-21 — Dossier header structure

- Wrapped the dossier header in Discourse's content container and refined its classification field
  and layout.
- Consolidated `#main-outlet` styling.

## 2026-07-20 — Forum styling pass

- Styling pass over navigation and topic metadata to match the command-network visual language.

## 2026-07-19 — Initial theme foundation

- Initial Discourse theme structure, settings, and the first pass of the DDI Command Network visual
  redesign (header, card-based category/topic list presentation, base color/spacing foundation).
- Several early fixes: settings YAML formatting, JS API compatibility, an SCSS gradient syntax error,
  and scoping the visual overrides so they didn't leak into unrelated Discourse layout.
