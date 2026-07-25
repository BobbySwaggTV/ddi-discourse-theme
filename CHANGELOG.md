# Changelog

This changelog is derived from the project's git history, grouped by development session (date).

**A note on versioning:** early commit messages embed ad hoc version labels (`v0.1.0` through
`v0.3.0`), but these were never consistently reflected in `about.json` — `about.json` currently
declares `version`/`theme_version` `0.2.1`, and the labels don't even increase monotonically over
time in the commit history. They should not be read as an authoritative release history. This
changelog uses dates instead, since those are verifiable.

## 2026-07-25 — CSS token consolidation, related-documents feature, intelligence timeline, classification watermark, archive navigation, intelligence index, document integrity verification

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
