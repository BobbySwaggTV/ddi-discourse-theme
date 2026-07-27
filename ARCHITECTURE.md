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
2. **Document Breadcrumb** (`connectors/topic-above-post-stream/ddi-document-breadcrumb.*`) — a
   lightweight trail: `DDC Intelligence Archive → Department → Document Type → (current title)`.
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
3. **Classification Watermark** (`connectors/topic-above-post-stream/ddi-classification-watermark.*`)
   — a fixed, full-viewport, low-opacity classification label rendered behind the document while its
   topic page is mounted. Shares the `topic-above-post-stream` outlet with Dossier Header and
   Breadcrumb; DOM order among the three doesn't matter for the watermark since it's removed from
   normal flow (`position: fixed`). See **Classification Watermark** below.
4. **Security Banner** (`connectors/topic-above-posts/ddi-security-banner.*`) — classification name
   and message, via `lib/ddi-classification.js`.
5. **Executive Summary** (`connectors/topic-above-posts/ddi-executive-summary.*`) — takes the
   first post's cooked HTML, parses it with `DOMParser`, and shows the text of the first `<p>`
   element. This is a simple extraction, not a generated summary.
6. **Document Intelligence** (`connectors/topic-above-posts/ddi-document-intelligence.*`) — reading
   time (word count ÷ 200, min 1 minute), word count, category name, reply count, view count, and a
   revision label derived from the first post's version.
7. **Table of Contents** (`connectors/topic-above-posts/ddi-document-toc.*`) — scans the first
   post's rendered `<h2>` elements after render (`requestAnimationFrame`), assigns each an `id`, and
   lists them as anchor links.
8. **Revision History** (`connectors/topic-above-posts/ddi-document-revision-history.*`) — Revision
   Number, Last Updated, Author, Revision Status, and a static Revision Notes placeholder, derived
   synchronously from the first post — no service, since nothing here needs async I/O or
   cross-component reuse. Positioned directly below Document Intelligence via filename-based outlet
   ordering (see `docs/ddi-intelligence-network.md` for the same technique applied elsewhere). RC
   cleanup re-verified the sort arithmetic itself is correct (`ddi-document-intelligence` <
   `ddi-document-revision-history` < `ddi-document-toc`, confirmed against the live directory
   listing) — what remains genuinely unverified is the underlying assumption that Discourse renders
   same-outlet connectors in filename order at all, which requires a running instance to confirm and
   wasn't something this cleanup pass had access to.
9. **Intelligence Timeline** (`connectors/topic-above-posts/ddi-document-timeline.*`) — a vertical,
   chronologically-ordered list of lifecycle events (Created, Approved, Revised, Reviewed,
   Deprecated, Archived), synchronous, derived entirely from `ddi-document-metadata.js`'s existing
   fields (no new fetch, no new tag, no new topic custom field). Filename sorts directly after
   Revision History and before Table of Contents (`ddi-document-revision-history` <
   `ddi-document-timeline` < `ddi-document-toc`), same filename-ordering technique and the same
   unverified-against-a-live-instance caveat noted for Revision History above. See **Intelligence
   Timeline** below.
10. **Document Footer** (`connectors/topic-below-post-stream/ddi-document-footer.*`) — Document
   Number, Classification, Revision, Department, Last Updated, Author, and a static "End of
   Document" marker. Synchronous, same reasoning as Revision History (no service needed). Ordered
   before Intelligence Network within the same outlet (filename-based, same caveat as above,
   re-verified the same way) so the document's own closing metadata appears before the secondary
   "related documents" panel. `ddi-debug-panel` also shares this outlet and sorts before both — no
   ordering requirement was ever set for it, so there's nothing to verify there.
11. **Archive Navigation** (`connectors/topic-below-post-stream/ddi-document-navigation.*` +
    `services/ddi-archive-navigation.js`) — Previous Document, Next Document, Department Home, and
    up to 5 Recent Documents in Department. Previous/Next/Recent are ordered by Document Number
    (`lib/ddi-document-order.js`, parsed via `lib/ddi-document-id.js`'s existing `parseDocumentId()` —
    reused rather than re-implemented), not creation date. The connector was renamed from
    `ddi-navigation` to `ddi-document-navigation` specifically so its filename sorts between
    `ddi-document-footer` and `ddi-document-relationships`, placing it directly beneath Document
    Footer using the same deliberate filename-ordering mechanism described above — the service class
    and its file (`ddi-archive-navigation.js`) were kept as-is since only the connector's outlet
    position needed to change. See **Archive Navigation** below.
12. **Document Relationships** (`connectors/topic-below-post-stream/ddi-document-relationships.*` +
    `services/ddi-relationship.js`) — up to N declared relationships (References, Supersedes,
    Superseded By, Related Intelligence, Required Reading, Supporting Documentation) to other
    documents, parsed from the current document's own body text. Sorts immediately after Archive
    Navigation in the same outlet (previously immediately after Document Footer, before Archive
    Navigation's connector was relocated here — see previous item). See **Document Relationships**
    below.
13. **Intelligence Network** (`connectors/topic-below-post-stream/ddi-intelligence-network.*` +
    `services/ddi-related-intelligence.js`) — up to 5 related topics, scored by: same category
    (+100), same classification (+50, see caveat below), and +25 per shared tag. See
    `docs/ddi-intelligence-network.md` for the full design rationale.
14. **Cross References** (`api-initializers/ddi-cross-references.js` +
    `lib/ddi-cross-reference.js`) — detects `DDI-NNNNNN` patterns in the first post's rendered text
    and converts them into links to the referenced document. Not a plugin-outlet connector, unlike
    everything else in this list — `decorateCookedElement` is the correct Discourse API for mutating
    already-rendered post HTML, and this project already has one precedent for that class of work
    (`api-initializers/ddi-dossier-refresh.js`). See **Cross References** below for the full split
    between the pure detection/parsing library and this DOM-mutation layer.
15. **Debug Mode** (`connectors/topic-below-post-stream/ddi-debug-panel.*` +
    `lib/ddi-debug.js`) — an opt-in diagnostic panel (Document ID, Topic ID, Category,
    Classification, Detected Tags, Revision, Word Count, Reading Time), gated entirely off by
    default. See **Debug Mode** below.
16. **Document Integrity Verification** (`connectors/topic-below-post-stream/ddi-verification-panel.*`
    + `lib/ddi-integrity.js`) — five PASS/WARN checks (Classification, Department, Document Type,
    Lifecycle, Metadata) against the current document's already-resolved metadata. Gated by the same
    `ddi_debug_mode_enabled` setting as Debug Mode, not a new one. Filename (`ddi-verification-panel`)
    deliberately sorts after `ddi-document-navigation`, the same "append without reordering"
    technique Archive Navigation established. See **Document Integrity Verification** below.

## Archive-Wide Components

Everything above is scoped to a single topic page (`args.model` is that topic). These two aren't:
they render on every *non-document* route instead of one document, off a different Discourse outlet
family.

1. **Intelligence Index** (`connectors/below-main-container/ddi-intelligence-index.*` +
   `services/ddi-intelligence-index.js`) — an alphabetical, archive-wide list of every document
   (Document Number, Title, Department, Classification, Revision). Gated by the
   `ddi_intelligence_index_enabled` setting (default `true`) and, at render time, by a route check
   that hides it on document (`topic.*`) and `admin` routes. Moved from `above-main-container` to
   `below-main-container` as part of the post-RC homepage hierarchy pass — see **Intelligence
   Index** below for why. Automatically department-scoped on category pages (Division Command
   Center, Phase 1) via the new `services/ddi-category-context.js` — see below.
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

## Document Relationships

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

**Fails gracefully per-reference, not per-card.** If a declared reference can't be resolved (deleted
topic, no access, bad ID), `getCitationById` already resolves to `null` — `_resolve()` passes that
through, and the caller filters `null`s out. A card with 3 declared relationships where 1 is broken
simply shows the other 2; it doesn't show an error row, matching how Intelligence Network already
handles individual fetch failures.

**Designed for expansion, concretely:** the 6 relationship types are a single array
(`RELATIONSHIP_TYPES`) the regex is built from — adding a 7th type is a one-line change, nothing
else. `isValidRelationshipType()` is exported even though this feature's own parsing doesn't need to
call it (the regex only ever matches known types), for the same reason `ddi-document-type.js`,
`ddi-lifecycle.js`, and `ddi-department.js` each export their own `isValid*` — a future consumer
(composer-side validation, an admin tool) gets it for free rather than having to add it later.

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
used by Document Footer and Document Intelligence) — the two are different properties of the same
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
`UNCATEGORIZED_LABEL`-aware fallback Document Footer and Document Intelligence already get from the
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
Intelligence Network, say) with slightly different field completeness — Relationship-sourced nodes
don't carry `department`, since `getRelationships()`'s resolved shape doesn't include it. Rather than
whichever source ran first silently winning, `mergeNodes()` keeps the first-seen node and backfills
any `null`/`undefined` field from later occurrences of the same ID — multiple *edges* to that ID
still exist, one per signal that found it (this is a multigraph, not a simplified one), only the
*node* is deduplicated.

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
(`element._ddiResetGraphView`), so the `resetView` action (a real `{{action}}`, which does reliably
bind `this`) can find them again later via `this.element` without any shared component state at all.
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
References, Broken Related Document links. Not a second validation system: it runs the exact same
checks already used elsewhere and reshapes their output into a table.

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

**Confidence caveat.** The classic connector `actions: {}` hash + `{{action "open"}}`/`{{action
"close"}}` in the template is the same pattern this theme's `setupComponent`-style connectors are
already written against; `service:current-user` and `.staff` are standard, long-stable Discourse DI
conventions. Untested against a live Discourse instance — if either assumption is wrong, the safe
failure mode is the trigger button simply not appearing or not opening, not a broken page.

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
- **`settings.yml` — as of RC cleanup, 6 settings remain (down from 8).** `ddi_header_enabled` and
  `ddi_interface_mode_enabled` were removed: neither has ever had any documented design describing
  what conditional behavior they'd control, and the behavior they name (the header shell, "v0.2.0
  interface overrides") is unconditionally active today with no described "off" state anywhere in
  this repo's history. Of the remaining 6:
  - `ddi_debug_mode_enabled` is wired (Debug Mode).
  - `ddi_compact_density` and `ddi_red_glow_strength` are kept — `docs/ddi-intelligence-archive-dashboard.md`'s
    Phase 6 explicitly names both for the dashboard's "new section styling," a concrete, specific tie
    to planned work, not a vague aspiration.
  - `ddi_homepage_dashboard_enabled` is now wired (Intelligence Dashboard) — it was kept, pre-wiring,
    specifically because it was the exact gate `docs/ddi-intelligence-archive-dashboard.md` specified
    the dashboard connector should check, and that's exactly what it now does.
  - `ddi_sidebar_command_panel_enabled` is kept, on weaker footing than the above: the sidebar rebuild
    is acknowledged intent (`docs/ddi-roadmap.md`'s "Excluded / Not Yet Ready") but has no design past
    that acknowledgment. Kept because the intent is real, not because a plan exists yet.
  - `ddi_footer_enabled` is kept, paired with the still-present `common/footer.html` above, for the
    same reasoning: real (if under-specified) intent, valid mechanism, zero cost to leave in place.
- **`assets/ddi-logo.png` is never referenced** by any template, stylesheet, or `about.json` asset
  entry — reviewed in RC cleanup. The header's actual logo sizing (`#site-logo.logo-big` in
  `common.scss`) already targets Discourse's native, admin-uploaded branding image, not a
  theme-bundled file, so this asset was never the mechanism in use. Recommendation: remove it — the
  only "logo" mention anywhere in `docs/` is generic prototype-description context with no tie to
  this specific file. Left in place pending an explicit decision, since deleting a branding asset
  outright felt like it warranted a human call rather than a unilateral one.
- **`javascripts/discourse.js`'s comment is stale.** It states "No runtime DOM injection is used for
  homepage/sidebar/footer assembly," which was true when written, but
  `api-initializers/ddi-dossier-refresh.js` does now use runtime DOM injection (`querySelector` +
  `replaceChildren`) — for the topic page, not the homepage, so the comment isn't wrong about its
  original scope, but it reads as broader than it is.
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
