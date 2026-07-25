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
  instead of `lib/`.
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
   color, author, status (open/closed), and (see **Known Gaps** below) document ID / issued date.
2. **Security Banner** (`connectors/topic-above-posts/ddi-security-banner.*`) — classification name
   and message, via `lib/ddi-classification.js`.
3. **Executive Summary** (`connectors/topic-above-posts/ddi-executive-summary.*`) — takes the
   first post's cooked HTML, parses it with `DOMParser`, and shows the text of the first `<p>`
   element. This is a simple extraction, not a generated summary.
4. **Document Intelligence** (`connectors/topic-above-posts/ddi-document-intelligence.*`) — reading
   time (word count ÷ 200, min 1 minute), word count, category name, reply count, view count, and a
   revision label derived from the first post's version.
5. **Table of Contents** (`connectors/topic-above-posts/ddi-document-toc.*`) — scans the first
   post's rendered `<h2>` elements after render (`requestAnimationFrame`), assigns each an `id`, and
   lists them as anchor links.
6. **Revision History** (`connectors/topic-above-posts/ddi-document-revision-history.*`) — Revision
   Number, Last Updated, Author, Revision Status, and a static Revision Notes placeholder, derived
   synchronously from the first post — no service, since nothing here needs async I/O or
   cross-component reuse. Positioned directly below Document Intelligence via filename-based outlet
   ordering (see `docs/ddi-intelligence-network.md` for the same technique applied elsewhere). RC
   cleanup re-verified the sort arithmetic itself is correct (`ddi-document-intelligence` <
   `ddi-document-revision-history` < `ddi-document-toc`, confirmed against the live directory
   listing) — what remains genuinely unverified is the underlying assumption that Discourse renders
   same-outlet connectors in filename order at all, which requires a running instance to confirm and
   wasn't something this cleanup pass had access to.
7. **Document Footer** (`connectors/topic-below-post-stream/ddi-document-footer.*`) — Document
   Number, Classification, Revision, Department, Last Updated, Author, and a static "End of
   Document" marker. Synchronous, same reasoning as Revision History (no service needed). Ordered
   before Intelligence Network within the same outlet (filename-based, same caveat as above,
   re-verified the same way) so the document's own closing metadata appears before the secondary
   "related documents" panel. `ddi-debug-panel` also shares this outlet and sorts before both — no
   ordering requirement was ever set for it, so there's nothing to verify there.
8. **Intelligence Network** (`connectors/topic-below-post-stream/ddi-intelligence-network.*` +
   `services/ddi-related-intelligence.js`) — up to 5 related topics, scored by: same category
   (+100), same classification (+50, see caveat below), and +25 per shared tag. See
   `docs/ddi-intelligence-network.md` for the full design rationale.
9. **Cross References** (`api-initializers/ddi-cross-references.js` +
   `lib/ddi-cross-reference.js`) — detects `DDI-NNNNNN` patterns in the first post's rendered text
   and converts them into links to the referenced document. Not a plugin-outlet connector, unlike
   everything else in this list — `decorateCookedElement` is the correct Discourse API for mutating
   already-rendered post HTML, and this project already has one precedent for that class of work
   (`api-initializers/ddi-dossier-refresh.js`). See **Cross References** below for the full split
   between the pure detection/parsing library and this DOM-mutation layer.
10. **Debug Mode** (`connectors/topic-below-post-stream/ddi-debug-panel.*` +
    `lib/ddi-debug.js`) — an opt-in diagnostic panel (Document ID, Topic ID, Category,
    Classification, Detected Tags, Revision, Word Count, Reading Time), gated entirely off by
    default. See **Debug Mode** below.

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
to get the answer, rather than reimplementing the check (and the vocabulary list) itself. None of
the four are currently wired into an existing component: Classification's *display* was already
safe by construction before this change (`getClassification()` can only ever return one of its own
known values or the default); Document Type and Lifecycle aren't read by any component yet; and
Department is a Discourse category, which Discourse itself already guarantees exists — this adds
the narrower check of whether it's one of *this archive's* six divisions specifically, not just any
valid Discourse category.

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
