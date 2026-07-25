# Changelog

This changelog is derived from the project's git history, grouped by development session (date).

**A note on versioning:** early commit messages embed ad hoc version labels (`v0.1.0` through
`v0.3.0`), but these were never consistently reflected in `about.json` — `about.json` currently
declares `version`/`theme_version` `0.2.1`, and the labels don't even increase monotonically over
time in the commit history. They should not be read as an authoritative release history. This
changelog uses dates instead, since those are verifiable.

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
