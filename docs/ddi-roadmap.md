# DDI Roadmap — Next 10 Features

Version: v1.0
Repository: ddi-discourse-theme
Scope: A prioritized backlog synthesized from a full review of the current codebase (`ARCHITECTURE.md`,
`CODING_STANDARDS.md`) and every existing design document in `docs/`. Nothing here is a new
architecture decision — every item either fixes a known defect in already-shipped code, or
implements a feature that already has a complete design document, using the lib/service/connector
pattern already established. No new folders, patterns, or conventions are introduced.

## Review Basis

This list was built from what's actually in the repository, not fresh brainstorming:

- **Known defects in shipped code** (from `ARCHITECTURE.md`'s Known Gaps): the `getClassification()`
  tag-matching bug, the Dossier Header's dead `documentId`/`issuedDate` computation, and the
  hardcoded Document Type placeholder.
- **Fully-designed, unimplemented features**: the Homepage Dashboard
  (`docs/ddi-intelligence-archive-dashboard.md`), Intelligence Search
  (`docs/ddi-intelligence-search.md`), and Revision History (`docs/ddi-revision-history.md`).
- Items that are real gaps but **not yet at "designable next feature" maturity** — Lifecycle
  tag display (the metadata standard has an open, undecided default-value question) and the
  sidebar rebuild (never designed past "it's dead," per `ARCHITECTURE.md`) — were deliberately left
  out of the top 10 rather than presented as ready to build. See **Excluded / Not Yet Ready** below.

**Note on estimates:** this project has no prior complexity-estimation or milestone convention to
draw from (no story points, no release history beyond `about.json`'s version field). The
Complexity scale (XS/S/M/L) and milestone groupings below are proposed for this roadmap, not a
description of an existing process.

## Summary

| # | Feature | Complexity | Depends on | Milestone |
|---|---|---|---|---|
| 1 | Fix classification resolution bug | XS | — | M1 — Foundation Fixes |
| 2 | Resolve Dossier Header dead code | S | — | M1 — Foundation Fixes |
| 3 | Dynamic Document Type in Dossier Header | S | #1 | M1 — Foundation Fixes |
| 4 | Homepage Dashboard: connector scaffold | M | — | M2 — Homepage Dashboard |
| 5 | Dashboard: Search Intelligence + Divisions + Statistics | M | #4 | M2 — Homepage Dashboard |
| 6 | Dashboard: Recent Intelligence + Recently Updated | M | #4 | M2 — Homepage Dashboard |
| 7 | Dashboard: Classification Breakdown | S | #1, #4 | M2 — Homepage Dashboard |
| 8 | Revision History (per-document) | L | — | M3 — Document Lifecycle |
| 9 | Dashboard: Recent Revisions | M | #8, #4 | M3 — Document Lifecycle |
| 10 | Intelligence Search | M | — | M4 — Search & Discovery |

## 1. Fix Classification Resolution Bug

**Purpose:** Correct `getClassification()` in `lib/ddi-classification.js`, which compares
`tag.slug` against `topic.tags` — but Discourse tags are plain strings, not objects with a `.slug`
property, so the comparison silently never matches and every document falls back to the default
(`PUBLIC RELEASE`) classification regardless of its actual tags.

**User value:** This is the single highest-leverage fix available — three already-shipped features
(Security Banner, Dossier Header's classification accent color, Intelligence Network's
classification-match ranking signal) are all silently degraded by it today. Fixing one function
correctly restores the accuracy of all three at once, and unblocks Classification Breakdown (#7).

**Estimated complexity:** XS — a one-line comparison fix. The effort is almost entirely in careful
manual QA across the three dependent features, not the code change itself.

**Dependencies:** None.

**Suggested milestone:** M1 — Foundation Fixes.

## 2. Resolve Dossier Header Dead Code

**Purpose:** `ddi-dossier-header.js` computes `documentId` and `issuedDate` and sets them as
component properties, but the template never renders either — the visible text is actually produced
by a separate, imperative DOM-mutation initializer (`ddi-dossier-refresh.js`) that redundantly
re-derives the same values. Pick one mechanism and remove the other.

**User value:** No visible change if done correctly — the value is entirely in removing a
maintenance trap. Today, a future contributor "fixing" the document ID or issued date in the
connector would see no effect, because a different file is what actually renders it.

**Estimated complexity:** S — mechanically small, but requires a real decision (template-bound
property vs. the initializer's direct DOM write) before either can be safely removed; both options
are already laid out in `ARCHITECTURE.md`'s Known Gaps.

**Dependencies:** None functionally; pairs naturally with #3 since both touch the same template.

**Suggested milestone:** M1 — Foundation Fixes.

## 3. Dynamic Document Type in Dossier Header

**Purpose:** Replace the hardcoded literal `INTELLIGENCE BRIEF` in `ddi-dossier-header.hbs` with
the topic's actual Document Type tag, read against the vocabulary already defined in
`docs/ddi-archive-information-architecture.md`.

**User value:** Every document in the archive currently displays the identical, almost certainly
wrong document type. This is a visible, easily-noticed correctness gap for anyone actually using
the archive, and it's what makes the Document Type field in the metadata standard real instead of
aspirational.

**Estimated complexity:** S — read the topic's Document Type tag, map to a display label, fall back
gracefully (e.g. "UNCLASSIFIED TYPE" or similar) when untagged.

**Dependencies:** #1 — this should reuse the corrected tag-matching approach rather than introduce
the same string-vs-object bug a second time in new code. Also depends on the Document Type tags
actually existing in Discourse admin (a content/configuration precondition, not code).

**Suggested milestone:** M1 — Foundation Fixes.

## 4. Homepage Dashboard: Connector Scaffold

**Purpose:** Stand up the real `above-main-container` connector — route-guarded to the homepage
only, gated by the existing `ddi_homepage_dashboard_enabled` setting, with default Discourse
homepage furniture suppressed via CSS — as an empty shell. Phase 1 of the existing dashboard design.

**User value:** None directly visible (an empty shell, by design) but this is the foundation every
other dashboard feature below depends on, and it deliberately re-does the one step that was skipped
the first time this was attempted (`docs/ddi-intelligence-archive-dashboard.md`'s root-cause
section) — proving the mechanism reaches the browser before any content is built on top of it.

**Estimated complexity:** M — the connector shape itself is proven (six existing topic-page
connectors use it), but route-guarding an outlet that renders on every page, and scoping CSS
suppression correctly, are genuinely new territory for this codebase.

**Dependencies:** None blocking, but the design's own Phase 0 groundwork (confirming the setting is
the right gate, deciding the retirement plan for `common/homepage.html`/`sidebar.html`) should
happen alongside it.

**Suggested milestone:** M2 — Homepage Dashboard.

## 5. Dashboard: Search Intelligence + Operational Divisions + Document Statistics

**Purpose:** Deliver the three lowest-risk dashboard sections together — the search entry point,
the six division cards, and archive-wide document counts (which reuses the exact same category data
Divisions already loads, at zero extra fetch cost).

**User value:** The single biggest visible step toward "a corporate intelligence portal, not a
discussion forum" — this is the first thing every visitor to the homepage sees, and it's the
foundation the eventual Intelligence Search UI (#10) will live inside.

**Estimated complexity:** M — three sections, but all three were specifically flagged as low-risk in
the existing design: no new fetch pattern for Search (delegates to Discourse's native search),
read-only rendering for Divisions, and zero new requests for Statistics.

**Dependencies:** #4.

**Suggested milestone:** M2 — Homepage Dashboard.

## 6. Dashboard: Recent Intelligence + Recently Updated

**Purpose:** Add the two archive-activity list sections — newest documents, and most recently
edited/active documents.

**User value:** Gives returning users a reason to come back to the homepage rather than landing on
it once — the archive starts surfacing what's new and what's changed instead of sitting static.

**Estimated complexity:** M — the first dashboard section requiring real list-fetching (extending
the existing `ddi-related-intelligence` service pattern, or a sibling service). Requires the
sort/filter distinction between the two lists to be precise enough that they don't render
near-duplicate content, which the existing design already calls out as a requirement, not an
afterthought.

**Dependencies:** #4.

**Suggested milestone:** M2 — Homepage Dashboard.

## 7. Dashboard: Classification Breakdown

**Purpose:** Add the per-classification document-count section, reading Discourse's existing
`/tags.json` (which already returns topic counts per tag) filtered to the 5 classification slugs.

**User value:** An at-a-glance sensitivity profile of the entire archive — a genuinely
intelligence-portal-specific feature with no discussion-forum equivalent, valuable to anyone
overseeing the archive rather than just reading individual documents.

**Estimated complexity:** S — no new aggregation logic, purely a filtered read of an endpoint
Discourse already provides.

**Dependencies:** #1 (without it, this section would just show the entire archive as 100% Public
Release, which is worse than not shipping it) and #4.

**Suggested milestone:** M2 — Homepage Dashboard.

## 8. Revision History (Per-Document)

**Purpose:** A topic-page panel listing a document's edit history — Revision, Date, Editor,
Summary — per the completed design in `docs/ddi-revision-history.md`, built on Discourse's native
post-revision system rather than a new tracking mechanism.

**User value:** Real audit-trail value that doesn't exist anywhere in the product today — "who
changed this document and when" is a basic expectation for anything calling itself an intelligence
archive, not an optional nicety.

**Estimated complexity:** L — the only item in this list needing a genuinely new service with an
unresolved architectural question already flagged in its own design doc (bounded vs. unbounded
revision fetching for documents with long edit histories) that needs a real decision during
implementation, not just code.

**Dependencies:** None blocking, but the `Rnn` revision-formatting logic should be extracted into
`lib/` first (already recommended in the design doc) rather than duplicated a second time alongside
the existing, currently-dead computation in `ddi-document-intelligence.js`.

**Suggested milestone:** M3 — Document Lifecycle Features.

## 9. Dashboard: Recent Revisions

**Purpose:** Add the archive-wide "recently edited documents" dashboard section, per the design's
extension of the Revision History service with a new, narrower "latest revision only" method.

**User value:** Extends #8's audit-trail value from one document at a time to the whole archive at a
glance — surfaces editorial activity across all six divisions on the homepage.

**Estimated complexity:** M — mostly reuses #6's recently-active topic list, enriched via a new
method on #8's service; the design deliberately avoids inventing a second revision-fetching
mechanism, so most of the complexity is already resolved in the design, not deferred to
implementation.

**Dependencies:** #8 — hard dependency, explicitly called out in the design as "don't build this
before the per-document version exists," since it would mean building the revision-fetching logic
twice. Also #4.

**Suggested milestone:** M3 — Document Lifecycle Features (grouped with #8 despite being
dashboard-hosted, since they share one service).

## 10. Intelligence Search

**Purpose:** The structured search form (Document Number, Title, Department, Classification, Tags,
Document Type) per `docs/ddi-intelligence-search.md` — a query-building layer over Discourse's
existing search, plus a direct-lookup path for Document Number.

**User value:** Turns "browse and hope" into "look up a specific document" — the single most basic
capability expected of a document-management system, and currently entirely absent (only
Discourse's default, unstyled search exists today).

**Estimated complexity:** M — mostly UI/form work plus one small new `lib/` function
(`parseDocumentId`, the inverse of the existing `formatDocumentId`); the design deliberately avoids
building any new search backend.

**Dependencies:** None blocking on its own — it can ship as a standalone connector before the
dashboard exists, per its own design's placement note, and relocate into #5's Search Intelligence
slot later without redesign.

**Suggested milestone:** M4 — Search & Discovery.

## Excluded / Not Yet Ready

Real gaps, deliberately left out of the top 10 because they aren't at "ready to build" maturity yet:

- **Lifecycle tag display** — the metadata standard (`docs/ddi-document-metadata-standard.md` §4.7)
  has an open, undecided question (should an untagged document default to `active`, like
  Classification defaults to `PUBLIC RELEASE`, or have no default at all?) that needs a deliberate
  decision before this is a well-scoped feature, not an implementation task in its own right.
- **Sidebar rebuild** — confirmed dead (`common/sidebar.html` is never compiled in), but unlike the
  homepage it has never been designed past that diagnosis. Worth a design pass of its own before it
  belongs on an implementation roadmap.
- **Revision comparison/diff view** — explicitly deferred as a "future extensibility" seam in the
  Revision History design (#8), not a currently-designed feature. Natural candidate for the next
  roadmap pass once #8 ships.
- **Wiring the remaining inert `settings.yml` toggles** (`ddi_header_enabled`, `ddi_compact_density`,
  `ddi_red_glow_strength`, `ddi_interface_mode_enabled`) to real behavior, and retiring
  `common/homepage.html`/`sidebar.html`/`variables.scss` — legitimate cleanup work, but lower user
  value than anything in the top 10, better suited to the Dashboard's own already-planned Phase 6
  (Retirement & Polish) than a standalone roadmap slot.
