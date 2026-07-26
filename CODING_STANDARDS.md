# Coding Standards

This document is the detailed reference for how code in this repo should look. [CONTRIBUTING.md](CONTRIBUTING.md)
covers process (local dev, PR expectations); [ARCHITECTURE.md](ARCHITECTURE.md) covers *why* the
system is shaped the way it is. This is the *how*.

Every rule below is derived from what the live, working parts of this codebase already do —
verified against the actual files, not assumed. Where the codebase is inconsistent, that's called
out explicitly rather than papered over, and the standard picks the side the majority (and the
live, non-dead files) already follow.

## Folder Structure

```
common/       Styles and HTML applied on every device — the only place new shared styling goes
desktop/      Desktop-only @media overrides — nothing else
mobile/       Mobile-only @media overrides — nothing else
javascripts/discourse/
  lib/            Pure, stateless helper functions
  services/       Injectable Ember services
  connectors/     Plugin outlet components (one outlet-named folder per outlet)
  api-initializers/  Page-lifecycle hooks
docs/         Design documents (Version/Repository/Scope header, see existing docs/ files)
assets/       Static files
```

New code goes in the folder matching its role (see **Connectors**, **Services**, **Shared
Libraries** below) — don't create a new top-level folder without updating `ARCHITECTURE.md` to
explain why the existing structure didn't fit.

## Naming Conventions

**Files** — kebab-case, `ddi-` prefixed, for every theme-authored JS file in `lib/`, `services/`,
`connectors/*/`, and `api-initializers/`: `ddi-classification.js`, `ddi-related-intelligence.js`,
`ddi-intelligence-network.js`. This is consistent across the entire current codebase — no
exceptions to work around.

**Connector folders** — named after the exact Discourse plugin outlet they attach to
(`topic-above-posts`, `topic-below-post-stream`), not an abbreviation or a DDI-specific name. If
you're not sure an outlet name is current, say so in the PR rather than guessing — see
`docs/ddi-intelligence-network.md`'s note on verifying outlet availability against the installed
Discourse core version.

**CSS classes** — flat kebab-case, `.ddi-` prefix, **no BEM double-underscore**:
`.ddi-card-title`, `.ddi-dossier-grid`, `.ddi-security-banner`. No exceptions remain — `.welcome-
banner__*` (BEM-style, styling for the dead `common/homepage.html`) was removed as part of the
post-RC homepage hierarchy pass, once it was confirmed to target nothing in the current DOM (see
`ARCHITECTURE.md`'s **Intelligence Index** section). If a BEM-style exception ever reappears without
a documented reason, treat it the same way this one was treated: as leftover, not precedent.

**CSS custom properties** — `--ddi-<category>[-<variant>]`: `--ddi-text-muted`, `--ddi-red-18`,
`--ddi-shadow-lg`. Opacity variants are named by whole-number percentage (`-18` means 0.18 alpha),
matching the existing `--ddi-red-05` through `--ddi-red-75` scale — not the literal decimal.

**JS identifiers** — camelCase for variables and functions; for service classes, PascalCase with a
`Ddi` prefix and `Service` suffix (`DdiRelatedIntelligenceService`). Note this class-naming pattern
currently has exactly one real example in the codebase — treat it as the established precedent to
follow, not as a heavily battle-tested convention with lots of prior art.

**Ember service lookup names** — the dasherized filename is the lookup string:
`services/ddi-related-intelligence.js` → `service:ddi-related-intelligence`.

## JavaScript Style

- **Double quotes only.** Verified — there is no single-quoted string anywhere in the current JS.
- **2-space indentation**, matching every JS file and `common.scss`.
- **ES modules** — `import`/`export`. Named exports for `lib/` helper functions; a single default
  export for connectors, services, and initializers, matching Discourse's own expected shapes.
- **No comments unless the *why* is non-obvious.** The codebase is intentionally comment-sparse —
  clear naming carries the weight. If you're explaining *what* code does, rename instead.
- **Optional chaining and nullish coalescing** (`topic?.tags`, `post?.version ?? 1`) are used
  freely for Discourse model access throughout — prefer them over manual `&&` guards.
- **No Ember Native Array Extensions** (`findBy`, `filterBy`, `mapBy`, `sortBy`, `rejectBy`, `isAny`,
  `isEvery`, `any`, `everyBy`, `firstObject`, `lastObject`) — deprecated by Discourse
  (`discourse.native-array-extensions.*`) and trigger an admin warning. Use native `Array.prototype`
  methods instead: `array.find((item) => item.key === value)` for `findBy`, `array.filter(...)` for
  `filterBy`/`rejectBy` (negate the predicate for the latter), `array.map(...)` for `mapBy`,
  `[...array].sort(...)` for `sortBy` (spread first — native `.sort()` mutates in place, `sortBy`
  doesn't), `array.some(...)`/`array.every(...)` for `isAny`/`isEvery`, and `array.at(0)`/
  `array.at(-1)` (or `array[0]`/`array[array.length - 1]`) for `firstObject`/`lastObject`. Verified
  clean as of the 2026-07-26 audit — a repo-wide grep for all eleven names found and fixed the one
  remaining case (`ddi-citation-preview.js`'s `categories.findBy(...)`).

## SCSS Organization

- **`common/common.scss` is the single live stylesheet.** `desktop/desktop.scss` and
  `mobile/mobile.scss` hold *only* `@media` breakpoint overrides — not new component definitions.
- **Section banners** (`/* ====... TITLE ====... */`) divide `common.scss` by component/feature.
  New styling gets its own banner, placed near the section it's related to rather than appended at
  the end of the file — this file has already suffered from fragmented, appended-later sections for
  the same feature (see `ARCHITECTURE.md` / the header-logo cleanup in the CSS refactor); don't
  reintroduce that pattern.
- **All repeated colors, borders, and shadows go through the `:root` custom-property scale.** Don't
  hardcode a raw hex/rgba value that will be used more than once or twice — add a token and use
  `var(...)`.
- **2-space indentation.** `desktop.scss` and `mobile.scss` are currently tab-indented — that's the
  inconsistency, not the standard. New code, and any file touched for other reasons, should use
  2-space.
- **All tokens belong in `common.scss`'s `:root` block.** A second token system
  (`common/variables.scss`) existed early in this project, was never `@import`ed, and was removed in
  RC cleanup — don't reintroduce a second token file.

## Connectors

- **One connector = one outlet, one concern.** A `.js` + `.hbs` pair, exporting a plain
  `{ setupComponent(args, component) {...} }` object — not a full Ember `Component` subclass. Every
  existing connector in this codebase follows this exact shape; don't introduce a different one.
- **No business logic in the connector body.** Its job is: look up data (`args.model`, or a service
  via `getOwner(component).lookup("service:...")`), call into `lib/`/`services/`, and call
  `component.setProperties(...)`. If `setupComponent` is doing more than that, the logic belongs
  elsewhere.
- **Guard async resolutions.** If a connector awaits a service call, check
  `component.isDestroying || component.isDestroyed` before calling `setProperties` after the await
  resolves — the component may have been torn down by a fast page change in the meantime.
- **Templates reuse existing CSS classes before introducing new ones** (`.ddi-card`, `.ddi-toc-item`,
  `.ddi-dossier-grid`) — check whether an existing card/list/grid pattern already fits before adding
  new markup structure.

## Services

- Use an Ember `Service` (not a `lib/` function) when logic needs **async I/O** (network requests)
  or needs to be **injectable from more than one connector**. Simple synchronous formatting belongs
  in `lib/`, not a service.
- **Small public surface.** A service should expose a handful of clearly-named async methods (e.g.
  `findRelated(topic)`) — internal steps as `_`-prefixed private methods, so the scoring/fetching/
  presentation pipeline is readable as a sequence, matching `ddi-related-intelligence.js`'s existing
  `_fetchCandidates` → `_rank` → `_score` → `_present` shape.
- **Reuse `lib/` helpers inside services** rather than reimplementing formatting or classification
  logic — a service is an orchestration layer, not a second place to define what a document ID or a
  classification tier looks like.
- **Handle partial failure.** If a service issues multiple concurrent requests, a single failed
  request shouldn't take down the whole result set — prefer isolating failures (e.g.
  `Promise.allSettled`, or a `.catch()` per request) over an unguarded `Promise.all`.

## Shared Libraries (`lib/`)

- **Pure functions only.** No Discourse/Ember API calls, no network I/O, no component state. If a
  helper needs any of those, it belongs in `services/`, not `lib/`.
- **One file per concern**, matching `ddi-classification.js`, `ddi-document-id.js`,
  `ddi-format-date.js` — don't bundle unrelated helpers into a single file, and don't create a new
  file for a concern that already has one (extend the existing file with a named export instead).
- **Named exports**, not a default export — this is what lets multiple small helpers for the same
  concern live in one file.
- **Never duplicate logic that already exists here.** If you need document ID formatting, date
  formatting, or classification resolution, import the existing helper. A past instance of exactly
  this mistake — `ddi-dossier-header.js` recomputing a document ID inline instead of importing
  `formatDocumentId`, producing a value the template doesn't even render — is documented in
  `ARCHITECTURE.md` as the cautionary example. Don't repeat the pattern.

## Commit Messages

Prefer [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`,
`docs:`, `chore:`) going forward. Repo history is a mix of plain descriptions and loose
Conventional-Commits-style prefixes — converging on one style makes history scannable and
changelog-able. Don't embed ad hoc version labels in commit messages (e.g. `v0.2.3 - ...`) — early
history did this and it was never reflected in `about.json`, producing a version history that
doesn't match anything. If a change represents a release, bump `about.json`'s `version` /
`theme_version` directly instead.

## Branch Naming

**No existing convention to document here** — repo history is entirely direct commits to `main`;
no feature branch has been used yet. What follows is a proposal, not a description of current
practice.

Suggested pattern, mirroring the commit-prefix vocabulary above so both are learned once:

```
<type>/<short-kebab-description>
```

Examples: `feat/intelligence-search`, `fix/classification-tag-match`, `docs/coding-standards`,
`refactor/common-scss-tokens`. Keep branches short-lived — merge and delete rather than
accumulating long-running parallel branches, consistent with this project's "small, incremental,
independently-committable changes" working style.
