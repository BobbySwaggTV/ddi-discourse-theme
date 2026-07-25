# Changelog

This changelog is derived from the project's git history, grouped by development session (date).

**A note on versioning:** early commit messages embed ad hoc version labels (`v0.1.0` through
`v0.3.0`), but these were never consistently reflected in `about.json` — `about.json` currently
declares `version`/`theme_version` `0.2.1`, and the labels don't even increase monotonically over
time in the commit history. They should not be read as an authoritative release history. This
changelog uses dates instead, since those are verifiable.

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
