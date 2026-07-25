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
- **`services/`** — Ember `Service` classes, used when logic needs to do async work (network
  requests) or would benefit from being injectable/reusable across multiple connectors. Currently
  one example: `ddi-related-intelligence.js`.
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
6. **Intelligence Network** (`connectors/topic-below-post-stream/ddi-intelligence-network.*` +
   `services/ddi-related-intelligence.js`) — up to 5 related topics, scored by: same category
   (+100), same classification (+50, see caveat below), and +25 per shared tag. See
   `docs/ddi-intelligence-network.md` for the full design rationale.

## Classification System

`lib/ddi-classification.js` maps a topic's tags to a classification tier (`TOP SECRET`,
`RESTRICTED`, `CONFIDENTIAL`, `INTERNAL`, or the default `PUBLIC RELEASE`), each with a display
name, a CSS class, and a message. It's imported and reused correctly everywhere classification is
needed (Security Banner, Dossier Header, Intelligence Network) — there's no duplicated
classification logic elsewhere in the codebase.

**Known bug:** the lookup does `tags.some((tag) => tag.slug === classification.slug)`, which
assumes `topic.tags` is an array of tag objects with a `.slug` property. In Discourse, a topic's
`tags` are plain strings (tag names), not objects — so this comparison likely never matches, and
every topic silently falls back to the default `PUBLIC RELEASE` classification regardless of its
actual tags. This affects the Security Banner, Dossier Header's classification color, and the
Intelligence Network's classification-match scoring. Fixing it is a single-line change (compare
against the tag string directly) but is not done in this codebase yet — verify current behavior in
a live instance before depending on classification-driven behavior.

## CSS Architecture

`common/common.scss` is the only stylesheet actually compiled into the theme (via `desktop.scss`
and `mobile.scss` for breakpoint-specific overrides). It defines a `:root` custom-property token
system — background/text colors, a red-accent opacity scale (`--ddi-red-05` through `--ddi-red-75`),
border colors, and a shadow scale (`--ddi-shadow-xs` through `--ddi-shadow-lg`) — and every
component rule in the file is built from those tokens rather than repeating raw hex/rgba values.
New styling should extend this token set rather than introducing new raw color/shadow literals.

**`common/variables.scss` is a second, separate token system that is not used.** It defines its own
color/spacing/shadow variables under different names, but is never `@import`ed by `common.scss` (or
anything else), and `about.json`'s `assets` field is empty — so none of its tokens reach the
compiled CSS. `docs/ddi-design-system.md` describes it as the intended "source of truth," but that
was never wired up. Do not add new tokens here expecting them to take effect — they won't. This file
should either be deleted or actually imported and migrated onto; until one of those happens, treat
it as dead.

## Known Gaps / Unwired Code

These are things that exist in the repository but do not currently affect the running theme. Each
was verified by grepping for references — not assumed.

- **`common/homepage.html` and `common/sidebar.html`** contain full static markup for a homepage
  dashboard and command sidebar, but `homepage.html` and `sidebar.html` are not filenames Discourse's
  theme compiler recognizes (the recognized `common/*.html` targets are `head_tag`, `header`,
  `after_header`, `body_tag`, and `footer`, plus embedded variants). Neither file is ever rendered.
  `docs/ddi-command-network-interface.md` planned real connectors for this
  (`connectors/above-main-container/ddi-homepage-dashboard.hbs` and `ddi-sidebar-panel.hbs`) that
  were never built. See `docs/ddi-intelligence-archive-dashboard.md` for the current roadmap to
  actually implement the homepage dashboard the right way.
- **`common/footer.html` is empty.** `ddi_footer_enabled` exists as a setting but there's no footer
  content or connector for it to gate.
- **All 7 settings in `settings.yml` are unread.** No `settings.*` reference exists anywhere in the
  JS or SCSS. They are reserved names, not live toggles.
- **`assets/ddi-logo.png` is never referenced** by any template, stylesheet, or `about.json` asset
  entry.
- **`javascripts/discourse.js`'s comment is stale.** It states "No runtime DOM injection is used for
  homepage/sidebar/footer assembly," which was true when written, but
  `api-initializers/ddi-dossier-refresh.js` does now use runtime DOM injection (`querySelector` +
  `replaceChildren`) — for the topic page, not the homepage, so the comment isn't wrong about its
  original scope, but it reads as broader than it is.
- **Dossier Header computes two properties nothing renders.** `ddi-dossier-header.js` computes
  `documentId` and `issuedDate` and sets them as component properties, but `ddi-dossier-header.hbs`
  never references `{{this.documentId}}` or `{{this.issuedDate}}` — those elements are actually
  populated by `api-initializers/ddi-dossier-refresh.js`, which independently re-fetches the topic
  and re-derives the same values (using `lib/formatDocumentId`, correctly, unlike the dead
  connector-side computation which is missing the `DDI-` prefix). Net effect: the connector-computed
  values are dead code, and the date-formatting logic runs twice for the same result. If you're
  touching document ID or issued-date rendering, the initializer is the code that actually matters.

## Document Archive Information Architecture

`docs/ddi-archive-information-architecture.md` proposes a category and tag taxonomy for the
archive (one top-level category, 6 divisional subcategories, and classification/document-type/
lifecycle tag groups). **This is a design document for Discourse's admin panel, not something this
theme creates automatically.** A theme cannot provision categories or tags — an admin has to create
them by hand (Categories → New Category, Tags → New Tag) following that document. The
classification tag *slugs* the theme's code actually depends on (`top-secret`, `restricted`,
`confidential`, `internal`) are defined in `lib/ddi-classification.js`; the archive IA doc's
proposed tags were designed to match those exactly.
