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
   color, author, status (open/closed), document type, and (see **Known Gaps** below) document ID /
   issued date. Document type is `metadata.documentType` (the Metadata Engine's already-resolved tag)
   run through `lib/ddi-document-type.js`'s `getDocumentTypeLabel()` — a pure slug-to-label formatter
   added alongside `isValidDocumentType()` in the same file, not a new lookup table — falling back to
   the literal string `"INTELLIGENCE BRIEF"` only when the topic has no valid Document Type tag.
2. **Classification Watermark** (`connectors/topic-above-post-stream/ddi-classification-watermark.*`)
   — a fixed, full-viewport, low-opacity classification label rendered behind the document while its
   topic page is mounted. Shares the `topic-above-post-stream` outlet with Dossier Header; DOM order
   between the two doesn't matter since the watermark is removed from normal flow (`position: fixed`).
   See **Classification Watermark** below.
3. **Security Banner** (`connectors/topic-above-posts/ddi-security-banner.*`) — classification name
   and message, via `lib/ddi-classification.js`.
4. **Executive Summary** (`connectors/topic-above-posts/ddi-executive-summary.*`) — takes the
   first post's cooked HTML, parses it with `DOMParser`, and shows the text of the first `<p>`
   element. This is a simple extraction, not a generated summary.
5. **Document Intelligence** (`connectors/topic-above-posts/ddi-document-intelligence.*`) — reading
   time (word count ÷ 200, min 1 minute), word count, category name, reply count, view count, and a
   revision label derived from the first post's version.
6. **Table of Contents** (`connectors/topic-above-posts/ddi-document-toc.*`) — scans the first
   post's rendered `<h2>` elements after render (`requestAnimationFrame`), assigns each an `id`, and
   lists them as anchor links.
7. **Revision History** (`connectors/topic-above-posts/ddi-document-revision-history.*`) — Revision
   Number, Last Updated, Author, Revision Status, and a static Revision Notes placeholder, derived
   synchronously from the first post — no service, since nothing here needs async I/O or
   cross-component reuse. Positioned directly below Document Intelligence via filename-based outlet
   ordering (see `docs/ddi-intelligence-network.md` for the same technique applied elsewhere). RC
   cleanup re-verified the sort arithmetic itself is correct (`ddi-document-intelligence` <
   `ddi-document-revision-history` < `ddi-document-toc`, confirmed against the live directory
   listing) — what remains genuinely unverified is the underlying assumption that Discourse renders
   same-outlet connectors in filename order at all, which requires a running instance to confirm and
   wasn't something this cleanup pass had access to.
8. **Intelligence Timeline** (`connectors/topic-above-posts/ddi-document-timeline.*`) — a vertical,
   chronologically-ordered list of lifecycle events (Created, Approved, Revised, Reviewed,
   Deprecated, Archived), synchronous, derived entirely from `ddi-document-metadata.js`'s existing
   fields (no new fetch, no new tag, no new topic custom field). Filename sorts directly after
   Revision History and before Table of Contents (`ddi-document-revision-history` <
   `ddi-document-timeline` < `ddi-document-toc`), same filename-ordering technique and the same
   unverified-against-a-live-instance caveat noted for Revision History above. See **Intelligence
   Timeline** below.
9. **Document Footer** (`connectors/topic-below-post-stream/ddi-document-footer.*`) — Document
   Number, Classification, Revision, Department, Last Updated, Author, and a static "End of
   Document" marker. Synchronous, same reasoning as Revision History (no service needed). Ordered
   before Intelligence Network within the same outlet (filename-based, same caveat as above,
   re-verified the same way) so the document's own closing metadata appears before the secondary
   "related documents" panel. `ddi-debug-panel` also shares this outlet and sorts before both — no
   ordering requirement was ever set for it, so there's nothing to verify there.
10. **Document Relationships** (`connectors/topic-below-post-stream/ddi-document-relationships.*` +
    `services/ddi-relationship.js`) — up to N declared relationships (References, Supersedes,
    Superseded By, Related Intelligence, Required Reading, Supporting Documentation) to other
    documents, parsed from the current document's own body text. Sorts immediately after Document
    Footer in the same outlet. See **Document Relationships** below.
11. **Intelligence Network** (`connectors/topic-below-post-stream/ddi-intelligence-network.*` +
    `services/ddi-related-intelligence.js`) — up to 5 related topics, scored by: same category
    (+100), same classification (+50, see caveat below), and +25 per shared tag. See
    `docs/ddi-intelligence-network.md` for the full design rationale.
12. **Archive Navigation** (`connectors/topic-below-post-stream/ddi-navigation.*` +
    `services/ddi-archive-navigation.js`) — Previous Document, Next Document, Department Home, and
    up to 5 Recent Documents in Department. Filename (`ddi-navigation`) deliberately sorts after
    `ddi-intelligence-network` so it renders last among this outlet's existing cards without
    disturbing their current order. See **Archive Navigation** below.
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
    deliberately sorts after `ddi-navigation`, the same "append without reordering" technique Archive
    Navigation established. See **Document Integrity Verification** below.

## Archive-Wide Components

Everything above is scoped to a single topic page (`args.model` is that topic). This is the first
component that isn't: it renders on every *non-document* route instead of one document, off a
different Discourse outlet family.

1. **Intelligence Index** (`connectors/below-main-container/ddi-intelligence-index.*` +
   `services/ddi-intelligence-index.js`) — an alphabetical, archive-wide list of every document
   (Document Number, Title, Department, Classification, Revision). Gated by the
   `ddi_intelligence_index_enabled` setting (default `true`) and, at render time, by a route check
   that hides it on document (`topic.*`) and `admin` routes. Moved from `above-main-container` to
   `below-main-container` as part of the post-RC homepage hierarchy pass — see **Intelligence
   Index** below for why.

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
department, ordered by filing date), **Department Home** (a link to the document's own category),
and **Recent Documents in Department** (up to 5 other documents most recently filed there).

**Reuses the Metadata Engine for department identity, not a second resolution.**
`services/ddi-archive-navigation.js` injects `ddi-document-metadata.js` and reads
`metadata.departmentDisplay` for the department's display name — the same
`UNCATEGORIZED_LABEL`-aware fallback Document Footer and Document Intelligence already get from the
metadata engine — rather than re-deriving `topic.category?.name` and its fallback a second time.
Only the category's `slug`/`id` (native Discourse fields, not a classification/business concept the
metadata engine owns) are read directly off `topic.category` to build the Department Home URL.

**Fetches one topic list, derives three of the four things from it.** `_fetchDepartmentTopics()`
calls the exact same `/c/{slug}/{id}.json` endpoint `ddi-related-intelligence.js`'s
`_fetchCategoryTopics()` already established as this codebase's way of listing a category's topics
— not a new endpoint assumption. `lib/ddi-document-order.js`'s two pure functions,
`findAdjacentDocuments()` and `selectRecentDocuments()`, both work off that single fetched array:
the former sorts by `created_at` ascending and returns the immediate neighbors of the current
topic's index; the latter excludes the current topic and returns the `created_at`-descending top 5.
Sorting is done client-side deliberately, rather than trusting the endpoint's own default order (its
exact sort — latest activity vs. creation date — isn't confirmed against a live instance, the same
class of caveat already flagged for other endpoints in this document) — this sidesteps the question
entirely instead of assuming an answer.

**Presentation reuses Citation Preview, not a new "topic to display fields" mapping.** Previous,
Next, and each Recent Documents row are all passed through `ddi-citation-preview.js`'s
`getCitation()` — the same service `ddi-related-intelligence.js` already uses to shape its related-
document rows from this identical raw-AJAX-topic shape. Because `getCitation()` caches by document
ID, a document that appears in both Intelligence Network and Archive Navigation on the same page
view is only fully resolved once.

**One page each is enough; no new pagination system.** `_fetchDepartmentTopics()` fetches a single
page (Discourse's default topic-list page size) and does not follow further pages. For a department
with more topics than that, Previous/Next/Recent could be inaccurate at the boundary — an honest
limitation, not a silent one, matching the same eager-vs-bounded trade-off already reasoned through
(and left as a flagged simplification rather than solved) in `docs/ddi-revision-history.md`.

**Template reuses existing rows, not a new list pattern.** The Department Home link and each Recent
Documents row reuse `.ddi-toc-item` / `.ddi-toc-title` / `.ddi-dossier-grid` exactly as Intelligence
Network already does. Only the Previous/Next two-up row (`.ddi-nav-links`/`.ddi-nav-link`) is new
markup, since no existing component in this theme is a two-column button pair — everything else
(color tokens, hover treatment, uppercase label convention) is drawn from the existing `:root` token
set, not new literals.

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

**One new endpoint, and why it's different from the others already in this codebase.**
`_fetchArchiveTopics()` calls Discourse's `/latest.json` — the standard "every topic, newest first"
listing endpoint, distinct from `ddi-related-intelligence.js`'s and `ddi-archive-navigation.js`'s
`/c/{slug}/{id}.json` (both category-scoped) because this feature is explicitly archive-wide, not
scoped to one document's category. Same single-page-is-enough limitation as Archive Navigation's
department fetch, and the same reason: fetched newest-first order is not used for anything — the
result is always re-sorted by title, so the endpoint's own ordering is irrelevant either way.

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

**Does not touch the Homepage Dashboard's territory.** `ddi_homepage_dashboard_enabled` and the
default-furniture-suppression technique `docs/ddi-intelligence-archive-dashboard.md` describes are
untouched — this feature doesn't hide or replace any existing homepage/category-page content, only
adds a card below it, so it doesn't preempt or conflict with that larger, still-unbuilt feature.

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
the relationship between two documents), the reusable shape a future visualization would actually
need instead of four separately-shaped API surfaces. **No visualization is built here** — this is
the data model and the service that produces it, nothing else. No connector, no template, no CSS,
no settings.yml entry: nothing renders as a result of this file existing.

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
   it requires a real traversal/crawl strategy (breadth-first from a seed set? every document via
   `/latest.json` pagination, extending `ddi-intelligence-index.js`'s existing single-page-fetch
   pattern to multiple pages?) and a termination bound — exactly the kind of "genuinely new territory"
   this codebase's own convention is to design deliberately (see the Homepage Dashboard's phased
   design in `docs/ddi-intelligence-archive-dashboard.md`) rather than build speculatively inside an
   unrelated task.
2. **A visualization connector.** Explicitly out of scope for this task. Once built, it should be a
   plain `connectors/*/ddi-*.js` consumer of `getDocumentGraph()` — no graph-shaping logic belongs in
   that connector; it should only call this service and render what comes back, the same "connectors
   are wiring only" rule already governing every other connector in this codebase.
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
  never built. The design intent isn't lost — `docs/ddi-intelligence-archive-dashboard.md` is the
  current, accurate roadmap for implementing the homepage dashboard correctly, and doesn't depend on
  the deleted files.
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
  - `ddi_homepage_dashboard_enabled` is kept — it's the exact gate `docs/ddi-intelligence-archive-dashboard.md`
    already specifies the dashboard connector should check.
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
