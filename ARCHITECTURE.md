# Architecture

This document describes how the DDI theme is actually built, as verified against the current
source — not the original design plans in `docs/`, which describe some work that was never
finished. Where the two disagree, this document says so explicitly.

## Constraints

- **Theme only.** No Discourse core files are modified. All behavior comes from SCSS overrides,
  Discourse's plugin outlet system, and theme API initializers.
- **No build step.** There is no `package.json`, bundler, or compile step in this repo. Files are
  used as-is by Discourse's theme compiler.
- **No test suite.** There is no automated testing in this repo. Verification is manual, in a real
  Discourse instance.

## Directory Layout

```
common/       Styles and HTML applied on every device
desktop/      Desktop-only SCSS (media query overrides)
mobile/       Mobile-only SCSS (media query overrides)
javascripts/discourse/
  lib/            Pure, stateless helper functions
  services/       Injectable Ember services
  connectors/     Plugin outlet components (rendering only)
  api-initializers/  Page-lifecycle hooks (discourse/lib/api's apiInitializer)
assets/       Static files (currently just one unreferenced logo image)
docs/         Design documents written during development
```

## The lib / service / connector pattern

This is the one architectural rule the codebase is consistent about, and it should be preserved
for any new work:

- **`lib/`** — pure functions with no side effects and no Discourse/Ember dependencies beyond their
  input. Example: `formatDocumentId(id)`, `formatDocumentDate(date)`. If two pieces of code need the
  same computation, it belongs here, imported by both — not reimplemented in each place.
  `ddi-classification.js`, `ddi-document-type.js`, `ddi-lifecycle.js`, and `ddi-department.js` each
  export their field's canonical vocabulary plus an `isValid*(slug)` check against it — see
  **Metadata Validation** below. `ddi-category.js` exports `UNCATEGORIZED_LABEL`, the fallback text
  for a topic with no category — extracted in RC cleanup from 4 identical literal-string occurrences
  across Document Intelligence, Document Footer, Debug Mode, and Citation Preview.
- **`services/`** — Ember `Service` classes, used when logic needs to do async work (network
  requests) or would benefit from being injectable/reusable across multiple connectors.
  `ddi-related-intelligence.js` injects `ddi-citation-preview.js` rather than shaping its own result
  objects — a service depending on another service for a shared concern (turning a topic into
  display-ready fields) is the same pattern as any other reuse rule here, just at the service layer
  instead of `lib/`. `ddi-document-metadata.js` is the canonical, synchronous metadata resolver for
  the *current* topic page; `ddi-relationship.js` injects both it and `ddi-citation-preview.js` —
  the metadata engine for the current document (no fetch needed), citation-preview for any *other*
  referenced document (which does need a fetch, and already handles the snake_case/camelCase shape
  difference between a raw AJAX response and an Ember topic model — see **Document Relationships**
  below for why that distinction matters).
- **`connectors/<outlet-name>/<name>.js` + `.hbs`** — the classic Discourse plugin-outlet-connector
  shape: a `{ setupComponent(args, component) { ... } }` export paired with a template that reads
  `{{this.someProperty}}`. Connectors should contain wiring only — look up data, call into `lib/`
  or `services/`, call `component.setProperties(...)`. They should not contain business logic.
- **`api-initializers/`** — for behavior that doesn't fit the outlet-connector model, e.g. reacting
  to `api.onPageChange`. Used once, for a case described below that's worth understanding before
  adding a second one.

## Topic Page Components

All topic-page components follow the pattern above. In render order:

1. **Dossier Header** (`connectors/topic-above-post-stream/ddi-dossier-header.*`) — classification
   color, author, status (open/closed), document type, lifecycle, and (see **Known Gaps** below)
   document ID / issued date. Document type is `metadata.documentType` (the Metadata Engine's
   already-resolved tag) run through `lib/ddi-document-type.js`'s `getDocumentTypeLabel()` — a pure
   slug-to-label formatter added alongside `isValidDocumentType()` in the same file, not a new lookup
   table — falling back to the literal string `"INTELLIGENCE BRIEF"` only when the topic has no valid
   Document Type tag. Lifecycle is a small badge shown beside it (same grid cell, not a new grid
   column — the grid's `repeat(4, 1fr)` is unchanged): `metadata.lifecycle` run through
   `lib/ddi-lifecycle.js`'s new `getLifecycleLabel()`, which maps each of the five real
   `LIFECYCLE_STATES` slugs to a display word (`under-review` → `"REVIEW"`, `superseded` →
   `"DEPRECATED"`, the rest unchanged), falling back to `"ACTIVE"` when no valid lifecycle tag is
   present. **Note:** a sixth requested badge value, "Approved," has no backing slug in
   `LIFECYCLE_STATES` — by explicit choice (see `CHANGELOG.md`), the vocabulary itself was left
   untouched rather than adding a new tag as part of a display task, so "Approved" cannot currently
   appear; it would require a genuine vocabulary change (new admin tag), out of scope here.
2. **Document Navigation Sidebar** (`connectors/topic-above-post-stream/
   ddi-document-navigation-sidebar.*`, v1.4) — replaced the old "Table of Contents" card (retired —
   H2-only, inline, no active-section tracking) with a live, auto-built outline of every H2 and
   nested H3, active-section highlighting via `IntersectionObserver`, smooth scroll, and a
   right-docked sticky panel at wide viewports that collapses to a tap-to-expand disclosure at
   narrower ones. Hides entirely on documents with no headings. Shares `topic-above-post-stream`
   with Dossier Header/Breadcrumb/Watermark, `position: fixed` at its wide-viewport breakpoint, so
   its DOM position within that outlet doesn't matter, the same reasoning Classification Watermark
   below already established for the identical reason. See **Document Navigation Sidebar (v1.4)**
   below for the full reasoning and confidence caveats.
3. **Document Breadcrumb** (`connectors/topic-above-post-stream/ddi-document-breadcrumb.*`) — a
   lightweight trail: `DDI Intelligence Archive → Department → Document Type → (current title)`.
   Department is `metadata.department`/`metadata.departmentDisplay` (both already resolved by the
   Metadata Engine from `topic.category`) — falls back to `"Unknown Department"` when
   `metadata.department` is `null` (category isn't one of the six recognized divisions), reusing that
   already-computed truthiness rather than re-calling `isValidDepartment()`. Document Type reuses the
   same `getDocumentTypeLabel()` added for the Dossier Header, falling back to
   `"Unknown Document Type"`. All segments render uppercase via CSS (`text-transform: uppercase` on
   `.ddi-document-breadcrumb`) to match the Dossier Header and Discourse's own themed
   `.category-breadcrumb` — the source strings themselves (`departmentDisplay`, the topic title) are
   left in their natural case; only presentation is transformed. **Shares the `topic-above-post-stream`
   outlet with Dossier Header, placed to render directly beneath it** — this is the same outlet
   relationship Classification Watermark already has with Dossier Header (see next item), except
   Breadcrumb *does* participate in normal document flow, so unlike the fixed-position Watermark, its
   position relative to Dossier Header inside that outlet has not been confirmed against a live
   Discourse instance (none was available for this pass); if it renders above Dossier Header instead
   of below, the fix is a `topic-above-post-stream`-only concern (e.g. an explicit render priority or
   moving Breadcrumb to `topic-above-posts` ahead of Security Banner) and does not touch any other
   component. Flagging this the same way the homepage reorder's manual-testing caveat was flagged.
4. **Classification Watermark** (`connectors/topic-above-post-stream/ddi-classification-watermark.*`)
   — a fixed, full-viewport, low-opacity classification label rendered behind the document while its
   topic page is mounted. Shares the `topic-above-post-stream` outlet with Dossier Header and
   Breadcrumb; DOM order among the three doesn't matter for the watermark since it's removed from
   normal flow (`position: fixed`). See **Classification Watermark** below.
5. **Security Banner** (`connectors/topic-above-posts/ddi-security-banner.*`) — classification name
   and message, via `lib/ddi-classification.js`.
6. **Executive Summary** (`connectors/topic-above-posts/ddi-executive-summary.*`) — takes the
   first post's cooked HTML, parses it with `DOMParser`, and shows the text of the first `<p>`
   element. This is a simple extraction, not a generated summary.
7. **Document Intelligence Header** (`connectors/topic-above-posts/ddi-document-intelligence-header.*`,
   v1.3) — replaced the old "Document Intelligence" card (same outlet, same filename-ordering
   position — `ddi-document-intelligence-header` still sorts between `ddi-executive-summary` and
   `ddi-document-revision-history`, re-verified after the rename, see below). A
   prominent document title plus a compact two-column metadata grid: Document Number, Classification,
   Department, Lifecycle, Revision, Last Reviewed, Estimated Reading Time, Related Documents count.
   See **Document Intelligence Header (v1.3)** below for the full reasoning.
8. **Intelligence Relationships** (`connectors/topic-above-posts/
   ddi-document-intelligence-relationships.*`, v1.5) — replaced the old, separate Document
   Relationships and Intelligence Network cards (both retired — see items 12/13 removed from this
   list) with one consolidated panel directly below the Document Intelligence Header, grouped by
   relationship type: References, Supersedes, Superseded By, Related Intelligence, Required Reading,
   Supporting Documentation (all from `services/ddi-relationship.js#getRelationships()`, unchanged),
   plus two new derived groups, Same Department and Same Classification (client-side filters over
   `services/ddi-related-intelligence.js#findRelated()`'s own already-ranked candidates — no new
   fetch, no new scoring pass). Only groups with data render; the whole panel hides on documents with
   no relationships in any group. Filename deliberately sorts directly after
   `ddi-document-intelligence-header` and before `ddi-document-revision-history` (shared prefix
   `ddi-document-i` still precedes `ddi-document-r`), the same filename-ordering technique used
   throughout this outlet. See **Intelligence Relationships (v1.5)** below for the full reasoning and
   confidence caveats.
9. **Revision History** (`connectors/topic-above-posts/ddi-document-revision-history.*`, enhanced
   v1.7) — a real Revision Number/Date/Author/Summary/Approval Status table, newest revision first,
   parsed from the document's own "## Revision History" body section when one exists; falls back to
   the original single-row snapshot (derived from Discourse's own post-edit version counter) for any
   document that doesn't have one. Still no service — parsing is synchronous and reuses the same
   cooked-HTML parse other topic-page components already trigger for this post, no new fetch. See
   **Revision History (v1.7)** below for the full reasoning. Positioned directly below the Document
   Intelligence Header via
   filename-based outlet ordering (see `docs/ddi-intelligence-network.md` for the same technique
   applied elsewhere). RC cleanup re-verified the sort arithmetic itself is correct
   (`ddi-document-intelligence` < `ddi-document-revision-history`, confirmed
   against the live directory listing); re-verified again after the v1.3 rename
   (`ddi-document-intelligence-header` sorts identically relative to it, since the shared prefix
   `ddi-document-i` still precedes `ddi-document-r`) — what remains genuinely
   unverified is the underlying assumption that Discourse renders same-outlet connectors in filename
   order at all, which requires a running instance to confirm and wasn't something either pass had
   access to. (The old "Table of Contents" card that used to sort last in this chain,
   `ddi-document-toc`, was retired in v1.4 — see item 2 above and **Document Navigation Sidebar
   (v1.4)** below — so this chain no longer has a third link.)
10. **Intelligence Timeline** (`connectors/topic-above-posts/ddi-document-timeline.*`) — a vertical,
   chronologically-ordered list of lifecycle events (Created, Approved, Revised, Reviewed,
   Deprecated, Archived), synchronous, derived entirely from `ddi-document-metadata.js`'s existing
   fields (no new fetch, no new tag, no new topic custom field). Filename sorts directly after
   Revision History (`ddi-document-revision-history` < `ddi-document-timeline`), same
   filename-ordering technique and the same unverified-against-a-live-instance caveat noted for
   Revision History above. See **Intelligence Timeline** below.
11. **Document Footer** (`connectors/topic-below-post-stream/ddi-document-footer.*`) — Document
   Number, Classification, Revision, Department, Last Updated, Author, and a static "End of
   Document" marker. Synchronous, same reasoning as Revision History (no service needed).
   `ddi-debug-panel` also shares this outlet and sorts before it — no ordering requirement was ever
   set for it, so there's nothing to verify there.
12. **Archive Navigation** (`connectors/topic-below-post-stream/ddi-document-navigation.*` +
    `services/ddi-archive-navigation.js`) — Previous Document, Next Document, Department Home, and
    up to 5 Recent Documents in Department. Previous/Next/Recent are ordered by Document Number
    (`lib/ddi-document-order.js`, parsed via `lib/ddi-document-id.js`'s existing `parseDocumentId()` —
    reused rather than re-implemented), not creation date. The connector was renamed from
    `ddi-navigation` to `ddi-document-navigation` specifically so its filename sorts directly after
    `ddi-document-footer`, placing it directly beneath Document Footer using the same deliberate
    filename-ordering mechanism described above — the service class and its file
    (`ddi-archive-navigation.js`) were kept as-is since only the connector's outlet position needed to
    change. (Previously this also had to sort ahead of `ddi-document-relationships`; that connector,
    along with `ddi-intelligence-network`, was retired in v1.5 — see item 8 above and **Intelligence
    Relationships (v1.5)** below — so this outlet's own ordering constraint is simpler than it used
    to be.) See **Archive Navigation** below.
13. **Cross References** (`api-initializers/ddi-cross-references.js` +
    `lib/ddi-cross-reference.js`) — detects `DDI-NNNNNN` patterns in the first post's rendered text
    and converts them into links to the referenced document. Not a plugin-outlet connector, unlike
    everything else in this list — `decorateCookedElement` is the correct Discourse API for mutating
    already-rendered post HTML, and this project already has one precedent for that class of work
    (`api-initializers/ddi-dossier-refresh.js`). See **Cross References** below for the full split
    between the pure detection/parsing library and this DOM-mutation layer.
14. **Debug Mode** (`connectors/topic-below-post-stream/ddi-debug-panel.*` +
    `lib/ddi-debug.js`) — an opt-in diagnostic panel (Document ID, Topic ID, Category,
    Classification, Detected Tags, Revision, Word Count, Reading Time), gated entirely off by
    default. See **Debug Mode** below.
15. **Document Integrity Verification** (`connectors/topic-below-post-stream/ddi-verification-panel.*`
    + `lib/ddi-integrity.js`) — five PASS/WARN checks (Classification, Department, Document Type,
    Lifecycle, Metadata) against the current document's already-resolved metadata. Gated by the same
    `ddi_debug_mode_enabled` setting as Debug Mode, not a new one. Filename (`ddi-verification-panel`)
    deliberately sorts after `ddi-document-navigation`, the same "append without reordering"
    technique Archive Navigation established. See **Document Integrity Verification** below.

## Archive-Wide Components

Everything above is scoped to a single topic page (`args.model` is that topic). These three aren't:
they render off a different Discourse outlet family than any topic-page component. The first two
render on every *non-document* discovery route (homepage, `/categories`, and individual division
pages alike); the third (Homepage Hero) is scoped narrower still — the true homepage only, not
`/categories` or a division page — see its own bullet for why.

1. **Browse Archive** (`connectors/below-main-container/ddi-browse-archive.*` +
   `services/ddi-intelligence-index.js`) — an archive-wide document list, either alphabetical
   (Document Number, Title, Department, Classification, Revision) or year-grouped, as a tab switcher
   between the two (Homepage UX Cleanup, v1.1, merged what were two separate cards — Intelligence
   Index and Intelligence Timeline — into this one section; see **Browse Archive (Homepage UX
   Cleanup, v1.1)** below). Each view is still gated by its own original setting
   (`ddi_intelligence_index_enabled`/`ddi_timeline_view_enabled`, both default `true`) and, at render
   time, by a route check that hides the whole section on document (`topic.*`) and `admin` routes.
   Moved from `above-main-container` to `below-main-container` as part of the post-RC homepage
   hierarchy pass, before the merge — see **Intelligence Index** below for why. Automatically
   department-scoped on category pages (Division Command Center, Phase 1) via
   `services/ddi-category-context.js` — see below.
2. **Intelligence Dashboard** (`connectors/discovery-list-container-top/ddi-intelligence-dashboard.*` +
   `lib/ddi-archive-statistics.js`) — live archive statistics: Total Documents, a Departments
   breakdown, a Document Types breakdown, a Classification Levels breakdown, and up to 5 Recently
   Updated Documents. Gated by `ddi_homepage_dashboard_enabled` (already defined in `settings.yml`,
   previously unused by anything — this is its first real consumer) and the same route-guard
   `isExcludedRoute()` Intelligence Index uses, shared from `lib/ddi-route-guard.js` rather than
   duplicated a second time. Originally shipped on `above-main-container` (which renders before the
   entire routed template, so before the Search Banner too, not "between" it and the Topic List as
   requested), then relocated to `discovery-list-container-top` — a real Discourse outlet scoped to
   the discovery/topic-list template specifically, which is the outlet family the native Search
   Banner and Topic List both render within. See **Intelligence Dashboard** below for the full
   reasoning and its confidence caveat.
3. **Homepage Hero** and **Mission Briefing** (both `connectors/above-main-container/
   ddi-homepage-hero.*` — one connector, two independently-toggleable sections; see that file's own
   section below for why they share a connector) — a full-bleed cinematic banner (background image,
   dark gradient overlay, DDI logo, archive title, optional subtitle, headline archive statistics,
   Browse Archive/View Divisions actions), immediately followed by a static Mission Briefing (a
   welcome message, DDI's mission statement, all six official Operational Divisions as pillar cards
   linking to their Division pages, and a Mission Objectives list) — above everything else on the
   homepage. Gated by
   `ddi_homepage_hero_enabled`/`ddi_mission_briefing_enabled` respectively, sharing a narrower route
   guard than Browse Archive/Intelligence Dashboard use: hidden not just on `topic.*`/`admin` but
   also on `/categories` and any specific division page, since Division Cards and Division Header
   already fill the "orient the visitor" role there. See **Homepage Hero (v1.2)** and **Mission
   Briefing (v1.2)** below for the full reasoning and confidence caveats.

## Backend-Only Services

`services/ddi-knowledge-graph.js` is a further departure from both lists above: it has no connector
and no outlet at all. It is data-model infrastructure with no current renderer, by design — see
**Knowledge Graph** below for what it does and why it's deliberately unconsumed today.

## Classification System

`lib/ddi-classification.js` maps a topic's tags to a classification tier (`TOP SECRET`,
`RESTRICTED`, `CONFIDENTIAL`, `INTERNAL`, or the default `PUBLIC RELEASE`), each with a display
name, a CSS class, and a message. It's imported and reused correctly everywhere classification is
needed (Security Banner, Dossier Header, Intelligence Network) — there's no duplicated
classification logic elsewhere in the codebase.

**Formerly a known bug, now fixed:** the lookup used to do
`tags.some((tag) => tag.slug === classification.slug)`, which assumed `topic.tags` was an array of
tag objects with a `.slug` property. Discourse's `topic.tags` is actually an array of plain strings,
so the comparison never matched, and every topic silently fell back to `PUBLIC RELEASE` regardless
of its actual tags. Fixed by comparing the tag string directly
(`tags.some((tag) => tag === classification.slug)`) — Security Banner, Dossier Header's
classification color, and Intelligence Network's classification-match scoring all inherit the fix
automatically, since all of them call this one shared function rather than resolving classification
themselves.

## Cross References

`lib/ddi-cross-reference.js` + `api-initializers/ddi-cross-references.js` detect `DDI-NNNNNN`
patterns (the exact format `formatDocumentId()` produces) inside a document's rendered text and
convert them into links to the referenced topic, so an author can write `DDI-000245` in a document
body and have it become clickable without any manual linking.

**Split, and why:**

- `lib/ddi-cross-reference.js` is pure — no DOM, no Discourse API, matching the `lib/` rule. It
  exports `findDocumentReferences(text)` (the detection primitive: regex-matches
  `DDI-NNNNNN` and extracts the numeric ID via `parseDocumentId()`, added to
  `lib/ddi-document-id.js` as the inverse of the existing `formatDocumentId()`) and
  `linkifyDocumentReferences(text)` (the reusable parser: splits a string into an ordered sequence
  of plain-text and reference segments). Because it operates on plain strings, not raw HTML, it has
  no way to accidentally match text inside an HTML attribute — the only content it's ever given is
  a single text node's `textContent`, which can't contain markup.
- `api-initializers/ddi-cross-references.js` is the DOM-mutation layer, using Discourse's
  `decorateCookedElement` API — the correct mechanism for altering already-rendered post HTML,
  and not a plugin-outlet connector, because outlet connectors render fixed UI at a fixed position;
  they have no way to reach into and rewrite arbitrary rendered content. This project already has
  one precedent for `decorateCookedElement`-style DOM mutation
  (`api-initializers/ddi-dossier-refresh.js`), so this follows an existing pattern rather than
  introducing a new one. It walks the first post's text nodes (skipping any already inside an `<a>`,
  `<code>`, or `<pre>` element, to avoid nested links or mangling code samples), and for any node
  containing a reference, replaces it with a mix of text nodes and real `<a>` elements built from
  the parser's segments.

**Scoped to the first post only** (`post.post_number !== 1` skips everything else), consistent with
every other component in this list treating the first post as "the document."

**Citation preview service:** `services/ddi-citation-preview.js` provides `getCitationById(documentId)`
— given the exact ID a cross-reference link's `data-ddi-document-id` attribute already carries, it
returns `{ documentId, title, classification, classificationClass, department, revision, url }` for
that document, fetching and caching by ID (so repeated hovers over the same reference don't
re-fetch). No hover-triggered popup/card UI exists yet — this is deliberately the data layer only,
ready for a future component to inject this service and call it on `mouseenter`. This same service
is also injected by `ddi-related-intelligence.js` (via `getCitation(topic)`, the non-ID entry point)
to shape its related-document rows — the "turn a topic into these 7 fields" logic exists in exactly
one place, not duplicated between the two features that both need it.

**Unverified against a live instance**, consistent with other Discourse API usage flagged elsewhere
in this document: `decorateCookedElement`'s `{ onlyStream: true }` option and `helper.getModel()`
are standard, well-established patterns, but haven't been confirmed against this project's actual
target Discourse core version.

## Document Relationship Service

**Renamed from "Document Relationships" (v1.5).** This section used to describe a dedicated
`connectors/topic-below-post-stream/ddi-document-relationships.*` card; that card was retired in
v1.5 and its data now renders as part of the consolidated Intelligence Relationships panel (see
**Intelligence Relationships (v1.5)** below). Everything below is unchanged and still accurate —
`services/ddi-relationship.js` itself, and the reasoning behind it, weren't touched, only which
connector consumes it.

A document declares relationships to other documents by writing a labeled line in its own body
text — e.g. `Supersedes: DDI-000123` or `References: DDI-000456, DDI-000789` — one of the 6 types in
`lib/ddi-relationship.js`'s `RELATIONSHIP_TYPES`, followed by one or more `DDI-NNNNNN` references.
This is a theme, with no database and no plugin, so a document's own body text is the only place an
author can put custom, per-document data — the same constraint Cross References already works
within, and this feature reuses its detection function (`findDocumentReferences`) rather than
re-parsing `DDI-NNNNNN` patterns a second way.

**Why two different services resolve the referenced documents' data, not one:** `_resolve()` in
`services/ddi-relationship.js` checks whether a declared reference points at the *current* topic
(a defensive, cheap check — `declaration.documentId === topic.id`) and, if so, uses
`ddi-document-metadata.js` directly — synchronous, no fetch, since the current topic is already
fully loaded. Every other reference goes through `ddi-citation-preview.js`'s `getCitationById()`,
which fetches, caches, and already correctly handles the raw-AJAX-response shape (`post_stream`,
`category_id` only) that `ddi-document-metadata.js` does not accept — it expects a full Ember topic
model (`postStream`, a resolved `category` object). Passing a fetched document straight to the
metadata engine would silently produce wrong values (empty word count, "SYSTEM" as author, `"R01"`
as revision) rather than an error, because every field it reads would just be `undefined` — this is
exactly the class of bug already caught once this session (a cache-key type mismatch in this same
citation-preview file); reusing the service that's already correct for this shape avoids repeating
it.

**Fails gracefully per-reference, not per-group.** If a declared reference can't be resolved (deleted
topic, no access, bad ID), `getCitationById` already resolves to `null` — `_resolve()` passes that
through, and the caller filters `null`s out. A group with 3 declared relationships where 1 is broken
simply shows the other 2; it doesn't show an error row, matching how `services/ddi-related-
intelligence.js` already handles individual fetch failures.

**Designed for expansion, concretely:** the 6 relationship types are a single array
(`RELATIONSHIP_TYPES`) the regex is built from — adding a 7th type is a one-line change, nothing else.

**`department` added to both `_resolve()` and `_citationFromMetadata()`'s returned shape (v1.5).**
Neither previously exposed it, even though the underlying citation data always had it —
`ddi-citation-preview.js#_buildCitation()` already computes `department`, and
`ddi-document-metadata.js#_resolve()` already computes `departmentDisplay`; this only forwards an
already-derived field through, added for the Intelligence Relationships panel's per-item department
display. Purely additive — every existing consumer of `getRelationships()` (this connector's old
card, and Knowledge Graph via `getDocumentGraph()`) reads the same fields it already read and is
unaffected by the new one.

**`isValidRelationshipType()` was removed in the v1.0 RC cleanup, not kept as forward-looking API
surface.** An earlier version of this doc defended keeping it exported on the same reasoning as
`ddi-document-type.js`/`ddi-lifecycle.js`/`ddi-department.js`'s own `isValid*` siblings — "a future
consumer gets it for free." The difference, confirmed by checking rather than assumed: those three
siblings each have real, current consumers (`ddi-document-metadata.js`, `ddi-search-results.js`,
`ddi-citation-preview.js`, `ddi-division-cards.js`, `ddi-command-palette.js` between them);
`isValidRelationshipType()` had zero, anywhere, ever — this feature's own parsing never called it
either, since the regex only ever matches known types by construction. Speculative API surface with
no consumer is exactly what a release cleanup pass should remove rather than carry forward on the
strength of a hypothetical future caller.

## Metadata Validation

`isValidClassification(slug)` (`lib/ddi-classification.js`), `isValidDocumentType(slug)`
(`lib/ddi-document-type.js`), `isValidLifecycle(slug)` (`lib/ddi-lifecycle.js`), and
`isValidDepartment(slug)` (`lib/ddi-department.js`) each check a single value against their field's
canonical vocabulary (defined in `docs/ddi-archive-information-architecture.md`), returning a plain
boolean. `isValidClassification` reuses the existing `CLASSIFICATIONS` array rather than a second
copy of the same 4 slugs — it's deliberately consistent with what `getClassification()` actually
recognizes today, not the archive doc's proposed 5th (`public-release`) tag, which isn't wired into
that function yet (see **Classification System** above). `isValidDepartment` checks a Discourse
category **slug** (`topic.category?.slug`), not the display name shown elsewhere (`topic.category?.name`,
used by Document Footer and the Document Intelligence Header) — the two are different properties of the same
category object, and it's worth not confusing them.

**Scope, stated plainly:** these are pure validity checks, not enforcement. A Discourse theme has no
mechanism to block a topic from being saved with an unrecognized tag or category — that would
require a Discourse plugin (server-side) or a composer-level hook, both a materially different and
larger architecture than anything else in this repo, and neither is built here. "Prevent invalid
values" is satisfied in the sense that any future code needing this check — a composer hook, an
admin QA tool, or a display component wanting a safe fallback — now has one correct, reusable place
to get the answer, rather than reimplementing the check (and the vocabulary list) itself.

**The first real consumer: Document Integrity Verification** (below) is the "admin QA tool" /
"display component wanting a safe fallback" this section already anticipated. It reads
`isValidClassification` directly (the one field whose display value can never itself be invalid —
`getClassification()` always returns one of its own known values or the default — so checking the
*raw tags* is what surfaces whether that default was silently used). Document Type, Lifecycle, and
Department are not re-checked a second time there: `ddi-document-metadata.js`'s `_resolve()` already
calls `isValidDocumentType`/`isValidLifecycle`/`isValidDepartment` and stores the result as `null`
when invalid — Document Integrity Verification reads those three already-resolved metadata fields
rather than importing and re-running the same three functions a second time.

**`DOCUMENT_TYPES` expanded from 17 to 23 slugs** (Charter, Policy, Manual, Procedure, Reference,
Training Guide added; Directive, Strategic Plan, and Threat Assessment were already present) to
close the gap the Document Template Standard's own Appendix had flagged. Purely additive — one
array, six new entries, appended after the existing 17 rather than reordered among them. No other
file changed: `isValidDocumentType()`'s signature and behavior are unchanged, and every existing
consumer (`ddi-document-metadata.js`, Document Integrity Verification) already reads the vocabulary
generically rather than hardcoding a count or list, so they picked up the six new types with zero
edits. Required Discourse admin tags for the new six are documented in
`docs/ddi-archive-information-architecture.md` §4 — a theme cannot create them itself, the same
constraint as every other tag in this system.

## Debug Mode

An opt-in diagnostic panel, gated by `ddi_debug_mode_enabled` (`settings.yml`, default `false`) —
the first setting in this repo actually read by code, via the global `settings` object every theme
JS file has access to.

**Feature toggle, not a per-user preference.** Like every other DDI setting, this is a site-wide
theme setting an admin controls — there's no per-visitor "enable debug mode for just me." That's
appropriate for a diagnostic tool meant for staging/admin use, and it's what "do not affect
production users" actually depends on here: the setting defaults to `false`, so on any site that
hasn't deliberately changed it, the panel never renders for anyone.

**Minimal performance impact, enforced by `shouldRender`.** The connector's `shouldRender()` returns
`settings.ddi_debug_mode_enabled` directly — when `false`, `setupComponent` never runs at all,
meaning `buildDebugSnapshot()` (which parses the post's cooked HTML to compute word count) never
executes for the disabled/default case. This is stronger than rendering the component and hiding it
with CSS, which would still pay the computation cost.

**Reusable debug utility:** `lib/ddi-debug.js`'s `buildDebugSnapshot(topic)` gathers all 8 fields by
composing existing helpers — `formatDocumentId`, `getClassification`, `formatRevision`, and the new
`analyzeReadingTime` (`lib/ddi-reading-time.js`) — rather than recomputing any of them. It returns
plain data (including the raw `tags` array, not a pre-joined string), so a future consumer other
than this one connector — a console log, an admin tool — could reuse it without inheriting this
connector's specific display formatting.

**`analyzeReadingTime` was extracted from `ddi-document-intelligence.js`**, which had this exact
word-count/reading-time computation inline. Debug Mode needed the identical computation, and unlike
the smaller one-line formatting patterns elsewhere in this codebase (author display, status text),
this is genuine multi-step derived logic — parsing HTML, splitting text, computing a ceiling — which
crosses the line into "shared business logic" at the second occurrence, not just the third. While
already touching that file, its dead, still-unused inline `Rnn` computation (flagged since the
Revision History work) was also replaced with the existing `formatRevision()` — a one-line, purely
adjacent fix, not new work for this task.

## Intelligence Timeline

*(Per-document lifecycle timeline — not to be confused with the archive-wide, year-grouped
browsing view that shares this same section title further down this file, now folded into
**Browse Archive (Homepage UX Cleanup, v1.1)** near the end of this document.)*

A vertical list, on every document, of up to 6 lifecycle events in fixed chronological/logical
order: Created, Approved, Revised, Reviewed, Deprecated, Archived. Only events the theme can
actually derive today are rendered — there's no fabricated "pending" placeholder for the rest,
matching the fail-gracefully convention already established elsewhere (Revision History's empty
state, Intelligence Network's `"NO RELATED DOCUMENTS FOUND"`).

**Pure derivation, zero new data sources.** `lib/ddi-timeline.js`'s `buildTimeline(metadata)` takes
the already-resolved metadata object `ddi-document-metadata.js` produces for every topic page and
reads three fields it already exposes — `createdDate`, `updatedDate`, `lifecycle` — computing
nothing itself. No new tag, topic custom field, or fetch was introduced:

- **Created** — always shown, from `createdDate`.
- **Revised** — shown only when `updatedDate` differs from `createdDate` (i.e. the document has
  actually been edited since it was filed), using `updatedDate`.
- **Approved / Reviewed / Deprecated / Archived** — at most one of these is shown, driven by the
  document's current Lifecycle tag (`metadata.lifecycle`, already computed by the metadata service
  but not consumed by any other component yet — see **Metadata Validation** above), mapped
  `active → Approved`, `under-review → Reviewed`, `superseded → Deprecated`, `archived → Archived`.
  `draft` has no corresponding event, since it's the pre-approval starting state, not a completed
  milestone. This mapping deliberately does **not** touch the open Lifecycle-default question
  flagged in `docs/ddi-document-metadata-standard.md` §4.7 and `docs/ddi-roadmap.md`'s "Excluded /
  Not Yet Ready" — an untagged document simply shows no lifecycle-derived event, rather than this
  feature silently picking a default on that question's behalf.

**Known simplification, stated plainly rather than hidden:** the theme has no historical log of
*when* a document transitioned between lifecycle states — only its current tag. So the lifecycle
event shown (whichever of the four it is) reuses `updatedDate` as the best available proxy for "as
of," the same "last edit time" `updatedDate` Revised also uses. If a document was both edited and,
say, archived, Revised and Archived render with the same date — an honest reflection of the
granularity of data actually available, not a bug. A real per-transition history would need a new
storage mechanism (topic custom field or body convention, the same open trade-off already flagged
for Last Reviewed / Effective Date in the metadata standard's §4.8–4.9), which this feature
deliberately does not introduce.

**Composed into the metadata service, not the connector.** `ddi-document-metadata.js`'s `_resolve()`
calls `buildTimeline()` after assembling the rest of the metadata object and attaches the result as
`metadata.timeline` — the same "service composes `lib/` helpers" shape already used for
classification, revision, and reading time. This keeps `ddi-document-timeline.js` a plain field-copy
connector (`timelineEvents: metadata.timeline`), identical in shape to Security Banner and Document
Footer, with no business logic of its own.

**Designed for expansion, concretely:** `TIMELINE_EVENT_TYPES` is a single ordered array, the same
pattern as `RELATIONSHIP_TYPES` and `LIFECYCLE_STATES` — adding a 7th event type is a one-line
addition to that array plus (if it's lifecycle-driven) one entry in the adjacent lookup map, nothing
else. A future event source that isn't lifecycle-derived (e.g. Last Reviewed, once §4.8 above is
actually implemented) only needs to add another key to the `eventDates` object `buildTimeline()`
builds internally — the filtering/ordering/rendering pipeline around it doesn't change.

## Classification Watermark

A fixed, full-viewport, low-opacity classification label — `PUBLIC RELEASE`, `INTERNAL`,
`CONFIDENTIAL`, `RESTRICTED`, or `TOP SECRET` — rendered diagonally behind whatever document is
currently open, so a document's sensitivity is visible even at a glance, not just in the Dossier
Header/Security Banner text.

**Zero new classification logic — reuses the same two fields Security Banner already consumes.**
`ddi-classification-watermark.js` looks up `service:ddi-document-metadata` and copies
`metadata.classification` (the label) and `metadata.classificationClass` (`ddi-public` /
`ddi-internal` / `ddi-confidential` / `ddi-restricted` / `ddi-top-secret`) onto the component —
exactly `ddi-security-banner.js`'s shape, field for field. `getClassification()` in
`lib/ddi-classification.js` is still the only place the tag-to-classification mapping is defined;
this feature does not read `topic.tags` itself and does not know what a classification slug is.

**The color comes from CSS reuse too, not a second palette.** `.ddi-watermark-text`'s `color` reads
`var(--ddi-accent)`, the same custom property `.ddi-public`/`.ddi-internal`/`.ddi-confidential`/
`.ddi-restricted`/`.ddi-top-secret` already set (**DDI Classification Levels**, `common.scss`) for
the Dossier Header and Security Banner's accent color. Applying `classificationClass` to the
watermark's own root element means each classification's watermark is auto-tinted with the exact
color that classification already uses everywhere else — no new color decisions, no risk of the
watermark and the banner ever disagreeing about what color "RESTRICTED" is.

**CSS does the actual watermark effect; JS only supplies the two data points above.** Fixed
positioning, full-viewport coverage, the diagonal rotation, the large type size, and the low
opacity are all plain `common.scss` rules on `.ddi-watermark`/`.ddi-watermark-text` — mirroring the
`position: fixed; inset: 0; pointer-events: none;` full-viewport-overlay pattern this stylesheet
already uses for the page-wide grid texture (`body::before`, **Command Network Grid**), rather than
inventing a new positioning technique. `pointer-events: none` and `aria-hidden="true"` keep it
inert — it never blocks clicks or gets announced to screen readers, consistent with it being a
decorative cue, not new information (the classification is already stated in text by Security
Banner and the Dossier Header's classification field).

**Automatically per-document, with no manual guard.** Like Dossier Header, this connector has no
`shouldRender` or page check of its own — Discourse's outlet system only mounts
`topic-above-post-stream` connectors on a topic page, so the watermark appears and disappears with
the topic itself, the same "no extra guard code" precedent Dossier Header already established.

## Archive Navigation

A topic-page card offering four ways to keep moving through the archive without going back to a
list view: **Previous Document** and **Next Document** (the adjacent documents in the same
department, ordered by Document Number), **Department Home** (a link to the document's own
category), and **Recent Documents in Department** (up to 5 other documents with the highest Document
Numbers there, excluding the current one).

**Reworked to order by Document Number and reuse the Intelligence Index service**, replacing an
earlier version that ordered by creation date and fetched the category's topics directly. The
Metadata Engine reuse, category-URL derivation, and template all carried over unchanged (see below);
only the data source and sort key changed.

**Reuses the Metadata Engine for department identity, not a second resolution.**
`services/ddi-archive-navigation.js` injects `ddi-document-metadata.js` and reads
`metadata.departmentDisplay` for the department's display name — the same
`UNCATEGORIZED_LABEL`-aware fallback Document Footer and the Document Intelligence Header already get from the
metadata engine — rather than re-deriving `topic.category?.name` and its fallback a second time.
Only the category's `slug`/`id` (native Discourse fields, not a classification/business concept the
metadata engine owns) are read directly off `topic.category` to build the Department Home URL.

**Reuses the Intelligence Index service instead of its own fetch.** `getNavigation()` calls
`ddi-intelligence-index.js`'s `getIndex({ department: metadata.departmentDisplay })` — the same
department filter `lib/ddi-document-index.js`'s `filterDocuments()` already supported end-to-end
since the Intelligence Index was built, previously unused by any caller. This replaced a direct
`/c/{slug}/{id}.json` fetch. One subtlety worth recording: the filter's `department` value must be
the category's *display name* (what `ddi-citation-preview.js`'s `getCitation()` puts in its
`department` field), not the Metadata Engine's validated department *slug* — the two are different
fields on `metadata` (`departmentDisplay` vs `department`) that happen to describe the same category
under different representations, and passing the slug here would silently match nothing.

**Previous/Next/Recent are all already Citation-Preview-shaped, with no second shaping step.**
Because `getIndex()` already runs every result through `getCitation()`, `lib/ddi-document-order.js`'s
`findAdjacentDocuments()` and `selectRecentDocuments()` operate directly on citation objects — sorted
by `parseDocumentId(doc.documentId)` (reusing `lib/ddi-document-id.js`'s existing parser, not a new
one) rather than `created_at`. This removed the service's own `ddiCitationPreview` injection and the
extra `Promise.all(...).map(getCitation)` pass the earlier version needed after computing adjacency
from raw topics — a genuine simplification, not just a data-source swap.

**Missing Previous/Next now hide rather than showing a disabled placeholder.** The template
previously rendered a greyed-out "No earlier/later document in department" row when one side was
absent; it now omits that link entirely (`{{#if this.previous}}` / `{{#if this.next}}` with no
`{{else}}`), matching the explicit fallback spec this rework was built against. The now-unreferenced
`.ddi-nav-link-disabled` CSS rule was removed.

**No pagination logic of its own — inherits whatever Intelligence Index provides.** `getIndex()`
originally carried the single-page-of-`/latest.json` limitation documented here at the time this was
written; since the Archive Pagination refactor (see **Archive Pagination** below), Intelligence Index
now sees the complete, paginated archive, so Previous/Next/Recent do too, automatically, with zero
change to this file.

**Template reuses existing rows, not a new list pattern.** The Department Home link and each Recent
Documents row reuse `.ddi-toc-item` / `.ddi-toc-title` / `.ddi-dossier-grid` exactly as Intelligence
Network already does. Only the Previous/Next two-up row (`.ddi-nav-links`/`.ddi-nav-link`) is
bespoke markup, since no existing component in this theme is a two-column button pair — everything
else (color tokens, hover treatment, uppercase label convention) is drawn from the existing `:root`
token set, not new literals. Directional glyphs (`←`/`→`/`↑`) were added to the existing labels to
match the new spec; no other markup changed.

## Intelligence Index

An alphabetical (by title) list of every document in the archive — Document Number, Title,
Department, Classification, Revision — rendered below the page content on browsing routes
(homepage, categories, tags), so the archive has one place to scan its full contents rather than
only per-category listings.

**Post-RC homepage hierarchy pass: moved from `above-main-container` to `below-main-container`.**
This shipped on `above-main-container` (see below for why that outlet, not a specific route, was
the guard mechanism), which — being *above* the routed template — put a full archive listing ahead
of Discourse's native search banner and topic list on the homepage: the least time-sensitive of the
three homepage components was rendering first. `below-main-container` is `above-main-container`'s
standard counterpart on the other side of `#main-outlet`, so this was a one-line outlet change (a
folder rename, `connectors/above-main-container/` → `connectors/below-main-container/`) — the
connector's internals (`shouldRender`, the route guard, the service call) are untouched, since none
of them depend on which side of the main content they render on. Net effect: Search Banner, then the
topic list, then the full index — reading flow first, reference material last, still fully visible
and still not collapsed.

**Reuses Citation Preview end to end — no new "topic to display fields" mapping.**
`services/ddi-intelligence-index.js` maps every fetched topic through
`ddi-citation-preview.js`'s existing `getCitation()`, the same call Intelligence Network and Archive
Navigation already make. Its output — `{ documentId, title, classification, classificationClass,
department, revision, url }` — already covers all 5 required columns exactly; this feature adds zero
new fields to that shape.

**One new endpoint, and why it's different from the others already in this codebase.** This service
originally called Discourse's `/latest.json` directly — the standard "every topic, newest first"
listing endpoint, distinct from `ddi-related-intelligence.js`'s `/c/{slug}/{id}.json`
(category-scoped) because this feature is explicitly archive-wide, not scoped to one document's
category. Since the Archive Pagination refactor (see **Archive Pagination** below), that fetch (now
paginated) lives in `ddi-archive.js` instead, and this service just asks it for the topic list.
Archive Navigation calls this same service (see above) rather than its own endpoint. Fetched
newest-first order was never used for anything by this feature either way — the result is always
re-sorted by title, so the endpoint's own ordering is irrelevant.

**Sorting and filtering are pure `lib/` functions, not service-embedded logic.**
`lib/ddi-document-index.js` exports `sortDocumentsAlphabetically()` (title, locale-aware) and
`filterDocuments(documents, { department, classification })`. The service always sorts; filtering is
wired all the way through — `getIndex(filters)` — and is real, tested logic today, not a stub. What
doesn't exist yet is filter *controls* in the template (not part of this task's required Display
list) — a future connector-side filter UI only needs to call `getIndex({ department, classification })`
or filter the already-loaded array with `filterDocuments()` directly; no service or data-shape change
is needed to add it.

**A new outlet family for this theme, guarded conservatively.** Every previous DDI component is
scoped to a topic page via `topic-*` outlets. `above-main-container`/`below-main-container` are
different — Discourse renders both on every route, a fact `docs/ddi-intelligence-archive-
dashboard.md` already flagged as needing a route guard when it designed (but never built) a
*different*, much larger homepage-replacement feature. This component's guard is deliberately
simpler and safer than guessing that plan's specific homepage route name: `setupComponent` looks up
`service:router` (Ember's own router service, not a Discourse-specific API) and hides the panel via
a template-level `{{#if this.isVisible}}` whenever `currentRouteName` starts with `topic.` or
`admin` — both stable, well-known Discourse route-name prefixes — rather than trying to allow-list
one exact homepage route that could differ by site configuration. Net effect: shows on discovery/
category/tag listing pages, never on a document (where it would be redundant with the topic page's
own components) or in admin — true regardless of which of the two outlets it's mounted on, which is
exactly why moving outlets required no change to this guard. The `shouldRender(args,
context)`-with-route-argument approach that dashboard doc describes was deliberately avoided here —
its exact argument shape is unconfirmed against a live instance, whereas `setupComponent` +
`getOwner(component).lookup(...)` is the one connector mechanism already proven throughout this
codebase.

**New opt-out setting, unlike this session's other three features.** Those are per-document and
already scoped to a single outlet with clear precedent; this is the theme's first component on a
"renders on every route" outlet, genuinely new territory here. `ddi_intelligence_index_enabled`
(`settings.yml`, default `true`) lets an admin disable it if the route guard above doesn't suit a
given site's configuration, without needing a code change — read via `shouldRender()`, the same
zero-argument, already-proven pattern `ddi-debug-panel.js` established for setting-gated connectors.

**No new CSS.** The card shell, row markup, and 4-field grid reuse `.ddi-card` / `.ddi-toc-item` /
`.ddi-toc-title` / `.ddi-dossier-grid` verbatim — the same reuse `docs/ddi-intelligence-archive-
dashboard.md` already called for ("No new component vocabulary is needed"). `#main-outlet`'s
existing width/padding/background styling applies to this connector's content the same as it does to
routed page content, so no wrapper styling was needed either.

**Unrelated dead CSS removed in the same pass, not new to this feature.** `.welcome-banner`,
`.welcome-banner h1`/`p`, `.welcome-banner__wrap`, `.welcome-banner__title` (plus its
`::after` tagline), and `.welcome-banner__search-menu` — seven rules across three section banners,
two of them duplicate-titled — were confirmed to target nothing (the only file that ever would have
carried a plain `.welcome-banner` element, `common/homepage.html`, was already deleted in RC
cleanup) and removed. `.custom-search-banner-wrap`, the adjacent and differently-named rule
immediately after them, was deliberately left alone — it's the live styling for Discourse's native
Search Banner, not part of the same dead family, and removing it would have been a real functional
regression, not cleanup.

**Did not touch the Homepage Dashboard's territory — written before that feature existed.** At the
time this was built, `ddi_homepage_dashboard_enabled` and `docs/ddi-intelligence-archive-
dashboard.md`'s default-furniture-suppression technique were both untouched, and this feature only
added a card below existing homepage/category-page content rather than hiding or replacing any of
it. A scoped version of the dashboard was built later — see **Intelligence Dashboard** below — and
the two still don't conflict: Intelligence Dashboard renders on `discovery-list-container-top`
(inside the discovery/topic-list template, above the topic list), this renders on
`below-main-container` (after the entire routed template), so they don't compete for the same
space.

**Homepage UX Cleanup (v1.1): merged into Browse Archive.** This connector and Intelligence
Timeline below (the year-grouped one, not the per-document lifecycle timeline documented earlier
in this file under the same heading name — see that section's own note) were two always-visible
cards rendering the same archive document set back to back, in two different orders. They're now
one component, `connectors/below-main-container/ddi-browse-archive.js`, with a tab switcher
between "All Documents" (this view, alphabetical) and "By Year" (the grouped view). Everything
described above — the outlet placement, the route guard, the Citation Preview reuse, the
alphabetical sort, the filter-ready `getIndex()` plumbing, the dead-CSS removal — is unchanged and
still accurate; only the wrapper component and its outlet file changed. See **Browse Archive
(Homepage UX Cleanup, v1.1)** near the end of this document for the merge itself.

## Intelligence Timeline

A chronological, year-grouped browse view — every document in the archive (or, on a category page,
every document in that department, matching Intelligence Index's own scoping) bucketed by year, most
recent year first, each year collapsible, showing Document Number, Title, Document Type,
Classification, Revision, and Last Updated per document. Renders on `below-main-container` alongside
Intelligence Index — a second, complementary way to browse the same archive, not a replacement for the
alphabetical one.

**Reuses Intelligence Index end to end — zero new fetches.** `connectors/below-main-container/
ddi-timeline-view.js` calls `service:ddi-intelligence-index`'s existing `getIndex()`, the exact same
call Intelligence Index's own connector makes, department-scoped the same way (via
`ddi-category-context`'s `getCurrentDepartment()`) and route-guarded the same way (`isExcludedRoute()`
from `lib/ddi-route-guard.js`). This feature performs no fetch of its own at all — it only groups and
sorts the array `getIndex()` already returns.

**"Existing document dates" means the citation's `updatedAt`/`updatedDate` — there is no separate
"created date" available here, and this feature doesn't invent one.** Citation Preview's shape
(`services/ddi-citation-preview.js`) only carries `updatedAt` (raw, for sorting) and `updatedDate`
(pre-formatted via `lib/ddi-format-date.js#formatDocumentDate()`, for display) — `topic.bumped_at ||
topic.created_at`, the same fallback Citation Preview already uses for every other consumer. Grouping
by year therefore means "the year the document was last updated (or created, if never updated)," which
is the only date this feature's data source exposes — not a design choice made independently of what's
available.

**`lib/ddi-timeline.js`'s `buildTimeline()` was considered and correctly not reused — it solves a
different problem.** That existing function builds a single document's own event history (Created,
Approved, Revised, Reviewed, Deprecated, Archived) from one document's metadata, for the per-topic
Document Timeline connector. This feature groups *many* documents by year for browsing, which needed
new grouping logic either way — reusing `buildTimeline()` here would have meant calling it once per
document just to throw away everything except a date already sitting on the citation object, adding
complexity for something `document.updatedAt` alone already answers.

**New pure grouping logic, `lib/ddi-timeline-view.js`, kept deliberately small.**
`groupDocumentsByYear(documents)` derives each document's year from `updatedAt` via
`new Date(...).getFullYear()`, skips anything with a missing or unparseable date (`Number.isNaN`
check) rather than crashing or mis-bucketing it, and returns years sorted descending with each year's
documents sorted descending by the same date — verified directly (year ordering, within-year ordering,
and all three "no date"/"invalid date"/"missing field entirely" cases falling out of the result set
cleanly rather than raising).

**Expand/collapse is per-year boolean state on plain objects, not a `Set`.** Each grouped year gets an
`isExpanded` flag (`true` for the first/most-recent year on initial load, `false` for the rest);
toggling replaces the `years` array with a new array where only the toggled year's object changed
(`{ ...entry, isExpanded: !entry.isExpanded }`), which is both simpler to render (`{{#if
entry.isExpanded}}` directly in the `{{#each}}`, no helper needed to query a `Set`) and the correct way
to trigger the classic connector API's `set()`-based reactivity, which does not track in-place
mutation of a `Set` sitting inside component state.

**Template reuses `.ddi-card`, `.ddi-toc-item`/`.ddi-toc-title`, `.ddi-dossier-grid`, and
`.ddi-favorites-grid` (its 5-column variant, introduced for the Favorites Panel) verbatim** — this
feature needs the same 5 per-document cells Favorites does (Document Number, Document Type,
Classification, Revision, Last Updated, vs. `.ddi-dossier-grid`'s native 4), so it reuses that existing
modifier rather than introducing a near-identical one under a new name. Only the year toggle row itself
(a plain button: caret, year label, document count) is new markup and new CSS.

**Fails gracefully at every stage.** No date on a document: excluded from every year, never grouped
into a wrong or "Unknown" bucket. No documents at all: `NO DOCUMENTS FOUND`, matching Intelligence
Index's own empty state text and placement exactly. A year with its `isExpanded` toggled off just
hides its own document list — no other year's state is affected.

**Inherits whatever Intelligence Index provides, with no pagination logic of its own.** This section
originally documented a shared single-`/latest.json`-page limitation inherited from Intelligence
Index; since the Archive Pagination refactor (see **Archive Pagination** below), `getIndex()` returns
the complete archive, so every year the archive actually has documents in is grouped and shown —
with zero change to this file.

**Homepage UX Cleanup (v1.1): merged into Browse Archive.** `connectors/below-main-container/
ddi-timeline-view.js`/`.hbs` are retired. Every behavior and piece of reasoning documented above —
the year grouping, the `updatedAt`-as-proxy date choice, the expand/collapse-via-new-array
mechanics, the deliberate non-reuse of `lib/ddi-timeline.js`, the empty/no-date fail-gracefully
handling — carries over unchanged into `ddi-browse-archive.js`'s "By Year" tab; only the wrapper
component and outlet file changed, and `lib/ddi-timeline-view.js#groupDocumentsByYear()` itself was
not touched. See **Browse Archive (Homepage UX Cleanup, v1.1)** near the end of this document.

## Intelligence Dashboard

Live archive statistics rendered on browsing routes: **Total Documents** (a single count),
**Departments**, **Document Types**, and **Classification Levels** (each a count-per-value
breakdown, highest count first), and **Recently Updated Documents** (up to 5, newest activity
first). Requested as "between the Search Banner and the Topic List" — see the placement note below
for why it doesn't land exactly there.

**A scoped implementation of a much larger, pre-existing design.**
`docs/ddi-intelligence-archive-dashboard.md` (v0.4.0, proposed) describes a 7-section homepage
*replacement* — Search Intelligence, Operational Divisions, Recent Intelligence, Recently Updated,
Document Statistics, Classification Breakdown, Recent Revisions — built across 6 phases, retiring
`common/homepage.html`/`common/sidebar.html` (already removed in RC cleanup) entirely. This feature
is not that: it's one additive card covering the 5 items actually requested, most of which map onto
that doc's Document Statistics + Classification Breakdown + Recently Updated sections (Document
Types has no equivalent in that doc; it's new). Search Intelligence, Operational Divisions, Recent
Intelligence, and Recent Revisions were not built — out of scope for what was asked, and each carries
its own dependency chain in the source doc (Recent Revisions in particular explicitly depends on a
per-document Revision History component existing first, which is a topic-page concern this task was
told not to touch).

**Confirmed the design doc's one blocking dependency was already resolved.** The doc flags
`getClassification()`'s tag-shape bug (comparing `tag.slug` against what are actually plain strings)
as something Classification Breakdown depends on. That bug was already fixed in an earlier session
(see **Classification System** above) — verified by reading the current source before relying on it,
not assumed from the doc, which predates the fix and doesn't reflect it.

**Reuses the Intelligence Index service instead of a new fetch — the core "no duplicate data
fetching" decision.** `getIndex()` (no filter) returns every archive document already shaped through
Citation Preview. All 5 dashboard sections are derived from that one array by
`lib/ddi-archive-statistics.js` — no second network request, no new service. This differs from the
design doc's Phase 2 plan (reusing already-loaded `Site.categories` data and each category's
`topic_count` for zero-fetch statistics) in favor of internal consistency: every number on this
dashboard comes from the same underlying document list, so Total Documents, the Departments
breakdown, and Recently Updated Documents can never disagree with each other the way two
independently-sourced counts could.

**Citation Preview extended by two fields, not duplicated elsewhere.** `documentType` /
`documentTypeLabel` and `updatedAt` / `updatedDate` were added to `ddi-citation-preview.js`'s
`getCitation()` output — the first pair reuses `lib/ddi-document-type.js`'s `isValidDocumentType()` /
`getDocumentTypeLabel()` exactly as the Dossier Header does; the second reuses
`lib/ddi-format-date.js`'s `formatDocumentDate()` exactly as the Metadata Engine does, sourced from
`topic.bumped_at` (the topic-list-level activity timestamp, the field this design doc's own Recently
Updated section names) rather than the Metadata Engine's post-level `updated_at` field, which isn't
present on lightweight topic-list items. Both additions are purely additive — every existing
consumer of `getCitation()` (Intelligence Index, Archive Navigation, Intelligence Network's citation
calls, Knowledge Graph) reads the same fields it already read and is unaffected.

**Aggregation is pure `lib/` code, not service- or template-embedded.**
`lib/ddi-archive-statistics.js` exports `countByDepartment()`, `countByDocumentType()`,
`countByClassification()` (all three the same `countBy()` helper parameterized by which field to
group on, sorted by count descending), `selectRecentlyUpdated()` (filters out documents with no
`updatedAt`, sorts descending, bounds to a limit), and `buildArchiveStatistics()`, which composes all
four into the connector's exact display shape. Zero Discourse/Ember dependencies, following the same
`lib/` rule as everything else in this codebase.

**Route guard extracted to `lib/ddi-route-guard.js` rather than duplicated a second time.**
Intelligence Index's `isExcludedRoute()` (hide on `topic.*`/`admin` routes) previously lived inline
in its own connector. Since this feature needed the identical guard, it was extracted to a shared
`lib/` function and both connectors now import it — the same "if two pieces of code need the same
computation, it belongs in `lib/`" rule stated at the top of this document, applied here for the
first time to connector-guard logic rather than data logic.

**Placement: relocated from `above-main-container` to `discovery-list-container-top`, resolving
the earlier "not literally between" gap.** The dashboard originally shipped on `above-main-container`
because it was the only outlet already proven in this codebase — but that outlet renders before the
*entire* routed template, so before the Search Banner too, not between it and the Topic List as
requested. `above-main-container`/`below-main-container` are theme-wide "renders on every route"
outlets; neither is scoped to the discovery page's internal layout at all, which is why neither could
ever have achieved true between-placement no matter how they were combined.

`discovery-list-container-top` is different in kind, not just position: it's an outlet Discourse core
defines *inside* the discovery/topic-list template itself, specifically for content that should
appear above the topic list on a listing page — the same template region the native Search Banner
and `.custom-search-banner-wrap` styling (see **Intelligence Index** above) already render within.
Moving the connector there (a pure `git mv` — the `.js`/`.hbs` contents, `shouldRender()` setting
gate, and `isExcludedRoute()` guard are all byte-for-byte unchanged) is what makes "immediately after
the Search Banner, before the Topic List" achievable at all, rather than a second attempt at the same
theme-wide-outlet compromise.

**Confidence caveat, stated plainly, same as before.** This project has no history of using
`discovery-list-container-top` — Intelligence Index and the dashboard's first attempt both stuck to
`above-main-container`/`below-main-container` specifically because those were already proven here.
`discovery-list-container-top` is used based on general knowledge of Discourse core's outlet catalog,
not verified against a live instance of this theme (none was available this session, the same
limitation already flagged for connector render order elsewhere in this document). The failure mode
if the outlet name is wrong is safe, not silent breakage: Discourse's plugin-outlet system simply
never mounts a connector registered for an outlet name that doesn't exist at that template location —
the dashboard would just not render, exactly as if `ddi_homepage_dashboard_enabled` were `false`,
with no error and no effect on the rest of the page. Recommended verification: load the homepage on a
real instance and confirm the card appears; if it doesn't, `above-main-container` is the documented,
proven fallback (one-line outlet-folder revert, same as this move itself), at the cost of
re-introducing the "above the Search Banner" gap this change was meant to close.

**The existing route guard was kept, not removed, despite the new outlet already being
discovery-scoped.** `isExcludedRoute()` (hide on `topic.*`/`admin`) was written for
`above-main-container`, which renders on literally every route. `discovery-list-container-top`
likely makes that guard redundant in practice — but "likely," not confirmed, and the guard costs
nothing to keep. Removing a real (if possibly now-redundant) safety check on the strength of an
unverified assumption about a newly-adopted, unverified outlet would be trading a small, harmless
redundancy for a real regression risk if that assumption turns out wrong. Left in place deliberately,
not as an oversight.

**Fails gracefully by construction, not via a separate error path.** `getIndex()` already resolves to
`[]` on a fetch failure rather than rejecting (see **Intelligence Index** above), so
`buildArchiveStatistics([], limit)` naturally produces `{ totalDocuments: 0, departments: [],
documentTypes: [], classifications: [], recentlyUpdated: [] }` — no `try`/`catch`, no new error
state, matching the connector's existing `.then()`-only precedent rather than adding defensive code
the codebase doesn't already consider necessary. The template shows "NO ARCHIVE STATISTICS
AVAILABLE" / "NO RECENTLY UPDATED DOCUMENTS" for the empty case, the same empty-state convention
Intelligence Index and Archive Navigation already use.

**Inherits Intelligence Index's data completely, whatever it is.** Because this reuses `getIndex()`
directly, Total Documents and every breakdown are exactly as complete as Intelligence Index's own
result — originally an undercount limited to one `/latest.json` page, and now, since the Archive
Pagination refactor (see **Archive Pagination** below), the true archive total, with zero change to
this file.

**New CSS is additive and reuses existing tokens; no existing rule changed.** `.ddi-card` /
`.ddi-card-title` / `.ddi-card-body` (the shell) and `.ddi-toc-item` / `.ddi-toc-title` /
`.ddi-nav-section-label` (the Recently Updated list) are reused verbatim, matching
`docs/ddi-intelligence-archive-dashboard.md`'s own explicit direction ("No new component vocabulary
is needed"). Four new rules were added for the one thing that didn't already exist anywhere in this
theme — a labeled count breakdown and a big total-count tile (`.ddi-stat-grid`, `.ddi-stat-tile`,
`.ddi-stat-list`, `.ddi-stat-updated-date`) — built entirely from existing `:root` tokens
(`--ddi-bg-panel`, `--ddi-border`, `--ddi-text-muted`, `--ddi-text-primary`), no new color literals.

### Department-Aware on Category Pages (Division Command Center, Phase 1)

Both Intelligence Dashboard and Intelligence Index now detect whether they're rendering on a
category page and, if so, scope themselves to that category's department automatically — the first
implemented slice of the Division Command Center plan (see
`docs/ddi-archive-information-architecture.md` and the category-page planning review). Homepage
behavior is unchanged: both components only apply a filter when a category is actually detected.

**New `services/ddi-category-context.js`, not a new lib function — deliberately.** Detecting the
current category requires an Ember owner lookup (`controller:discovery/category`), which is a
Discourse/Ember dependency the `lib/` rule explicitly excludes. `getCurrentDepartment()` returns the
current category's display name (matching Citation Preview's `department` field, the same
"display name, not slug" gotcha already documented under **Archive Navigation** above) or `null` if
none is found. Both connectors call this exactly once via `owner.lookup("service:ddi-category-context")`,
the same wiring pattern already used for every other service lookup in this codebase — no new lookup
mechanism invented.

**No new filtering logic — this is entirely about supplying the existing filter's argument.**
`ddi-intelligence-index.js`'s `getIndex(filters = {})` and `lib/ddi-document-index.js`'s
`filterDocuments()` are completely unchanged. Both connectors now call
`getIndex(department ? { department } : {})` instead of `getIndex()` — passing `{}` when no
department is detected is behaviorally identical to omitting the argument, since that's the
function's own default. `lib/ddi-archive-statistics.js` is equally untouched: Dashboard still calls
`buildArchiveStatistics()` on whatever `getIndex()` returns, department-filtered or not.

**Dashboard hides its own Departments breakdown when scoped, rather than the aggregator omitting
it.** Showing a one-entry "department: this department" tile once already filtered to one
department is redundant. Rather than adding a conditional to `buildArchiveStatistics()` (which would
make its return shape context-dependent, complicating its one existing homepage caller), the
connector sets `isDepartmentScoped` and the template wraps the Departments tile in
`{{#unless this.isDepartmentScoped}}`. The statistics object itself still contains a (unused, in
this case) `departments` array — a small, deliberate bit of unused-but-harmless computation, chosen
over branching the shared aggregator's output shape.

**Intelligence Index's layout is untouched — only its data changed.** No template edits at all;
`getCategoryDepartment`'s result flows into the same `getIndex()` call the connector already made,
so every existing row/column/empty-state in `ddi-intelligence-index.hbs` behaves exactly as before,
just against a smaller (or identical, on the homepage) document set.

**A discrepancy worth recording, not silently resolved either way.** The task that requested this
said Intelligence Index should "preserve sorting by Document Number." Intelligence Index has never
sorted by Document Number — `lib/ddi-document-index.js`'s `sortDocumentsAlphabetically()` sorts by
title, and always has, since the feature was first built (see **Intelligence Index** above; Document
Number ordering is Archive Navigation's behavior, not this feature's). Changing the sort algorithm
was out of scope for a department-filtering task and would have been a second, unrequested behavior
change, so the existing alphabetical-by-title sort was left exactly as it was — "preserved" in the
sense of "not touched," which may not be what was meant. Flagged rather than guessed either way.

**The one unverified touchpoint, given a safety net.** `controller:discovery/category` is a
standard Discourse controller based on general knowledge, not confirmed against a live instance of
this theme (none available this session — the same limitation already flagged for the
`discovery-list-container-top` outlet choice). Unlike every other service/router lookup in this
codebase, which are already proven here, this one is new and unverified, which is why it's the one
lookup in this change wrapped in a `try`/`catch`: if the controller name is wrong, `getCurrentDepartment()`
returns `null`, and both components fall back to identical archive-wide behavior — the same
fallback already required for any non-category page. There's no failure mode where a wrong guess
here produces a broken page, only an un-scoped one.

## Categories Page Layout (Division Command Center, Phase 2)

Stock Discourse renders the `/categories` page as two side-by-side panels — Category list, Latest
topics — via a wrapper class, `.categories-and-latest`, that this theme had never targeted before
this pass (confirmed present in this exact codebase already, in `mobile/mobile.scss`'s
`.categories-and-latest .category-list .category` selector and `desktop/desktop.scss`'s own
`.categories-and-latest` gap rule — not a guess based on general Discourse knowledge, unlike the
`discovery-list-container-top`/`controller:discovery/category` decisions above).

**CSS-only: no new connector, no new JS.** The requested layout — Division Information + Recent
Intelligence, then Category Navigation, then Latest Intelligence — needs only one new thing built,
and it already exists: **Intelligence Dashboard** (Total Documents / Document Types / Classification
Levels / Recently Updated, per Phase 1) already renders above the categories/latest area via the
`discovery-list-container-top` outlet, the same outlet family used on every other discovery route.
Since `/categories` isn't a single-category route, `ddi-category-context.js`'s
`getCurrentDepartment()` returns `null` there, so Dashboard shows archive-wide statistics — an
appropriate "Division Information" overview for a page that isn't scoped to one division. Nothing
was built or changed for this zone; it was already correct by construction once Phase 1 shipped.

**`.categories-and-latest` forced to stack**, in `common/common.scss`:
`display: flex !important; flex-direction: column !important;` overrides Discourse's native
side-by-side arrangement. `!important` was necessary to reliably beat Discourse core's own rule for
this wrapper — consistent with this file's existing, established use of `!important` elsewhere for
the same reason. Because this rule isn't scoped to a media query, the stacked layout applies at every
viewport width, not just mobile — this *is* the redesign being requested, not an accidental
mobile-only behavior leaking to desktop. Category Navigation renders above Latest Intelligence
because that's their existing DOM order in `.categories-and-latest`; no `order` property was needed.

**Category boxes and "latest" rows extend the existing topic-card rule instead of duplicating
it.** `.category-box` and `.latest-topic-list-item` — both real, pre-existing Discourse classes this
theme had never styled — were added to the selector list of the rule that already gives
`.topic-list-item` its card treatment (gradient background, red accent left-border, hover lift),
rather than copy-pasting that ruleset three times. The section comment above that rule was renamed
from the misleading "DDI Intelligence Index" (it was never specific to that feature — it's general
topic-row styling) to reflect what it now covers. Desktop/mobile breakpoint overrides for
`.category-box`/`.latest-topic-list-item` (min-height, padding, `clip-path`) already existed in
`desktop/desktop.scss`/`mobile/mobile.scss` and were left untouched — they layer on top of this
shared rule at their existing breakpoints exactly as they did before.

**One pre-existing rule split, not removed.** `desktop/desktop.scss` previously set
`gap: 1rem` on `.category-list` (gap between category boxes in its grid — unrelated, kept) and
`.categories-and-latest` (gap *between* the old side-by-side columns) in one shared rule. Since
`.categories-and-latest`'s gap now serves a different purpose (vertical spacing between the two
stacked sections) with its own value already set in `common.scss`, `.categories-and-latest` was
removed from that shared desktop rule rather than left to silently override the new stacking gap at
wider viewports.

**Responsive behavior preserved, not fought.** No new media queries were added. `.category-list`'s
own internal grid (`grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`, unchanged, ≥1024px)
still reflows its box count responsively; the existing mobile-width overrides for topic/category/
latest rows are untouched. "Preserve responsive behavior" here means those continue working
unmodified — not that the categories/latest split itself remains conditionally side-by-side, since
replacing that split everywhere is the actual point of this phase.

## Division Header (Division Command Center, Phase 3)

A new card at the top of every individual category page — `connectors/discovery-list-container-top/
ddi-division-header.*` — showing Division Name, a short Division Description, a fuller Mission
Statement, Total Documents, and Last Updated, all scoped to that one division. Renders alongside
Intelligence Dashboard on the same outlet, discussed below; `ddi-intelligence-dashboard.js`/`.hbs`
were not touched by this change at all (confirmed via `git diff` showing zero delta on either file).

**`ddi-category-context.js`'s private category lookup made public, not duplicated a second time.**
Phase 1 added this service with one method, `getCurrentDepartment()`, backed by a private
`_getCurrentCategory()`. Division Header needs the full category object — name, description — not
just its derived department-name string, so the private method was renamed to a public
`getCurrentCategory()` (a pure rename; `getCurrentDepartment()` now calls it instead of duplicating
the same `controller:discovery/category` lookup). Nothing external ever referenced the private name
(verified by grep before renaming), so this is a safe, backward-compatible refactor.

**Mission Statement and Division Description both derive from `category.description` through the
same HTML-to-text mechanism Executive Summary already established** — `lib/ddi-cooked-parser.js`'s
`parseCookedHtml()`, generic enough to parse any HTML string, not just cooked post content. This was
chosen over guessing at Discourse's plain-text category fields (`description_excerpt`/
`description_text` — real in some Discourse versions, not confirmed against this instance) because
it reuses an already-proven, already-in-this-codebase technique instead of a new unverified field
name. Division Description is the first `<p>`'s text (Executive Summary's own extraction pattern,
reused identically); Mission Statement is the full parsed body's text — genuinely two different views
of the one field, not two different fields, and not a duplicate-content bug. Falls back to
`"No mission statement available."` when the parsed body has no text (matching Executive Summary's
own `"No summary available."` fallback convention); Division Description simply doesn't render
(`{{#if this.divisionDescription}}`) rather than showing a second, redundant fallback message.

**Total Documents and Last Updated reuse `buildArchiveStatistics()` completely — no new statistics
logic.** `getIndex({ department: category.name })` (the same call Phase 1's Dashboard/Index make)
feeds the same aggregator Dashboard already uses; Last Updated is simply
`statistics.recentlyUpdated[0]?.updatedDate`, since that array is already sorted newest-first.
`recentLimit` is passed as `1` — Division Header only needs the single most recent document, unlike
Dashboard's 5. Falls back to `"—"` when a division has no documents (the same "no value" convention
`ddi-citation-preview.js`'s revision fallback already established), which happens automatically
because `getIndex()` never rejects — it resolves to `[]` on fetch failure — so this fails gracefully
by the same construction as Dashboard, with no new error-handling path.

**Total Documents appears twice on a category page — Dashboard's tile and this card's tile — by the
letter of the request, not a mistake.** Phase 1 already made Dashboard show department-scoped Total
Documents on category pages, and this task explicitly listed Total Documents for Division Header too
while explicitly saying to preserve Dashboard unchanged. Both compute the number through the same
`buildArchiveStatistics()` call — the *logic* isn't duplicated, only the on-page display of one
number is, and that's what was asked for. Flagging it rather than unilaterally omitting it from one
card to "fix" a redundancy that wasn't identified as a problem.

**Zero new CSS.** The template uses only classes that already existed before this phase — `.ddi-card`
/ `.ddi-card-title` / `.ddi-card-body` (the shell and both text blocks), `.ddi-nav-section-label`
(the "Mission Statement" heading), and `.ddi-stat-grid` / `.ddi-stat-tile` /
`.ddi-stat-tile-total` (Total Documents / Last Updated, styled identically to Dashboard's own tiles).

**No dedicated enable/disable setting**, unlike Intelligence Index and Dashboard. Nothing in
`settings.yml` fits this specifically, and none was requested; Archive Navigation has no toggle of
its own either, and this follows that same precedent rather than inventing a new setting for
something not asked for. Gated only by `isExcludedRoute()` (hides on `topic.*`/`admin`, same as
every other component on this outlet) and by whether a category is actually detected — no category,
no header, the same fallback shape Dashboard/Index already use.

**Ordering relative to Intelligence Dashboard is a naming hedge, not a confirmed guarantee.** Both
connectors share the `discovery-list-container-top` outlet. `ddi-division-header` was named
specifically to sort alphabetically before `ddi-intelligence-dashboard` (`d` < `i`), in case this
outlet's connector ordering turns out to be filename-based the way `topic-below-post-stream`'s is
confirmed to be (see **Archive Navigation** above) — but that's confirmed for a different outlet,
not this one. If live testing shows Dashboard rendering above the Division Header instead of below
it, this is the one thing in this phase that would need adjusting, and it's a naming/outlet concern
only — no data or logic would need to change.

## Division Cards (Division Command Center, Phase 4)

Replaces the stock `.category-list` grid on the `/categories` index page with DDI-styled Division
Cards — `connectors/discovery-list-container-top/ddi-division-cards.*` — one per division, each
showing Division Name, a Short Description, Total Documents, Last Updated, Primary Classification,
and a View Division button. Only renders on `discovery.categories` exactly (not the homepage, not an
individual category page, not tag pages) — a real, moderately-confident Discourse route name, more
confident than the outlet-name guesses elsewhere in this document since discovery route names have
been stable across Discourse versions for a long time.

**Enumerates divisions from `site.categories`, the same already-loaded data source Citation Preview
already reads — no new fetch for the category list itself.** `lib/ddi-department.js`'s
`isValidDepartment()` filters `site.categories` down to exactly the six recognized divisions, so a
non-division category (e.g. a `Staff` or `Meta` category, if one exists) never gets a card. This is
what "reuse the existing category context" meant in practice here: not `ddi-category-context.js`
directly (that service answers "which single category is being viewed," a different question from
"list every division"), but the same `site.categories` technique this codebase already established.

**Per-division statistics are `getIndex({ department })` + `buildArchiveStatistics()`, called once
per division, in parallel — the exact same calls Phase 1/3 already make, just for more than one
department at a time.** No new statistics logic exists anywhere in this phase. Primary Classification
is `statistics.classifications[0]?.name` — the *existing*, already-sorted-by-count breakdown array's
first entry — not a new "most common" computation. A division with zero documents gets `"—"` for
Last Updated and Primary Classification and `0` for Total Documents, the same graceful-by-construction
fallback as every other statistics consumer in this codebase (`getIndex()` never rejects).

**Short Description reuses the same extraction Division Header uses, now shared.** The
paragraph-extraction logic Division Header (Phase 3) had inline was extracted into a new
`lib/ddi-division-summary.js` (`getShortDescription()`/`getFullDescriptionText()`, both built on the
existing `parseCookedHtml()`), and Division Header was refactored to import from it instead of
duplicating the logic a second time now that Division Cards needs the identical short-description
extraction. Zero behavior change for Division Header — verified by re-reading its output against the
same test cases used when it was first built.

**"Preserve existing navigation behavior," concretely: the View Division button is
`/c/{slug}/{id}`** — the identical URL-building expression `services/ddi-archive-navigation.js`
already uses for its own Department Home link. No new routing, no client-side navigation override;
this is a plain anchor tag Discourse's own router already knows how to handle.

**The stock category grid is hidden unconditionally, not conditionally — a deliberate, documented
trade-off, not an oversight.** `.category-list { display: none; }` in `common/common.scss` applies
regardless of whether Division Cards actually has data to show. In the realistic failure mode
(`getIndex()` degrading to `[]` per division), cards still render, just with zero-valued stats — this
doesn't trigger the hidden-grid problem. The only way the page would show neither the stock grid nor
Division Cards is if `site.categories` contains none of the six recognized department slugs at all —
a genuine site-configuration issue, not a transient failure, and not worth the added complexity of a
body-class toggle or DOM-mutation approach to fully cover. Flagged here rather than silently accepted.

**Dead code removed as a direct consequence of hiding `.category-list`, not left behind.** Once the
stock grid is hidden, everything that only ever rendered inside it has no visible effect either:
`.category-box` (added to the shared topic/category card-treatment rule in Phase 2, now removed from
it — that rule's section comment was updated to explain why), `.category-list-item`'s border-color
(removed from the shared rule it was part of, `.topic-list-item` kept), and in
`desktop/desktop.scss`/`mobile/mobile.scss`, every `.category-list`/`.category-box`/`.categories-list`
selector in the responsive breakpoint rules (min-height, padding, `clip-path`, grid layout) — all
removed, `.topic-list-item`/`.latest-topic-list-item`'s entries in those same shared rules kept, since
those remain genuinely live. `.category-list` itself was also dropped from the earlier "Discourse
Surface Panels" background/border rule for the same reason.

### Routing Refinement: Directory vs. Individual Division Pages

A real bug, not a hypothetical one: `getCurrentCategory()` trusted
`controller:discovery/category`'s `.category` unconditionally. That controller is an Ember singleton
— it doesn't reset when the route changes — so after visiting an individual division page and then
navigating (client-side, no full reload) to `/categories`, the controller could still hold the
*previous* division, wrongly making Division Header render there and wrongly making Dashboard show
department-scoped instead of archive-wide statistics on the directory page.

**Fixed once, in the shared service, not once per connector.** `ddi-category-context.js` gained
`isCategoriesIndexRoute()` (an exact match against `router.currentRouteName === "discovery.categories"`,
the same route name Division Cards already used), and `getCurrentCategory()` now checks it first: on
`/categories`, it returns `null` regardless of whatever the controller happens to hold. Because
Division Header and Intelligence Dashboard both already went through `getCurrentCategory()`/
`getCurrentDepartment()` rather than reading the controller directly, **neither connector needed a
single line changed** — both inherited the fix automatically. Verified via `git diff` showing zero
delta on both files.

**Division Cards refactored to consume the same signal instead of its own copy.** It previously kept
its own `CATEGORIES_ROUTE_NAME` constant and did its own exact-match check against
`router.currentRouteName` — a second place asserting "this route name means the directory," which is
exactly the kind of routing-logic duplication this task called out. It now calls
`ddi-category-context.js`'s `isCategoriesIndexRoute()` instead, so the `"discovery.categories"`
string literal exists in exactly one place in the codebase. This also removed Division Cards' own
`service:router` lookup entirely, since checking the route was its only use for it.

**Net effect, verified by simulation (real DOM/router objects aren't available outside a live
instance, so the service's logic was exercised directly against fake owner/router objects
reproducing the exact stale-controller scenario):** a fresh visit to an individual division page
still resolves that division correctly; `/categories` with a *stale* controller still holding the
last-viewed division correctly resolves to `null` despite that stale state; the homepage is
unaffected. Division Cards' own route gate was independently confirmed to show only on
`/categories` and hide everywhere else, unchanged in behavior from Phase 4, just re-expressed through
the shared service.

## Document Integrity Verification

Five PASS/WARN checks — Classification, Department, Document Type, Lifecycle, Metadata — against
the current document, shown only when `ddi_debug_mode_enabled` is on. Not enforcement (a theme still
can't block a save, per **Metadata Validation** above) — a QA read of whether a document's tags are
complete enough for the rest of the theme's classification/department/type/lifecycle-dependent
features to work as intended.

**Reads the Metadata Engine's output; does not re-derive it.** `lib/ddi-integrity.js`'s
`verifyDocumentIntegrity(metadata)` takes the exact object `ddi-document-metadata.js` already
produces. Department, Document Type, and Lifecycle checks are `Boolean(metadata.department)` /
`Boolean(metadata.documentType)` / `Boolean(metadata.lifecycle)` — each already `null` when its tag
was invalid or absent (the metadata service already ran `isValidDepartment`/`isValidDocumentType`/
`isValidLifecycle` to produce that), so no library beyond `ddi-classification.js` is imported here.
Classification is the one exception, and deliberately so: `metadata.classification` is always a
valid display value by construction (`getClassification()` never returns anything else), so the only
way to detect "this document has no explicit classification tag and is silently defaulting" is to
check the raw `metadata.tags` array against `isValidClassification` directly — reusing the exported
predicate, not the private `CLASSIFICATIONS` data it's built from.

**Metadata (the fifth check) covers what the other four don't** — general resolution failures the
per-field checks wouldn't catch: an empty title, an author that fell back to `formatDocumentAuthor()`'s
`"SYSTEM"` sentinel, or a created date that fell back to `formatDocumentDate()`'s `"UNKNOWN"`
sentinel. Reusing those two existing fallback sentinels as the signal means this check needs no new
date or author logic of its own — it only recognizes values the Metadata Engine already produces.

**PASS/WARN only, no FAIL state.** Matches the "pure validity checks, not enforcement" framing
already established in **Metadata Validation** — a WARN is "this field wasn't declared, so a
default or fallback was used," not an error condition the theme has any way to prevent or correct.

**New connector, same gate as Debug Mode, no new setting.** `ddi-verification-panel.js`'s
`shouldRender()` reads `settings.ddi_debug_mode_enabled` — the identical zero-argument pattern
`ddi-debug-panel.js` already established — rather than introducing a second debug-visibility toggle
for what is, from an admin's perspective, the same "diagnostic, staging-only" concern. It is a
separate connector file, not an edit to `ddi-debug-panel.js` itself, so the existing Debug Mode panel
is untouched.

**Template reuses `.ddi-card.ddi-restricted` and `.ddi-intel-grid` verbatim** — the same shell and
grid Debug Mode already uses for its own field list — plus two one-line color-modifier classes,
`.ddi-integrity-pass`/`.ddi-integrity-warn`, built from the existing `--ddi-green`/`--ddi-red` tokens
(`--ddi-green` was already declared in `:root` but unused anywhere until now). WARN detail text
renders in a plain `.ddi-card-body` list below the grid, shown only when at least one check warns,
so a fully clean document's panel is just five short PASS rows.

## Knowledge Graph

**Purpose.** Every prior feature treats "documents related to this one" as its own separate,
single-purpose fetch: Intelligence Network for taxonomy relevance, Archive Navigation for
department sequence, Document Relationships for declared references, Cross References for inline
mentions. `services/ddi-knowledge-graph.js` doesn't replace any of them — it's a fifth service that
calls the other four and assembles their results into one typed graph (nodes = documents, edges =
the relationship between two documents), the reusable shape a visualization would actually need
instead of four separately-shaped API surfaces. **No visualization was built in this pass** — this
section describes the data model and the service that produces it, nothing else; at the time this
was written, no connector, template, CSS, or settings.yml entry consumed it. A visualization was
built later — see **Knowledge Graph Viewer** below — as a plain consumer of `getDocumentGraph()`,
exactly as anticipated in the Future Roadmap's item 2 at the time.

### Data Model

```
Node:  { id, documentId, title, classification, classificationClass, department, revision, url }
Edge:  { source, target, type, label, rank }
```

`id`/`source`/`target` are Discourse topic IDs (numbers) — one ID space shared by every node
regardless of which signal discovered it. `type` is one of three values, `label` is a short
human-readable string for that edge (a relationship type, or a fixed label for the other two kinds),
and `rank` is `null` except on `"related"` edges (see below).

### How Each Required Input Maps to the Model

| Requirement | Source | New logic? |
|---|---|---|
| Metadata | `ddi-document-metadata.js` | None — only field selection, to build the center node |
| Relationships | `ddi-relationship.js` (`getRelationships`) | None — declarations become `"relationship"` edges, labeled with their declared type (Supersedes, References, etc.) |
| Cross References | `lib/ddi-cross-reference.js` (`findDocumentReferences`) + `ddi-citation-preview.js` | None — mentions become `"cross-reference"` edges |
| Categories + Tags | `ddi-related-intelligence.js` (`findRelated`) | None — see below for why these two are one edge type, not two |
| — | `lib/ddi-cooked-parser.js` (`parseCookedHtml`) | None — reused to get the first post's plain text for cross-reference scanning, the same function Document Relationships already uses for the same purpose |

**Categories and Tags are deliberately one edge type, `"related"`, not two.** Splitting them would
mean re-implementing `ddi-related-intelligence.js`'s own category/classification/tag scoring a
second time in this service — exactly the duplication this task rules out. Instead, `findRelated()`'s
existing output is reused as-is; the position of each result in that already-sorted array (best
match first) becomes the edge's `rank` (`1` = strongest), so relative strength survives into the
graph without this service re-deriving or even seeing the underlying score.

**Every value in the table above was already a public method on an already-injected service or an
already-exported `lib/` function before this file existed.** `ddi-knowledge-graph.js` imports zero
new Discourse APIs (`ajax`, `DOMParser`, etc.) directly — every fetch and every parse happens inside
a service this one composes, not inline here.

### Assembly

`getDocumentGraph(topic)` is the entire public surface. It builds the center node from the Metadata
Engine, then runs the three edge-building steps — `_buildRelationshipEdges`,
`_buildCrossReferenceEdges`, `_buildRelatedEdges` — concurrently via `Promise.all`, each wrapped in
its own `.catch()` so one signal failing (a broken fetch, an unresolvable citation) returns an empty
`{ nodes: [], edges: [] }` for that signal rather than failing the whole graph — the same
per-source failure isolation `ddi-related-intelligence.js`'s own `_fetchCandidates` already uses.
Declared self-references (a document listing itself) and self-matches are filtered out of every
edge-building step, so the center node never has an edge to itself.

**Node de-duplication fills gaps rather than picking one source and discarding the rest.**
`lib/ddi-graph.js`'s `mergeNodes()` is new, small, and pure: the same target document can be
discovered by more than one signal (declared as a Relationship *and* independently surfaced by
`findRelated()`, say) with slightly different field completeness. (Relationship-sourced nodes used to
never carry `department`, since `getRelationships()`'s resolved shape didn't include it — v1.5 added
that field, see **Document Relationship Service** above, so this specific gap no longer occurs
between these two signals; `mergeNodes()`'s backfill still exists for signals where a genuine
completeness gap remains.) Rather than whichever source ran first silently winning, `mergeNodes()`
keeps the first-seen node and backfills any `null`/`undefined` field from later occurrences of the
same ID — multiple *edges* to that ID still exist, one per signal that found it (this is a multigraph,
not a simplified one), only the *node* is deduplicated.

### Architecture Review

- **Composition over invention, verified.** Every one of the four injected services
  (`ddiDocumentMetadata`, `ddiRelationship`, `ddiRelatedIntelligence`, `ddiCitationPreview`) is
  called through its existing public method, unmodified. The only new code is: field-selection into
  the two canonical shapes above (`lib/ddi-graph.js`), and the `Promise.all` orchestration plus
  self-reference filtering in the service itself. No scoring, matching, fetching, or parsing logic
  was reimplemented anywhere in this feature.
- **Inherited caveats, not new ones.** This service is only as reliable as what it composes:
  `ddi-related-intelligence.js`'s classification-match scoring still depends on the classification
  tag-matching fix already in place; `ddi-relationship.js` and the cross-reference scan both depend
  on `parseCookedHtml`, which — like every other `DOMParser`-based read in this codebase — is
  unverified against a live Discourse instance. Nothing here makes those caveats worse, and nothing
  here silently works around them either.
- **No caching.** Unlike `ddi-document-metadata.js` (`_cache` keyed by topic ID) and
  `ddi-citation-preview.js` (`_cache` keyed by document ID), `ddi-knowledge-graph.js` recomputes the
  whole graph on every call, including re-invoking its own dependencies. In practice this cost is
  bounded by those dependencies' own limits (Intelligence Network's `MAX_RESULTS = 5`, one category
  page fetch, one cross-reference scan of the first post) — not unbounded — but a future caller
  invoking `getDocumentGraph()` more than once per page life would redo all of that work. Deliberately
  not solved here: this service has no consumer yet, so there's no real call pattern to design a
  cache key or invalidation rule against. Premature caching is exactly the kind of complexity this
  project's stated defaults argue against (see **CODING_STANDARDS.md**).
- **Edge weighting is ordinal, not numeric, for `"related"` edges, and absent for the other two.**
  `rank` preserves *order* from Intelligence Network's already-sorted results, not its underlying
  score — because that score isn't part of that service's public return value, and adding a second
  method (or a second return shape) to expose it would be new surface area on a shipped service for
  a consumer (this one) that has no visualization yet to prove the exact number is needed. Relationship
  and Cross Reference edges carry no weight at all; every declared relationship and every mention is
  currently treated as equally significant.
- **Single-document scope, not archive-wide.** `getDocumentGraph(topic)` returns *one document's*
  local neighborhood (the center node plus everything one hop away) — it does not, and today
  cannot, return a graph of the whole archive. See **Future Roadmap** below for why that's a
  deliberate boundary for this pass rather than a missed requirement.

### Future Roadmap

1. **Archive-wide graph assembly.** The natural next capability: union many `getDocumentGraph()`
   calls (or a lower-level batch variant) into one archive-spanning graph. Not attempted here because
   it requires a real traversal/crawl strategy (breadth-first from a seed set? every document, via
   `ddi-archive.js`'s now-paginated, session-cached topic list — see **Archive Pagination** below,
   which removes what used to be this item's biggest open question) and a termination bound —
   exactly the kind of "genuinely new territory" this codebase's own convention is to design
   deliberately (see the Homepage Dashboard's phased
   design in `docs/ddi-intelligence-archive-dashboard.md`) rather than build speculatively inside an
   unrelated task.
2. **A visualization connector.** ~~Explicitly out of scope for this task.~~ Built later — see
   **Knowledge Graph Viewer** below. As anticipated here, it's a plain `connectors/*/ddi-*.js`
   consumer of `getDocumentGraph()`; the one piece of new shaping logic it needed (categorizing edges
   into 4 display buckets, and laying them out spatially) went into its own new `lib/` file rather
   than into the connector or into this service, keeping this rule intact.
3. **Expose Intelligence Network's underlying score.** Would let `"related"` edges carry a real
   weight instead of an ordinal `rank` — a small, additive change to `ddi-related-intelligence.js`
   (e.g., a second return shape or a `findRelatedWithScores()` sibling method), not a rewrite.
4. **A cache, once there's a real call pattern to design it against.** Deliberately deferred (see
   Architecture Review) until a real consumer's call frequency is known.
5. **Multi-hop traversal.** Today's graph is exactly one hop from the center document. A
   visualization wanting "documents related to documents related to this one" would need a bounded
   depth parameter and cycle detection (the underlying data can and will contain cycles — two
   documents can mutually declare `References` on each other) — worth designing deliberately rather
   than defaulting to an arbitrary depth.

## Knowledge Graph Viewer

An interactive, per-document relationship graph on the topic page — the current document at the
center, Parent Documents, Child Documents, Cross References, and Related Documents arranged around it
in four fixed sectors, with click-to-open, hover-to-preview, pan, zoom, and Reset View. Renders on
`topic-below-post-stream`, alongside Document Relationships and Intelligence Network — a visual,
spatial complement to those existing list-based views, not a replacement for either.

**Reuses `getDocumentGraph()` as its only data source — zero fetches of its own.**
`connectors/topic-below-post-stream/ddi-knowledge-graph.js` calls
`service:ddi-knowledge-graph`'s `getDocumentGraph(topic)` exactly once, on the topic already loaded
by the page (`args.model`), and does nothing else network-related. Every fetch this feature's data
depends on — relationship resolution, cross-reference resolution, related-document scoring — happens
inside that already-existing service, composing already-existing services, none of it touched or
duplicated here (see **Knowledge Graph** above).

**The graph's 6 relationship types don't map 1:1 onto the 4 requested display buckets — the mapping
is a stated judgment call, not a discovered fact.** New `lib/ddi-knowledge-graph-view.js`'s
`buildGraphView(graph, centerId)` categorizes every edge sourced from the center:
- `"cross-reference"`-type edges, plus declared-relationship edges labeled **"References"** →
  Cross References.
- `"related"`-type edges, plus declared-relationship edges labeled **"Related Intelligence"** →
  Related Documents.
- Declared-relationship edges labeled **"Superseded By"** or **"Required Reading"** → Parent
  Documents (a newer authoritative version, or a prerequisite — both sit "above" this document in its
  own lineage).
- Declared-relationship edges labeled **"Supersedes"** or **"Supporting Documentation"** → Child
  Documents (an older version this one replaces, or subordinate supporting material).

This reads two of the six declared relationship types (References, Related Intelligence) as
duplicating what Cross References/Related Documents already mean by other means, and splits the
remaining four into Parent vs. Child by "which side of this document's lineage it sits on" — a
defensible reading, not the only possible one, and not something `ddi-relationship.js` itself asserts.

**Layout is a fixed 4-sector radial diagram, computed in pure functions, not a force-directed
layout.** `layoutGraphView(view)` places the center at a fixed point and spreads each category's
nodes evenly across its own 80°-wide sector (Cross References right, Child Documents below, Related
Documents left, Parent Documents above — "above/below" reading as lineage, "left/right" as lateral
connections), all in a normalized 0–100 coordinate space matching a `viewBox="0 0 100 100"` SVG. No
force simulation, no collision resolution, no external graphing library — a real force-directed layout
would need iterative physics and a runtime dependency this theme has no build step to vendor;
sector-based placement is deterministic, trivially testable, and never produces an unstable or
overlapping-at-first-render layout, at the cost of nodes in a crowded sector sitting closer together
rather than spreading further out.

**Node color reuses the classification-driven `--ddi-accent` pattern, not a new relationship-type
palette.** Every other list of documents in this theme (Document Relationships, Intelligence Network,
Intelligence Index, Timeline) colors each row by the *target document's own classification*
(`classificationClass`, setting `--ddi-accent` via the existing `.ddi-restricted`/`.ddi-confidential`/
etc. classes), not by why that document showed up in the list. This viewer follows that same
precedent rather than inventing 4 new category colors that would clash with this theme's
deliberately narrow red/neutral palette — category is instead conveyed by sector position, the
quadrant label, edge line style (solid for Parent/Child, dashed for Cross References, dotted for
Related), and each node's own caption (its declared relationship label, or "Cross Reference"/
"Related").

**Click and hover are free — both features already exist and only needed a real `<a href>`.** Every
non-center node renders as `<a href="{{node.url}}">`, so clicking it uses Discourse's own existing
link-interception/routing, no new navigation code. Hovering it is picked up by
`api-initializers/ddi-document-preview.js`'s existing global `mouseover`/`mouseout` listener, which
matches any `a[href*='/t/']` in the entire document regardless of where it renders — this feature adds
no preview code of its own at all. The center node is deliberately *not* a link (it's the document
already being viewed; a link to itself would be a confusing no-op).

**Pan/zoom is plain DOM state, deliberately outside Ember's reactivity — and deliberately not
relying on `this` inside the modifier callback either.** `setupGraphCanvas(element)`/
`teardownGraphCanvas(element)` are free functions, not component methods: `{{did-insert}}`/
`{{will-destroy}}` (from `@ember/render-modifiers` — a standard Ember addon, but genuinely new to
this codebase, so unverified against a live instance; failure mode is the canvas simply not panning/
zooming, not a broken page) guarantee the element as their first argument, but not that `this` inside
the callback is the component — so neither function uses `this` at all. `setupComponent` stores them
as plain properties (`component.setProperties({ setupGraph: setupGraphCanvas, ... })`), which the
template reads via `this.setupGraph` as an ordinary property lookup, not an action. The
`resetView`/teardown handles that closure creates are stashed directly on the DOM element itself
(`element._ddiResetGraphView`), so `resetView` — bound via `{{on "click"}}` since the
`discourse.template-action` cleanup (see **Deprecated Template Actions**), a plain closure over
`component` rather than a `{{action}}`-bound method — can find them again later via
`component.element` without any shared component state at all.
Listeners attach `wheel`/`pointerdown`/`pointermove`/`pointerup` and update a CSS `transform` on
`.ddi-graph-canvas-inner` directly — routing every drag/scroll event through `set()`-based component
state would mean a re-render per pixel of mouse movement, which this theme's existing patterns (e.g.
Command Palette's own direct DOM manipulation) already treat as the wrong tool for high-frequency
interaction. Reset View just resets the closure's own `scale`/`translateX`/`translateY` to their
defaults and reapplies the transform — no
component state involved on either path.

**Fails gracefully at both ends.** No topic loaded (`args.model` missing): stops immediately, renders
nothing broken. `getDocumentGraph()` rejecting entirely: caught, same as "no relationships" below. No
relationships of any kind (all 4 buckets empty): `NO DOCUMENT RELATIONSHIPS FOUND`, no canvas
rendered at all — a document with no discoverable relationships never shows an empty, confusing
circle with nothing around it.

**Verified directly, not just described.** Categorization (all 6 relationship-type labels routing to
their intended bucket, edges not sourced from the center ignored, an edge pointing at a node absent
from the graph skipped rather than crashing, a missing center resolving to `null`) and layout
(deterministic, finite, distinct positions per node; single-node sectors centering exactly on their
sector's angle; empty views producing zero edges/labels without losing the fixed center point) were
both exercised with mock graphs standing in for `getDocumentGraph()`'s output.

## Search Results (Intelligence Search, Phase 1)

Annotates Discourse's own native search results — `api-initializers/ddi-search-results.js` — with a
badge row per result: Document Number, Classification (color-coded), Department, Document Type.
Native title, blurb/excerpt, highlighted matched terms, ranking, permissions, and pagination are
completely untouched; this only reads what Discourse already rendered and prepends new content.
Complements, and doesn't duplicate, `docs/ddi-intelligence-search.md`'s design for the *search form*
(the query-building layer feeding this page) — that document explicitly left results-page styling
for later; this is that later work, scoped to Phase 1 only (no structured search form here).

**Not a plugin-outlet connector — deliberately.** Every other DDI feature in this document is a
connector into a named outlet. Search results are rendered entirely by Discourse's own search
component with no DDI-controlled outlet inside it, so the only way to add content is to decorate the
already-rendered DOM after the fact — the same category of technique
`api-initializers/ddi-cross-references.js` (post content) and `ddi-dossier-refresh.js` (topic header)
already use in this codebase, applied here to a third kind of surface (search results) instead of
post content or the topic header.

**`api.onPageChange` plus a `MutationObserver`, not `onPageChange` alone.** `onPageChange` fires on
route transitions and correctly handles navigating *to* `/search` fresh. It's a real, open question
— not confirmed against a live instance — whether typing a new query or paginating within the same
search page re-fires it, since Discourse's search page is heavily AJAX-driven and may update results
in place without a full route transition. A `MutationObserver` on `.search-results` (re-created on
every `onPageChange`, so a page navigation always gets a fresh one scoped to the current container)
covers that gap generically, without needing to know or guess whichever specific Discourse hook fires
for "search results changed." `decorateResult()` is idempotent (`dataset.ddiSearchDecorated` guard,
the same pattern `ddi-cross-references.js` already established) specifically because the observer
watches for the very DOM insertions this code itself performs — without the guard, decorating a
result would re-trigger the observer, which would re-decorate it, forever appending duplicate badge
rows. With it, that re-trigger is a harmless no-op.

**No new services, no new fetches — every field is read out of DOM Discourse already rendered, not
re-fetched.** Document Number is `formatDocumentId()` (unchanged) applied to a topic ID parsed out of
each result's own title link (`a.search-link`, `href` matching `/t/(?:slug/)?(\d+)`) — the same ID
Discourse's own link already encodes, not a new lookup. Classification and Document Type are derived
by treating each result's already-rendered tag pill text (`.discourse-tag`) as the tag list: a small
`{ tags }` object is constructed from that text and handed to the *existing*
`getClassification(topic)` unmodified (it only ever reads `topic?.tags`, so a bare `{ tags }` object
satisfies it exactly the way a full topic model would), and `isValidDocumentType()`/
`getDocumentTypeLabel()` are called directly on the tag strings, exactly as `ddi-citation-preview.js`
already does. Department reads a result's rendered category badge (`.badge-category`)'s `href` to
recover the category slug, validated through the existing `isValidDepartment()` before trusting its
displayed name — a category badge for a non-division category (if one exists) is deliberately
excluded rather than shown, since it isn't part of the archive's department vocabulary.

**Classification color reuses `--ddi-accent` exactly as the rest of the theme does — no new color
logic.** The classification badge gets `classificationClass` (e.g. `ddi-restricted`) as an extra
class, which is the *existing* mechanism (see **Classification System**) that sets `--ddi-accent`
locally; the new `.ddi-search-badge` rule reads `var(--ddi-accent, var(--ddi-border))` /
`var(--ddi-accent, var(--ddi-text-muted))`, so only the classification badge picks up a
classification-specific color and every other badge (Document Number, Department, Document Type,
none of which carry `classificationClass`) falls back to the neutral border/muted-text default.

**New CSS, not a reuse of `.ddi-lifecycle-badge`, despite the visual similarity — a deliberate choice
to avoid a side effect.** `.ddi-lifecycle-badge` already exists and looks like what this needed, but
it's nested inside `.ddi-dossier-header {{classificationClass}}` on the topic page — meaning that
context *already* has `--ddi-accent` set on an ancestor. Making `.ddi-lifecycle-badge` itself read
`var(--ddi-accent, ...)` to reuse it here would have silently recolored the existing Lifecycle badge
on every document page too, a behavior change to a working component that nothing in this task asked
for. `.ddi-search-badge` is a new, independently-scoped rule instead — same visual proportions
(padding, border-radius, letter-spacing), copied rather than shared, precisely to avoid coupling two
features that happen to look alike but don't share a rendering context.

**Result container gets a light, static card border — not the accent color.** `.ddi-search-result`
uses `--ddi-border`/`--ddi-red-65` (static tokens), not `--ddi-accent`, because the result element is
also the ancestor of every badge in its row — if the whole card picked up `--ddi-accent`, badges
without their own `classificationClass` would inherit the classification color too, undermining the
"only the classification badge is color-coded" design. Deeper restyling of the native title/blurb
typography was deliberately deferred — this phase adds only a border, background tint, and the
badge row, leaving the internal native markup untouched, since its exact structure isn't confirmed
against a live instance.

**Confidence caveat, same class as every other DOM-structure assumption in this document.**
`.fps-result`, `a.search-link`, `.badge-category`, `.discourse-tag`, and `.search-results` are
reasonably well-established Discourse class names based on general knowledge, not confirmed against
a live instance of this theme (none available this session). The failure mode if any is wrong is
safe: `querySelector`/`querySelectorAll` simply return nothing, the corresponding badge is skipped,
and native search behavior is completely unaffected either way — decoration is purely additive, so a
wrong selector produces a plainer result row, never a broken one.

## Document Quick Preview

A floating hover card — `api-initializers/ddi-document-preview.js` — showing Document Number, Title,
Classification, Department, Document Type, Revision, and Executive Summary (first paragraph) for any
document link on the page, after a short hover delay. Global by design: rather than instrument each
of the six surfaces named for this feature individually (Intelligence Index, Search Results, Related
Documents, Archive Navigation, Homepage Dashboard, Division Cards), it listens for `mouseover`/
`mouseout` on `document` and matches any `a[href*='/t/']` — since every one of those surfaces already
builds its document links through `ddi-citation-preview.js`'s own `/t/{slug}/{id}` convention, one
generic listener covers all of them with zero changes to any of the six connectors.

**Verified against each named surface, not assumed — and one genuine gap found.** Grepped every
listed connector's template for `href`: Intelligence Index, Related Documents, Archive Navigation's
Previous/Next/Recent rows, and Homepage Dashboard's Recently Updated all link through `doc.url`/
`this.previous.url`/etc., all Citation-Preview-shaped `/t/...` links — the hover card works on all of
them with no code changes there. **Division Cards does not have a document link at all** — its only
link (`card.url`) is `/c/{slug}/{id}`, the division/category page, not a document. There is nothing
for this feature to attach to on Division Cards, because Division Cards was never a list of document
links to begin with (see **Division Cards** above — it links to divisions, not individual documents).
Flagging this rather than inventing a document link there that wasn't asked for elsewhere, or
silently claiming coverage that doesn't exist. Archive Navigation's Department Home link
(`/c/...`) is correctly excluded for the same reason — a division link, not a document link.

**Reuses Citation Preview entirely for data — the actual "no new fetch, cache after first load"
mechanism.** The card calls `ddi-citation-preview.js`'s existing `getCitationById(topicId)` unchanged
— the same already-cached-by-document-id method every other document-linking feature in this theme
already uses. No new service, no new fetch path: Citation Preview's own `_cache` Map is what
satisfies "cache preview data after first load," not anything new written for this feature. Because
`getCitationById()` always does the full `/t/{id}.json` fetch (unlike `getCitation(topic)` called
directly on a list-derived topic, which usually lacks post content), the response reliably includes
`post_stream.posts[0].cooked` regardless of which of the six surfaces the hovered link came from —
the preview's Executive Summary doesn't depend on what data the *originating* list happened to have.

**Citation Preview gained one new field, `executiveSummary`, reusing an existing extraction
function under a name that doesn't quite fit — flagged, not silently left as a small
inconsistency.** `getShortDescription()` (`lib/ddi-division-summary.js`, first added for Division
Header's category-description parsing) is reused as-is to pull the first paragraph out of
`topic.post_stream?.posts?.[0]?.cooked` — the exact same "parse HTML, take the first `<p>`'s text"
operation Executive Summary's own connector performs inline for the *current* topic page. Reusing it
here (rather than a third copy of that logic) was straightforward; the function's name — written for
category descriptions — is a slightly awkward fit for "first paragraph of a post," but renaming it or
touching Executive Summary's own separate inline implementation to match was judged out of scope
("do not redesign existing components") for what this task actually asked for. Purely additive to
Citation Preview's output shape — every existing consumer (Intelligence Index, Archive Navigation,
Intelligence Network, Knowledge Graph, Search Results) is unaffected, the same reasoning already
applied when `documentType`/`updatedAt` were added.

**Metadata Engine reuse, and why it doesn't apply directly here — same finding as Division
Header's.** `ddi-document-metadata.js` resolves the *current* topic page's already-loaded model; a
hover preview is, by definition, always about some *other* topic that may never have been loaded.
Citation Preview is the parallel mechanism this codebase already built for exactly that case (see
**The lib / service / connector pattern**), and it shares the Metadata Engine's same underlying
`lib/` helpers (`formatDocumentId`, `formatDocumentDate`, `getClassification`,
`getDocumentTypeLabel`) — reusing that shared foundation is what "reuse the Metadata Engine where
possible" means in a context where the Metadata Engine's own service class structurally cannot apply.

**`lib/ddi-document-id.js` gained `parseTopicIdFromUrl()` — extracted once, used twice, not
duplicated a third time.** Both this feature and Search Results (Phase 1) need to recover a topic ID
from a rendered `href`. The regex was written carefully to handle `/t/{id}/{post_number}` (no slug)
correctly — an initial version mis-parsed that shape by treating the numeric id itself as a "slug"
segment, which would have silently mis-attributed hover previews (and Search Results badges) on any
link to a specific post rather than a topic's first post. Fixed before either consumer shipped it;
`ddi-search-results.js` was refactored to call the shared function instead of keeping its own
slightly-buggy inline copy, closing that bug there too as a side effect, not a separate fix.

**Fails gracefully at every stage, not via a single top-level catch.** No topic ID parsed from the
hovered link → nothing scheduled. `getCitationById()` resolves to `null` (deleted topic, fetch
failure — it already never rejects) → nothing rendered. The user moves to a different link, or away
entirely, before the delay elapses or the fetch resolves → a request-token plus a "still hovering the
same link" check discards the stale response. Missing Executive Summary specifically falls back to
`"No summary available."`, the same fallback text Executive Summary's own connector already
established. In every case, the failure is silence — no error state, no broken layout, matching "fail
gracefully" literally.

**A UX simplification, stated rather than left implicit.** The card hides immediately when the mouse
leaves the *link* — it does not stay open if the mouse moves onto the card itself (e.g., to read a
longer summary or click through). Keeping the card open under the cursor would need additional
mouse-tracking between the link and the card; deliberately left out to keep this "lightweight," per
the explicit requirement, rather than building a more elaborate hover-intent state machine.

**New CSS is one small addition, not a new component vocabulary.** `.ddi-document-preview` only adds
fixed positioning and an opacity/visibility toggle; the card's background, border, and shadow come
from `.ddi-card` (reused verbatim), and its metadata row reuses `.ddi-search-badge` (Search Results,
Phase 1) exactly, including the same `--ddi-accent`-based classification coloring — the classification
badge is the only one of the five with a `classificationClass`, so it's the only one that picks up a
non-neutral color, consistent with how classification color-coding works everywhere else in this
theme.

## Command Palette

`Ctrl+K` / `Cmd+K` opens a floating palette — `api-initializers/ddi-command-palette.js` — supporting
document search, department search, Open Homepage, Open Category Pages, and recently viewed
documents, all keyboard-navigable (arrows, Enter, Escape) with mouse support too.

**Registered through Discourse's own keyboard-shortcut API, not a raw `keydown` listener — the
actual mechanism behind "preserve native Discourse shortcuts."** `api.addKeyboardShortcut("ctrl+k",
...)` / `api.addKeyboardShortcut("meta+k", ...)` are the platform's own registration point for
exactly this purpose, the same "reuse the platform's mechanism rather than hand-roll an equivalent"
principle already applied elsewhere (`decorateCookedElement` for Cross References,
`api.onPageChange` for Dossier Refresh and Search Results). A raw global `keydown` listener would
have been the more obviously riskier path — this codebase has no history of using
`addKeyboardShortcut` before, so its exact call shape (particularly the options object, here
`{ global: true }`) is based on general knowledge of the Discourse plugin API, not confirmed against
a live instance. The registration is wrapped in a `try`/`catch`: if the method doesn't exist or
throws, the palette simply isn't keyboard-reachable rather than breaking theme initialization —
consistent with "fail gracefully."

**No conflict with Discourse's default shortcuts, as far as could be verified without a live
instance.** Discourse's own documented default shortcut set (`j`/`k` topic navigation, `#` topic
list, `/` search, etc.) doesn't include Ctrl+K/Cmd+K. The one caveat that's genuinely out of this
theme's control: some browsers reserve Ctrl+K/Cmd+K at the chrome level (address-bar search, in
some older browser versions) before page JavaScript ever sees the keystroke — an inherent property
of choosing this specific shortcut, not something a page-level script can detect or work around.

**Reuses Intelligence Index and Citation Preview completely — the actual "no duplicate search
logic" mechanism.** Document search calls the existing `ddi-intelligence-index.js`'s `getIndex()`
unchanged (the same archive-wide fetch every other archive-wide feature uses) and filters the
result with a new, narrow `lib/ddi-command-palette.js` (`filterDocumentsByQuery()`/
`filterDepartmentsByQuery()`) — free-text substring matching across title/Document Number/
department/classification/type, a genuinely different concern from `lib/ddi-document-index.js`'s
existing `filterDocuments()` (exact department/classification matching) and not a re-implementation
of it. Neither this nor anything else in the palette reimplements Discourse's own search relevance
ranking — that remains exclusively `/search`'s job (see **Search Results** above), this is a
lightweight quick-jump filter over an already-fetched list, not a second search engine.

**"Cache recent results" is two distinct things, both real:** (1) the full document list and
department list are each fetched once per page session and reused for every subsequent palette open
(module-level variables, not re-fetched per keystroke or per open — filtering happens client-side
against the cached copy); (2) "recently viewed documents" is inherently a cache of recent
activity, tracked via `localStorage` (capped at 8 entries, deduplicated, most-recent-first) and
hydrated on each palette open through Citation Preview's own `getCitationById()` — which is already
cached by document ID, so repeat opens re-fetch nothing for a document already seen this session.

**Recently viewed tracking is genuinely new — nothing existing tracks per-user browsing history.**
This is a different concept from Intelligence Dashboard/Index's "Recently Updated" (archive-wide,
by edit timestamp, no per-user state). `api.onPageChange` checks `router.currentRouteName` for a
`topic.` prefix and, if so, reads `controller:topic`'s `.model` — the exact same lookup
`ddi-dossier-refresh.js` already established for "get the current topic" — and records `{id, title}`
to `localStorage`. Wrapped in `try`/`catch`: if `localStorage` is unavailable (privacy mode, quota,
disabled), tracking silently no-ops rather than throwing.

**Navigation reuses `DiscourseURL.routeTo()`, Discourse's own utility for exactly this** — not a
hand-rolled router transition. An earlier draft of this feature called `service:router`'s
`transitionTo()` directly with a bare URL string and a manual `window.location.assign()` fallback;
`DiscourseURL.routeTo()` is the actual, well-established Discourse utility built for "navigate to
this URL, handling both Ember and full-page cases correctly," and reusing it is strictly safer than
the hand-rolled equivalent this initially had. Caught during self-review, fixed before this shipped.

**Accessibility: a real combobox/listbox pattern, not decorative ARIA — dialog mechanics (Escape,
focus trap, focus restore, scroll lock) come from the shared `lib/ddi-modal.js` utility, not
bespoke code.** The input carries `role="combobox"` and `aria-activedescendant` pointing at
whichever result row is currently selected; the results container is `role="listbox"`; each row is
`role="option"` with `tabindex="-1"` (deliberately *not* independently tabbable — selection moves
via `aria-activedescendant`, keeping the input the single real focus target while open, which is
also why the shared Tab-trap's first-focusable/last-focusable happen to be the same element: there's
nothing else to trap focus between). A visually-hidden `aria-live="polite"` status region announces
the result count on every keystroke, for screen-reader users who can't see the list update. See
**Modal Accessibility** below for what the shared utility provides to every DDI dialog, including
this one: Escape closes, focus is restored to whatever was focused before opening, and background
scroll is now locked while open (previously not the case here). Known, stated limitation, unchanged
by that refactor: content *behind* the palette isn't marked `aria-hidden` while it's open (a fuller
implementation would toggle that on the rest of the page) — judged out of scope for "keep
lightweight" against the actual accessibility gains of doing so.

**New CSS reuses the established shell and row patterns.** `.ddi-card` (dialog background/border/
shadow), `.ddi-toc-item`/`.ddi-toc-title` (result rows, identical to every other document list in
this theme), and `.ddi-nav-section-label` (section headers) are all reused verbatim; only the
backdrop, positioning, input styling, and active-row highlight are new.

### Command Palette Expansion (v1.1)

Six new entries — Open Reading Lists, Open Favorites (already existed; re-grouped, not new), Open
Timeline (later renamed Open Browse Archive — see below), Open Knowledge Graph, Open Integrity
Dashboard, Open System Status Dashboard — make the
palette what the Post-Release Product Review named as a concrete gap: it "doesn't know about half
the product," forcing users to hunt for corner-anchored trigger buttons instead. Every entry
activates something that already existed; no new dialog, route, or service was created.

**Every activation delegates to an existing service's `open()`, an existing scroll target, or the
existing Favorites dialog helper — nothing here recomputes what those already compute.**
`activate()`'s `switch` on `entry.special` calls `ddiReadingLists.open()`,
`ddiIntegrityDashboard.open()`, and `ddiSystemStatus.open()` directly (the identical methods their
own trigger buttons already call), and reuses the existing `openFavorites()` helper for Favorites
unchanged. Two entries aren't dialogs, so "open" means something else for them, reusing
infrastructure Document Actions already established rather than inventing new routing:

- **Open Knowledge Graph** only appears as an entry while already on a topic route (there's no
  page-agnostic graph — it's always the *current* document's) and, when activated, scroll-anchors to
  `#ddi-knowledge-graph-viewer` — the exact same element `id` Document Actions' own "Open Knowledge
  Graph" action already scrolls to (see **Document Actions** above), not a second anchor.
- **Open Timeline** (renamed **Browse Archive** by the Homepage UX Cleanup, v1.1, once its target
  merged with Intelligence Index — see **Browse Archive (Homepage UX Cleanup, v1.1)** below; the
  technique described here is otherwise unchanged) is available from anywhere, since jumping to it
  from a page that isn't already showing it is the actual point of a "navigation hub" entry. If the
  target section's `id` (originally `#ddi-timeline-view` on `ddi-timeline-view.hbs`'s own outer card,
  now `#ddi-browse-archive` on the merged card — the identical technique used for the Knowledge Graph
  anchor either way) is already on the current page, it scrolls directly; otherwise it navigates to
  `/` via `DiscourseURL.routeTo()` (the same navigation every other entry already uses) and defers
  the scroll to `api.onPageChange()` — the same page-lifecycle hook `recordVisit()` already relies on
  in this same file — via one `requestAnimationFrame` frame, the identical "wait for the route's
  connectors to render" technique `ddi-document-toc.js` already uses for its own post-render DOM
  work.
- **Open System Status Dashboard required one prerequisite change**, documented in **DDI System
  Status Dashboard** above: its dialog state moved from the connector onto its own service, mirroring
  the exact move Integrity Dashboard's service already made for the identical reason. Without this,
  opening it from Command Palette would have needed either a second dialog implementation (a
  duplicate) or a new cross-component signaling mechanism the project has already deliberately ruled
  out (see that section) — the fix was extending existing, proven infrastructure, not building around it.

**Visibility is entry-by-entry, checked synchronously against the same settings and staff gate each
feature's own connector already applies — never a second implementation of "is this available."**
Reading Lists/Timeline/Knowledge Graph each check their own existing `ddi_*_enabled` setting; the two
staff entries check both their own setting *and* `currentUser.staff`, the identical double-gate their
own connectors' `shouldRender()` already applies, so a non-staff user never sees the entries exist —
not shown-but-disabled, absent, the same "hide what doesn't work" standard **Document Actions**
established.

**Grouping**: two new section types, `"tool"` (Reading Lists, Favorites, Timeline, Knowledge Graph —
labeled "Archive Tools") and `"staff"` (Integrity Dashboard, System Status — labeled "Staff Tools"),
alongside the existing `"action"`/`"department"`/`"recent"`/`"document"` types. Favorites moved from
`"action"` into `"tool"` — a deliberate re-grouping, not an oversight: it belongs with the other
"open a panel" entries, not alongside "navigate to a static page." Section membership stays
contiguous (tool entries are constructed before staff entries, and `Array.prototype.filter` preserves
order), so the existing "insert a label whenever the type changes" rendering logic in `renderEntries()`
needed no changes to correctly show the two new section headers.

**Keyboard: Tab/Shift+Tab now jump to the next/previous section's first entry, wrapping at either
end.** With five possible sections now visible at once on an empty query, arrowing one row at a time
to reach a later one is real friction. This was the only keyboard change available that doesn't
regress anything: Tab was already effectively a no-op inside the palette (the shared modal utility's
document-level, capturing-phase Tab-trap — see **Modal Accessibility** — finds only one focusable
element, the input itself, so it always re-focuses the same input either way) — confirmed directly by
simulating both listeners firing in their real capturing-then-bubbling order, not assumed: the modal's
handler still runs first and still re-focuses the input (a harmless no-op, since it was already
focused), and the new bubbling-phase handler on the input still runs afterward and performs the
section jump. Focus never leaves the input in either case, so the trap's actual safety property is
unchanged; only what Tab *does* while focus is there is new. Home/End and other key combinations were
considered and rejected — Home/End inside a focused text input already means "move the cursor," and
overriding that would regress normal text editing, not improve navigation.

**Verified directly.** Entry visibility was checked for every combination of staff/non-staff,
topic-route/non-topic-route, and each relevant setting on/off; `activate()`'s dispatch was checked to
call the correct service method or helper for all six new entries plus the pre-existing
plain-URL fallback, confirming no cross-contamination between them; `openTimeline()`'s same-page
(scrolls, never navigates) and cross-page (navigates, queues exactly one pending scroll) branches;
`jumpToAdjacentSection()`'s forward/backward/wrap-at-both-ends behavior against a five-section mock
entry list; and the System Status service migration's `open()`/`close()`, the cross-dialog handoff to
Integrity Dashboard, and that both the template and Command Palette read the identical single source
of truth. No new files were added — six entries, one keyboard behavior, and one prerequisite service
migration, entirely inside already-existing files.

## Favorites Panel

A quick-access panel — Document Number, Title, Classification, Department, Document Type, Last
Updated per favorite, plus Open Document and Remove Bookmark — for the current user's bookmarked
documents, reached via a new "Open Favorites" entry in the Command Palette rather than a separate
trigger.

**No favorites database — this is a read/write view directly over Discourse's own native bookmarks,
not a parallel store.** `services/ddi-favorites.js` has no local persistence of its own: reading
calls Discourse's bookmark-list endpoint fresh on every panel open (no caching of the list itself,
unlike the document/department lists the Command Palette caches for its own session — a favorite
list can change from *any* page via Discourse's native bookmark button, so this one deliberately
isn't cached, to stay synchronized rather than risk showing a stale list), and removing calls
Discourse's own bookmark-delete endpoint directly. A bookmark removed here is genuinely gone from
Discourse's own bookmark system — visiting Discourse's own bookmarks page afterward would not show
it either, since both paths ultimately hit the same backend resource.

**Verified against Discourse's actual source (`discourse/discourse` on GitHub, `main` branch) in a
follow-up pass, not left as an unconfirmed guess.** The first version of this feature was built on
general knowledge of Discourse's bookmark API and flagged, honestly, as the least-verified part of
the theme. A dedicated verification pass fetched the real controllers/routes/serializers and found
two genuine defects, both since fixed:

- **List endpoint was wrong.** Confirmed route (`config/routes.rb`): `GET /u/:username/bookmarks`
  (`UsersController#bookmarks`), not `/bookmarks.json` — a user-scoped resource, not a global one.
  `_fetchAllBookmarks()` now builds `/u/${currentUser.username}/bookmarks.json` and skips the
  request entirely (returns `[]`) if there's no `currentUser` — confirmed via the controller's
  `requires_login` filter that an anonymous request would only fail anyway.
- **Response shape was wrong, and so was the topic-id field this relied on.** Confirmed
  (`UserBookmarkListSerializer`): the response is `{ bookmarks: [...], more_bookmarks_url, ... }`
  at the top level — the `user_bookmark_list.bookmarks` shape tried first (with `response.bookmarks`
  only as a fallback) never existed. Worse, confirmed (`UserBookmarkBaseSerializer`'s actual
  attribute list): **individual bookmarks have no `topic_id` field at all** — the original
  `_uniqueTopicBookmarks()` relied on one that was never real, silently falling through to a second
  guess (`bookmarkable_type === "Topic"`) that only handled topic-level bookmarks and *dropped
  post-level bookmarks entirely* (a real, common case — bookmarking a specific reply, not the
  topic itself, then never seeing that document in Favorites at all). Fixed by reusing
  `bookmarkable_url` (a real, confirmed field — a direct link to the bookmarked topic or post)
  through the *existing* `parseTopicIdFromUrl()` (`lib/ddi-document-id.js`, already handles every
  `/t/...` shape including a trailing post number), which resolves both topic- and post-level
  bookmarks to the same topic id uniformly, with no branching on `bookmarkable_type` needed at all.
- **Pagination was missing entirely, not just unconfirmed.** Confirmed (`UsersController#bookmarks`):
  20 bookmarks per page (`BOOKMARKS_LIMIT`), with `more_bookmarks_url` present on the response
  whenever there's another page. A user with more than 20 bookmarks would have silently seen only
  their most recent 20. `_fetchAllBookmarks()` now follows `more_bookmarks_url` until it's absent,
  capped at `MAX_PAGES = 10` (200 bookmarks) as a safety bound against a runaway loop — not a new
  feature, just the existing "list all my bookmarks" operation actually completing correctly.
- **What was already correct, confirmed rather than re-guessed:** the deletion endpoint,
  `DELETE /bookmarks/:id` (`BookmarksController#destroy`, confirmed via both `routes.rb` and the
  controller itself), matches what was already implemented exactly — no change needed there.

**Every bookmark is resolved to its topic via `bookmarkable_url`, deduplicated, and reuses Citation
Preview completely for display data — no duplicate metadata logic.** `_uniqueTopicBookmarks()`
keeps only the first bookmark seen per topic id — a user who bookmarked three posts in the same
document sees that document once, with one "Remove Bookmark" action removing whichever bookmark was
found first, not all three (unchanged from the original design; still a deliberate, stated
simplification, not something the verification pass needed to touch). Each unique topic id then
goes through `ddi-citation-preview.js`'s existing `getCitationById()` unchanged — the exact same
call Document Quick Preview and Recently Viewed already make, already cached by document id.

**Reuses the Command Palette's backdrop styling and, for dialog mechanics, the shared
`lib/ddi-modal.js` utility — not a second hand-rolled implementation of either.** The favorites
panel is a second dialog/backdrop pair inside the same `ddi-command-palette.js` initializer (not a
separate file) specifically so it can share the palette's existing `.ddi-command-palette-backdrop`
styling and be triggered directly from `activate()` without inventing a cross-initializer
communication mechanism. It does *not* reuse the palette's combobox/`aria-activedescendant`
pattern, though — there's no search input here, just a scrollable list of real,
independently-focusable controls (each row's two buttons), a genuinely different interaction shape
from the palette's virtual-cursor-over-a-listbox one. What it does share with the palette (and every
other DDI dialog) is Escape/Tab-trap/focus-restore/scroll-lock, all from the one shared modal
utility — see **Modal Accessibility** below.

**Reuses `.ddi-dossier-grid`'s cell typography without touching its existing 4-column layout.**
Favorites needs 5 grid cells (Document Number, Classification, Department, Document Type, Last
Updated), one more than `.ddi-dossier-grid`'s established `repeat(4, 1fr)`, which many other
existing features already depend on unchanged. A `.ddi-favorites-grid` modifier class, applied
alongside `.ddi-dossier-grid` on the same element, overrides just `grid-template-columns` to
`repeat(auto-fit, minmax(110px, 1fr))` — the container still gets `.ddi-dossier-grid`'s label/value
typography for free, and the 4-column rule everywhere else is untouched.

**Metadata Engine reuse doesn't apply directly, same finding as Division Header and Document Quick
Preview's.** Favorited documents are, by definition, not necessarily the currently-loaded topic —
Citation Preview (built on the same underlying `lib/` helpers the Metadata Engine also uses) is the
established mechanism for exactly this "some other document" case throughout this theme.

**Known, stated UX limitation, not silently accepted.** Removing a bookmark re-renders the list,
which resets focus to the document body rather than a nearby remaining control — a real, narrow
rough edge judged disproportionate to fix for a "quick-access panel," not code the review missed.
(A previously-documented second limitation here — a Shift+Tab pressed before any Tab press could
escape the dialog, in the one narrow window before the list finished loading — no longer applies:
the shared modal utility's Tab-trap queries the dialog's actual focusable elements live on every
keypress rather than depending on Tab having been pressed first, so it traps correctly from the
first keypress regardless of loading state.)

## Document Integrity Dashboard

A staff-only, read-only audit table: one row per detected issue across the whole archive — Missing
Document Type / Classification / Lifecycle / Department, Duplicate Document Numbers, Invalid Cross
References, Broken Related Document links, and (v1.7) Missing Revision History / Duplicate Revision
Numbers / Invalid Revision Ordering. Not a second validation system: it runs the exact same checks
already used elsewhere and reshapes their output into a table.

**Reuses `lib/ddi-integrity.js` for the four "missing metadata" checks — does not reimplement
them.** `services/ddi-integrity-dashboard.js` calls the same `verifyDocumentIntegrity(metadata)`
already used by the per-topic Verification Panel (see **Document Integrity Verification** above), on
`metadata` produced by the same `ddi-document-metadata.js` Metadata Engine service, for every document
in the archive rather than just the current topic. A `FIELD_TO_ISSUE_TYPE` map translates the check's
`field` (`"Classification"`, `"Department"`, `"Document Type"`, `"Lifecycle"`) into this dashboard's
issue vocabulary; the fifth check (`"Metadata"` — title/author/date resolution) is deliberately
excluded, since it isn't one of the issue types this dashboard was asked to surface, and doing so
would have meant the dashboard silently growing scope beyond what was requested.

**Reuses `lib/ddi-cross-reference.js` and `lib/ddi-relationship.js` for the other two checks, not new
regex logic.** "Invalid Cross References" runs `findDocumentReferences()` (the same inline
`DDI-######` mention scanner Knowledge Graph and the Verification/Relationships panels already use)
against each document's cooked text; "Broken Related Document links" runs `findDocumentRelationships()`
(the same `Type: DDI-######` declaration parser `ddi-relationship.js`'s service already uses) the same
way. Both existing libraries already parse the text — this dashboard's only new work is asking "does
the referenced document actually exist?"

**Existence is checked against the scanned set first, Citation Preview second — not assumed broken on
a miss.** Every document scanned this pass has a known topic id; a reference or declared relationship
pointing to one of those ids is trivially valid with no extra request. A reference pointing *outside*
that set falls back to `ddiCitationPreview.getCitationById()` (the same cached lookup Document Quick
Preview and Favorites already use) before being called broken — this matters because the dashboard
only scans one page's worth of documents (see limitation below), so a reference to an older document
that's still real, just not on that page, is not a false positive.

**Missing Revision History / Duplicate Revision Numbers / Invalid Revision Ordering (v1.7) reuse the
revision table already parsed once per document — zero new fetches, zero new cooked-HTML parses.**
`_toDocument()` now parses each document's cooked HTML exactly once and reuses that single parsed
`Document` for both the existing `.textContent` extraction (cross-reference/relationship scanning,
unchanged) and `lib/ddi-revision-table.js#parseCookedRevisionTable()` (new) — not a second call to
`parseCookedHtml()`. The three checks themselves call `lib/ddi-revision-table.js`'s own
`findDuplicateRevisionNumbers()`/`isRevisionOrderValid()` — the exact same functions Author Assistant
calls against a composer draft (see **Document Author Assistant** above) and the Document View panel
calls for a single document (see **Revision History (v1.7)** below) — against the already-parsed
rows, synchronously, with no `await` needed for this part of `_buildIssues()`. All three are "Low"
severity: the task that requested them called them "non-blocking informational checks," and "Low" is
this dashboard's existing least-severe tier (already used by Missing Lifecycle) rather than a new
5th tier invented for just these three.

**Duplicate Document Numbers is a defensive check against a condition the current ID scheme can't
actually produce.** `documentNumber` is `formatDocumentId(topic.id)` — derived 1:1 from each topic's
unique id (`lib/ddi-document-id.js`), so two documents colliding on the same number is not reachable
through normal use. The check still runs (group scanned documents by `documentNumber`, flag any group
of 2+) so that if the ID scheme is ever changed to something not inherently unique, this dashboard
starts catching it immediately rather than needing a companion change.

**A raw `/t/{id}.json` payload isn't shaped like the Metadata Engine's input, so a small adapter
translates it — this is shape translation, not new validation logic.** `ddi-document-metadata.js`
expects a live Ember `Topic` model (camelCase `postStream`, a resolved `category` object). A
archive-wide scan has no such model for each document — only the raw JSON from `ajax()` — so
`_adaptTopic()` builds a minimal plain object (`postStream: { posts: topic.post_stream?.posts || [] }`,
`category` looked up from `this.site.categories` by `category_id`, the same lookup
`ddi-citation-preview.js`'s `getCitation()` already uses) before handing it to the real
`getMetadata()`. None of `getMetadata()`'s own resolution logic is duplicated or reimplemented.

**Scans the complete, paginated archive via `ddi-archive.js` — no longer a single `/latest.json`
page.** This section originally documented a known, stated limitation here: this dashboard, like
Intelligence Index and Archive Navigation, only ever saw `/latest.json`'s first page, with documents
beyond it silently invisible rather than merely under-checked. The Archive Pagination refactor (see
**Archive Pagination** below) replaced the direct `ajax("/latest.json")` call this dashboard's
`_scanArchive()` used to make with `this.ddiArchive.getTopics()` — the shared, paginated,
session-cached topic list every archive-wide feature now uses. `_scanArchive()` itself is otherwise
unchanged: it still fetches each topic's full `/t/{id}.json` afterward (a different, still-necessary
concern this shared service doesn't replace), and every check downstream of that runs exactly as
before.

**Staff-only, gated twice.** `connectors/above-main-container/ddi-integrity-dashboard.js`'s
`shouldRender()` looks up `service:current-user` and checks `.staff`, so the trigger button and its
dialog never mount at all for a regular member — this is the primary gate. `getIssues()` in the
service checks `this.currentUser?.staff` again and returns `[]` immediately if false, the same
defense-in-depth pattern `ddi-favorites.js` already uses for its own `currentUser` guard, in case the
service is ever called from anywhere else. A new `ddi_integrity_dashboard_enabled` setting (default
on) gates the connector's rendering the same way `ddi_intelligence_index_enabled` and
`ddi_homepage_dashboard_enabled` already do, but does not replace the staff check — turning the
setting on never exposes the dashboard to non-staff.

**Fully read-only — no write path exists.** The dashboard has no action beyond "Open Document" (a
plain link to the topic) and "Close." No document is modified, tagged, or otherwise changed by this
feature; it only reports what it finds.

**A fixed corner trigger button, not a new outlet on an existing page.** `above-main-container` was
previously unused in this theme (only `below-main-container` hosts the Intelligence Index), so adding
the trigger there doesn't compete with or displace anything already rendered. It's `position: fixed`
specifically so it adds zero layout height to any page for the staff members who do see it, and is
invisible (not merely hidden) to everyone else via `shouldRender()`.

**Confidence caveat.** The classic connector `setupComponent`-style shape, with `open`/`close`
exposed as plain component properties bound via `{{on "click"}}` (see **Deprecated Template
Actions**), is the same pattern every connector in this theme is already written against;
`service:current-user` and `.staff` are standard, long-stable Discourse DI conventions. Untested
against a live Discourse instance — if either assumption is wrong, the safe failure mode is the
trigger button simply not appearing or not opening, not a broken page.

## DDI System Status Dashboard

A staff-only, read-only archive health summary — simple stat cards (Total Documents, Documents
Missing Metadata, Broken Cross References, Broken Related Documents, Duplicate Document Numbers,
Draft/Archived Documents, Public/Internal/Restricted/Top Secret Documents), with the four
issue-derived cards linking into the Document Integrity Dashboard. Built entirely on top of two
already-existing things rather than re-deriving any of their data.

**Reuses `lib/ddi-archive-statistics.js` for totals and classification counts, exactly as an existing
consumer would.** `services/ddi-system-status.js` fetches the archive's citation-shaped documents via
`ddiIntelligenceIndex.getIndex()` (the same call Homepage Dashboard already makes) and runs them
through the same `buildArchiveStatistics()` Homepage Dashboard and Division Header already use.
`totalDocuments` and the four classification counts (Public/Internal/Restricted/Top Secret — looked up
by name from `statistics.classifications`) come from this call alone; nothing about archive statistics
was reimplemented.

**Reuses the Integrity Dashboard's own scan for everything else, rather than scanning the archive a
second time.** The four remaining counts — Documents Missing Metadata, Broken Cross References,
Broken Related Documents, Duplicate Document Numbers — plus Draft/Archived Documents, all come from a
single call to `ddiIntegrityDashboard.getSummary()` (see **Document Integrity Dashboard** above),
which was extended (not duplicated) specifically to serve this need: it already scans every document
and runs every check to build the issue table, so this dashboard just asks for that same result
shaped two ways — the issue list (for counts) and a lifecycle tally (for Draft/Archived, which the
Integrity Dashboard's own issue table has no reason to expose otherwise).

**"Documents Missing Metadata" counts documents, not issue rows — the other three count issue rows.**
A document missing both its classification and department tags produces two separate rows in the
Integrity Dashboard's table (one issue per missing field), but should only count once as "a document
with a metadata gap" here — `getStatus()` de-duplicates by `documentNumber` across the four
missing-metadata issue types for that one figure. Broken Cross References and Broken Related Documents
intentionally do *not* de-duplicate this way: a document with two separate broken cross-references is
two real problems to go fix, not one, so those counts reflect issue rows directly. Duplicate Document
Numbers de-duplicates by document number for the same reason as Missing Metadata — the group, not
each row `_duplicateIssues()` emits per member of the group, is the countable thing.

**Draft/Archived counts, and only those two, needed a small new capability in the Integrity Dashboard
service — not a new scan.** Citation-shaped documents (`buildArchiveStatistics`'s input) have no
`lifecycle` field at all; the Metadata Engine's output does, but only the Integrity Dashboard's scan
already resolves every document through the Metadata Engine. Rather than have this new service
duplicate that scan-and-adapt logic to reach the same `metadata.lifecycle` values, `getSummary()`
was added to `ddi-integrity-dashboard.js` to return `{ issues, lifecycleCounts }` from one scan;
`getIssues()` itself is unchanged — both public methods now share one internal `_buildIssues()`.

**No per-issue-type filtering on drill-down — clicking any of the four issue-derived cards just opens
the full Integrity Dashboard.** A more surgical "jump straight to just the broken cross-references"
view would need new filtering support added to the Integrity Dashboard itself, which wasn't asked for
here and would have grown that already-shipped feature's scope. Opening the same dialog with every
issue visible still satisfies "links into the Integrity Dashboard where applicable" without it.

**The Integrity Dashboard's dialog state moved from the connector into the service to make this
possible cleanly.** Before this feature, `isOpen`/`isLoading`/`issues` lived as local component state
on `connectors/above-main-container/ddi-integrity-dashboard.js`, set via `setupComponent`/actions —
fine when only that one connector ever needed to open its own dialog. `ddi-system-status.js`'s summary
cards need to open that *same* dialog from a *different* connector, which local component state can't
do without new cross-component plumbing. Moving `isOpen`/`isLoading`/`issues` onto the service itself
(as `@tracked` fields, with `open()`/`close()` methods) makes the service the single source of truth;
the Integrity Dashboard connector was updated to read/act through `this.ddiIntegrityDashboard` instead
of local state, with no change to its own visible behavior, and `ddi-system-status.js` simply injects
the same service and calls `.open()` — no event bus, no new shared state container, no DOM-querying
across connector boundaries.

**Two full-screen dialogs never stack.** The System Status panel's "open Integrity Dashboard" action
closes itself first, then opens the Integrity Dashboard — both dialogs reuse the same
`.ddi-command-palette-backdrop`/`z-index: 2000` shell, so showing both at once would just be two
identical full-screen overlays on top of each other with no visible way to tell them apart.

**v1.1 update: this dashboard's own `isOpen`/`isLoading`/`status` moved from the connector onto
`services/ddi-system-status.js` itself** — the exact same move `ddi-integrity-dashboard.js` made
above, for the exact same reason: Command Palette Expansion (see **Command Palette** below) needed to
open this dialog from outside its own connector, which local component state can't do without new
cross-component plumbing. `open()`/`close()` now live on the service as `@tracked` fields;
`connectors/above-main-container/ddi-system-status.js`'s own `open`/`close`/`openIntegrityDashboard`
actions are now thin delegating wrappers around `this.ddiSystemStatus`, with no change to the
connector's own trigger-button behavior or visible output — the same "delegate, don't duplicate"
shape the Integrity Dashboard connector already established.

**The `/latest.json` half of this is no longer duplicated — the Archive Pagination refactor fixed
exactly this.** This section originally described `ddiIntelligenceIndex.getIndex()` (for totals/
classifications) and `ddiIntegrityDashboard.getSummary()` (for issues/lifecycle) as each
independently fetching `/latest.json`, an accepted-but-real cost. Since both now go through
`ddi-archive.js`'s shared, session-cached `getTopics()` (see **Archive Pagination** below), whichever
of the two runs first performs the actual paginated fetch and the other reuses that same cached
result — one archive listing per session, not two per dialog open. What's still legitimately separate
is each side's own *per-topic* follow-up work: Citation Preview's shaping (for totals/classifications)
versus raw `/t/{id}.json` plus Metadata Engine adaptation (for issues/lifecycle) are different data
needs neither side can substitute for the other, and remain two independent costs — just no longer
stacked on top of two independent archive listings as well.

**Staff-only, gated twice, matching the Integrity Dashboard's own pattern exactly.**
`connectors/above-main-container/ddi-system-status.js`'s `shouldRender()` checks `service:current-user`
`.staff` before the connector even mounts; `getStatus()` checks `currentUser?.staff` again and returns
`null` if false. A new `ddi_system_status_enabled` setting (default on) gates the connector the same
way `ddi_integrity_dashboard_enabled` does, without replacing the staff check.

**Fully read-only.** The only actions are "open Integrity Dashboard" (navigates to another read-only
view) and "Close." No document is modified, tagged, or otherwise changed.

**Template reuses `.ddi-stat-grid`/`.ddi-stat-tile`/`.ddi-stat-tile-total` verbatim** — the exact same
stat-card shell Homepage Dashboard, Division Header, and Division Cards already use — plus a new
`.ddi-stat-tile-link` modifier (a `<button>` styled to match `.ddi-stat-tile` with a hover state,
`font: inherit`/`text-align: left`/`width: 100%` resetting the element's own UA button defaults) for
the four clickable cards. The trigger button reuses `.ddi-integrity-trigger` verbatim plus a
`.ddi-system-status-trigger` modifier that only changes `bottom` so the two fixed corner buttons stack
instead of overlapping.

## Reading Lists

Member-facing, browser-local reading lists — create a named list, add/remove documents by number or
link, and see its Documents, Estimated Reading Time, and Completion Progress. Unlike every other
"panel" feature in this theme, this one's data has no native Discourse counterpart at all (bookmarks
for Favorites, categories for Division Cards) — there is no server-side reading-list concept to
delegate to, so this feature owns real, if small, persisted state for the first time.

**Stores only document references, in `localStorage`, by necessity — not a design preference.** A
theme has no database and no server-side storage of its own; `localStorage` (already precedented by
Command Palette's own "recently viewed" list) is the only mechanism available at all. What's stored
per list is exactly `{ id, name, description, documentIds: [], createdAt }` — an array of topic ids,
nothing else. Every displayable field (title, classification, document type, revision, reading time)
is re-resolved from that id list every time a list is opened; none of it is cached into
`localStorage` alongside the reference. This is what "do not duplicate document storage / store only
references" means in a theme with no backend of its own: the browser-local list of *ids* is the
only thing this feature persists.

**Reuses Citation Preview for every displayed document field except reading time.**
`services/ddi-reading-lists.js#_loadDocumentDetail(documentId)` calls the existing
`ddiCitationPreview.getCitationById()` — the same cached call Favorites, Document Quick Preview, and
the Command Palette already make — for Document Number, Title, Classification, Document Type,
Revision, and the Open link. No new "topic to display fields" mapping was written for any of those.

**Reuses the Metadata Engine specifically for Estimated Reading Time — the one field Citation
Preview doesn't carry.** Citation Preview's shape has no `readingTime` field; `ddi-document-metadata.js`
does (`analyzeReadingTime()`, already used for the per-topic reading-time display). Since Reading
Lists has no live Ember Topic model for documents that aren't the currently-open topic, `_resolveReadingTime()`
fetches the raw `/t/{id}.json` payload and adapts it into the shape `getMetadata()` expects — the
same `_adaptTopic()` shape-translation technique the Integrity Dashboard and System Status services
already established (see **Document Integrity Dashboard** above) for exactly this "need the Metadata
Engine's output, but there's no live Topic model" situation. A list's Estimated Reading Time is the
sum of each of its documents' `readingTime`, computed fresh on every open — no caching, matching this
feature's "keep implementation lightweight" mandate.

**Completion Progress reuses the *existing* "recently viewed" tracking — this feature adds no new
tracking of its own, deliberately.** The task's required actions ("Create... Add... Remove... Open
all... Share") notably don't include any "mark as read" action, so there was no obvious signal for
Completion Progress to come from. Rather than invent a new read/unread toggle unasked-for, this
feature treats "has the user actually opened this document" (already recorded via
`recordVisit()`/`ddi-recently-viewed` in `localStorage` on every topic-page visit, previously private
to Command Palette) as that signal — a document counts as complete for a given reading list once its
id appears in that same recently-viewed history. **Extracted `lib/ddi-recently-viewed.js` out of
`api-initializers/ddi-command-palette.js`** (which previously defined `RECENT_STORAGE_KEY`,
`readRecentlyViewed()`, `recordVisit()` inline as the sole consumer) so both features import the same
unchanged logic rather than a second copy of it; Command Palette's own behavior is unaffected — same
storage key, same cap, same fallback-on-failure.

**Add Document reuses existing parsing, not a new document picker.** The input accepts either a
document number or a pasted document URL, resolved via the existing `parseTopicIdFromUrl()` (tried
first, so `/t/{slug}/{id}` and `/t/{id}` links both work) falling back to `parseDocumentId()` (a bare
`DDI-XXXXXX` or plain number) — both already in `lib/ddi-document-id.js`, reused unchanged. Building a
real document search/browser UI for this was deliberately not attempted: it would have been a
materially larger, separate feature, and every other document-lookup surface in this theme (Command
Palette, Timeline) already exists for finding a document number to paste in here.

**Click and hover reuse the same free mechanisms Knowledge Graph Viewer already established.** Every
document row's "Open" control is a real `<a href="{{doc.url}}">`, so it uses Discourse's own routing
for clicks and is picked up by `ddi-document-preview.js`'s existing global hover listener for free —
no new preview or navigation code.

**Open All Documents is a real, known browser limitation, stated plainly rather than hidden.**
`openAllDocuments()` calls `window.open()` once per document; most browsers block more than one or
two popups triggered synchronously from a single click, depending on the user's own settings. Each
call is independently guarded so one blocked popup doesn't prevent the rest from being attempted, but
there is no workaround for the underlying browser behavior — a "fails gracefully, not a broken
feature" limitation, not a bug in this code.

**Share has no server to publish to, so the reading list itself is encoded into the URL.** There is
no backend endpoint a theme could POST a shareable list to, and `localStorage` is inherently
per-browser — the only way to hand a reading list to someone else at all is to put the data (still
just `{ name, description, documentIds }`, never document content) directly into a URL. `lib/
ddi-reading-list.js#encodeShareableList()`/`decodeShareableList()` base64-encode/decode that payload
(wrapped in `encodeURIComponent`/`decodeURIComponent` for a safe Unicode round trip); `shareList()`
copies the resulting URL via `navigator.clipboard.writeText()`, and — since clipboard access can fail
or be denied — falls back to displaying the raw URL as plain, selectable text rather than claiming a
false success or referencing browser history the URL was never actually added to.

**Importing a shared list always creates a new list, named `"{name} (Shared)"` — it never overwrites
anything.** `_checkForSharedList()` runs once, in the service's constructor, reading the
`?ddi-shared-list=` query param if present; a valid payload opens the dialog automatically to an
import/dismiss prompt rather than requiring the recipient to already know to look for it. Confirming
import calls `importSharedList()`, which builds a brand-new list via the same `createReadingList()`
used everywhere else — the sender's own list (if they have one client-side) and the recipient's copy
are two entirely independent objects from that point on, consistent with there being no shared
backend record for either side to point at.

**No delete-list action — a stated scope boundary, not an oversight.** The task's required action
list is Create, Add, Remove (documents), Open All, Share; deleting an entire list isn't among them.
Skipping it here rather than adding it unasked-for follows this theme's established "implement
exactly what's asked" convention, but it is a real, user-facing gap worth naming directly: today,
the only way to get rid of an unwanted list is clearing browser storage entirely (which also clears
Recently Viewed and the Favorites panel isn't affected, since that's server-side bookmarks — only
Reading Lists and Recently Viewed live in `localStorage`).

**Fails gracefully throughout.** `localStorage` unavailable or throwing (private browsing, quota,
disabled): reads return `[]`, writes are silently no-ops — the panel still works for the rest of that
page life, just doesn't persist. A document number/link that doesn't resolve to a real document:
`addDocumentError` is set to a plain message, nothing is added, no exception surfaces. Corrupt or
non-array data already in `localStorage` (from a future format change, manual tampering, or another
site sharing the origin): treated as an empty list, not a crash. An invalid or tampered
`?ddi-shared-list=` value: silently ignored, no import prompt shown.

**Verified directly.** The full lifecycle — create, persist, reload, add (both a bare document number
and a `/t/{slug}/{id}/{post}` URL), remove, recompute Completion Progress as the list changes, encode/
decode a shareable payload (including a Unicode name) and import it as a distinct new list without
touching the original — was exercised end to end against the real pure `lib/ddi-reading-list.js`
functions plus an in-memory `localStorage` standing in for the browser's, alongside corrupt-data and
non-array-data fallback cases.

## Archive Pagination

Replaces every archive-wide feature's single-`/latest.json`-page scan with one shared, paginated,
session-cached service — `services/ddi-archive.js`. This was the single highest-leverage item flagged
in the Version 1 architecture review: five features (Intelligence Index, Archive Navigation, Timeline,
Integrity Dashboard, System Status) were all silently blind to any document past the first archive
page, independently, for the same underlying reason.

**One new service, one new public method, `getTopics()` — the entire surface area.**
`ddi-archive.js` exists to answer exactly one question: "every topic currently in the archive." It
does not shape, filter, sort, or classify anything — it returns the same raw topic-list-item objects
`/latest.json` always returned (`id`, `title`, `tags`, `category_id`, `bumped_at`, etc.), just
aggregated across every page rather than truncated to the first one. Shaping is still each
consumer's own job, exactly as before.

**Follows `topic_list.more_topics_url` until it's absent, the same "follow the link or stop" shape
already confirmed for Discourse's bookmark pagination** (`more_bookmarks_url` — see **Favorites
Panel**'s API verification pass). A `MAX_PAGES = 50` cap (roughly 1,500 topics at Discourse's default
page size) is a safety bound against a runaway loop, not a feature — the same framing already used
for the Favorites Panel's own `MAX_PAGES`.

**Caches the in-flight `Promise`, not the resolved array — deliberately.** `getTopics()` stores
`this._cache = this._fetchAllTopics()` on first call and returns that same stored value on every
subsequent call, for the life of the page. Storing the *Promise* rather than awaiting it first means
two features looking this service up in the same tick (e.g. System Status opening while something
else is still mid-fetch) share the one in-flight pagination chain instead of each independently
kicking off their own — the same technique `ddi-citation-preview.js`'s per-document `_cache` already
uses, applied here to the one archive-wide fetch instead of many per-document ones. There is no
`refresh()`/invalidation method — "cache for the session" was the requirement, and none of this
theme's consumers have ever needed a mid-session refresh.

**Fails gracefully by construction, the same way Favorites' pagination already did.** Each page fetch
is wrapped in `.catch(() => null)`; a failure mid-pagination stops the loop and returns whatever pages
were already collected rather than throwing, and `_fetchAllTopics()` itself therefore never rejects —
so the cached `Promise` is never a rejected one that would poison every future caller for the rest of
the session. A total failure on the very first page returns an empty array, matching every existing
consumer's own established "empty archive" empty-state handling with no new code on their end.

**Every consumer's public API is unchanged — this was a data-source swap, not a rewrite.**
`ddi-intelligence-index.js`'s `getIndex(filters)` and `ddi-integrity-dashboard.js`'s `getIssues()`/
`getSummary()`/`open()`/`close()` all keep their exact existing signatures and return shapes; only
their *internal* fetch call changed, from a direct single-page `ajax("/latest.json")` to
`this.ddiArchive.getTopics()`. Every downstream consumer needed zero changes at all:
- **Intelligence Dashboard**, **Archive Navigation**, and **Timeline** all already called
  `ddiIntelligenceIndex.getIndex()` rather than fetching anything themselves, so fixing Intelligence
  Index fixed all three simultaneously.
- **System Status Dashboard** already called `ddiIntelligenceIndex.getIndex()` and
  `ddiIntegrityDashboard.getSummary()`, so fixing both of those fixed it too — and, as a side effect,
  the two independent `/latest.json` fetches System Status used to trigger per open are now one
  shared, cached fetch (see **DDI System Status Dashboard** above, updated in place).
- **Reading Lists** was never an archive-wide scanner to begin with — a reading list only ever
  resolves the specific document ids a user added, never "the whole archive" — so it's unaffected by
  this refactor and required no changes, confirmed by there being no `/latest.json` reference in that
  service at all.

**`ddi-related-intelligence.js` was deliberately left alone — it isn't an archive-wide scan.** It
fetches `/c/{slug}/{id}.json` (category-scoped) and `/tag/{tag}.json` (tag-scoped) to find documents
related to one specific topic's own category and tags — a fundamentally narrower, intentionally
different query than "list the whole archive," not another instance of the same duplicated logic this
refactor targets. Routing it through `ddi-archive.js` would mean fetching the *entire* archive just to
filter it back down to one category/tag's topics locally — strictly more work for the same result, not
a simplification.

**Obsolete fetch helpers removed, not left dead alongside the new service.**
`ddi-intelligence-index.js`'s `_fetchArchiveTopics()` and `ddi-integrity-dashboard.js`'s
`_fetchArchiveTopicList()` — the two duplicated single-page implementations this refactor replaces —
are both deleted outright, along with the now-unused `ajax` import in `ddi-intelligence-index.js`
(`ddi-integrity-dashboard.js` keeps its `ajax` import, still used by `_fetchFullTopic()` for each
document's own full JSON, a different, still-necessary fetch this service doesn't replace).

**Verified directly.** Pagination logic was exercised against a mocked, multi-page archive: collects
topics across 3 simulated pages while following `more_topics_url`, a second call to `getTopics()`
performs zero additional fetches (session cache), two concurrent callers before the first fetch
resolves share exactly one fetch chain, a failure partway through pagination returns the pages
already collected rather than throwing, a total first-page failure returns an empty array, a
single-page archive (no `more_topics_url` at all) still works unchanged, and the `MAX_PAGES` cap
correctly halts a runaway/self-referential pagination loop. Separately, `ddi-intelligence-index.js`'s
full pipeline (fetch → shape via Citation Preview → sort → filter) was re-verified against a
multi-topic mock archive to confirm existing sort/filter behavior is untouched by the data-source
change.

## Modal Accessibility

Brings every DDI dialog — Command Palette, Favorites, Integrity Dashboard, System Status, Reading
Lists — into line on keyboard/screen-reader behavior via one shared utility, `lib/ddi-modal.js`,
rather than five independent (and, for two of them, already-duplicated) implementations of the same
mechanics.

**One function, `createModal(element, options)`, is the entire surface area.** It sets `role`,
`aria-modal="true"`, and either `aria-labelledby` (an id pointing at the dialog's own visible title)
or `aria-label` (for the one dialog with no visible title — Command Palette) immediately, and
returns `{ activate, deactivate, destroy }`. It does not decide *when* a dialog is open — every
dialog already owns that (a service's `@tracked isOpen`, or local component state) — it only turns
the accessibility behavior on and off in step with whatever the caller tells it. `activate()`
records the currently-focused element, locks background scroll, registers one document-level
`keydown` listener (Escape closes via an `onClose` callback; Tab is trapped between the dialog's
first and last focusable descendants, recomputed live on every keypress rather than cached at open
time), and moves focus to an explicit `initialFocus` target, the first focusable descendant, or the
dialog element itself as a last resort (it's always given `tabindex="-1"` if it doesn't already have
one, so that fallback is always valid). `deactivate()` reverses all of it, including restoring focus
to whatever was focused before the dialog opened. `destroy()` is `deactivate()` under another name,
for use as a `{{will-destroy}}` safety net if a dialog's element is torn down while still open.

**Background scroll lock is ref-counted at the module level, on purpose.** `lockScroll()`/
`unlockScroll()` share one counter across every `createModal()` instance in the page — the body's
`overflow` is only touched on the 0→1 and 1→0 transitions, so if a second dialog were ever open
while a first is still active, closing one wouldn't prematurely re-enable scrolling while the other
is still up. Every current DDI dialog closes any sibling before opening (see **DDI System Status
Dashboard**'s "two full-screen dialogs never stack"), so this is a correctness guarantee against a
case that can't happen today, not a response to an observed bug — cheap enough to include outright
rather than assume the invariant holds forever.

**Two different integration shapes for two different dialog implementations, same underlying
utility.** Command Palette and Favorites are hand-built DOM inside `api-initializers/
ddi-command-palette.js`; each now calls `createModal()` once when its dialog element is first
created and calls the returned `.activate()`/`.deactivate()` directly from its own existing
`open()`/`close()` functions, in place of the hand-rolled focus-save/restore and (for Favorites) an
entire bespoke `onFavoritesKeydown` Tab-trap that duplicated what Command Palette's own `keydown`
handler was separately doing. Integrity Dashboard, System Status, and Reading Lists are classic Ember
connector components whose dialog visibility is driven by a tracked `isOpen` (service-owned for the
first and third, component-local for the second) toggling a CSS class — for these, `setupModal`
creates the controller via `{{did-insert}}`, `onOpenChange` calls `.activate()`/`.deactivate()` via
`{{did-update this.onOpenChange <the isOpen value>}}` (which re-fires whenever that tracked value
changes), and `teardownModal` calls `.destroy()` via `{{will-destroy}}`. All three are free functions
closing over a plain service/component reference captured in `setupComponent`, never `this` —
the same lesson already established by the Knowledge Graph Viewer's `setupGraphCanvas`/
`teardownGraphCanvas` (did-insert/will-destroy guarantee the element as an argument but not `this`
bound to the component), applied here to a third modifier, `{{did-update}}`, for the same reason.

**Reading Lists needed one extra line the other two Ember connectors didn't: `setupModal` also
activates immediately if the dialog is already open at insert time.** A shared reading list URL
(`?ddi-shared-list=...`) sets `ddiReadingLists.isOpen = true` inside the service's own constructor,
before the connector's panel ever renders — `{{did-update}}` only fires on *later* changes to the
watched value, so relying on it alone would leave that one auto-opened dialog rendered visually open
with no focus trap, no Escape handling, and no scroll lock. Integrity Dashboard and System Status
have no code path that starts `isOpen` at `true`, so they don't need the same guard — this was a
deliberate, checked difference, not an inconsistency.

**Dead code removed, not left alongside the new utility.** Favorites' entire `onFavoritesKeydown`
function (manual Escape handling plus a hand-rolled Tab-trap querying `a[href], button:not([disabled])`)
is gone, along with the `favoritesLastFocusedElement` variable it and `openFavorites()`/
`closeFavorites()` maintained. Command Palette's `onInputKeydown` lost its own `Escape` branch and
the `Tab`-prevention branch it used to carry (`ArrowUp`/`ArrowDown`/`Enter` — real combobox
navigation, not modal mechanics — are untouched). Both dialogs' manual `dialog.setAttribute("role",
...)`/`aria-modal`/`aria-label` calls are gone too; `createModal()` sets all of it now.

**No UI or visual change — appearance was never in scope.** Every dialog's existing markup, CSS
classes, and backdrop-open toggle are untouched; only `role`/`aria-*`/`tabindex` attributes (already
either present or invisible to sighted users) and JS-level focus/scroll/keydown behavior changed.
The one behavior genuinely new to *every* dialog, not just Favorites/Command Palette, is background
scroll lock — none of the three Ember-connector dialogs (Integrity Dashboard, System Status, Reading
Lists) prevented background scrolling before this.

**Known, stated limitation.** As already noted under **Command Palette**, content behind an open
dialog isn't marked `aria-hidden` — true for all five dialogs now, not just that one, and still
judged out of scope for the same reason. Separately: each dialog's Escape/Tab listener is
independent per `createModal()` instance, scoped to whether *that* dialog is currently active, not a
single global modal stack — if two dialogs were ever simultaneously open (which, per the ref-count
note above, doesn't happen today), one Escape press would close both rather than just the top one.
Judged an acceptable, honestly-documented simplification for a theme where that situation is
prevented by convention rather than something worth a full modal-stack manager to guard against.

**Verified directly**, against a minimal in-memory DOM mock standing in for `document`/elements (no
`jsdom` dependency in this repo): static ARIA attributes set on creation; `activate()` saves focus,
locks scroll, and moves focus to the first focusable descendant by default; Escape invokes `onClose`;
Tab wraps at both ends of the focusable set (including Shift+Tab from the first element, and that a
Tab press from a *middle* element is left alone); `deactivate()` restores focus, unlocks scroll, and
removes its listener (confirmed by dispatching another Escape afterward and observing `onClose` does
not fire again); `activate()` is idempotent (calling it twice registers only one listener);
`destroy()` cleans up correctly even without an explicit `deactivate()` call first; and the scroll-lock
counter stays locked while any one of two simultaneously-active modals remains open, unlocking only
once both have deactivated.

## Mobile & Responsive Audit

A CSS-only pass across every custom DDI component, closing the gaps left by five earlier
`@media (max-width: 600px)`/`900px` rules (`.ddi-intel-grid`, `.ddi-watermark-text`, `.ddi-nav-links`,
`.ddi-stat-grid`, and `mobile.scss`'s own unrelated topic-list rule) that only ever covered a few of
this theme's grids. Every fix lives in `common/common.scss` — no `.hbs`/`.js` file changed, no
markup, no desktop-visible value changed; every new rule is inside a `max-width: 600px` query, the
same breakpoint the file's five pre-existing DDI media queries already used.

**`.ddi-dossier-grid`'s fixed `repeat(4, 1fr)` had no responsive handling at all — the single
highest-impact finding.** Five components share this bare class unchanged: Dossier Header, Document
Relationships, Document Navigation (the "Archive Navigation" card — one connector, two names for the
same feature, see below), Intelligence Index, and Intelligence Network. (Timeline, Reading Lists, and
Favorites all pair it with the `.ddi-favorites-grid` auto-fit modifier instead, which was already
safe — confirmed by grep before touching anything, not assumed.) At a 320-375px content width, four
fixed columns leave roughly 45-90px each — not enough for an uppercase, `.22em`-letter-spaced label
like "CLASSIFICATION" to render without wrapping into unreadable fragments, worst of all inside
Intelligence Index, where it repeats once per document in what can be a long list. Collapses to one
column below 600px, the same shape as `.ddi-intel-grid`'s existing 3→1 collapse.

**`.ddi-division-cards-grid`'s `auto-fit, minmax(300px, 1fr)` was a real, confirmed horizontal-
overflow bug, not a hypothetical one — the only defect in this audit that actually broke "no
horizontal scrolling."** `auto-fit`/`minmax` guarantees every track is *at least* its minimum, even
if that's wider than the container; `#main-outlet`'s own chrome plus this grid's own padding leaves
only ~240px of content width at 320px and ~295px at 375px — both narrower than the 300px floor,
forcing a track wider than the page and a horizontal scrollbar. Verified by computing actual content
width at all four required test widths (320/375/768/1024) before and after: overflows at 320 and 375
pre-fix, fits cleanly post-fix, and 768/1024 were never affected (they already had ≥300px to spare).
Used by both Division Cards and Reading Lists' "all reading lists" view — fixing it once fixes both.
Below 600px, the floor is dropped (`grid-template-columns: 1fr`) rather than lowered, since the grid
already reduces to one column naturally at that width regardless of the floor's exact value.

**`.ddi-card`'s 28px horizontal padding, tightened to 18px below 600px, benefits nearly every
component in one place rather than patching each consumer.** `.ddi-card` is the shared shell for
Homepage/Intelligence Dashboard, Executive Summary, Timeline, Division Header, and all five dialogs
(Command Palette, Favorites, Integrity Dashboard, System Status, Reading Lists) — reclaiming 10px a
side matters most inside a dialog, which already loses width to its own backdrop gutter (below).
`.ddi-dossier-header` isn't built on `.ddi-card` (its own class, own hardcoded `padding: 22px 28px`)
so it needed the identical reduction added separately — same reasoning, different selector.

**`.ddi-command-palette-backdrop` had zero horizontal padding — every dialog stretched flush to both
screen edges on mobile.** All five dialogs share this one backdrop; each dialog's own `width: 100%`
resolves against the backdrop's content box, so adding `padding-inline: 16px` there (not the `padding`
shorthand, so it doesn't disturb the `padding-top` already set here and by `.ddi-integrity-dashboard`)
gives every dialog a gutter in one place. "Ensure dialogs fit within the viewport" is otherwise
already satisfied pre-existing: every panel already carries `max-height`/`overflow-y: auto` so a tall
dialog scrolls internally rather than exceeding the viewport — this fix is purely about the horizontal
axis, which had no equivalent protection at all.

**Corner trigger buttons (Integrity Dashboard, System Status, Reading Lists): a touch-target bump and
a real overlap risk, verified by computing pixel positions rather than eyeballing it.** `padding: 8px
14px` at a 10px font lands under the ~44px touch-target guideline; bumped to `10px 16px` below 600px.
Separately, Reading Lists' trigger sits in the opposite corner from the other two on desktop
(bottom-left vs. bottom-right) — safe there, but on a narrow phone "READING LISTS" and "INTEGRITY
DASHBOARD" are each wide enough relative to the viewport that the two could plausibly overlap in the
middle, and rendered text width isn't something that can be measured from source alone. Rather than
guess, the mobile fix moves all three into one corner (`bottom: 108px`, stacked above System Status's
existing 64px), which rules out horizontal collision regardless of label width. Verified the
resulting stack has ≥10px clearance between each button at the bumped touch-target height.

**Knowledge Graph: no overflow risk to begin with (nodes are positioned in percentage space within an
`overflow: hidden` container — confirmed, not assumed), but the fixed 420px canvas height and 6px/10px
node padding were both worth trimming for a mobile viewport.** Canvas drops to 320px below 600px,
reclaiming vertical space without touching the percentage-based layout math in
`ddi-knowledge-graph-view.js` at all; node padding grows slightly (`8px 12px`) since each node is a
real tap target that opens a document.

**Already correct, confirmed by inspection rather than left unverified:** `.ddi-integrity-table`
already had `.ddi-integrity-table-wrap { overflow-x: auto; }` — the standard "wide table scrolls in
its own container" pattern — so "verify tables become usable on mobile" needed no change; Search
Results' badge row already used `flex-wrap: wrap`; Document Footer's `.ddi-intel-grid` and Archive
Navigation's `.ddi-nav-links` both already had their own 600px collapse from earlier work. "Archive
Navigation" and "Document Navigation" in this audit's component list turned out to be the same single
connector (`ddi-document-navigation.js`, card title "ARCHIVE NAVIGATION") — confirmed via a direct
search for any second navigation connector before assuming so.

**Dead/redundant CSS removed while auditing, not left alongside the fix.** `.ddi-dossier-header`
declared `max-width: 760px` immediately followed by `max-width: 100%` in the same rule — the second,
identical-specificity, later declaration always won, making the first genuinely unreachable; deleted
it rather than the (already-shipped, unchanged) effective behavior. `.ddi-reading-lists-panel`
re-declared `max-height: 82vh; overflow-y: auto;` — values already inherited unchanged from
`.ddi-integrity-dashboard-panel` on the same element (both classes are always present together) —
removed the duplicate, kept its one genuinely different property, `max-width: 820px`.

**Verified directly**, not just visually reasoned about: compiled the full stylesheet with `sass`
after every change (`sass common/common.scss`, zero errors, all 15 `@media` blocks present — the 5
pre-existing plus 10 new); computed `#main-outlet` and nested-dialog content widths at exactly
320/375/768/1024px against every changed selector's floor/column-count to confirm the 320/375 bugs
are fixed and 768/1024 are numerically unchanged; computed the corner-trigger stacking positions to
confirm no overlap at the bumped touch-target size.

## Performance Audit

A pass across every `lib`/`service`/connector for duplicate work, no code changed for its own sake
— every fix below targets a specific, traced call path that actually runs redundantly today, and
each preserves its function's exact public signature and return shape.

**`ddi-document-metadata.js`'s cache was single-slot; it's now a `Map` keyed by topic id — the
single highest-leverage fix in this pass.** `getMetadata(topic)` is called directly by 10+
independent topic-page connectors (Dossier Header, Executive Summary, Document Footer, Verification
Panel, Debug Panel, Document Timeline, Revision History, the Document Intelligence Header) plus three services
(Archive Navigation, Knowledge Graph, Relationship) for the *same* current topic on every single
topic page view, and once per document by Integrity Dashboard/System Status during an archive-wide
scan. A single-slot cache only helps two calls that happen to run back-to-back; any archive scan
(even one triggered from an earlier, different page in the same session) sat between same-topic
calls and evicted the slot, forcing a full re-resolve — classification, cooked-HTML reading-time
analysis, timeline building — for the same document repeatedly. A `Map` keyed by topic id keeps
every distinct topic's metadata for the session instead of just the last one, the same "cache for
the session, no invalidation" tradeoff `ddi-citation-preview.js` and `ddi-archive.js` already make.
Left unbounded deliberately: metadata objects are small plain data, unlike the parsed-DOM cache
below, so holding one per document even across a full archive scan is cheap.

**`ddi-cooked-parser.js`'s memo was the same single-slot shape, shared by 7+ call sites — upgraded
to a bounded (30-entry) LRU `Map`, not an unbounded one.** `parseCookedHtml()` is called from
Executive Summary, Document Footer/reading-time, Document Relationships, Knowledge Graph, Integrity
Dashboard, and Division Header/Cards — independent connectors and services that don't run
back-to-back, so in practice the one slot was almost always holding some *other* document's cooked
HTML by the time the next same-document call arrived, silently defeating the memo entirely. Bounded
rather than session-cached like the metadata `Map` above, specifically because the cached value here
is a full parsed DOM `Document`, not a handful of strings — an Integrity Dashboard scan touches
hundreds of documents' cooked HTML in one pass, and each is only ever visited once per scan, so
caching all of them for the rest of the session would be a real memory cost for zero reuse benefit.
30 entries comfortably covers one topic page's own call sites with headroom, evicted LRU (not FIFO)
so a document revisited partway through stays warm.

**`ddi-related-intelligence.js#findRelated()` and `ddi-relationship.js#getRelationships()` had no
caching at all — both are called twice, independently, for the same topic on every single topic page
view.** Intelligence Network and Knowledge Graph Viewer are both `topic-below-post-stream` connectors
that each call `findRelated(topic)` directly; Document Relationships and Knowledge Graph Viewer both
call `getRelationships(topic)` directly. Before this fix, that meant a real doubled cost every time:
`findRelated()` re-ran its category-topics fetch plus one tag-topics fetch per tag (genuine duplicate
network requests, the most expensive resource on this list); `getRelationships()` re-ran its
declaration-regex scan over the document body plus every declared document's citation lookup. Both
now cache their Promise per topic id — the same Promise-as-cache-value technique
`ddi-citation-preview.js` already established, applied here instead of a second bespoke
implementation. Safe to cache for the session: a topic's own declared relationships and candidate
related documents can't change within one page view, and neither underlying async chain can reject
(every internal fetch already `.catch()`s to an empty/null fallback), so there's no risk of a
permanently-cached rejected Promise poisoning later callers.

**`ddi-reading-lists.js` was fetching a document's full `/t/{id}.json` a second time for reading
time — once implicitly via Citation Preview, once explicitly via its own uncached fetch — and
re-fetching it for *every* document in a list on *every* mutation, not just the one that changed.**
`_loadActiveListDetails()` re-resolves the entire list's documents on open, on adding one document,
and on removing one document; each resolution called `_resolveReadingTime()`, which had its own
uncached `ajax('/t/{id}.json')` call with no memory of a previous fetch. Added a `Map` cache keyed by
document id, so a list mutation only pays for the documents actually affected, not the whole list
again. On failure, the cache entry is deleted rather than left holding a permanent "0 minutes" —
same reasoning `ddi-citation-preview.js`'s own cache already uses for the identical failure case, so
a transient network hiccup doesn't stick a document at the wrong reading time for the rest of the
session. (The very first fetch for a brand-new document is still two separate requests to the same
endpoint — Citation Preview's return shape has no `readingTime` field to reuse directly, and giving
it one, or building a second shared "raw topic" cache, would be more surface area than this fix's
actual, repeated-reload cost justifies; left as a small, named, deliberately-unfixed residual rather
than resolved further.)

**Command Palette's search input had no debounce — every keystroke ran a full filter pass over the
cached document list plus a full result-row DOM rebuild.** For a fast typist that's one full pass per
character rather than roughly one per completed word, and the cost scales with archive size (the
explicit "large archive scalability" concern this audit was asked to cover). Input now goes through a
120ms debounce (`scheduleRefresh()`), short enough that the palette still feels instant. The one
correctness wrinkle a debounce introduces — Enter pressed quickly enough after typing could otherwise
activate the *previous* query's top result, not the one matching what's actually in the input — is
handled explicitly: if a refresh is still pending when Enter fires, it's flushed immediately (query
resolved fresh, then activated) rather than left to race the timer. Also clears any pending timer on
`close()`, so a debounced refresh never fires into a closed dialog.

**`ddi-search-results.js`'s `MutationObserver` re-scanned the entire results container on every
mutation, including ones its own writes caused — O(n²) in result count, not O(n).** Each
`decorateResult()` call prepends a badge row, which is itself a childList mutation; the observer was
re-running `decorateVisibleResults()` (a full `container.querySelectorAll()`) from its own callback,
so a page streaming in n results (infinite scroll) did roughly n full-container re-scans, each larger
than the last — confirmed by simulation: 1,275 total nodes visited scanning 50 results the old way,
against a container that grows on every pass, versus 0 extra nodes visited processing each mutation's
own `addedNodes` directly the new way. `decorateResult()` was already idempotent (the
`dataset.ddiSearchDecorated` guard), so the old behavior was correct, just wastefully re-checking
already-decorated rows on every single mutation — this is a pure complexity fix, not a behavior
change.

**Considered and deliberately not cached: `ddi-integrity-dashboard.js#_scanArchive()`.** Opening
Integrity Dashboard or System Status Dashboard triggers a full archive scan — one `/t/{id}.json`
fetch per document — with no caching, and re-opening either dialog re-scans the entire archive from
scratch every time, including the "System Status → click a stat tile to drill into Integrity
Dashboard" flow this theme's own UI explicitly encourages. This looks like the same class of fix as
the two services above, but isn't: this dashboard's entire purpose is surfacing the archive's
*current* metadata problems so staff can fix them, and the most likely reason to reopen it is to
confirm a just-made fix actually took effect. Caching the scan — even briefly — risks showing stale
"still broken" results in exactly that check-my-fix-worked moment, which would be a functional
regression disguised as a performance win. No change made; documented here so the omission reads as
a considered decision, not a gap the audit missed.

**Verified directly, not just reasoned about.** Every changed function's public signature and return
value are unchanged; behavior was exercised via mocked simulations (no `jsdom` dependency in this
repo, consistent with how this project has verified DOM-touching code throughout): the metadata/
related-intelligence/relationship/reading-time caches were checked for identical results on a
same-key repeat call, correct results on a different-key call, and (reading time specifically) that a
failed fetch doesn't permanently poison later attempts; the cooked-HTML LRU cache was checked for
cache hits, eviction past its 30-entry cap, and that a recently-touched entry survives eviction that
an untouched peer from the same generation doesn't; the debounce was checked for collapsing a rapid
typing burst into exactly one refresh reflecting the final query, and for Enter mid-burst correctly
flushing and activating the just-typed query's result rather than a stale one; the search-results
observer fix was checked for identical end-state decoration (every result still gets exactly one
badge row) with zero wasted node visits instead of a quadratically-growing count. A benchmark
simulating 13 same-topic metadata calls interleaved with a 200-document archive scan (the realistic
shape of a topic page whose staff member opens Integrity Dashboard mid-load) showed the `Map` cache
eliminating 12 of 13 redundant re-resolves in that scenario, a 61% reduction in simulated wall-clock
time — a specific, reproducible number from this repo's own mocked benchmark, not a live-browser
measurement.

### Archive Browsing Performance Pass (v1.1)

A second, more targeted pass across the 10 archive-browsing surfaces named in this task (Homepage
Dashboard, Browse Archive, Timeline, Search decoration, Knowledge Graph, Citation Preview, Related
Documents, Reading Lists, Favorites, Command Palette) — most already covered by the pass above, but
two new features shipped since it ran (Browse Archive's merge, Document Author Assistant) and one
real gap in that pass's own scope (`getCitation()`, as opposed to `getCitationById()`) had never
actually been exercised.

**The one real finding, and it was bigger than it first looked: `ddi-citation-preview.js#getCitation(topic)`
wrote to its own cache but never read from it.** Only `getCitationById(documentId)` actually
benefited from a repeat call; `getCitation(topic)` — called directly by
`ddi-intelligence-index.js#getIndex()` for *every* topic in the archive, and by
`ddi-related-intelligence.js` for its top 5 ranked candidates — rebuilt the full citation object
from scratch every single time, including `_resolveRevision()`'s own `/t/{id}.json` fallback fetch
(real for every topic sourced from `/latest.json`, which never carries `post_stream`). That alone
would just be "the metadata Map cache's shape, applied inconsistently," but `getIndex()` itself
also has no caching of its own, and it's called with the same filters, on the same page view, by
far more consumers than its own file suggests:

- **Browse Archive** and **Intelligence Dashboard** — both directly on the homepage/category pages.
- **Division Cards** and **Division Header** — both on a category page, `Division Cards` alone
  calling `getIndex({ department: X })` once *per division* (6 calls) on the `/categories` index.
- **Archive Navigation** — on *every single topic page view*, for Previous/Next/Recently Updated.

Since `_buildIndex()` always maps every topic in the archive through `getCitation()` before
filtering (filtering happens after, not before), each of those callers was independently paying the
full archive-wide cost — meaning the `/categories` index page alone, via Division Cards' 6
per-division calls, triggered 6 full passes over the entire archive's citations before this fix.

**Fix: both services now read through the exact cache-Map pattern already established everywhere
else in this codebase** (`ddiArchive.getTopics()`, `ddiRelatedIntelligence`, `ddiRelationship`) —
store the in-flight/resolved Promise itself, keyed by identity, check-then-set on every entry
point, no new caching mechanism invented:

- `ddi-citation-preview.js`: the actual citation-building logic was extracted, unchanged, into
  `_buildCitation(topic)`; `getCitation(topic)` and `getCitationById(documentId)` now both
  check-and-populate the *same* `Map`, keyed by topic id either way — so a document resolved via
  one entry point is warm for the other too. `_loadCitationById()` calls `_buildCitation()`
  directly rather than `this.getCitation()` — calling back into `getCitation()` would have
  re-entered a cache key `getCitationById()` had already claimed with its own in-flight Promise
  before `_loadCitationById()` even started, deadlocking on a Promise awaiting itself. Verified this
  doesn't deadlock in any call ordering (`getCitationById` then `getCitation`, the reverse, and both
  concurrently in the same tick) via a mocked simulation with a timeout-based deadlock detector.
- `ddi-intelligence-index.js`: `getIndex(filters)` now checks a `Map` keyed by
  `` `${department}::${classification}` `` (the only two dimensions `filterDocuments()` supports;
  no caller passes `classification` today, included anyway for correctness) before running
  `_buildIndex()`, the unchanged original body. Two different filter keys still each run their own
  `_buildIndex()` pass (genuinely different result sets), but since `getCitation()` is now cached
  per topic id *globally*, the second distinct filter's pass finds every topic's citation already
  warm from the first — only the actual archive-wide citation-building work is shared, not the
  smaller per-filter sort/scan.

**One accepted tradeoff, stated plainly rather than left implicit: `revision` is now frozen for the
session the first time any topic is resolved, the same way every other citation field already was.**
Before this fix, `getCitation()`'s callers (`getIndex()`, `findRelated()`) happened to see a fresh
`/t/{id}.json`-sourced revision on every call, while `getCitationById()`'s callers (Reading Lists,
Favorites, Related Documents, Command Palette's Recently Viewed) had *always* seen a
frozen-for-session revision, since that path already cached. This fix doesn't introduce a new
staleness policy — it resolves an inconsistency where two entry points into the same cache offered
two different freshness guarantees, in favor of the one already established, documented, and relied
upon everywhere else (`getTopics()`, `getMetadata()`, `findRelated()`, `getRelationships()` are all
"cache for the session, no invalidation" already). A document's revision changing mid-session
without a full page reload, from another user's concurrent edit, was already an edge case no other
part of this theme refreshes for.

**Considered and deliberately left alone: Favorites.** `ddi-favorites.js#getFavorites()` has no
cache, same as before this pass. Unlike Citation Preview/Intelligence Index, this is the *correct*
choice, not a gap — bookmark state changes from multiple independent surfaces this theme doesn't
control (Document Actions' toggle, Discourse's own native post menu, the Favorites/Command Palette
panels' own remove buttons), and every one of those needs the next `getFavorites()` call to reflect
what actually just happened, not a session-frozen snapshot. Same reasoning class as the prior pass's
own "deliberately not cached" call on the Integrity Dashboard's archive scan.

**Everything else in scope was already correct.** Command Palette (debounced, capped result counts,
`allDocuments`/`allDepartments` already memoized once per page load, dialog DOM/listeners built
exactly once via `ensureDialog()`/`ensureFavoritesDialog()` guards) and Search decoration's
`MutationObserver` (already O(results), disconnected and recreated on every `api.onPageChange()`)
were both already fixed by the pass above and re-verified unchanged. Knowledge Graph (service and
Viewer connector) composes entirely on top of already-cached primitives
(`ddiRelationship`/`ddiRelatedIntelligence`/`ddiCitationPreview`/the cooked-HTML LRU) and is called
at most once per topic page view — adding a cache at that layer too would be caching a call that
never repeats, the premature-optimization case this task explicitly warned against. Reading Lists'
own reading-time `Map` cache (prior pass) is untouched and unaffected. No `MutationObserver`, event
listener, or lifecycle hook was added, removed, or modified by this pass — the fix is entirely at
the service-cache layer, so **verifying cleanup of listeners/observers reduces to confirming none
were touched**, which a repository-wide diff review confirmed.

**Verified directly.** Deadlock-safety of the `getCitation()`/`getCitationById()` merge (above). A
mocked before/after simulation of a mixed page view (3 no-filter + 2 same-department `getIndex()`
calls, 500-document archive) showed revision fetches and citation rebuilds both dropping from 2,500
to 500 — an 80% reduction — with `getIndex()`'s own build count dropping from 5 to 2 (one per
distinct filter key, correctly not over-merged). A second simulation of Division Cards' actual
6-division `/categories` page load showed revision fetches dropping from 3,000 to 500 — an 83%
reduction — while `getIndex()` itself still correctly ran once per division (6 genuinely different
result sets), confirming the fix shares the expensive citation-building work without incorrectly
merging distinct filtered result sets. Cache correctness: different filter keys verified to still
return their own correct, independently-filtered results, not a merged or crossed one. No stale
data beyond the one documented, accepted revision tradeoff above. `check-unused-imports.py`/
`check-orphan-exports.py` re-run clean; `node --check` clean on all 74 theme JS files. No CSS,
markup, or connector `args`/return shape changed — every fix is internal to the two services' own
`Map` caches.

## Document Actions

The first v1.1 feature: a compact action bar — Add to Reading List, Add/Remove Favorite, Open
Knowledge Graph, Share Document — rendered near the Dossier Header
(`connectors/topic-above-post-stream/ddi-document-actions.*`). Built directly from the Post-Release
Product Review's own findings, not a generic addition: three of its four actions exist specifically
to close friction that review named concretely (Reading Lists had no way to add the document you're
currently viewing without leaving the page to copy its ID; Command Palette couldn't reach Reading
Lists, Timeline, or the staff tools; there was no single place to act on the current document at all).

**Every action reuses an existing service unchanged — this is a new surface over old capability, not
a new capability.** No new storage, no new document-lookup code, no new fetch logic anywhere in this
feature.

- **Add to Reading List** calls `ddiReadingLists.addDocument(listId, String(topic.id))` /
  `removeDocument(listId, topic.id)` directly — the exact methods the Reading Lists dialog itself
  uses. The only new code is `lib/ddi-document-actions.js#buildReadingListOptions()`, a pure
  presentation-shaping function (list name + "is the current document already in it") that plays the
  same role for this dropdown that `lib/ddi-timeline-view.js#groupDocumentsByYear()` plays for
  Timeline — reshaping already-fetched service data for a template, not fetching or storing anything
  new. Reading `ddiReadingLists.lists` directly in the template (not copied into local component
  state) means the dropdown and the full Reading Lists dialog can never disagree about what lists
  exist. Zero lists, or wanting the full create/rename/share experience, both route to the *existing*
  dialog via `ddiReadingLists.open()` rather than a second, smaller create-list form.
- **Add/Remove Favorite** reuses `ddiFavorites.getFavorites()` / `removeFavorite(bookmarkId)`
  unchanged for removal — the exact pair the Favorites Panel already uses. There is deliberately no
  new "add" implementation: `ddi-favorites.js` never built one, by design, relying entirely on
  Discourse's own native bookmark UI (see **Favorites Panel** above) — this feature follows that same
  discipline rather than inventing a parallel bookmark-creation path. **Confidence caveat:** the "can
  this document be favorited" check and the add action itself feature-detect
  `post.toggleBookmark`/`post.toggleBookmarkWithReminder` on the topic's first post — the method the
  native bookmark button itself is believed to call, based on general knowledge of Discourse's
  client-side API, the same class of caveat already flagged for `addKeyboardShortcut` (see **Command
  Palette**) and not confirmed against a live instance. If neither method exists, Add Favorite simply
  isn't offered (an unfavorited document with no detected toggle shows neither button) rather than
  risking a broken or duplicate bookmark flow — "hide what doesn't work" applied literally. On
  success, this component deliberately does **not** optimistically flip its own `isFavorited` flag:
  the native toggle may itself open a reminder dialog, so this component can't reliably know the
  outcome inline, and claims it can't verify — the topic model's own `bookmarked` field (read
  directly, no new fetch — the same "already-loaded model field" reuse `ddi-document-metadata.js`
  applies to `topic.closed` elsewhere) is trusted again on the next page visit instead.
- **Open Knowledge Graph** does not call `ddiKnowledgeGraph.getDocumentGraph()` a second time — doing
  so would duplicate the exact graph-building work the Knowledge Graph Viewer connector already does
  for this same topic. Instead it scroll-anchors to that connector's own existing output: its outer
  `.ddi-card` (in `ddi-knowledge-graph.hbs`) gained one `id="ddi-knowledge-graph-viewer"` attribute —
  a markup-only addition, no behavior change to that connector — and this action is
  `document.getElementById("ddi-knowledge-graph-viewer")?.scrollIntoView(...)`. That element always
  renders when the feature setting is on, whether or not this specific document has any
  relationships (the "NO DOCUMENT RELATIONSHIPS FOUND" empty state lives inside the same wrapper), so
  the action is shown whenever `ddi_knowledge_graph_viewer_enabled` is on — checked once, synchronously,
  with no risk of racing the Viewer's own async load, unlike checking "does this document actually
  have relationships" would have required.
- **Share Document** copies the document's own canonical URL — `topic.slug ? /t/{slug}/{id} :
  /t/{id}`, the identical inline formula `ddi-citation-preview.js`, `ddi-knowledge-graph.js`, and
  `ddi-integrity-dashboard.js` already each compute the same way, matched here rather than diverged
  from or extracted into a new shared helper (extracting one wasn't asked for and would be a fourth
  duplicate site's problem to solve, not this feature's). Uses the identical
  `navigator.clipboard.writeText()` + raw-URL-fallback-on-failure pattern `ddi-reading-lists.js`'s own
  `shareList()` already established, not a second implementation of "copy this text."

**Visibility is settings- and state-driven, checked synchronously wherever possible, to avoid both
async races and duplicate fetches.** A new `ddi_document_actions_enabled` setting (default on) gates
the whole bar, matching every other DDI panel's own settings convention. Within it: Add to Reading
List follows `ddi_reading_lists_enabled`; the Favorite action is hidden entirely for logged-out users
(bookmarks are inherently a logged-in Discourse feature) and further limited to Remove-only when no
add mechanism was detected; Open Knowledge Graph follows `ddi_knowledge_graph_viewer_enabled`; Share
is always available (clipboard failure degrades to a visible link rather than hiding the button, the
same choice Reading Lists' own Share already makes).

**Guards every async action against a destroyed component before calling `set()`** —
`toggleFavorite()`, `share()`, and `toggleReadingListMembership()` all check
`this.isDestroying || this.isDestroyed` after their awaits, the exact convention this project's own
`CODING_STANDARDS.md` documents and the one gap the v1.0 RC audit found and fixed elsewhere
(`ddi-reading-lists.js`'s `share()` action) — not repeated here.

**Known, accepted limitation.** The reading-list picker is a lightweight inline dropdown, not a full
`role="menu"` widget — it carries real ARIA (`aria-haspopup`, `aria-expanded`,
`role="menuitemcheckbox"`/`aria-checked` per item) and closes on any selection or on re-clicking its
own trigger, but doesn't implement roving-tabindex arrow-key navigation or an Escape-to-close
handler the way the five full dialogs (see **Modal Accessibility**) do. Standard Tab-order navigation
between its items works regardless. Judged proportionate for a small inline disclosure widget rather
than pulling in the full modal-dialog accessibility machinery built for actual backdrop dialogs — a
deliberate scope decision, not an oversight.

**Verified directly.** `lib/ddi-document-actions.js#buildReadingListOptions()` was exercised directly
(membership true/false per list, empty/null input); every connector action was mirrored against
mocked services (no live Ember runtime available) covering: reading-list add/remove call the correct
existing service method with the correct argument type (string for `addDocument`, matching what
`parseDocumentId()` expects; number for `removeDocument`, matching `documentIds`' own stored type);
favorite removal's found/not-found/server-failure paths; favorite add's toggle-present/absent/
throwing paths, confirming no optimistic state flip on success; share's clipboard success/failure
paths; the Knowledge Graph anchor scroll no-ops safely when the target element is absent; and that no
action calls `set()` after the component starts destroying mid-await.

## Deprecated Template Actions

A maintenance pass fixing a real Discourse admin warning (`discourse.template-action`): the classic
`{{action "name" arg1 arg2}}` template helper is deprecated across current Discourse, in favor of the
`{{on "click" ...}}` modifier (an event listener, not Ember's action-dispatch mechanism) combined with
the `{{fn}}` helper for partial application of arguments. Every one of this theme's 28 `{{action}}`
usages, across the six connectors that have any interactive buttons — Knowledge Graph Viewer, Intelligence
Timeline, Document Integrity Dashboard, Reading Lists, DDI System Status Dashboard, and Document
Actions — was replaced. **Pure syntax migration: no button's visible behavior, click target, or
keyboard reachability changed.** Every replaced button was already a real `<button type="button">`
(confirmed by inspecting each of the 28 call sites individually before touching any of them, not
assumed) — `type="button"` has no native browser default action for a click to begin with, so
`{{action}}`'s implicit `preventDefault()` was already a no-op everywhere it was used, and dropping it
in favor of `{{on}}` (which doesn't auto-`preventDefault()`) changes nothing observable. Keyboard
activation (Enter/Space on a focused button) is native `<button>` behavior, unrelated to which
JavaScript API wires up the click handler, so it's unaffected either way.

**The real work wasn't the template syntax — it was that `{{action}}`'s automatic `this`-binding had
no replacement, and every action method's body relied on it.** `{{action "foo"}}` looks up `foo` in
a connector's `actions: {}` hash and invokes it with `this` bound to the component; `{{on "click"
this.foo}}` requires `foo` to be a plain, already-bound function property on the component, and
invokes it as a native DOM event listener would — `this` inside it is whatever the function's own
closure captured, nothing more. Every migrated action already had a direct precedent for this exact
constraint already established in this codebase: `{{did-insert}}`/`{{did-update}}`/`{{will-destroy}}`
have carried the identical "you get the element, not a bound `this`" guarantee since the Knowledge
Graph Viewer's `setupGraphCanvas` first ran into it, and every connector since (Modal Accessibility's
`setupModal`, Document Actions' whole action set) has used the same fix: close over `component`
(and, where one was already captured, the relevant service — `ddiReadingLists`, `ddiIntegrityDashboard`,
etc.) directly, instead of relying on any binding the invocation mechanism provides. Migrating
`{{action}}` away applied that exact, already-proven pattern to the last places still relying on the
opposite guarantee, rather than introducing a new one.

**Every action method's body is otherwise byte-for-byte the same logic, `this.` renamed to
`component.` (or the captured local variable it already pointed at) and nothing else** — confirmed by
grepping every touched file afterward for a stray `this.` that should have been renamed and finding
none (only comments mentioning `this.`/`{{action}}` remain, explaining the migration itself). No
conditional, no service call, no argument, and no async/await/error-handling path changed. Reading
Lists' `share(listId)` — one of the more involved ones, an async method with an `isDestroying`/
`isDestroyed` guard inside a `.then()` callback — is representative: the guard, the three branches
(no url / copied / clipboard-denied-but-url-shown), and the exact message strings are all unchanged;
only `this.set(...)`/`this.isDestroying` became `component.set(...)`/`component.isDestroying`.

**Argument passing is identical, via `{{fn}}`.** `{{action "toggleYear" entry.year}}` called
`toggleYear(entry.year, event)`; `{{on "click" (fn this.toggleYear entry.year)}}` calls the exact same
`toggleYear(entry.year, event)` — `{{fn}}` partially applies its own arguments first, then the
listener appends whatever the browser passes (the click event), the same order `{{action}}` already
used. No action method needed a signature change; every one already ignored the trailing event
argument it was implicitly receiving before, the same as it does now.

**Verified directly**, not just by inspection: every touched file re-confirmed syntactically valid;
zero remaining `{{action}}`/`action=`/`(action ...)` occurrences anywhere in the repository (a
second, repository-wide grep after the fact, not just within the six files known to be touched); zero
stray `this.` left in any migrated closure; the `{{fn}}` partial-application semantics themselves
mocked and confirmed to pass arguments in the same order `{{action}}` did; and the trickiest migrated
actions (Reading Lists' async `toggleReadingListMembership`/`share` with their `isDestroying` guards,
Document Actions' `toggleFavorite`, System Status's cross-dialog `openIntegrityDashboard` handoff,
Knowledge Graph's `resetView` reaching through `component.element`) individually re-verified against
mocked components to confirm identical outcomes to their pre-migration behavior.

## Browse Archive (Homepage UX Cleanup, v1.1)

A homepage/category-page UX pass, not a feature — the requested reading order was Search ↓
Archive Summary ↓ Recent Activity ↓ Browse Archive, and the theme already produced that order
(Discourse's native Search Banner and topic list, then Intelligence Dashboard on
`discovery-list-container-top`, then two `below-main-container` cards). What undercut it was the
last step showing the same document set twice in a row, in two different orders, with no framing
for why: Intelligence Index (alphabetical) immediately followed by Intelligence Timeline
(year-grouped) read as redundant rather than as two deliberate browsing modes.

**The fix: merge the two into one "Browse Archive" section with a tab switcher**, rather than
reorder, hide, or cut either view — both were explicitly required to stay
(`ddi_intelligence_index_enabled` / `ddi_timeline_view_enabled` still independently gate their own
tab; see **Intelligence Index** and **Intelligence Timeline** above for everything about each
view's own logic, which is unchanged). `connectors/below-main-container/ddi-timeline-view.js`/
`.hbs` and `ddi-intelligence-index.js`/`.hbs` are retired; `connectors/below-main-container/
ddi-browse-archive.js`/`.hbs` replaces both.

**A UX fix that also happened to remove a real duplicate service call — not just visual
deduplication.** Both retired connectors independently called `service:ddi-intelligence-index`'s
`getIndex(department ? { department } : {})` with identical arguments on every homepage/category
render. The merged connector calls it exactly once and derives both the alphabetical `documents`
array (used as-is, already sorted) and the year-grouped `years` array
(`groupDocumentsByYear(documents)`, from the untouched `lib/ddi-timeline-view.js`) from that one
result. This is the same "one fetch, multiple derived views" shape already established elsewhere
in this codebase (Intelligence Index's own service maps one `getIndex()` result through Citation
Preview for every consumer) — merging the two former connectors made a data-flow duplication that
already existed structurally impossible to keep, not just visually redundant.

**Tab state, not route or setting state.** Which tab is active lives on the connector component
(`activeTab`/`isYearTabActive`/`isIndexTabActive`, set via a `setTab(tab)` closure), defaulting to
"By Year" if that view is enabled, else "All Documents." If only one of the two settings is on,
`showTabs` is false and that view renders directly with no switcher — an admin who had disabled
one view before this merge sees exactly what they saw before, just without the empty second card
that used to sit above or below it.

**ARIA tabs pattern**, matching the standard tabs design pattern rather than inventing bespoke
semantics: the tab bar is `role="tablist"` with an `aria-label`; each tab button is `role="tab"`
with a stable `id`, `aria-selected` (a pre-computed boolean template property, not the `eq` helper
— `ember-truth-helpers`' availability in this bare theme is unconfirmed, the same reasoning already
applied to every other conditional in this codebase), and `aria-controls` pointing at its panel's
`id`; each panel is `role="tabpanel"` with `aria-labelledby` pointing back at its tab. Full
roving-tabindex arrow-key tab navigation was deliberately scoped out as disproportionate for a
2-option switcher — Tab/Shift+Tab already reaches both buttons in document order, and each is
natively activatable via click or Enter/Space like any other button in this theme; this is a
scope decision, not an oversight.

**Fixed a dependency the merge would otherwise have silently broken.** Command Palette's "Open
Timeline" entry (see **Command Palette Expansion (v1.1)** above) scrolled to
`#ddi-timeline-view`, an id that only existed on the now-deleted `ddi-timeline-view.hbs`. Found via
a repository-wide `grep` for that id before deleting anything, not discovered after the fact. The
entry is now "Browse Archive," gated on either underlying setting instead of just the timeline
one, scrolls to the merged component's `#ddi-browse-archive` id, and its `special` dispatch value
changed from `"timeline"` to `"browse-archive"` end to end (palette entry, `activate()`'s switch,
and the renamed `openBrowseArchive()` helper) — a required fix to avoid shipping a silently dead
keyboard-navigable action, not new Command Palette work.

**No new CSS beyond the tab bar itself.** `.ddi-browse-archive-tabs`/`.ddi-browse-archive-tab`/
`.ddi-browse-archive-tab-active` are the only new rules; every other class each view's markup uses
(`.ddi-card`, `.ddi-toc-item`, `.ddi-dossier-grid`, `.ddi-timeline-year*`, `.ddi-favorites-grid`)
is copied verbatim from the two retired templates with zero changes, confirmed via `sass` compiling
`common/common.scss` cleanly. Neither retired wrapper class (`.ddi-timeline-view`,
`.ddi-intelligence-index`) carried any dedicated CSS of its own, confirmed by grep before deletion,
so nothing was orphaned by removing them.

**Verified directly.** No duplicate logic: confirmed exactly one `getIndex()` call per render via
the merged connector's source, and that both `lib/ddi-route-guard.js#isExcludedRoute()` and
`lib/ddi-timeline-view.js#groupDocumentsByYear()` are reused unmodified rather than reimplemented.
Accessibility: the tab pattern above matched against the standard ARIA tabs authoring practice;
`aria-selected`/`aria-controls`/`aria-labelledby` cross-references checked by hand for every
id/target pair. Responsive layout: reused the theme's existing mobile audit methodology (320/375/
768/1024px content-width checks against `#main-outlet`'s 80px outlet chrome and `.ddi-card`'s
18px/28px padding) — the tab bar's two buttons were checked against the narrowest viewport's
content width and given `flex-wrap: wrap` defensively, since both existing card bodies' own layouts
were already verified responsive before this merge and are unchanged. Dead code: both
`check-unused-imports.py` and `check-orphan-exports.py` re-run after deletion found nothing
orphaned; `ddi-command-palette.js`'s remaining "Timeline" mentions confirmed all intentional
(comments explaining the rename, not stale references). Syntax: `node --check` clean on the new
connector and every touched file; `settings.yml` re-validated as valid YAML.

## Document Author Assistant

A lightweight, composer-time guidance panel — not a workflow engine, not a gate. While an author is
creating a new topic or editing an existing document's first post, it lists 9 fixed items plus up to
4 more revision-table items (v1.7, only shown once a revision table exists — see below) and marks
each ✓ Valid or ⚠ Needs attention as the draft changes: Document Number, Classification, Department,
Document Type, Lifecycle, Executive Summary, H2 Sections, Cross References, Related Documents, and
(conditionally) Revision Table, Revision Numbers, Revision Order, Revision Summaries. It never blocks
publishing and never rewrites anything the author typed — pure read-only feedback, consistent with
`ddi-document-metadata-standard.md`'s own fields.

**First feature in this theme to touch the composer at all.** Every prior connector reads from a
published topic (`args.model`, a `Topic`); a draft has no topic yet if the author is creating one,
and no cooked HTML either way (Discourse hasn't re-rendered the preview from what's currently
typed). `connectors/composer-fields/ddi-document-author-assistant.js` looks up `service:composer`
directly (the same `getOwner(component).lookup(...)` pattern every other connector already uses)
rather than trusting the `composer-fields` outlet's own `args` shape, which is the safer of the two
paths this codebase already prefers when in doubt.

**Confidence caveat**, the same class already carried elsewhere in this theme (Post's
`toggleBookmark`/`toggleBookmarkWithReminder` feature-detection, `addKeyboardShortcut`): the
Composer model's `creatingTopic`/`editingPost`/`editingFirstPost` properties are long-standing,
widely-used Discourse APIs, but unconfirmed against a live instance, since nothing in this theme
had touched the composer before now. `isDocumentComposerContext()` treats `editingFirstPost` as
authoritative when present, and falls back to `post.post_number === 1` (the same condition
`editingFirstPost` is documented to compute) if it's ever absent — degrading to the same answer
rather than guessing. A reply (not editing the first post) never shows the panel.

**Reuses every validation library the task named, none reimplemented.**
`lib/ddi-integrity.js`'s `checkClassification`/`checkDepartment`/`checkDocumentType`/
`checkLifecycle` — the exact functions the topic-page Verification Panel
(`connectors/topic-below-post-stream/ddi-verification-panel.js`) already renders via
`verifyDocumentIntegrity()` — are now individually exported (purely additive; `verifyDocumentIntegrity()`
and every existing caller are unchanged) and called directly against a small adapter object built
from composer state (`lib/ddi-document-author-assistant.js#buildAuthorAssistantChecks()`), shaped
the same way `services/ddi-document-metadata.js#_resolve()` shapes a real topic's metadata. Cross
References and Related Documents call `findDocumentReferences()`/`findDocumentRelationships()`
(`lib/ddi-cross-reference.js`, `lib/ddi-relationship.js`) directly against the raw draft body —
the same parsers Document Relationships/Knowledge Graph already use against a published post's
`textContent`, just against markdown instead, which these two regex-based parsers don't need HTML
for in the first place. Document Number reuses `formatDocumentId()` (`lib/ddi-document-id.js`).

**Two checks with no existing library, kept new and minimal on purpose.** Executive Summary and H2
Sections have no dedicated pure function to reuse — the closest precedent
(`connectors/topic-above-posts/ddi-executive-summary.js`'s own `doc.querySelector("p")`,
`connectors/topic-above-posts/ddi-document-toc.js`'s own `.cooked h2` query) is each a one-line
inline DOM query on cooked HTML a draft doesn't have, not something already factored out as
reusable. Cooking the draft client-side just to reuse those cooked-HTML queries would have added a
new dependency (and async timing) for no real benefit, since both checks reduce to simple raw-
Markdown line matching: a non-blank, non-heading, non-list-item line (Executive Summary) and a
`^##\s` line (H2 Sections, the same `##`→`h2` convention `ddi-document-toc.js` already relies on).
Both are synchronous, pure, and live in `lib/ddi-document-author-assistant.js` alongside everything
else this feature adds.

**Cross References/Related Documents are a soft completeness nudge, not a hard requirement.**
Unlike the other 7 checks, a document can legitimately have zero of either — `findDocumentReferences`/
`findDocumentRelationships` never enforce a minimum. These two rows use the same ✓/⚠ presentation
anyway (≥1 found → valid) because most DDI documents are expected to participate in the archive's
cross-reference/relationship network (`docs/ddi-intelligence-network.md`), so their absence is
worth surfacing even though it's never actually wrong — consistent with "do not block publishing,"
since the panel only ever displays a status, it never prevents the reply from being submitted.

**Real-time updates via Ember's classic observer API, not polling or DOM scraping.** The Composer
model is a classic `EmberObject`-style model, not a Glimmer-tracked one, so template bindings alone
wouldn't re-run the checks as the author types. `addObserver`/`removeObserver`
(`@ember/object/observers`) on `reply`/`title`/`categoryId`/`tags` recompute the full check list on
every change and are torn down via `{{will-destroy this.teardown}}` — the same did-insert/
did-update/will-destroy free-function lifecycle pattern already established for Knowledge Graph
Viewer's `setupGraphCanvas`/`teardownGraphCanvas` and Document Integrity Dashboard's
`setupModal`/`teardownModal`. Without the explicit teardown, every composer open/close cycle would
leave one more observer registered on the composer model, which outlives any single connector
instance.

**Deduplicated during implementation, not left in.** `lib/ddi-integrity.js`'s private `result()`
formatter (builds the `{ field, status, statusClass, detail }` shape every check returns) was
exported and reused rather than copied a second time into the new lib — caught and fixed before
this task's own "remove duplicate validation logic" verification step, not after.

**Visual language reused, not reinvented.** `.ddi-card`/`.ddi-card-title` (the same shell every
other DDI panel uses) and `.ddi-integrity-pass`/`.ddi-integrity-warn` (the same status colors the
Verification Panel already uses for PASS/WARN) are reused verbatim; only a compact single-column
checklist row layout (`.ddi-author-assistant-list/-item/-icon/-field/-status`) is new, since
composer real estate is far narrower than a full-width homepage/topic-page card — the existing
`.ddi-intel-grid` 3-column layout that shape of data usually uses would be cramped here. The panel
shows ✓/⚠ plus the field name only, per the task's "simply display" spec; each row's `title`
attribute carries the longer detail message as a native hover tooltip rather than always-visible
text, so the panel stays compact without hiding the explanation entirely.

**Verified directly.** Every one of the 9 checks exercised against mocked composer drafts: a
completely empty draft (no args at all — must not throw), a blank new-topic draft (every check
WARNs), a fully valid existing-document edit (every check PASSes, including that Document Number
formats via `formatDocumentId`), a partially-filled draft, a heading-only body (Executive Summary
WARNs, H2 Sections PASSes), and an unrecognized category with a junk tag. A separate simulation
mocking `addObserver`/`removeObserver` confirmed: the initial check runs exactly once on setup,
every watched-property change triggers exactly one recompute reading the latest value, category
resolution by `categoryId` works, teardown removes every observer with none left dangling, and
`isDestroying`/`isDestroyed` guards prevent any work if `recompute()` is ever invoked after
destruction. `check-unused-imports.py`/`check-orphan-exports.py` re-run clean; `node --check` clean
on all 74 theme JS files; `settings.yml`'s new `ddi_document_author_assistant_enabled` re-validated
as YAML; `sass` compiles `common/common.scss` cleanly.

## Homepage Hero (v1.2)

The first thing a visitor sees: a full-bleed, cinematic banner
(`connectors/above-main-container/ddi-homepage-hero.*`) above the Search Banner, Intelligence
Dashboard, and everything else on the true homepage. Background image, dark gradient overlay, the
site's logo, "DDI Intelligence Archive" as the page's one `<h1>`, an optional subtitle, three
headline archive statistics (Total Documents, Divisions, Classification Levels), and two actions
(Browse Archive, View Divisions).

**Same connector file as Mission Briefing (v1.2), by deliberate choice, not scope creep.** Discourse
doesn't document (and this theme has never needed to rely on) a guaranteed render order between
multiple connectors registered to the *same* outlet — and Mission Briefing's one hard requirement is
rendering directly beneath the Hero. Rather than add a second `above-main-container` connector and
trust an unconfirmed ordering assumption, Mission Briefing's markup lives in the same template,
immediately after the Hero's own closing tag — plain sequential HTML, order guaranteed by
construction. `shouldRender()` now mirrors `ddi-browse-archive.js`'s own two-setting shape (mount if
*either* `ddi_homepage_hero_enabled` or `ddi_mission_briefing_enabled` is on); each section then
gates itself independently via its own `show*` property, so either can be toggled off without
affecting the other. This is the one place in the file this bends "one connector, one concern" — see
**Mission Briefing (v1.2)** below for that section's own details.

**Genuinely full-bleed by construction, not by a CSS override fighting a constrained parent.**
`above-main-container` — the same outlet Reading Lists/Integrity Dashboard/System Status's trigger
buttons already use — renders as a sibling *before* `#main-outlet` opens, not nested inside it, so
it was never subject to `#main-outlet`'s own `max-width: 1700px`/20px padding to begin with. The
`.ddi-hero`'s `width: 100vw; margin-left/right: calc(50% - 50vw)` is a defensive
belt-and-suspenders measure for if that assumption about the surrounding markup is ever wrong, not
evidence it's needed today.

**Deliberately does not reuse `.ddi-card`.** Every other DDI panel is a bordered, padded "dossier
document" box — the right metaphor for archive *content*, wrong for the one place this theme is
explicitly asked to feel cinematic and edge-to-edge. `.ddi-hero` is new, purpose-built markup, but
still pulls every color from the existing `:root` token scale (`--ddi-red`, `--ddi-red-75`,
`--ddi-bg-primary`/`-secondary`, `--ddi-text-dim`/`-muted`, `--ddi-border`/`-strong`, `--ddi-white`)
— no new literals, same internal consistency `.ddi-card` itself already has.

**Scoped narrower than Browse Archive/Intelligence Dashboard on purpose — homepage only.** Both of
those render on every non-document discovery route, including `/categories` and each individual
division page. The Hero doesn't: it hides on `/categories` (`ddiCategoryContext.isCategoriesIndexRoute()`)
and on any specific division (`ddiCategoryContext.getCurrentCategory()` truthy), reusing both checks
unmodified rather than writing a new one. Reasoning: a division page already has its own immersive,
category-specific header (**Division Header**, Division Command Center Phase 3) and `/categories`
already has **Division Cards** — a second, generic "welcome to the archive" banner stacked on top of
either would compete with content that already fills the identical "orient the visitor" role there.
`isExcludedRoute()` (`lib/ddi-route-guard.js`) still applies underneath, same as every other
archive-wide component, hiding the Hero on `topic.*`/`admin` regardless.

**Reuses the intelligence-index/archive-statistics pipeline verbatim — no new data source.**
`services/ddi-intelligence-index.js#getIndex()` (no department filter, since this only ever renders
on the unscoped homepage) feeds `lib/ddi-archive-statistics.js#buildArchiveStatistics()`, the exact
same function Intelligence Dashboard already calls; the Hero just reads 3 of its fields
(`totalDocuments`, `departments.length`, `classifications.length`) instead of rendering the full
breakdown. Since Intelligence Dashboard renders on the same homepage and calls `getIndex()` with
the same (empty) filter, the two now share one cached build via the Performance Audit's `getIndex()`
`Map` cache — whichever connector's promise resolves first pays the real cost, the other reuses it
directly. Adding a second `getIndex()` consumer to the homepage would have reintroduced exactly the
duplicate-archive-fetch problem that audit fixed, had that cache not already existed.

**"Browse Archive" is a scroll-anchor, not navigation — the same technique already established
twice.** `document.getElementById("ddi-browse-archive")?.scrollIntoView(...)` is the identical call
Document Actions' "Open Knowledge Graph" and Command Palette's "Browse Archive" entry already make
against their own respective targets; no new scroll mechanism was introduced. The button hides
itself when neither `ddi_timeline_view_enabled` nor `ddi_intelligence_index_enabled` is on — the
same gate Command Palette's own "Browse Archive" entry already uses — since Browse Archive itself
wouldn't render at all in that case, and a button that scrolls to nothing is worse than no button.
"View Divisions" is a real `<a href="/categories">`, not a click handler, so the standard browser
navigation affordances (middle-click, Ctrl/Cmd-click, right-click "open in new tab") all keep
working — "do not interfere with normal Discourse navigation" made literal rather than just avoided
by omission.

**Configurable without touching code, exactly as required.** `ddi_hero_background_image` (`type:
upload`) is this theme's first upload-type setting — Discourse resolves it to the uploaded image's
URL string when read via `settings.ddi_hero_background_image` in JS, no different in kind from how
every other `settings.x` read in this codebase already works, just a different value type. Left
empty by default: `.ddi-hero`'s own base gradient plus the overlay still render a fully intentional-
looking dark cinematic banner with zero configuration, so an admin who never uploads an image still
gets a complete, non-broken Hero — not a placeholder or a missing-image icon. `ddi_hero_subtitle`
(`type: string`, a real but non-essential tagline provided as the default) hides itself entirely
when cleared to empty, rather than rendering a blank paragraph.

**Two confidence caveats**, the same class already carried elsewhere in this theme (Post's
`toggleBookmark` feature-detection, Composer's `creatingTopic`/`editingPost` for Document Author
Assistant): `service:site-settings` is a real, long-standing Discourse service, but this is the
first time this theme has looked it up, so `siteSettings.logo_url` is unconfirmed against a live
instance — absent or falsy just hides the logo `<img>` entirely, no broken image, no crash. The
`type: upload` → resolved-URL-string behavior itself is the more solidly-established half of this
feature (a long-standing, widely-used Discourse theme mechanism, not a guess), so it's treated with
higher confidence than the site-settings lookup, not lumped in as equally uncertain.

**Lazy loading, verified as a real browser feature, not simulated.** Both the background and logo
are real `<img loading="lazy" decoding="async">` elements — not a CSS `background-image`, which has
no native lazy-loading mechanism at all and would have needed a hand-built `IntersectionObserver`
to get the same effect, exactly the kind of "unnecessary observer" this project's own audits
explicitly watch for. Using `<img>` instead sidesteps that complexity entirely: the browser's native
lazy-loading heuristic already handles "already near the viewport at load" images (this one) by
loading them without a meaningful delay, so there's no real risk to LCP from an above-the-fold image
carrying the attribute, while still making the attribute concretely present and inspectable in the
rendered markup rather than a claim with nothing to verify. Both images are decorative
(`alt="" aria-hidden="true"`) — the archive title `<h1>` and subtitle `<p>` carry the actual content
a screen reader needs, not the images.

**Collapses cleanly on mobile, not just shrinks in place.** At ≤600px (this theme's one established
breakpoint, used consistently rather than introducing a second one): `min-height` drops from 480px
to 320px so the Hero doesn't push most of a phone's viewport below the fold before any real content,
title/subtitle font sizes step down, and the 3-item stats row and 2-button action row both switch
from horizontal to stacked — a horizontal row doesn't fit labels like "Classification Levels" at
320-375px without mid-label wrapping, the same reasoning behind every other stacked-on-mobile
pattern already established in this file (Command Palette's result rows, Browse Archive's tab bar).

**Verified directly.** Route-guard matrix (topic route, admin route, `/categories`, a specific
division, and the true homepage) exercised against a mocked `setupComponent`, confirming the Hero
shows only in the last case. Graceful handling confirmed for: `site-settings.logo_url` absent
entirely, an empty archive (zero documents — stats render as 0s, not a crash), an empty background
image setting (no broken image), and an explicitly-cleared subtitle (hidden, not a blank paragraph).
`showBrowseArchiveButton`'s gate verified against both Browse Archive settings off. The
`isDestroying`/`isDestroyed` guard verified to block a stats update if the connector is torn down
before `getIndex()` resolves. `node --check` clean on the new connector; `sass` compiles
`common/common.scss` cleanly; `settings.yml` re-validated as YAML (17 settings at the time this
section was written; see **Mission Briefing (v1.2)** below for the 18th); zero new event
listeners, `MutationObserver`s, or `IntersectionObserver`s were added — the only interactivity is a
single `{{on "click"}}` (framework-managed, auto-cleaned-up on destroy, the same pattern every other
button in this codebase already uses).

## Mission Briefing (v1.2)

Directly beneath the Hero, in the same `connectors/above-main-container/ddi-homepage-hero.*`
template: a static, non-dashboard introduction to the organization — an Executive Command Welcome
message, DDI's mission statement, all six official Operational Divisions as pillar cards, and a
Mission Objectives checklist. No fetch, no parsing, no service beyond `service:site` (for building
each pillar's category URL) — genuinely static content with links, as required.

**All six divisions, exactly as this theme has always recognized them — none invented, none
renamed.** `MISSION_PILLARS` lists Executive Command, Fleet Security, Commerce/Industry/
Manufacturing, Exploration & Survey, Contract Support Services, and Public Affairs, in that order —
the same six slugs, names, and order as `lib/ddi-department.js`'s `DEPARTMENTS` array and
`docs/ddi-archive-information-architecture.md`'s category table, verified directly by extracting
the actual array from source and diffing it against `DEPARTMENTS` (equal as sets, equal in order,
no duplicates). An earlier draft of this feature's spec named a "Personnel Services" pillar that
isn't one of the six divisions this theme has ever recognized — resolved (Contract Support Services
substituted) before any code was written for that draft, and superseded entirely once the
respecified request supplied the correct, complete list of all six. Executive Command now appears
twice in this section — once as the Welcome message's attributed source, once as its own pillar
card — which is intentional: the task asked for both a dedicated "Executive Command Welcome" block
and Executive Command as one of the six "Official Operational Divisions."

**Pillar links resolve real category URLs, with a graceful fallback — not a hardcoded guess, and
never a placeholder category.** Categories are admin-provisioned, never theme-created
(`docs/ddi-archive-information-architecture.md`'s own standing caveat) — a fresh install may not
have them yet. Each pillar's `/c/{slug}/{id}` is built from `service:site`'s `categories` list, the
exact same lookup Division Cards and Command Palette already do; a pillar whose category isn't
provisioned yet links to `/categories` instead of a 404, verified directly (unprovisioned,
partially-provisioned, and fully-provisioned scenarios all produce correct, non-broken links, for
all six divisions individually).

**Reuses `.ddi-card`/`.ddi-card-title`/`.ddi-card-body`/`.ddi-nav-link`/`.ddi-division-cards-grid`/
`.ddi-integrity-pass` verbatim — deliberately, unlike the Hero.** Where the Hero explicitly avoids
`.ddi-card` (a cinematic banner, not a document), Mission Briefing is exactly the "dossier document"
content that shell was built for, and the task asked for it by name ("reuse existing DDI card
styling"). The welcome message, mission statement, and each pillar are all plain `.ddi-card`s; the
pillar grid reuses Division Cards' own `.ddi-division-cards-grid` unmodified (including its existing
mobile single-column breakpoint, and its `auto-fit`/`minmax(300px, 1fr)` column logic, which needed
no change to go from 4 cards to 6) but *without* that component's stats grid — showing document
counts here would duplicate the Dashboard, which the task explicitly ruled out — leaving just
title/description/link, a strict subset of Division Cards' own markup. The Mission Objectives
checkmarks reuse `.ddi-integrity-pass` (the Verification Panel/Document Author Assistant's existing
green-checkmark color utility) rather than a new color rule.

**Glassmorphism and hover states reuse this theme's own existing techniques, not new ones.** The
welcome, mission-statement, pillar, and objectives cards use `--ddi-bg-panel` +
`backdrop-filter: blur(4px)` + `--ddi-shadow-lg` in place of `.ddi-card`'s own near-opaque
background — the identical translucent-panel treatment `.panel`/`.topic-list`/`.search-menu`
already carry (see "DISCOURSE SURFACE PANELS"), just applied to DDI's own cards for the first time,
tying this section visually to the Hero's cinematic backdrop rather than the fully-opaque cards used
throughout the rest of the archive. Pillar cards get a hover state — `--ddi-red-65` border plus
`--ddi-shadow-glow` — reusing the exact pair `.ddi-reading-list-card:hover` and
`.select-kit.is-expanded .select-kit-header` already use; no transform/lift was added, since no
existing hover rule in this codebase uses one. Only the full-bleed outer wrapper, the content
column, the glass/hover rules, and the pillar icon are new CSS — everything else is reuse, checked
directly (a repository-wide duplicate-selector scan after implementation found nothing new).

**Real `<h2>`/`<h3>` headings, not `.ddi-card-title` `<div>`s — a deliberate, scoped exception to
this codebase's own div-only title convention**, extending the same reasoning the Hero's own `<h1>`
already established: this section is genuinely narrative, content-heavy "immersive introduction," not
a compact UI panel label, so real heading structure gives screen-reader users actual navigation value
here that it wouldn't for, say, a stat tile's label. `<h2>` for each top-level block ("Executive
Command Welcome," "DDI Mission Statement," "Official Operational Divisions," "Mission Objectives")
nests under the Hero's own `<h1>`; `<h3>` for each pillar name nests under "Official Operational
Divisions." Every heading still carries the exact `.ddi-card-title` class — same visual result,
corrected semantics, zero new CSS for the change. Icons (`★ ⚓ ⚙ ✦ ⚖ ✉`, one per pillar) and
objective checkmarks are `aria-hidden="true"`; the heading text and objective text are what a
screen reader actually announces.

**"Support dark mode"/"verify dark mode" means "look correct within this theme's existing all-dark
design system," not a light/dark toggle.** This theme has never implemented a light variant anywhere
— no `prefers-color-scheme` branch, no toggle, a single fixed dark aesthetic throughout. Building an
actual light mode would be a new, unrelated feature far outside "static organizational content."
Mission Briefing satisfies the requirement the way every other DDI panel already does: every color
comes from the existing `:root` dark-token scale, nothing hardcoded outside it.

**Shares the Hero's exact route guard, not a separate one.** Both `isVisible` (the shared route
guard) and each section's own `show*` flag gate independently — see the connector-sharing note in
**Homepage Hero (v1.2)** above. Mission Briefing renders only where the Hero does: the true
homepage, never `/categories`, a division page, a topic page, or admin.

**Lighthouse was not run — no browser tooling is available in this environment — reasoned about
directly instead of claimed.** Zero new network requests: the glassmorphism is CSS already compiled
into the same stylesheet every page already loads, not a new asset. Zero new JS cost beyond a
`.find()` over 6 static array entries, reusing the same cached `getIndex()` call the Hero already
makes on this page. The one real, non-zero cost worth stating plainly rather than glossing over:
`backdrop-filter: blur(4px)` is a GPU-composited effect, and this adds it to 9 elements on the
homepage specifically (the welcome card, the mission-statement card, all 6 pillar cards, and the
objectives card) that didn't carry it before — a genuine, if modest, tradeoff for the requested
visual treatment, not a literally free one.

**Verified directly.** Extracted `MISSION_PILLARS`/`MISSION_OBJECTIVES` from the actual source file
(not a reimplementation) and confirmed: 6 pillars matching `lib/ddi-department.js`'s `DEPARTMENTS`
exactly (as a set and in order, no duplicates, none missing); 6 objectives matching the requested
text exactly; all 6 pillar URLs correct against fully/partially/un-provisioned `site.categories`
mocks. `shouldRender()`'s either-setting-on logic and each section's independent `show*` gating both
verified, including hero-off/briefing-on and hero-on/briefing-off combinations; the shared route
guard re-verified to hide both sections together on topic/admin/`/categories`/division-page routes.
`node --check` clean; `sass` compiles `common/common.scss` cleanly; `settings.yml` re-validated as
YAML (18 settings); a repository-wide exact-selector duplicate scan (re-run after adding the
glassmorphism/hover rules) found nothing new introduced beyond what's documented above. No new
service, fetch, or archive parsing was added — the only data read is `service:site`'s already-loaded
`categories` list.

## Document Intelligence Header (v1.3)

A standardized header above every document's body
(`connectors/topic-above-posts/ddi-document-intelligence-header.*`): a prominent title plus a
compact two-column metadata grid — Document Number, Classification, Department, Lifecycle,
Revision, Last Reviewed, Estimated Reading Time, Related Documents count.

**Replaces the old "Document Intelligence" card outright, not an addition alongside it.** That
card (same outlet, same filename-ordering position) already showed Reading Time, Word Count,
Department, Replies, Views, and a "Last Revision" date — substantial overlap with this task's
field list. Surfaced and confirmed before writing any code (not discovered as duplication
afterward): showing Reading Time and Department in two places on the same page would have
reintroduced exactly the "feels like duplicate information" problem the Homepage UX Cleanup (v1.1)
was built to eliminate on the homepage, now on the topic page instead. Word Count, Replies, and
Views are dropped — none were requested, and Replies/Views duplicate counts Discourse's own native
topic-list/post-stream chrome already shows elsewhere on the same page. `git rm`'d, not just
stopped being referenced.

**Deliberately did not touch Document Footer, despite carrying nearly the same field list
(Document Number, Classification, Revision, Department, Last Updated, Author).** This is a genuine
bookend pair by design, not an oversight: Document Footer renders on `topic-below-post-stream`
*after* the entire post stream, closing with a static "End of Document" marker — a closing stamp,
not a second header. The old "Document Intelligence" card had no such distinct role (a mid-page
stats card with no positional or narrative purpose of its own), which is what made it the one
actually redundant with this new header, not Document Footer.

**Every field reuses an existing resolver — nothing was re-derived.** `service:ddi-document-
metadata`'s already-cached `getMetadata(topic)` supplies Document Number, Classification,
Department, Revision (via the existing `formatRevision()`, which already defaults a missing
`post.version` to `"R01"` rather than crashing), and Reading Time directly. Lifecycle reuses
`lib/ddi-lifecycle.js#getLifecycleLabel()` with the identical `"ACTIVE"` fallback Dossier Header
already uses for an untagged document — the same literal value kept in both files rather than
extracted to `lib/` for one shared default string (this codebase's own threshold for extraction is
multi-step derived logic, not a single fallback literal — see **Debug Mode**'s `analyzeReadingTime`
extraction for the actual bar). Related Documents count calls `service:ddi-related-intelligence`'s
already-cached `findRelated(topic)` — the exact same call Intelligence Network already makes for
this topic — and reads `.length`; no second scoring pass, no new fetch.

**"Last Reviewed" has no field of its own, and this doesn't invent one.**
`docs/ddi-document-metadata-standard.md` §4.8 documents it as optional and "not yet stored," an
open question needing a real design decision (topic custom field vs. body convention) this task
was never asked to make. `ddi-timeline.js`'s own "Reviewed" lifecycle event already faced this
identical gap and resolved it the same way: reuse `metadata.updatedDate` as the best available
proxy, stated as a known simplification rather than hidden. This header does the same, for the
same reason — not a new decision, the existing one applied a second time.

**Compact two-column grid, not `.ddi-intel-grid`'s own 3-column default.** Reuses
`.ddi-intel-grid`'s item typography (`div`/`span`/`strong`) verbatim — the same pattern Verification
Panel, Debug Panel, Document Footer, and Revision History already use, deliberately not switched to
`<dl>`/`<dt>`/`<dd>` despite that being what Mission Briefing's new "Primary Function" metadata
uses, since here an established, already-shared pattern exists and matching it is the more
consistent reuse. Only the column count needed to change: `grid-template-columns: repeat(2, 1fr)`
is scoped to `@media (min-width: 601px)` specifically, so it overrides the 3-column desktop default
without touching `.ddi-intel-grid`'s own existing 600px single-column mobile collapse, which stays
exactly as-is and is reused rather than re-specified.

**Real `<h2>` for the title, not `<h1>` — the opposite call from the Homepage Hero, for a concrete
reason.** The Hero's own title is a real `<h1>` because the homepage had no other one. A topic page
already has one: Discourse's native topic title (`.topic-title h1`, confirmed directly in
`common.scss`). A second `<h1>` repeating the same title text would be a real duplicate-heading
problem, not a style choice — `<h2>` avoids it while still giving screen-reader users a genuine,
navigable heading for this section.

**Classification color reused, not re-derived.** The classification class (`{{classificationClass}}`)
sits on the same root element as `.ddi-card`, so its already-established `border-left` accent
applies for free, the same mechanism Dossier Header already relies on. The Classification field's
own value text additionally picks up `color: var(--ddi-accent, #b51d1d)` — the identical custom
property the classification class already sets, with the same fallback `.ddi-card`'s own
`border-left` rule uses, so there's no risk of unstyled text if `--ddi-accent` is ever unset.

**Glass panel reused from Mission Briefing, not Discourse's own native chrome directly.** Uses the
same `--ddi-bg-panel` + `backdrop-filter: blur(4px)` + `--ddi-shadow-lg` combination Mission
Briefing (v1.2) established for DDI's own cards, rather than the raw `.panel`/`.search-menu`
treatment those values were originally lifted from — this theme's own "reuse existing DDI glass
panels" is now that DDI-flavored variant specifically, not the underlying Discourse-chrome source.

**Related Documents count has a real loading state, distinguished from a genuine zero — caught
before shipping, not after.** An earlier draft used the count's own truthiness
(`{{if this.relatedCount ...}}`) to decide whether it had loaded yet, which would have shown "—"
forever for any document with zero related documents (a real, common case — the count is `0`,
which is falsy) rather than correctly showing `0`. Fixed by splitting into `relatedCount` (a real
number, defaults to `0`) and a separate `isRelatedCountLoaded` boolean the template actually
branches on, so "still loading" and "zero, confirmed" are never conflated.

**Verified directly.** Five scenarios exercised against the actual `setupComponent` logic: a fully
populated document (every field renders correctly, `Related Documents` count matches
`findRelated()`'s result length); missing topic/metadata (hides gracefully, sets nothing but
`isVisible: false`); an untagged document (Lifecycle falls back to `"ACTIVE"`, Department falls
back to `"Uncategorized"`); a document with genuinely zero related documents (displays `0`, not the
loading placeholder — the bug above, re-verified fixed); and a component destroyed before
`findRelated()` resolves (`isDestroying`/`isDestroyed` guard blocks the late update, matching the
guard pattern used throughout this codebase). Metadata rendering is independent of `documentType`
entirely — no field this header displays reads or branches on it, so "verify metadata renders
correctly for all supported document types" holds by construction rather than needing a per-type
test. Filename-sort ordering re-verified after the rename (see **Topic Page Components** above).
`node --check` clean on all touched files; `sass` compiles `common/common.scss` cleanly;
`settings.yml` re-validated as YAML (19 settings); a repository-wide exact-selector duplicate scan
found nothing new beyond the two intentional reuse points documented above; `.ddi-intel-grid`
confirmed still used by its other four existing consumers (Debug Panel, Verification Panel,
Document Footer, Revision History), none of which were touched.

## Document Navigation Sidebar (v1.4)

A live outline of the current document (`connectors/topic-above-post-stream/
ddi-document-navigation-sidebar.*`): every H2 and nested H3, active-section highlighting, smooth
scroll on click, sticky/docked at wide viewports, a tap-to-expand disclosure at narrower ones, and
hidden entirely on documents with no headings.

**Replaces the old "Table of Contents" card, not an addition alongside it.** That card (same
render-order slot, see **Topic Page Components** above) already scanned the same H2 headings and
listed them as anchor links — this component is a strict superset (adds H3 nesting, active
tracking, smooth scroll, sticky positioning) of the exact same underlying data, so keeping both
would have shown the same outline twice on one page. `git rm`'d outright, following the same
replace-not-duplicate call already made for the Document Intelligence Header above and reasoned the
same way: "do not introduce duplicate heading parsing if a heading parser already exists" is an
explicit instruction to find and reuse what's there, not a hint to build a second one beside it.

**Heading scan reuses the retired TOC's exact algorithm, extended rather than rewritten.** Same
selector (`.topic-post:first-child .cooked h2`, now also `h3`), same `requestAnimationFrame`
"wait for Discourse to finish rendering the cooked post" technique, same slug generation
(lowercase, strip punctuation, spaces to hyphens). One real gap in the original closed while
rewriting it: two identically-titled sections previously collided on the same `#id` silently; a
numeric suffix (`overview`, `overview-2`, `overview-3`, …) now guarantees uniqueness — a latent bug
made meaningfully more likely once H3s multiply the heading count per document, not a new feature.
An H3 encountered before any H2 is skipped rather than guessed at, the same fail-gracefully
convention used throughout this theme.

**Builds the outline exactly once — verified directly, not just claimed.** `buildOutline()` runs a
single time inside the same `requestAnimationFrame` callback that used to gate the old TOC; nothing
after that re-queries `.cooked h2`/`h3`. Active-section tracking after that point is handled
entirely by `IntersectionObserver` — a real browser API this theme had never used before, not an
existing instance being "reused" in the literal sense, but the standard, correct tool for "which
element is currently in view" instead of a hand-rolled scroll-position calculation, which is what
"reuse `IntersectionObserver`" in the task's own Performance section actually asked for. A heading
counts as "current" once it enters the top 30% of the viewport (`rootMargin: "0px 0px -70% 0px"`),
the standard technique for this exact UX, not an arbitrary number. When multiple headings intersect
at once (a short section fully on screen alongside a longer one it's overlapping), the physically
highest one wins, picked by comparing `boundingClientRect.top` — verified directly against a mocked
multi-entry callback.

**Active-state changes never re-touch the DOM or re-run the heading scan.** `applyActiveState()`
maps the *already-built* outline array with fresh `isActive` booleans and nothing else, called once
at setup and once per `IntersectionObserver` callback — the same "recompute derived booleans, let
Ember's classic-component reactivity re-render only what changed" pattern Browse Archive's
`applyTab()` and Command Palette's various `show*` flags already established, chosen deliberately
over comparing `section.id === activeId` directly in the template (which would need the `eq`
helper — `ember-truth-helpers`'s availability in this bare theme has been treated as unconfirmed all
session, so every conditional in this codebase already avoids it, this one included).

**Smooth scroll respects `prefers-reduced-motion`, and reuses the exact scroll target/offset
machinery already in place.** Every link keeps a real `href="#id"` (works with JS disabled, in a
new tab, or via "copy link") — the click handler only calls `preventDefault()` and substitutes
`scrollIntoView({ behavior, block: "start" })`, with `behavior` resolved from
`window.matchMedia("(prefers-reduced-motion: reduce)")` at click time — `"auto"` (instant) instead
of `"smooth"` when the user has that preference set, verified directly for both cases. The existing
`.topic-post:first-child .cooked h2 { scroll-margin-top: 110px; }` rule (already in place so a
plain `#anchor` link doesn't land a heading behind Discourse's fixed site header) gained `h3` in the
same selector — the identical value, not a new one — so this needed zero new offset math anywhere:
native `scrollIntoView()` already honors `scroll-margin-top` on its own.

**Positioning is a stated confidence caveat, not a false claim of certainty.** `position: fixed`,
docked at `top: 120px; right: 24px`, only above `min-width: 1400px`. `#main-outlet` has its own
`max-width: 1700px` and fills nearly the entire viewport width below roughly that point (only 20px
of margin on each side), so there's genuinely no free horizontal gutter for a docked panel to sit
in without overlap risk at most common desktop widths — 1400px was chosen as a deliberately
conservative floor, not a value confirmed against a live Discourse instance's actual rendered page
width, which wasn't available for this pass. Documented here explicitly, the same way Document
Breadcrumb's own untested render-order-within-an-outlet caveat is documented above, so a real
deployment knows to verify at its own common widths and adjust `top`/`right`/the breakpoint in
`common.scss` if overlap ever actually occurs.

**Below that breakpoint, a disclosure widget, not a vanished feature.** "Collapse gracefully on
mobile" is read as "still present, just compact" — distinct from "no headings," which hides the
whole thing outright. A `<button aria-expanded>` toggles a `<ul id="ddi-document-nav-list"
aria-controls="...">` open/closed; this is deliberately the plain WAI-ARIA disclosure pattern, not
`lib/ddi-modal.js`'s full focus-trap/backdrop dialog machinery, since there's no backdrop, no focus
trap, and no separate open/close-anywhere requirement here — pulling in the heavier mechanism built
for actual modal dialogs would be more machinery than a simple collapsible list needs. Verified this
tier covers both "tablet" and "mobile" together, deliberately, rather than by omission — this
feature's constraint (no free horizontal gutter) doesn't meaningfully differ between the two the way
content-reflow concerns elsewhere in this theme do, which is why it doesn't reuse this theme's usual
600px/900px breakpoints for anything here.

**Reuses this theme's own navigation typography and hover style, not the card/tile vocabulary.**
Top-level links keep the exact `.ddi-toc-item`/`.ddi-toc-item-number`/`.ddi-toc-title` classes (and
hover state — `color: var(--ddi-red); transform: translateX(6px);`) the retired TOC already used,
satisfying "hover states should reuse existing navigation styling" literally; H3 sublinks are new,
smaller (`.ddi-document-nav-sublink`) but styled with the identical hover technique, not a
different one. The panel shell reuses `.ddi-card`'s own border/shadow/padding values directly
(matched to the Document Intelligence Header's spacing as required) plus the same
`--ddi-bg-panel` + `backdrop-filter: blur(4px)` glass treatment Mission Briefing/the Header already
established. The active accent (`--ddi-red` text plus a 2px left border) uses a two-class selector
(`.ddi-document-nav-link.ddi-document-nav-active`) specifically so it wins on specificity over the
reused base classes regardless of source order — no `!important` anywhere in this file.

**Verified directly.** Extracted the actual `buildOutline`/`assignUniqueId`/`slugify`/
`applyActiveState`/`prefersReducedMotion` functions from the real source file (not reimplementations)
and exercised: H2/H3 nesting and numbering; duplicate heading text producing unique, non-colliding
ids; an H3 encountered before any H2 (skipped, not mis-nested); zero headings (empty outline). A
second pass evaluated the actual `setupComponent` against a mocked `IntersectionObserver`,
`requestAnimationFrame`, and DOM: full lifecycle (outline builds, every heading observed, topmost
intersecting entry correctly wins); zero headings (stays hidden, no observer ever created); a
component destroyed before the `requestAnimationFrame` callback fires (no crash, no observer
created); `teardownObserver()` actually disconnecting the real observer; and a component destroyed
mid-scroll (the intersection callback correctly no-ops rather than updating a torn-down component).
A third pass verified the click handler: `preventDefault()` always called, `"smooth"` under normal
motion preference, `"auto"` under `prefers-reduced-motion: reduce`, and a click on a stale/missing
id doing nothing rather than throwing. `node --check` clean; `sass` compiles `common/common.scss`
cleanly; `settings.yml` re-validated as YAML (20 settings); a repository-wide exact-selector
duplicate scan found nothing new. No new backend API, service, or document-metadata field — the
only data used is the already-rendered post's own heading elements.

## Intelligence Relationships (v1.5)

A contextual panel directly below the Document Intelligence Header
(`connectors/topic-above-posts/ddi-document-intelligence-relationships.*`) explaining how the
current document relates to the rest of the archive — declared relationships and algorithmically
discovered ones, organized into labeled groups, not a flat list.

**Replaces two separate cards, not an addition alongside them.** The old Document Relationships card
(declared relationships only) and Intelligence Network card (up to 5 algorithmically-related topics)
both lived on `topic-below-post-stream`, each with its own "RESOLVING…"/"SCANNING…" loading state and
its own empty-state message. This panel consolidates both into one grouped view immediately below the
header, following the same replace-not-duplicate call already made for the Document Intelligence
Header and Document Navigation Sidebar above. `git rm`'d outright: `ddi-document-relationships.*` and
`ddi-intelligence-network.*` are gone. The services behind them are not — `services/ddi-relationship.js`
(see **Document Relationship Service** above) and `services/ddi-related-intelligence.js` are unchanged
and still the only source of this data; only the presentation layer moved.

**Zero new data sources — every group is either the existing service's result, grouped, or a
client-side filter over it.** `setupComponent` calls exactly two things for the current topic:
`ddi-relationship.js#getRelationships(topic)` and `ddi-related-intelligence.js#findRelated(topic)` —
the same two calls Document Relationships and Intelligence Network already made, each still cached by
topic id in its own service (see **Performance Audit** below for why that caching exists). Any other
connector on the same page requesting the same topic's relationships or related documents — Knowledge
Graph Viewer included — hits the same cache; this panel adds no new fetch and no new scoring pass.
`lib/ddi-intelligence-relationships.js#buildRelationshipGroups(relationships, related, metadata)` is
pure grouping logic over those two already-resolved arrays plus the current document's own already-
resolved metadata (`ddi-document-metadata.js#getMetadata()`, likewise cached and already called by
the Document Intelligence Header on the same page).

**Eight possible groups, declared groups first:** References, Supersedes, Superseded By, Related
Intelligence, Required Reading, Supporting Documentation — `RELATIONSHIP_TYPES`
(`lib/ddi-relationship.js`) imported and iterated directly, not re-declared, so a group's item set is
just `relationships.filter((r) => r.type === type)`. Then two derived groups, Same Department and Same
Classification — `related.filter((c) => c.department === metadata.departmentDisplay)` and
`related.filter((c) => c.classification === metadata.classification)` respectively. Both sides of
each comparison resolve through the identical underlying logic (`ddi-citation-preview.js
#_buildCitation()`'s `department` is `site.categories.find((c) => c.id === topic.category_id)?.name`;
`ddi-document-metadata.js#_resolve()`'s `departmentDisplay` is `topic.category?.name` — the same
category's display name either way, both falling back to the same `UNCATEGORIZED_LABEL`), so this is
a safe string-equality filter, not an approximation. **Only groups with at least one item render; if
every group is empty, `isVisible` stays `false` and the whole panel doesn't render at all** — no
"NO RELATIONSHIPS FOUND" placeholder text, a deliberate difference from the two retired cards' own
empty states, per this feature's own requirement to "hide the panel entirely" rather than show an
empty one.

**Two categories the task's own spec named were deliberately not built, by explicit user decision,
not an oversight:**
- **"Referenced By"** — there is no reverse index anywhere in this codebase of which documents cite a
  given one; `findDocumentReferences()`/`findDocumentRelationships()` only ever parse the *current*
  document's own body for outgoing references. Building a "what points at me" index would mean
  scanning every other document's body archive-wide — new, unbounded backend-shaped work, not a reuse
  of an existing service. Omitted outright rather than approximated.
- **"Parent Document"/"Child Documents"** — no such concept exists anywhere else in this theme; the
  closest analogues are the already-declared `Supersedes`/`Superseded By` types. Rather than remap
  those onto a Parent/Child vocabulary that doesn't otherwise exist, they render under their own
  original labels, exactly as `RELATIONSHIP_TYPES` already names them — "keep original labels" was
  the explicit choice made over the alternative (`Supersedes` → "Parent Document",
  `Superseded By` → "Child Documents").

**Presentation reuses this theme's own established components, not new ones.** The panel shell is
`.ddi-card` (the same glass panel — `--ddi-bg-panel` + `backdrop-filter: blur(4px)` +
`--ddi-shadow-lg` — the Document Intelligence Header and Document Navigation Sidebar both already use,
picked up automatically via `.ddi-card`'s own base `margin: 24px 0` for spacing consistency with its
neighbors, no new spacing rule needed). Each group heading is `.ddi-nav-section-label` — the exact
class Command Palette already uses for grouping results under a caption, reused rather than
duplicated. Each relationship is a real `<a href>` (an `.ddi-toc-item`, this theme's established
navigation-list styling, hover state included) wrapping `.ddi-toc-title` for the document title and
`.ddi-search-badges`/`.ddi-search-badge` — Document Quick Preview's own metadata badge — for document
number, classification (colored via the existing `classificationClass` → `--ddi-accent` mechanism),
and department. Relationship type is not repeated a third time per item since it's already the group's
own heading; it's still present per item for a screen reader reading link-by-link, via each item's
precomputed `aria-label` (see below). The only genuinely new CSS is the gap between two stacked
groups inside one card — nothing existing already provided that specific spacing.

**Accessibility, verified by inspection, not assumed.** Real `<a href>` elements throughout — no
`<div>`/`onClick` pattern anywhere, so keyboard access (`Tab`, `Enter`) and "clicking a document opens
it normally" both fall out of using the correct native element rather than needing separate handling.
Heading hierarchy is `<h2>` for the panel title (matching the Document Intelligence Header's own `<h2>`
choice, both below Discourse's native `.topic-title h1`) and `<h3>` for each group label — no level is
skipped. Each item's `aria-label` (`"{title}, {relationship type}, {document number}, {classification},
{department}"`, built in `lib/ddi-intelligence-relationships.js`, not `{{concat}}` in the template) is
a deliberately meaningful link name distinct from the visually adjacent badge row, so a screen reader
user hears one coherent sentence per link rather than a title followed by four unlabeled badge
fragments. Color is never the only signal: classification is still spelled out as badge text, the
accent color is a reinforcement, not the only way to read it — same convention as every other
classification badge in this theme.

**Verified directly, not just claimed.** `lib/ddi-intelligence-relationships.js#buildRelationshipGroups`
was extracted from the real source file (not a reimplementation) and exercised against: a mixed input
covering all 8 possible groups at once (correct group labels, correct order, correct item shape,
correct `aria-label` text); an all-empty input (`groups.length === 0`, confirming the panel-hide
condition); and cross-checked that a candidate matching both Same Department and Same Classification
correctly appears in both groups rather than being deduplicated away (an intentional design choice —
these are different relationship types, not the same fact stated twice). `node --check` clean on the
connector, the new `lib/` file, and the modified `services/ddi-relationship.js`; `sass` compiles
`common/common.scss` cleanly with the new selectors present in the output; `settings.yml` re-validated
as YAML (21 settings); a repository-wide exact-selector duplicate scan found nothing new beyond the
one pre-existing legitimate case (`.timeline-footer-controls`); an unused-import/orphan-export sweep
found nothing new. No new backend API, no new topic custom field, no new fetch — every verification
above is exercising grouping/presentation logic over data two already-shipped services already
provide.

**Desktop/tablet/mobile — reasoning-based, not confirmed against a live instance (same caveat as
Document Navigation Sidebar's own positioning claim above; no running Discourse instance was available
for this pass either).** The panel adds no layout mechanism of its own — no grid, no fixed
positioning, no new breakpoint — it's a `.ddi-card` containing stacked `.ddi-toc-item` rows and
`.ddi-search-badges`, exactly the same DOM shapes the two retired cards already shipped at every
breakpoint from 320px up, plus `.ddi-nav-section-label` group headings, already responsive by the same
inheritance. There is nothing breakpoint-specific in this feature for that same reason: nothing new
needed reasoning about how it reflows, because nothing new reflows differently than components already
verified at those widths.

**Gated by `ddi_intelligence_relationships_enabled` (`settings.yml`, default `true`)**, the same
one-toggle-per-feature convention every prior release in this theme has followed — see **Known Gaps /
Unwired Code** below for the updated settings count.

## Document Template Library (v1.6)

A composer-time template picker (`connectors/composer-fields/ddi-document-template-library.*`) —
select an official DDI document type, get its standard structure inserted into a brand-new
document. An authoring enhancement, not a reader-facing one: nothing about the topic page, the
homepage, or any existing navigation panel changed for this feature.

**Nine templates, one shared builder, not nine copy-pasted strings.**
`lib/ddi-document-templates.js`'s `buildTemplateBody()` assembles every template from the same
boilerplate (Executive Summary, Required Metadata, Cross References, Related Documents, Revision
History, Approval) wrapped around each template's own short list of standard section headings —
adding a future template means adding one `{ type, label, sections }` entry to
`TEMPLATE_DEFINITIONS`, nothing else. This is a plain string builder, not a second templating
engine: no variable interpolation beyond a template's own label, no conditionals or loops an
author would ever write against, satisfying "do not introduce another template engine" by keeping
this well short of being one.

**Every template's `type` is a real, current `DOCUMENT_TYPES` slug, checked at module load, not
trusted by convention.** `lib/ddi-document-type.js`'s existing closed vocabulary is imported and
reused directly (`briefing`, `procedure`, `policy`, `manual`, `incident-report`, `training-guide`,
`technical-spec`, `directive`, `charter`) — no parallel type list, and `TEMPLATE_DEFINITIONS.forEach`
throws immediately at load time if a future template entry ever names a slug that isn't valid,
rather than failing silently the first time something else calls `isValidDocumentType()` on it.
The task's own example names don't map 1:1 onto this vocabulary's exact spelling — the mapping is a
judgment call, not a literal name match: Intelligence Brief → `briefing`, Standard Operating
Procedure → `procedure`, Policy Directive → `policy`, Operations Manual → `manual`, Incident Report
→ `incident-report` (exact), Training Manual → `training-guide`, Technical Specification →
`technical-spec`, Executive Order → `directive`, Corporate Charter → `charter` (exact). Every one
reuses an already-existing slug; none required extending the vocabulary.

**Metadata fields that live in tags/category, not body text, are a checklist in the template, not
something the template sets.** Per `docs/ddi-document-metadata-standard.md`, Classification,
Department, Document Type, and Lifecycle are Discourse tags/category, not parseable body text —
each generated template's "Required Metadata" section is a plain reminder list telling the author
which composer field to set, not data any parser reads. The one exception is Document Type: since
the author already told this feature what type they want by picking a template, selecting one also
sets that tag directly (see below) — reusing that answer rather than asking the author to state it
twice.

**Selecting a template updates the Document Type tag, reusing the exact "one Document Type tag"
convention the Metadata Engine and Author Assistant already read.**
`ddi-document-metadata.js#_resolve()` and `ddi-document-author-assistant.js` both derive Document
Type as `tags.find((tag) => isValidDocumentType(tag))` — singular, first match. Applying a template
filters out any *other* valid document-type tag already present and appends the new one
(`otherTags.filter((tag) => !isValidDocumentType(tag))`, then append), so switching templates mid-
draft swaps the tag rather than leaving two conflicting document-type tags behind. Every other tag
(Classification, Lifecycle, anything else) is left untouched.

**"Only prefill new documents" is enforced by never rendering the picker at all when editing, not
by a runtime overwrite check.** `model.creatingTopic` gates the whole connector — an existing
document's first post always has real content already, so there is nothing this feature needs to
protect there; the picker simply doesn't exist in that context. Within "new topic" itself, a second,
narrower guard still applies before writing to the body: `(model.reply || "").trim().length > 0`
skips the `model.set("reply", template.body)` call (an author may have started typing before opening
the picker) but still updates the Document Type tag either way — changing your mind about intended
type before submitting isn't the "existing content" this requirement is protecting, only the body
text is. A status line (`"X template inserted."` / `"X tagged — not inserted, this document already
has content."`) tells the author which branch happened rather than silently no-op-ing.

**No accidental cross-references or relationship declarations ship inside a fresh template — verified
directly against the real detection regexes, not assumed.** The Related Documents section lists all
6 `RELATIONSHIP_TYPES` labels (`References`, `Supersedes`, `Superseded By`, `Related Intelligence`,
`Required Reading`, `Supporting Documentation`) with a placeholder document number after each, and
the Cross References section names the same syntax in prose — both deliberately spell the
placeholder as `DDI-NNNNNN` (letters, not digits). `lib/ddi-cross-reference.js`'s
`REFERENCE_PATTERN` (`/\bDDI-\d{6}(?!\d)/g`) requires 6 literal digits, so this placeholder cannot
match it or `lib/ddi-relationship.js`'s declaration parser (which calls the same digit-matching
function on each labeled line's captured text) — a freshly inserted template registers zero cross
references and zero declared relationships until an author replaces a placeholder with a real
number, exactly the same "many legitimate documents have none yet" state Author Assistant/Document
Relationships/Cross References already treat as normal, not an error.

**Every generated document is structured so the Executive Summary, H2, and relationship checks all
read exactly what the template intends.** Executive Summary is the very first heading in every
template — nothing precedes it — so `connectors/topic-above-posts/ddi-executive-summary.js`'s "first
`<p>` in cooked HTML" extraction and Author Assistant's "first non-heading, non-list-item raw line"
check both land on the same placeholder paragraph, by construction rather than by coincidence of
Markdown list-tightness rendering. Every template has multiple `## ` headings, satisfying Author
Assistant's H2 Sections check and giving Document Navigation Sidebar (v1.4) a real outline to build
from the moment a template is inserted — a heading it built to read `.cooked h2`/`h3` already, no
change needed there.

**No API requests, no dynamic generation, no additional observers — templates are static strings,
picked from a native `<select>`.** `DOCUMENT_TEMPLATES` is computed once at module load and never
touched again; `setupComponent` reads `service:composer`'s already-resolved model once and wires a
single `{{on "change"}}` handler — no `addObserver`/`IntersectionObserver`/polling of any kind, a
deliberate contrast with Author Assistant's own observer-driven panel in the very same
`composer-fields` outlet, since this feature only ever needs to react to one explicit user action,
not continuously re-derive state as the author types.

**Accessibility reuses native form semantics rather than a custom widget.** A real `<label for>` /
`<select id>` pair (keyboard-operable, screen-reader-labeled, with the composer's own existing focus
styles/tab order applying automatically) — no custom listbox, no ARIA reimplementation of what an
`<option>` already provides. The label reuses `.ddi-nav-section-label` (Command Palette's own
caption style) rather than a new one.

**Confidence caveat: writing to the Composer model, not just reading it, is untested against a live
instance.** Every prior composer-touching feature (Author Assistant) only ever reads `model.reply`/
`model.tags`/etc.; this is the first time any connector in this theme calls `model.set(...)` on it.
`reply`/`tags` are standard, long-documented Discourse `Composer` model properties and the D-editor
textarea is expected to be reactively bound to `reply` the same way toolbar/quote-insertion features
already rely on, but this wasn't confirmed against a running Discourse instance, the same class of
caveat already carried for `creatingTopic`/`editingFirstPost` above.

**Verified directly, not just claimed.** Loaded the actual `ddi-document-templates.js` alongside the
real `lib/ddi-document-type.js`, `lib/ddi-cross-reference.js`, and `lib/ddi-relationship.js` (not
reimplementations) and exercised all 9 generated templates: valid `DOCUMENT_TYPES` slug; a real
prose paragraph present (Executive Summary check); at least one H2 (H2 Sections check); zero
cross-references detected; zero relationship declarations detected; Executive Summary is the first
heading in the body; and all 6 relationship labels present verbatim. Caught and fixed before
shipping: an early draft joined each template's unique section blocks with a single `\n`, not
`\n\n`, leaving no blank line between one section's placeholder and the next section's heading — a
real Markdown-formatting bug, fixed by joining with `\n\n` like every other block in the builder. A
second simulation exercised the connector's actual `applyTemplate` closure against a mocked
composer model: an empty new draft (template inserted, tag set); a draft with existing content (tag
still updated, body left untouched, correct status message); switching template type mid-draft
(old document-type tag dropped, unrelated tags kept, new tag added); and the placeholder `""`
option (no-op, no crash). `node --check` clean on both new files; `sass` compiles `common/common.scss`
cleanly; `settings.yml` re-validated as YAML (22 settings); a repository-wide duplicate-selector
scan and an unused-import/orphan-export sweep found nothing new.

**Responsive behavior is inherited, not newly built.** The `<select>` is `width: 100%` inside
`.ddi-card`'s existing responsive padding (already tightened below 600px archive-wide, and further
tightened to `.ddi-author-assistant`'s own composer-specific margin/padding directly above, reused
verbatim here) — nothing about this feature's layout is breakpoint-specific, so there is no new
breakpoint to verify beyond confirming the existing rules still apply, which the `sass` compile
above already confirms structurally.

**Gated by `ddi_document_template_library_enabled` (`settings.yml`, default `true`)**, the same
one-toggle-per-feature convention every prior release has followed — see **Known Gaps / Unwired
Code** below for the updated settings count.

## Revision History (v1.7)

A structured, multi-row revision table — Revision Number, Date, Author, Summary, Approval Status —
supplementing the archive's metadata, not replacing Discourse's own native post-edit history. Three
consumers, one parser: the composer (Author Assistant warnings), the Document View panel
(`connectors/topic-above-posts/ddi-document-revision-history.*`, enhanced), and the Integrity
Dashboard (archive-wide informational checks, see above).

**One shared parser, two source-format adapters — not two parsers.**
`lib/ddi-revision-table.js`'s `buildRevisionRows()`/`normalizeRow()` is the only code anywhere in
this theme that turns raw table cells into a `{ revisionNumber, date, author, summary,
approvalStatus }` object; every consumer goes through it. Two thin extraction functions feed it,
one per source representation this feature has to read from: `parseMarkdownRevisionTable()` scans
raw composer draft text for a pipe-table under a "## Revision History" heading (the same
"operate on source text directly" approach Author Assistant's other checks already use), and
`parseCookedRevisionTable()` walks an already-parsed cooked-HTML `Document`'s real `<table>` DOM
looking for the same heading. Two adapters exist because a `<table>`'s own `.textContent` drops
cell boundaries entirely (`"R1.02026-07-30Executive Command…"`, unusable) — unlike inline
`DDI-NNNNNN` mentions, a table genuinely can't be read with the same single text-scanning
technique regardless of source format. Both still resolve to the exact same 5-field row shape.

**Composer support reuses the v1.6 Template Library outright — no new insertion path.** The
"## Revision History" section every generated template already includes (see **Document Template
Library (v1.6)** above) was updated to the 5-column schema this feature defines
(`Revision Number | Date | Author | Summary | Approval Status`) with one static placeholder row
(`R1.0`, blank date/author/status placeholders, a fixed "Initial publication." summary) — "only
generate the initial row" is satisfied by that template never having generated more than one row in
the first place, and "do not overwrite existing revisions" was already guaranteed by v1.6's own
empty-document-only insertion guard (see that section), unchanged here.

**Document View panel: real table when one exists, the original single-row snapshot when one
doesn't — verified both ways, not just the new path.** `setupComponent` calls `parseCookedHtml()`
(the same LRU-cached parser Document Relationships/Intelligence Relationships already call for this
exact post) once, then `parseCookedRevisionTable()` on that result. If the body has a table, every
row renders, newest first (`getRevisionsNewestFirst()` — simply reverses source order, since an
author naturally appends new revisions at the bottom; this needs no revision-number parsing to work,
unlike the ordering *validation* check below). If not — every document published before this feature
existed, or any that simply never added a table — it falls back to exactly the fields this connector
displayed before v1.7 (`metadata.revision`, `metadata.updatedDate`, `metadata.author`,
`metadata.status`, the same static "No revision notes recorded." text), reusing the Metadata Engine's
already-computed values rather than inventing a second way to answer "what's this document's current
revision." This is what "verify existing documents" resolves to: a document with no revision table
looks exactly as it always has.

**"Display it cleanly without unnecessary controls" for a single revision is satisfied by never
building controls in the first place**, not by hiding some behind a conditional — there is no
pagination, expand/collapse, or "show more" anywhere in this panel regardless of row count; a
`<caption>` reading "1 revision" or "N revisions" is the only count-dependent element, and it's
there for every count, not specifically added for the single-row case.

**Ordering validation treats revision numbers as an optional major.minor scheme it can parse, not a
required one.** `isRevisionOrderValid()` accepts an optional leading `R` followed by dot-separated
integers (`R1.0`, `R2.3`, `1.0`) and compares stored (chronological, oldest-first) order the way
semantic-version segments compare; a revision number outside that shape (free-form text) is skipped
rather than treated as a failure — the same fail-gracefully convention Author Assistant's other soft
checks already use, chosen because forcing every author to use a specific numbering scheme wasn't
asked for, only detecting when a *parseable* one goes backward.

**Author Assistant's 4 checks are conditional, not always-shown, and reuse this file's exact
functions — see the updated count in Document Author Assistant above.** "Revision Table" always
shows (PASS/WARN); "Revision Numbers," "Revision Order," and "Revision Summaries" only appear once
`parseMarkdownRevisionTable()` finds at least one row — showing all 4 unconditionally would mean the
latter three always reading "nothing to check" until an author adds a table, three redundant restatements
of what the first check already says.

**Accessibility: real table markup, not a styled grid.** `<table>` with `<caption>`, `<thead><tr>
<th scope="col">`, and `<tbody><tr><th scope="row">` for each row's own revision number plus `<td>`
for the rest — proper semantics for a screen reader to announce row/column relationships, distinct
from every other tabular-looking display in this theme (`.ddi-intel-grid`/`.ddi-dossier-grid`),
which are styled `<div>` grids, not real tables, because none of them needed row/column semantics
for genuinely multi-row data the way this feature does. Approval Status reuses `.ddi-search-badge`
verbatim (this theme's existing metadata-badge component) rather than new cell styling.

**Responsive via a scroll container, not column collapsing.** `.ddi-revision-table-wrap` is
`overflow-x: auto`; five columns of tabular data don't reflow sensibly into fewer columns the way
`.ddi-intel-grid`'s uniform metadata cells do, so this feature scrolls horizontally at narrow widths
instead, with a tightened `padding`/`font-size` pass below 600px (the same breakpoint every other
mobile-tightening rule in this stylesheet already uses).

**Verified directly, not just claimed.** Loaded the actual `ddi-revision-table.js` and exercised:
a well-formed markdown table (2 rows, correct cells); a heading with no table before the next
heading (empty result, not a crash); no heading at all (empty result); duplicate/missing-summary
detection on hand-built rows; valid, invalid, and unparseable-revision-number ordering cases; and
newest-first reversal. A mocked-DOM pass exercised `parseCookedRevisionTable()` against a fake
heading/table/row/cell tree (found correctly; empty when no heading; empty when no table before the
next heading). A separate simulation loaded the real `buildAuthorAssistantChecks()` against an empty
draft, a well-formed revision table, and a table with duplicate/out-of-order/missing-summary rows —
all 4 checks read exactly as expected in each case. A third simulation loaded the real
`_revisionIssues()` logic against mocked documents with no table, a valid table, and a bad table —
correct issue types, correct severities, correct suggested-fix text. All 9 Template Library templates
re-verified to each produce exactly one valid, parseable initial revision row (`R1.0`) after the
column-schema change. `node --check` clean on every touched/new file; `sass` compiles
`common/common.scss` cleanly; `settings.yml` re-validated as YAML (23 settings); a repository-wide
duplicate-selector scan and an unused-import/orphan-export sweep found nothing new. No new backend
API, no new topic custom field, no archive rescan — the Integrity Dashboard's existing single scan
now also answers three more questions per document it was already fetching.

**Gated by `ddi_document_revision_history_enabled` (`settings.yml`, default `true`)** — a setting
this connector never had before, added now following the same one-toggle-per-feature convention
every other release has used, rather than leaving a meaningfully upgraded feature permanently
un-toggleable.

## CSS Architecture

`common/common.scss` is the only stylesheet actually compiled into the theme (via `desktop.scss`
and `mobile.scss` for breakpoint-specific overrides). It defines a `:root` custom-property token
system — background/text colors, a red-accent opacity scale (`--ddi-red-05` through `--ddi-red-75`),
border colors, and a shadow scale (`--ddi-shadow-xs` through `--ddi-shadow-lg`) — and every
component rule in the file is built from those tokens rather than repeating raw hex/rgba values.
New styling should extend this token set rather than introducing new raw color/shadow literals.

**`common/variables.scss` (RC cleanup: removed).** It defined a second, separate token system under
different names, but was never `@import`ed by `common.scss` (or anything else), so none of its
tokens ever reached compiled CSS. `docs/ddi-design-system.md` describes it as the intended "source
of truth," but that was never wired up. If that migration is ever actually done, re-derive it from
this doc rather than restoring the deleted file — the file itself was correct SCSS syntax, just
entirely disconnected from the build.

## Known Gaps / Unwired Code

These are things that exist in the repository but do not currently affect the running theme. Each
was verified by grepping for references — not assumed.

- **`common/homepage.html` and `common/sidebar.html` (RC cleanup: removed).** They contained full
  static markup for a homepage dashboard and command sidebar, but `homepage.html` and `sidebar.html`
  were never filenames Discourse's theme compiler recognizes (the recognized `common/*.html` targets
  are `head_tag`, `header`, `after_header`, `body_tag`, and `footer`, plus embedded variants) — neither
  file was ever rendered. `docs/ddi-command-network-interface.md` planned real connectors for this
  (`connectors/above-main-container/ddi-homepage-dashboard.hbs` and `ddi-sidebar-panel.hbs`) that were
  never built at the time. **Partially addressed since**: a scoped version now exists at
  `connectors/discovery-list-container-top/ddi-intelligence-dashboard.*` — see **Intelligence Dashboard**
  above — covering 5 of the design doc's statistics-oriented sections. The sidebar half, and the
  dashboard's remaining sections (Search Intelligence, Operational Divisions, Recent Intelligence,
  Recent Revisions), are still unbuilt; `docs/ddi-intelligence-archive-dashboard.md` remains the
  roadmap for those.
- **`common/footer.html` is empty, and was deliberately kept, not removed**, unlike the two files
  above — it's a real, Discourse-recognized template target (unlike `homepage.html`/`sidebar.html`,
  which were never valid filenames at all), so there's nothing broken about it; it's just unpopulated.
  Deleting a valid-but-empty file provides no runtime benefit, since present-and-empty and
  absent-entirely compile identically.
- **`settings.yml` — 23 settings, 19 wired, 4 reserved. (Corrected during the Version 1.0 RC audit,
  the Version 1.1 release audit, and again as of the Homepage Hero, Mission Briefing, Document
  Intelligence Header, Document Navigation Sidebar, Intelligence Relationships, Document
  Template Library, and Revision History (v1.2–v1.7) —
  this bullet previously described a 6-settings/1-wired snapshot from before Intelligence Index,
  Timeline, Knowledge Graph Viewer, Reading Lists, Integrity Dashboard, and System Status existed;
  each of those six shipped with its own settings gate, and this summary was never updated to match.
  The per-feature sections elsewhere in this document were kept accurate as each shipped — only this
  cross-cutting summary had drifted, every time — which is exactly why it's called out again here
  rather than trusted to have been kept current automatically.)** `ddi_header_enabled` and
  `ddi_interface_mode_enabled` were removed in the original RC cleanup: neither ever had a documented
  design describing what conditional behavior they'd control, and the behavior they name (the header
  shell, "v0.2.0 interface overrides") is unconditionally active today with no described "off" state
  anywhere in this repo's history.
  - **Wired (19):** `ddi_debug_mode_enabled` (Debug Mode), `ddi_homepage_dashboard_enabled`
    (Intelligence Dashboard), `ddi_intelligence_index_enabled` (Browse Archive's "All Documents"
    tab), `ddi_timeline_view_enabled` (Browse Archive's "By Year" tab), `ddi_knowledge_graph_viewer_enabled`
    (Knowledge Graph Viewer), `ddi_reading_lists_enabled` (Reading Lists),
    `ddi_integrity_dashboard_enabled` (Document Integrity Dashboard trigger — staff/admin status is
    still gated in code regardless of this setting, see that section), `ddi_system_status_enabled`
    (System Status trigger, same staff/admin caveat), `ddi_document_actions_enabled` (Document
    Actions, v1.1), `ddi_document_author_assistant_enabled` (Document Author Assistant, v1.1),
    `ddi_homepage_hero_enabled`, `ddi_hero_background_image`, `ddi_hero_subtitle` (Homepage Hero,
    v1.2), `ddi_mission_briefing_enabled` (Mission Briefing, v1.2),
    `ddi_document_intelligence_header_enabled` (Document Intelligence Header, v1.3),
    `ddi_document_navigation_sidebar_enabled` (Document Navigation Sidebar, v1.4),
    `ddi_intelligence_relationships_enabled` (Intelligence Relationships, v1.5),
    `ddi_document_template_library_enabled` (Document Template Library, v1.6),
    `ddi_document_revision_history_enabled` (Revision History, v1.7 — see that
    section above).
  - **Reserved, not wired (4):** `ddi_compact_density` and `ddi_red_glow_strength` —
    `docs/ddi-intelligence-archive-dashboard.md`'s Phase 6 explicitly names both for the dashboard's
    "new section styling," a concrete, specific tie to planned work, not a vague aspiration.
    `ddi_sidebar_command_panel_enabled` — the sidebar rebuild is acknowledged intent
    (`docs/ddi-roadmap.md`'s "Excluded / Not Yet Ready") but has no design past that acknowledgment;
    kept because the intent is real, not because a plan exists yet. `ddi_footer_enabled` — paired
    with the still-present, still-empty `common/footer.html` above, same reasoning: real (if
    under-specified) intent, valid mechanism, zero cost to leave in place.
- **`assets/ddi-logo.png` is never referenced** by any template, stylesheet, or `about.json` asset
  entry — reviewed in RC cleanup. The header's actual logo sizing (`#site-logo.logo-big` in
  `common.scss`) already targets Discourse's native, admin-uploaded branding image, not a
  theme-bundled file, so this asset was never the mechanism in use. Recommendation: remove it — the
  only "logo" mention anywhere in `docs/` is generic prototype-description context with no tie to
  this specific file. Left in place pending an explicit decision, since deleting a branding asset
  outright felt like it warranted a human call rather than a unilateral one.
- **`javascripts/discourse.js`'s stale comment (Version 1.1 release audit: resolved).** It named a
  version label (`v0.2.1`) that predates this project's dated-changelog convention and stated "No
  runtime DOM injection is used for homepage/sidebar/footer assembly," which was true when written
  but stopped being true once `api-initializers/ddi-dossier-refresh.js` started doing runtime DOM
  injection (`querySelector` + `replaceChildren`) — for the topic page, not the homepage, so the
  comment wasn't wrong about its original scope, just broader-reading than accurate. Reworded to
  describe the file's actual, current role (a no-op entry point, kept for structural symmetry) and
  point at the one real exception by name, and its tab-indentation corrected to this repo's 2-space
  standard. The no-op initializer itself is unchanged — this was a comment/formatting-only fix, zero
  behavioral impact.
- **Dossier Header's dead `documentId`/`issuedDate` computation (RC cleanup: resolved).**
  `ddi-dossier-header.js` used to compute these and set them as component properties despite
  `ddi-dossier-header.hbs` never referencing them — the visible values were always actually produced
  by `api-initializers/ddi-dossier-refresh.js`. The dead computation was removed from the connector;
  the initializer is unchanged and remains the sole source of both values. This was the oldest
  unresolved finding in the project's history before this cleanup pass.

## Document Archive Information Architecture

`docs/ddi-archive-information-architecture.md` proposes a category and tag taxonomy for the
archive (one top-level category, 6 divisional subcategories, and classification/document-type/
lifecycle tag groups). **This is a design document for Discourse's admin panel, not something this
theme creates automatically.** A theme cannot provision categories or tags — an admin has to create
them by hand (Categories → New Category, Tags → New Tag) following that document. The
classification tag *slugs* the theme's code actually depends on (`top-secret`, `restricted`,
`confidential`, `internal`) are defined in `lib/ddi-classification.js`; the archive IA doc's
proposed tags were designed to match those exactly.
