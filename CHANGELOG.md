# Changelog

This changelog is derived from the project's git history, grouped by development session (date).

**A note on versioning:** early commit messages embed ad hoc version labels (`v0.1.0` through
`v0.3.0`), but these were never consistently reflected in `about.json` until the Version 1.0 release
prep below, and the labels don't even increase monotonically over time in the commit history. Don't
read the early ad hoc labels as an authoritative release history — this changelog uses dates for
that instead, since those are verifiable. `about.json`'s `version`/`theme_version` is `1.0.0` as of
the entry below; every entry before it predates that field meaning anything.

## 2026-07-30 — v1.3: Document Intelligence Header

- New standardized header above every document's body
  (`connectors/topic-above-posts/ddi-document-intelligence-header.*`, gated by new
  `ddi_document_intelligence_header_enabled`, default on): a prominent title plus a compact
  two-column metadata grid — Document Number, Classification, Department, Lifecycle, Revision,
  Last Reviewed, Estimated Reading Time, Related Documents count.
- **Replaces the old "Document Intelligence" card outright** (`git rm`'d, same outlet, same
  filename-ordering position) rather than adding a second one alongside it — that card already
  showed Reading Time, Word Count, Department, Replies, Views, and a "Last Revision" date, and
  showing Reading Time/Department twice on one page would have reintroduced the same "duplicate
  information" problem the Homepage UX Cleanup (v1.1) eliminated on the homepage. Word Count,
  Replies, and Views are dropped — not requested, and Replies/Views duplicate what Discourse's own
  chrome already shows elsewhere on the page. Document Footer (the end-of-document "closing stamp"
  on `topic-below-post-stream`, after the entire post stream) was deliberately left untouched
  despite a similar field list — a genuine bookend pair by design, not a second redundant copy.
- Every field reuses an existing resolver: `service:ddi-document-metadata`'s already-cached
  `getMetadata()` for Document Number/Classification/Department/Revision/Reading Time,
  `lib/ddi-lifecycle.js#getLifecycleLabel()` (same `"ACTIVE"` fallback Dossier Header already uses)
  for Lifecycle, and `service:ddi-related-intelligence`'s already-cached `findRelated()` — the same
  call Intelligence Network already makes for this topic — for the Related Documents count. No new
  fetch, no new parsing, no new service.
- "Last Reviewed" has no field of its own (`docs/ddi-document-metadata-standard.md` §4.8: optional,
  "not yet stored") — reuses `metadata.updatedDate` as the proxy, the identical known-simplification
  `ddi-timeline.js`'s own "Reviewed" lifecycle event already established for the same gap, not a
  new decision.
- Compact two-column grid: reuses `.ddi-intel-grid`'s existing item typography verbatim (the same
  pattern Verification Panel/Debug Panel/Document Footer/Revision History already use) with a
  `grid-template-columns: repeat(2, 1fr)` override scoped to `@media (min-width: 601px)` — replaces
  only the 3-column desktop default, leaves `.ddi-intel-grid`'s own 600px single-column mobile
  collapse untouched and reused.
- Title is a real `<h2>`, not `<h1>` — the opposite call from the Homepage Hero, and deliberately
  so: a topic page already has a native `<h1>` (Discourse's own `.topic-title h1`, confirmed
  directly), so a second one repeating the same text would be a real duplicate-heading problem, not
  a style choice.
- Classification color reused via the existing `{{classificationClass}}` → `--ddi-accent` →
  `.ddi-card`'s `border-left` mechanism Dossier Header already relies on; the Classification value
  text additionally picks up `color: var(--ddi-accent, #b51d1d)`, the same token and fallback.
- Glass panel reuses Mission Briefing's (v1.2) `--ddi-bg-panel` + `backdrop-filter: blur(4px)` +
  `--ddi-shadow-lg` combination — the DDI-flavored variant of Discourse's own native panel
  treatment, not a new one.
- Caught and fixed before shipping: an earlier draft used the Related Documents count's own
  truthiness to detect "still loading," which would have shown "—" forever for any document with
  genuinely zero related documents (`0` is falsy). Split into a real `relatedCount` number plus a
  separate `isRelatedCountLoaded` boolean the template branches on instead.
- Verified directly: five scenarios against the actual connector logic (full metadata, missing
  topic/metadata, untagged document falling back correctly, zero related documents displaying `0`
  not the loading placeholder, and a component destroyed before `findRelated()` resolves). Metadata
  rendering doesn't depend on document type at all, so it's correct for every document type by
  construction. Filename-sort ordering re-verified after the rename. `node --check` clean; `sass`
  compiles cleanly; `settings.yml` re-validated as YAML (19 settings); a repository-wide
  duplicate-selector scan found nothing new; `.ddi-intel-grid`'s other four existing consumers
  confirmed untouched.

## 2026-07-30 — v1.2.1: Homepage visual polish

Pure CSS/markup polish on the Hero and Mission Briefing shipped in v1.2 below — no new sections, no
new settings, no new data. Same two files touched throughout:
`connectors/above-main-container/ddi-homepage-hero.{js,hbs}` and `common/common.scss`.

- **Tighter Hero → Mission Briefing seam.** `.ddi-mission-briefing-content`'s top padding cut
  roughly in half (56px → 32px desktop, 40px → 24px mobile) so the two read as one continuous
  landing sequence rather than two stacked blocks. Bottom padding (before the next, unrelated
  section) is unchanged.
- **Fixed a real double-spacing bug while auditing rhythm, not just eyeballing new numbers.**
  `.ddi-card`'s own `margin: 24px 0` doesn't collapse against a flex/grid `gap` the way block-level
  sibling margins collapse against each other — every Mission Briefing card was silently adding its
  own 24px on top of the section's 32px flex gap (and the pillar grid's 16px gap), an un-audited
  side effect from when the section first shipped. Reset to `margin: 0` on all four card types so
  `gap` is the one source of truth; base gap also tightened 32px → 24px (20px on mobile) now that
  the double-counting is gone.
- **Mission Statement is now the section's visual centerpiece**, as required: centered layout, a
  3px top accent (`--ddi-red`) replacing `.ddi-card`'s usual asymmetric left border — which reads
  oddly against centered text — and its own text bumped from `.ddi-card-body`'s 0.98rem to 1.6rem
  (1.25rem on mobile), `--ddi-white` instead of the dimmer default body color, constrained to a
  640px reading width so the larger type doesn't produce overlong lines. Every value is an existing
  token; nothing new was introduced to the color or type scale.
- **Executive Command Welcome gets a signature footer** — "Issued by Executive Command", small-caps
  and muted above a hairline divider (`--ddi-border-soft`), the same typographic pattern
  `.ddi-hero-stat span`/`.ddi-card-title` already use for a label in this exact register. The three
  existing welcome paragraphs are untouched, per "preserve the existing copy."
- **Division cards gained a "Primary Function" metadata line** (Strategic Leadership, Defense &
  Protection, Industrial Production, Frontier Discovery, Mission Coordination, Community &
  Outreach — one new short `role` field per division, alongside the existing `icon`/`description`,
  same static-content-only shape) between the description and the "View Division" link, marked up
  as a `<dl>`/`<dt>`/`<dd>` — the semantically correct element for a label/value pair — styled with
  the same uppercase-label-over-value pattern `.ddi-hero-stat` already uses. Card heights stay equal
  within a row unchanged: CSS Grid's default `align-items: stretch` already equalized pillar card
  heights before this release, and adding one more child element identically to all six cards
  doesn't change that mechanism.
- **Glassmorphism, hover treatment, and every design token are unchanged** from v1.2 — this release
  only adjusts spacing, the Mission Statement's own typography/border, and adds the two new small
  content elements above; it does not touch `--ddi-bg-panel`/`backdrop-filter: blur(4px)`/
  `--ddi-shadow-lg`/`--ddi-shadow-glow` or introduce any new ones.
- No tablet-specific breakpoint was added: the pillar grid's existing `auto-fit`/`minmax(300px,
  1fr)` already reflows fluidly (3 columns desktop, 2 columns ~700-900px tablet widths, 1 column
  ≤600px) without one, confirmed by checking the actual column math at 768px/1024px/1100px+ rather
  than assumed.
- Verified directly: `node --check` clean; `sass` compiles `common/common.scss` cleanly; a
  repository-wide exact-selector duplicate scan re-run clean (the only exact duplicate anywhere in
  the file remains the pre-existing, already-verified-legitimate `.timeline-footer-controls`
  base+override, unrelated to this change); `settings.yml` unchanged and still valid (18 settings —
  this release added no new settings). Lighthouse itself wasn't run (no browser tooling in this
  environment); reasoned instead: no new network requests, no new JS beyond one extra static field
  passed through an existing `{ ...pillar }` spread, and the `backdrop-filter` element count is
  unchanged from v1.2 (this release restyles existing glass surfaces, it doesn't add new ones).

## 2026-07-30 — v1.2: Mission Briefing

- New static "Mission Briefing" section directly beneath the homepage hero — an Executive Command
  Welcome message, DDI's mission statement, all **six** official Operational Divisions as pillar
  cards (Executive Command, Fleet Security, Commerce/Industry/Manufacturing, Exploration & Survey,
  Contract Support Services, Public Affairs — same names, slugs, and order as
  `lib/ddi-department.js`'s `DEPARTMENTS`, none invented or renamed), each with an icon, a short
  description, and a link to its Division page, and a 6-item Mission Objectives checklist. Gated by
  new `ddi_mission_briefing_enabled` (default on), independent of `ddi_homepage_hero_enabled` —
  either can be toggled without the other.
- Lives in the same connector as the Hero (`connectors/above-main-container/ddi-homepage-hero.*`)
  rather than a new one on the same outlet, since Discourse doesn't guarantee render order between
  multiple connectors on one outlet and "directly beneath the Hero" is a hard requirement — plain
  sequential HTML guarantees it instead. `shouldRender()` now mounts if *either*
  `ddi_homepage_hero_enabled` or `ddi_mission_briefing_enabled` is on; each section gates itself
  independently from there.
- Pillar links resolve real `/c/{slug}/{id}` URLs from `service:site`'s categories (the same lookup
  Division Cards/Command Palette already use), falling back to `/categories` if a division hasn't
  been provisioned yet by the admin — never a hardcoded, potentially-broken URL, and never a
  placeholder category invented by the theme.
- Reuses `.ddi-card`/`.ddi-card-title`/`.ddi-card-body`/`.ddi-nav-link`/`.ddi-division-cards-grid`/
  `.ddi-integrity-pass` verbatim (explicitly requested — unlike the Hero, which deliberately avoids
  `.ddi-card`). The pillar grid reuses Division Cards' grid exactly, minus its stats tiles — showing
  document counts would duplicate the Dashboard. Cards additionally reuse this theme's existing
  glassmorphism (Discourse's own native surface panels' `--ddi-bg-panel` + `backdrop-filter:
  blur(4px)` + `--ddi-shadow-lg`, applied here instead of `.ddi-card`'s own near-opaque background)
  and existing hover vocabulary (`--ddi-red-65` border + `--ddi-shadow-glow`, the same pair already
  used by `.ddi-reading-list-card:hover`) — no new blur value, color, or shadow token introduced.
  Only the full-bleed wrapper, content column, glass/hover rules, and pillar icon styling are new
  CSS; a repository-wide duplicate-selector scan confirmed nothing else was introduced.
- Section titles use real `<h2>`/`<h3>` elements (still styled via the existing `.ddi-card-title`
  class, zero visual change) rather than this codebase's usual title `<div>`s, extending the same
  reasoning the Hero's own `<h1>` established: genuinely narrative content benefits from real
  heading structure. Icons and objective checkmarks are decorative (`aria-hidden="true"`).
- "Support dark mode" is satisfied the way every other DDI panel already is — every color drawn from
  the existing `:root` dark-token scale. This theme has never had a light variant to toggle between.
- Shares the Hero's exact route guard (homepage only — hidden on topic pages, admin, `/categories`,
  and individual division pages, which already have their own header treatment).
- Verified directly: extracted the actual `MISSION_PILLARS`/`MISSION_OBJECTIVES` data from the real
  source file and confirmed — 6 pillars, exact slug/order match against `lib/ddi-department.js`'s
  `DEPARTMENTS` (none missing, none extra, none duplicated), 6 objectives matching the requested
  text exactly, and all 6 pillar URLs correct against fully/partially/un-provisioned
  `site.categories` mocks. `shouldRender()`'s either-setting logic and both sections' independent
  `show*` gating verified, including hero-off/briefing-on and the reverse; the shared route guard
  hiding both sections together on every excluded route. `node --check` clean; `sass` compiles
  cleanly; `settings.yml` re-validated as YAML (18 settings); a repository-wide duplicate-selector
  scan re-run clean after the glassmorphism/hover additions. No new service, fetch, or archive
  parsing. Lighthouse itself wasn't run (no browser tooling available in this environment) — reasoned
  instead: zero new network requests (the glassmorphism is CSS already shipped in the same
  stylesheet), zero new JS beyond a `.find()` over 6 static items reusing the same cached
  `getIndex()` call the Hero already makes; `backdrop-filter: blur(4px)` is a real, if modest,
  additional paint cost on 8 more elements on the homepage specifically, stated plainly rather than
  claimed as literally free, since it's a genuine tradeoff for the requested visual treatment, not a
  zero-cost one.

## 2026-07-29 — Branding audit: DDC → DDI

- Retired every remaining user-facing "DDC (Dagger Defense Corporation)" reference in favor of "DDI
  (Dagger Defense Industries)" — the theme's own file/service/class prefix has been `ddi-`/`Ddi`
  all along, so this closes the last inconsistency between that and the archive's own in-universe
  branding, rather than requiring any code identifier renames.
- Live, user-facing text changed: the Homepage Hero's `<h1>` (`ddi-homepage-hero.hbs`) and the
  Document Breadcrumb's archive label (`ddi-document-breadcrumb.js`'s `ARCHIVE_LABEL` constant —
  the constant's *name* is unchanged, only its string value) both now read "DDI Intelligence
  Archive" instead of "DDC Intelligence Archive."
- Documentation corrected for consistency: `README.md`'s opening description; `ARCHITECTURE.md`'s
  Document Breadcrumb and Homepage Hero sections (both were quoting the old label verbatim); and
  5 `docs/` design notes (`ddi-archive-information-architecture.md`, `ddi-document-metadata-
  standard.md`, `ddi-intelligence-archive-dashboard.md`, `ddi-command-network-interface.md`,
  `ddi-prototype-audit.md`) — including the proposed top-level category slug
  `ddc-intelligence-archive` → `ddi-intelligence-archive` in the two docs that named it, and two
  spelled-out "Dagger Defense Corporation" mentions → "Dagger Defense Industries."
- `CHANGELOG.md`'s own 2 pre-existing mentions of "DDC Intelligence Archive" (describing the
  Document Breadcrumb's and Homepage Hero's original shipped text) were deliberately left
  unchanged — this file is this project's historical record of what was true when each entry was
  written, the same reason past "Timeline"→"Browse Archive" and other rename entries were never
  rewritten either; this entry is how the rename itself gets recorded going forward.
- Verified clean, not assumed: a case-insensitive, whole-repository sweep for `ddc`,
  `Corporation`/`Corp`, and spacing/punctuation variants (`D.D.C.`, `D D C`) found zero remaining
  occurrences outside the two intentionally-preserved `CHANGELOG.md` history entries above.
  Watermarks, theme setting descriptions, `settings.yml`, `CONTRIBUTING.md`, `about.json` (already
  "DDI Internal Command Network"), and every `alt=` attribute in the theme were all confirmed
  already clean — nothing there needed changing.
- No internal identifiers renamed: every `ddi-*` filename, service lookup string, service class
  name, and cache already used the correct prefix before this audit, since "DDI" was already the
  code-level convention throughout. Zero behavior change beyond the display text listed above.
  `node --check` clean on all 75 theme JS files; `settings.yml` re-validated as YAML.

## 2026-07-29 — v1.2: Cinematic Homepage Hero

- New full-bleed hero (`connectors/above-main-container/ddi-homepage-hero.*`, gated by new
  `ddi_homepage_hero_enabled`, default on) above everything else on the true homepage: background
  image, dark gradient overlay, the site's logo, "DDC Intelligence Archive" as the page's `<h1>`,
  an optional subtitle, three headline archive statistics (Total Documents, Divisions,
  Classification Levels), and two actions (Browse Archive, View Divisions).
- Background image is a new `type: upload` setting (`ddi_hero_background_image`) — this theme's
  first — so an admin can replace it entirely by uploading a new image, no code change needed.
  Left empty by default; the hero's own dark gradient still renders a complete, intentional-looking
  banner with zero configuration. Subtitle is a new `type: string` setting (`ddi_hero_subtitle`,
  a real default provided) that hides itself entirely when cleared.
- Genuinely full-bleed by construction: `above-main-container` renders as a sibling before
  `#main-outlet` opens, not nested inside its 1700px max-width/padding, so no CSS override was
  needed to escape a constrained parent — a `calc(50% - 50vw)` full-bleed rule is included only as
  a defensive measure.
- Scoped to the true homepage only — narrower than Browse Archive/Intelligence Dashboard, which
  both also render on `/categories` and every division page. The hero hides on both, reusing
  `ddiCategoryContext.isCategoriesIndexRoute()`/`getCurrentCategory()` unmodified, since Division
  Cards/Division Header already fill the same "orient the visitor" role on those routes.
- Zero new data sources: statistics reuse `services/ddi-intelligence-index.js#getIndex()` +
  `lib/ddi-archive-statistics.js#buildArchiveStatistics()` verbatim, the exact pipeline Intelligence
  Dashboard already uses on the same page — the two now share one cached `getIndex()` build via the
  Performance Audit's own cache, so adding this second consumer doesn't reintroduce a duplicate
  archive-wide fetch. "Browse Archive" reuses the same scroll-anchor technique Document Actions and
  Command Palette already established, and hides itself using the same gate Command Palette's own
  "Browse Archive" entry uses when neither underlying view setting is on.
- Background and logo are real `<img loading="lazy" decoding="async">` elements, not a CSS
  `background-image` — native lazy loading is a real, inspectable browser feature this way, with no
  hand-built `IntersectionObserver` needed. Both are decorative (`alt="" aria-hidden="true"`); the
  `<h1>` and subtitle carry the actual content.
- Collapses cleanly on mobile at this theme's one established breakpoint (≤600px): shorter
  min-height, smaller type, and the stats/actions rows both switch from horizontal to stacked
  rather than wrapping mid-label.
- Two confidence caveats, consistent with this theme's established practice for first-time API
  usage: `service:site-settings`'s `logo_url` (absent/falsy gracefully hides the logo, no crash);
  `type: upload`'s resolved-URL behavior is treated with higher confidence, being a long-standing,
  widely-used Discourse theme mechanism.
- Verified directly: the full route-guard matrix (topic, admin, `/categories`, a division page,
  the true homepage) exercised against a mocked `setupComponent`; graceful handling of a missing
  logo URL, an empty archive, an empty background image, and an explicitly-cleared subtitle; the
  Browse Archive button's setting-based gate; the `isDestroying`/`isDestroyed` guard blocking a
  stats update after teardown. `node --check` clean; `sass` compiles cleanly; `settings.yml`
  re-validated as YAML (17 settings). Zero new event listeners, `MutationObserver`s, or
  `IntersectionObserver`s — the only interactivity is one framework-managed `{{on "click"}}`.

## 2026-07-29 — v1.1: Release audit and cleanup

- Full repository audit ahead of tagging v1.1.0: connectors, services, `lib/`, SCSS, templates,
  `settings.yml`, and every top-level doc, checked against every item in the audit's checklist
  (duplicate functionality, dead connectors, orphan exports, unused settings, duplicated CSS,
  duplicate service calls, inconsistent naming, stale documentation, outdated comments, TODO/FIXME
  markers, deprecated Ember/Discourse APIs, unnecessary observers/listeners).
- Mechanical checks came back clean: 0 TODO/FIXME markers, 0 remaining `{{action}}` usages, 0
  deprecated Ember Native Array Extensions (`findBy`/`filterBy`/etc.), 0 unused imports, 0 orphan
  `lib/` exports, every `services/*.js` file referenced by at least one consumer, every connector's
  `.js`/`.hbs` pair matched, only one exact-duplicate CSS selector found and confirmed legitimate
  (a shared base rule plus an intentional override, not accidental duplication).
- Fixed the real findings, all documentation/comment-only (zero behavioral impact):
  - `ARCHITECTURE.md`'s "Archive-Wide Components" summary still described the deleted
    `ddi-intelligence-index.*` connector by name — updated to describe the current
    `ddi-browse-archive.*` merge.
  - The "Command Palette Expansion (v1.1)" section still described its "Open Timeline" entry and
    `#ddi-timeline-view` target as current — annotated with the later Browse Archive rename rather
    than silently rewritten, preserving when each thing actually happened.
  - The `settings.yml` summary in `ARCHITECTURE.md`'s Known Gaps, `CONTRIBUTING.md`, and
    `README.md` all still said "12 settings, 8 wired" from before this session's two new v1.1
    settings (`ddi_document_actions_enabled`, `ddi_document_author_assistant_enabled`) — corrected
    to 14/10 in all three places.
  - `README.md` still framed the project as "Approaching a Version 1.0 release" (already shipped),
    was missing Document Actions and the Document Author Assistant from its feature summary and
    settings table entirely, listed a non-existent `common/header.html`, and its documentation index
    was missing 4 of the 10 files actually in `docs/` — all corrected.
  - `javascripts/discourse.js` carried a stale comment (referencing a pre-changelog `v0.2.1` label
    and a claim about DOM injection that stopped being true once `ddi-dossier-refresh.js` shipped)
    and tab indentation inconsistent with this repo's 2-space standard — reworded and reformatted;
    the no-op initializer's behavior is unchanged.
- Nothing was found to need removal or refactoring beyond the above — `assets/ddi-logo.png`
  (unreferenced, previously flagged) and the 4 reserved `settings.yml` entries remain exactly as
  the prior RC audit deliberately left them, both explicit human-call-not-unilateral decisions this
  audit re-confirmed rather than re-litigated.
- Re-ran full verification after cleanup: all 74 theme JS files pass `node --check`, `sass` compiles
  `common/common.scss` cleanly, `settings.yml` re-validated as YAML (14 settings), unused-import and
  orphan-export sweeps clean.

## 2026-07-29 — v1.1: Archive browsing performance pass

- Audited all 10 named archive-browsing surfaces (Homepage Dashboard, Browse Archive, Timeline,
  Search decoration, Knowledge Graph, Citation Preview, Related Documents, Reading Lists,
  Favorites, Command Palette) for duplicate requests, repeated parsing, unnecessary DOM/observer
  work, and cache misses, against the earlier Performance Audit's own baseline.
- Fixed the one real gap: `ddi-citation-preview.js#getCitation(topic)` wrote to its own cache but
  never read from it, so every call rebuilt the citation from scratch — including a
  `/t/{id}.json` revision-fallback fetch per topic, since `/latest.json` results never carry
  `post_stream`. `getCitation()` and `getCitationById()` now share one cache Map, both reading and
  writing through it (the citation-building logic itself moved unchanged into a new
  `_buildCitation()` that neither entry point's cache check re-enters, avoiding a Promise-awaiting-
  itself deadlock the naive merge would have caused — verified directly).
- `ddi-intelligence-index.js#getIndex(filters)` is now cached per filter key for the session (same
  Promise-Map pattern used throughout this codebase) — up to 5 independent callers on a single page
  view were each rebuilding the full archive-wide citation set from scratch: Browse Archive and
  Intelligence Dashboard on the homepage/category pages, Division Cards and Division Header on a
  category page, and Archive Navigation on every topic page view. Division Cards alone calls
  `getIndex()` once per division (6 calls) on the `/categories` index.
- One accepted, explicitly-documented tradeoff: `revision` is now frozen for the session on first
  resolution, matching the freshness `getCitationById()`'s callers (Reading Lists, Favorites,
  Related Documents, Command Palette) already had — this closes an inconsistency between two entry
  points into the same cache rather than introducing a new staleness policy.
- Considered and deliberately left alone: `ddi-favorites.js#getFavorites()` stays uncached —
  bookmark state changes from multiple surfaces this theme doesn't control, so every call needs to
  reflect what actually just happened. Command Palette, Search decoration's `MutationObserver`,
  Knowledge Graph, and Reading Lists' own reading-time cache were all re-verified already correct
  from the earlier Performance Audit and left untouched.
- No listener, observer, or lifecycle hook was added, removed, or changed — this pass is entirely
  at the service-cache layer, so listener/observer cleanup verification reduced to confirming none
  were touched.
- Measured directly: a mocked mixed-page-view simulation (3 no-filter + 2 same-department
  `getIndex()` calls, 500-document archive) showed revision fetches and citation rebuilds both
  dropping from 2,500 to 500 (80% reduction); a second simulation of Division Cards' actual
  6-division `/categories` page load showed revision fetches dropping from 3,000 to 500 (83%
  reduction), with `getIndex()` still correctly running once per genuinely-distinct filter. Cache
  correctness confirmed for different filter keys returning independently correct results, not a
  merged one. `check-unused-imports.py`/`check-orphan-exports.py` re-run clean; `node --check`
  clean on all 74 theme JS files. No CSS, markup, or connector-facing return shape changed.

## 2026-07-29 — v1.1: Document Author Assistant

- New composer-time guidance panel (`connectors/composer-fields/
  ddi-document-author-assistant.*`, gated by new `ddi_document_author_assistant_enabled`, default
  on): shows only while creating a new topic or editing an existing document's first post (never
  for replies), and marks 9 items ✓ Valid or ⚠ Needs attention in real time as the draft changes —
  Document Number, Classification, Department, Document Type, Lifecycle, Executive Summary, H2
  Sections, Cross References, Related Documents. Purely informational: never blocks publishing,
  never auto-corrects anything, never touches the composer beyond displaying itself.
- Zero validation logic reimplemented. `lib/ddi-integrity.js`'s `checkClassification`/
  `checkDepartment`/`checkDocumentType`/`checkLifecycle` — the same functions the topic-page
  Verification Panel already renders — are now individually exported (purely additive, existing
  callers unchanged) and reused against a small adapter built from composer state. Cross References
  and Related Documents reuse `findDocumentReferences()`/`findDocumentRelationships()` directly
  against the raw draft body. Document Number reuses `formatDocumentId()`.
- Executive Summary and H2 Sections have no prior dedicated library (the closest precedent is a
  one-line cooked-HTML query inline in two other connectors), so they're new, minimal, synchronous
  raw-Markdown checks in a new `lib/ddi-document-author-assistant.js` — deliberately not cooking the
  draft client-side just to reuse those cooked-HTML queries, which would have added new async
  indirection for no benefit.
- First feature in this theme to touch the composer. Looks up `service:composer` directly rather
  than trusting the `composer-fields` outlet's own `args` shape. Flags `creatingTopic`/
  `editingPost`/`editingFirstPost` as an unconfirmed-against-a-live-instance confidence caveat (same
  class as this theme's existing Post-bookmark-toggle feature-detection), with a same-answer
  fallback (`post.post_number === 1`) if `editingFirstPost` is ever absent.
- Real-time updates via Ember's classic `addObserver`/`removeObserver` on the Composer model's
  `reply`/`title`/`categoryId`/`tags` (not polling, not DOM scraping), torn down via
  `{{will-destroy}}` — the same did-insert/will-destroy lifecycle pattern already used for Knowledge
  Graph Viewer and Document Integrity Dashboard — so no observer is left registered on the
  composer model after the panel is destroyed.
- Deduplicated during implementation: `lib/ddi-integrity.js`'s private `result()` formatter was
  exported and reused rather than copied a second time into the new lib, caught before this task's
  own "remove duplicate logic" verification step.
- Reuses `.ddi-card`/`.ddi-card-title` and the Verification Panel's own `.ddi-integrity-pass`/
  `.ddi-integrity-warn` status colors verbatim; only a new compact single-column checklist layout
  was added, sized for composer width rather than a full-width homepage/topic-page card. Each row's
  longer explanation is a native `title` tooltip, not always-visible text, keeping the panel to
  exactly the task's "✓ Valid / ⚠ Needs attention" display.
- Verified directly: all 9 checks exercised against mocked drafts (empty, blank, fully valid,
  partial, heading-only, unrecognized category) — no throws, correct valid/warn outcomes in every
  case. A separate mock simulation of the observer wiring confirmed real-time recompute on every
  watched-property change, correct category resolution, full observer cleanup on teardown, and that
  `isDestroying`/`isDestroyed` guards block any post-destroy work. `check-unused-imports.py`/
  `check-orphan-exports.py` re-run clean; `node --check` clean on all 74 theme JS files;
  `settings.yml` re-validated as YAML; `sass` compiles `common/common.scss` cleanly.

## 2026-07-29 — v1.1: Homepage UX cleanup — Browse Archive

- Merged the homepage/category-page Intelligence Index (alphabetical) and Intelligence Timeline
  (year-grouped) cards into one "Browse Archive" section with a tab switcher, so the two no longer
  render back to back showing the same document set twice in a row. Both views are fully preserved
  and independently togglable via their existing settings (`ddi_intelligence_index_enabled`,
  `ddi_timeline_view_enabled`); if only one is on, that view renders with no switcher, matching
  prior behavior exactly.
- `connectors/below-main-container/ddi-timeline-view.js`/`.hbs` and `ddi-intelligence-index.js`/
  `.hbs` are retired; `ddi-browse-archive.js`/`.hbs` replaces both, reusing the untouched
  `lib/ddi-route-guard.js#isExcludedRoute()` and `lib/ddi-timeline-view.js#groupDocumentsByYear()`.
- Fixes a real duplicate service call as a direct consequence of the merge, not just visual
  deduplication: the two retired connectors each independently called
  `service:ddi-intelligence-index`'s `getIndex()` with identical arguments on every render; the
  merged connector calls it once and derives both views from that single result.
- Tab bar uses the standard ARIA tabs pattern (`role="tablist"`/`"tab"`/`"tabpanel"`,
  `aria-selected`/`aria-controls`/`aria-labelledby`); full roving-tabindex arrow-key navigation was
  scoped out as disproportionate for a 2-option switcher — both buttons already reach via Tab and
  activate via native `<button>` semantics.
- Fixed a dependency the merge would have silently broken: Command Palette's "Open Timeline" entry
  scroll-anchored to `#ddi-timeline-view`, an id only the now-deleted template carried. Found via a
  repository-wide grep before deleting anything. Renamed to "Browse Archive," gated on either
  underlying setting, retargeted to the merged component's `#ddi-browse-archive` id, with its
  `special` dispatch value and helper function renamed to match end to end.
- No new CSS beyond the tab bar itself (`.ddi-browse-archive-tabs`/`-tab`/`-tab-active`); every
  other class each view's markup uses is reused verbatim from the retired templates. Neither
  retired wrapper class carried any dedicated CSS, confirmed by grep before deletion.
- Verified directly: single `getIndex()` call per render confirmed from source; ARIA
  id/target cross-references checked by hand; responsive layout re-checked against this theme's
  existing 320–1024px content-width methodology with `flex-wrap` applied defensively to the tab
  bar; `check-unused-imports.py`/`check-orphan-exports.py` re-run clean after deletion; `node
  --check` clean on all touched files; `settings.yml` re-validated as YAML.

## 2026-07-28 — Maintenance: fix `discourse.template-action` deprecation warning

- Replaced every deprecated `{{action "name" ...}}` template usage (28 occurrences, across the six
  connectors with any interactive buttons: Knowledge Graph Viewer, Intelligence Timeline, Document
  Integrity Dashboard, Reading Lists, DDI System Status Dashboard, Document Actions) with `{{on
  "click" ...}}`, using `{{fn}}` to pre-bind arguments where an action took any. Confirmed via a
  repository-wide search for `{{action`, `action=`, and `(action ...)` before and after: zero legacy
  template-action syntax remains anywhere.
- Pure syntax migration — no behavior change. Every replaced button was already `<button
  type="button">` (verified per call site before touching any of them), which has no native browser
  default action to prevent, so `{{action}}`'s implicit `preventDefault()` was already a no-op and
  dropping it changes nothing observable; keyboard activation (Enter/Space) is native `<button>`
  behavior, unaffected by which API wires up the click handler.
- The real adaptation: `{{action}}`'s automatic `this`-binding has no equivalent under `{{on}}`, so
  every action method that relied on it (`this.set(...)`, `this.someService.method()`, etc.) was
  moved out of each connector's `actions: {}` hash into a plain closure over `component` (and any
  already-captured service, e.g. `ddiReadingLists`) — the identical free-function, no-`this` pattern
  already established for this theme's `{{did-insert}}`/`{{did-update}}`/`{{will-destroy}}` handlers,
  applied to the last places still depending on the opposite guarantee. Every method body is otherwise
  unchanged: same conditions, same service calls, same async/error-handling paths, same argument
  lists — confirmed by grepping every touched file afterward for any stray `this.` that should have
  been renamed (none found; only explanatory comments remain).
- Removed the now-dead `actions: {}` hash entirely from all six connectors — nothing referenced it
  once every button switched to a direct property lookup.
- Verified directly: all touched files re-confirmed syntactically valid; `{{fn}}`'s argument-passing
  order mocked and confirmed to match `{{action}}`'s own; the trickiest migrated actions (Reading
  Lists' async `share`/`toggleReadingListMembership` with their `isDestroying` guards, Document
  Actions' `toggleFavorite`, System Status's cross-dialog handoff, Knowledge Graph's `resetView`)
  individually re-verified against mocked components for identical outcomes. Two stale
  `ARCHITECTURE.md` mentions of `{{action}}` as the live pattern corrected in place. Zero unused
  imports, zero orphaned exports, zero deprecated Ember APIs, zero console/debug statements — all 72
  theme JS files re-verified syntactically valid.

## 2026-07-28 — v1.1: Command Palette Expansion — the primary navigation hub

- Six new Command Palette entries: Open Reading Lists, Open Favorites (already existed, re-grouped
  rather than duplicated), Open Timeline, Open Knowledge Graph, Open Integrity Dashboard (staff), Open
  System Status Dashboard (staff). Directly closes a gap the Post-Release Product Review named
  concretely: the palette "doesn't know about half the product."
- Every entry reuses something that already exists — no new dialog, route, or service:
  - Reading Lists, Integrity Dashboard, and System Status call each dashboard's existing `open()`
    service method directly, the same method their own trigger buttons already call.
  - Knowledge Graph (only offered while already on a topic route) scroll-anchors to
    `#ddi-knowledge-graph-viewer`, the exact same element `id` Document Actions' own "Open Knowledge
    Graph" action already scrolls to.
  - Timeline scroll-anchors to a new `id` on its existing outer card if already on the page, or
    navigates to `/` and defers the scroll to `api.onPageChange()` (one `requestAnimationFrame` frame,
    the same "wait for render" technique `ddi-document-toc.js` already uses) otherwise.
- **Prerequisite: `services/ddi-system-status.js`'s dialog state (`isOpen`/`isLoading`/`status`)
  moved from its connector onto the service itself** — the identical move `ddi-integrity-dashboard.js`
  already made, needed for the identical reason: Command Palette can't open a dialog whose open/closed
  state lives as local component state on a different connector. The connector's own `open`/`close`/
  `openIntegrityDashboard` actions are now thin delegating wrappers; no change to its own trigger
  button or visible output.
- New entry types `"tool"` ("Archive Tools") and `"staff"` ("Staff Tools") for grouping — Favorites
  moved from `"action"` into `"tool"`, a deliberate re-grouping (it belongs with the other
  open-a-panel entries, not static-page navigation), not an oversight.
- Staff entries are gated on both their own settings.yml flag and `currentUser.staff` — the identical
  double gate each staff dashboard's own `shouldRender()` already applies — so a non-staff user never
  sees them exist, not shown-but-disabled.
- Keyboard: Tab/Shift+Tab now jump to the next/previous section's first entry, wrapping at either end
  — the only available improvement that doesn't regress anything, since Tab was already an effective
  no-op inside the palette (the shared modal utility's Tab-trap finds only one focusable element, the
  input, and just re-focuses it). Verified by simulating both the modal's capturing-phase listener and
  the new bubbling-phase listener firing in their real order: the modal's harmless no-op still runs
  first, the section jump still runs after, and focus never leaves the input either way.
- Consolidated a routing check found duplicated while implementing this: `api.onPageChange()`'s own
  inline "is this a topic route" check now calls the same `isTopicRoute()` helper the new Knowledge
  Graph gating introduced, instead of each independently re-deriving the same answer.
- Verified directly: entry visibility across every staff/route/setting combination; `activate()`'s
  dispatch for all six new entries plus the pre-existing fallback, confirming no cross-contamination;
  Timeline's same-page vs. cross-page branches; section-jump forward/backward/wrap behavior; the
  System Status migration's cross-dialog handoff to Integrity Dashboard and single-source-of-truth
  reactivity. No new files added. Zero unused imports, zero orphaned exports, zero deprecated Ember
  APIs, zero console/debug statements — all 72 theme JS files re-verified syntactically valid.

## 2026-07-27 — v1.1: Document Actions — Add to Reading List, Favorite, Knowledge Graph, Share

- First v1.1 feature, built directly from the Post-Release Product Review's own findings: a compact
  action bar near the Dossier Header (`connectors/topic-above-post-stream/ddi-document-actions.*`)
  with Add to Reading List, Add/Remove Favorite, Open Knowledge Graph, and Share Document. Gated by a
  new `ddi_document_actions_enabled` setting (default on), matching every other DDI panel's own
  settings convention.
- Every action reuses an existing service unchanged — no new storage, no new document-lookup code, no
  new fetch logic anywhere in this feature:
  - Add to Reading List calls `ddiReadingLists.addDocument()`/`removeDocument()` directly, the same
    methods the Reading Lists dialog itself uses; a new pure helper,
    `lib/ddi-document-actions.js#buildReadingListOptions()`, only reshapes already-fetched list data
    for the dropdown (list name + current-document membership), the same role
    `groupDocumentsByYear()` already plays for Timeline.
  - Add/Remove Favorite reuses `ddiFavorites.getFavorites()`/`removeFavorite()` unchanged for
    removal. Deliberately no new "add bookmark" implementation — `ddi-favorites.js` never built one
    by design, relying on Discourse's native bookmark UI; this feature feature-detects
    `post.toggleBookmark`/`toggleBookmarkWithReminder` on the topic's first post instead (a
    `addKeyboardShortcut`-class confidence caveat, not confirmed against a live instance — see
    ARCHITECTURE.md) and hides Add Favorite entirely if neither exists, rather than risk a broken or
    duplicate bookmark flow.
  - Open Knowledge Graph doesn't re-run `ddiKnowledgeGraph.getDocumentGraph()` (which would duplicate
    the Knowledge Graph Viewer connector's own graph-building work) — it scroll-anchors to that
    connector's existing output instead, via one added `id` attribute on its outer card.
  - Share Document copies the document's own canonical URL, computed with the same inline formula
    already used in three other files, via the identical clipboard-write-with-fallback pattern
    `ddi-reading-lists.js`'s own Share already established.
- Every async action (`toggleFavorite`, `share`, `toggleReadingListMembership`) guards
  `isDestroying`/`isDestroyed` before calling `set()` — the exact convention the v1.0 RC audit found
  missing in one place (`ddi-reading-lists.js`'s `share()` action) and fixed there; not repeated here.
- Verified directly: the pure reshaping helper exercised for membership true/false/empty/null input;
  every connector action mirrored against mocked services (no live Ember runtime available),
  including reading-list add/remove argument types, favorite removal's found/not-found/
  server-failure paths, favorite add's toggle-present/absent/throwing paths (confirming no
  optimistic state flip on success), share's clipboard success/failure paths, the Knowledge Graph
  anchor's safe no-op when absent, and that no action calls `set()` after the component starts
  destroying mid-await. Zero unused imports, zero orphaned exports, zero deprecated Ember APIs, zero
  console/debug statements — all 72 theme JS files (including the 2 new to this feature)
  re-verified syntactically valid.

## 2026-07-27 — Version 1.0 release preparation

- **`about.json` version bump: `0.2.1` → `1.0.0`.** The first time `version`/`theme_version` has
  been touched since the project's early ad hoc-labeled commits (see the versioning note above) —
  this is the release this changelog's dates have been building toward.
- **Removed `lib/ddi-relationship.js`'s `isValidRelationshipType()`** — confirmed zero references
  anywhere in the codebase (not even internally; `findDocumentRelationships()` never called it
  either) via a repo-wide grep before removing it, not assumed. An earlier version of
  `ARCHITECTURE.md`'s **Document Relationships** section defended keeping it exported as
  forward-looking API surface, on the same reasoning as `ddi-document-type.js`/`ddi-lifecycle.js`/
  `ddi-department.js`'s own `isValid*` siblings; corrected in place, since — checked, not assumed —
  those three siblings each have real current consumers and this one never did.
- **Re-verified, clean:** no deprecated Ember array extensions, no `console`/`debugger` statements,
  no unused imports, and (via the same orphan-export sweep that found the item above) no other dead
  exports anywhere in `lib/`. All 72 theme JS files re-confirmed syntactically valid; `common.scss`
  recompiles clean.
- **Confirmed already committed, not re-done:** the Performance Audit changes (shared caches,
  Command Palette debounce, search-results observer fix) landed in `e82cf74`, prior to this pass —
  verified via `git diff HEAD`, not assumed from memory.

## 2026-07-27 — Version 1.0 RC audit: one connector bug fixed, three docs corrected for accuracy

- **`ddi-reading-lists.js`'s `share()` action could throw on a destroyed component.** Its
  `navigator.clipboard.writeText()` promise chain called `this.set("shareStatus", …)` with no
  `isDestroying`/`isDestroyed` guard — the one exception among every async `.then()` +
  `setProperties`/`.set()` call site in the codebase, all individually checked. Brought in line with
  this project's own documented convention (`CODING_STANDARDS.md`'s Connectors section).
- **`README.md`, `CONTRIBUTING.md`, and `ARCHITECTURE.md`'s own Known Gaps section all independently
  claimed settings were essentially unwired** ("`ddi_debug_mode_enabled` is the one exception" /
  "no existing setting is actually read by any code"). Verified directly against every
  `settings.<name>` reference in the codebase: 8 of 12 declared settings are actually wired
  (Homepage Dashboard, Intelligence Index, Timeline, Knowledge Graph Viewer, Reading Lists, Integrity
  Dashboard, System Status, Debug Mode) — only 4 are genuinely still reserved. All three documents
  were frozen at a snapshot from before those six features existed and never updated as each shipped
  its own settings gate. Corrected in all three files. Also removed a second stale claim in
  `README.md` about an "unfixed" classification bug that `ARCHITECTURE.md`'s own Classification
  System section already documents as fixed.
- Full audit (code quality, architecture, UX, accessibility, performance, release prep) delivered as
  a scored report; see that session's summary for the complete findings list — this entry covers only
  what was actually changed in the repository.

## 2026-07-27 — Performance Audit: shared caches replace single-slot memos, eliminate duplicate fetches

- Audited every `lib`/`service`/connector for duplicate service calls, duplicate metadata/cooked-HTML
  parsing, repeated transformations, DOM query patterns, listeners, caches, and loop complexity.
  No feature behavior changed; every fixed function keeps its exact existing public signature.
- **`ddi-document-metadata.js`: single-slot cache → `Map` keyed by topic id.** 10+ connectors plus 3
  services all call `getMetadata()` for the same current topic on one page view; the old single slot
  got evicted by any interleaved archive-wide scan, forcing repeated full re-resolves (classification,
  reading-time analysis, timeline building) of the same document. Left unbounded — small plain data.
- **`ddi-cooked-parser.js`: single-slot memo → bounded (30-entry) LRU `Map`.** Shared by 7+ call sites
  that don't run back-to-back, so the one slot was almost always holding a different document's HTML
  by the next call, defeating the memo. Bounded, not session-cached like the metadata `Map`, since the
  cached value is a full parsed DOM `Document` and an archive scan can touch hundreds of them.
- **`ddi-related-intelligence.js#findRelated()` and `ddi-relationship.js#getRelationships()`: added
  per-topic-id Promise caching.** Both were being called twice, independently, for the same topic on
  every topic page view (Intelligence Network + Knowledge Graph Viewer both call `findRelated()`;
  Document Relationships + Knowledge Graph Viewer both call `getRelationships()`) — real duplicate
  network requests and duplicate regex/parse work, not just a theoretical risk.
- **`ddi-reading-lists.js`: added a reading-time cache keyed by document id.** Every list mutation
  (open, add one document, remove one document) was re-fetching `/t/{id}.json` for *every* document in
  the list, not just the one that changed. Failed fetches evict their cache entry rather than sticking
  a document at "0 minutes" permanently, matching Citation Preview's existing failure handling.
- **Command Palette: search input debounced (120ms).** Previously every keystroke ran a full filter
  pass over the cached document list plus a full result-row rebuild — cost that scales directly with
  archive size. Enter pressed while a refresh is still pending flushes it immediately first, so it
  always activates the result matching what's actually in the input, never a stale query's top hit.
- **`ddi-search-results.js`: `MutationObserver` no longer re-scans the whole results container on
  every mutation.** Each badge insertion is itself a mutation, so the old callback — a full
  `querySelectorAll()` over the container — re-triggered on its own writes, O(n²) in result count for
  a page streaming in results. Now processes each mutation's own `addedNodes` directly; verified by
  simulation at 0 wasted node visits versus 1,275 across 50 results the old way.
- **Considered and deliberately not cached: `ddi-integrity-dashboard.js#_scanArchive()`.** Reopening
  Integrity Dashboard/System Status re-scans the whole archive every time, with no caching — looks
  like the same class of fix as the two services above, but isn't: this dashboard's job is showing
  *current* archive health, and the most likely reason to reopen it is confirming a just-made fix
  worked. Caching the scan risks showing stale "still broken" results in exactly that moment — a
  functional regression, not a win. Left unchanged on purpose; documented as a considered decision.
- Verified via mocked-DOM/service simulations (no `jsdom` dependency in this repo) for every fix:
  identical results on repeat calls, correct results on distinct keys, failure-doesn't-poison-cache
  for the reading-time fix, debounce-collapses-a-typing-burst-to-one-refresh with Enter-mid-burst
  correctness, and 0-vs-1,275-node-visits for the search-results fix. A benchmark simulating 13
  same-topic metadata calls interleaved with a 200-document archive scan showed the metadata `Map`
  eliminating 12 of 13 redundant re-resolves — 61% less simulated wall-clock time in that scenario.

## 2026-07-27 — Mobile & Responsive Audit: CSS-only fixes across every DDI component

- Audited all 18 named DDI components at 320/375/768/1024px against `common/common.scss` (the only
  stylesheet actually compiled into the theme). CSS-only change — no `.hbs`/`.js` file touched, no
  desktop-visible value changed; every fix lives inside a `max-width: 600px` query.
- **`.ddi-dossier-grid`'s fixed `repeat(4, 1fr)` had no responsive handling at all.** Shared unchanged
  by Dossier Header, Document Relationships, Document Navigation, Intelligence Index, and Intelligence
  Network — collapses to one column below 600px, matching `.ddi-intel-grid`'s existing pattern.
- **`.ddi-division-cards-grid`'s `minmax(300px, 1fr)` was a confirmed horizontal-overflow bug**, not a
  hypothetical one — its 300px floor exceeds the actual content width at both 320px (~240px available)
  and 375px (~295px available), forcing a track wider than the page. Used by both Division Cards and
  Reading Lists' "all lists" view. Verified by computing real content width at all four required test
  widths before and after the fix.
- `.ddi-card`'s (and `.ddi-dossier-header`'s) horizontal padding tightens from 28px to 18px below
  600px — reclaims content width across nearly every component and dialog in one shared place.
- `.ddi-command-palette-backdrop` gains a 16px horizontal gutter below 600px — every dialog (Command
  Palette, Favorites, Integrity Dashboard, System Status, Reading Lists) previously stretched flush to
  both screen edges on mobile with zero margin.
- Corner trigger buttons: touch target padding bumped (8px→10px vertical); Reading Lists' trigger
  moves from the opposite corner into the same bottom-right stack as the other two below 600px, ruling
  out a real risk of its label overlapping Integrity Dashboard's on narrow phones — verified by
  computing the resulting stack has ≥10px clearance at the bumped size, not eyeballed.
- Knowledge Graph: canvas height 420px→320px and node tap-target padding bumped below 600px. No
  overflow risk existed here to begin with (nodes are percentage-positioned inside an `overflow:
  hidden` container) — confirmed by inspection, not assumed.
- Confirmed already correct, no change needed: `.ddi-integrity-table` already scrolls horizontally
  within its own `.ddi-integrity-table-wrap` container; Search Results' badge row already wraps;
  Document Footer and Archive Navigation already had their own pre-existing 600px collapses.
- Removed dead/redundant CSS found while auditing: `.ddi-dossier-header`'s `max-width: 760px` was
  unreachable, immediately overridden by `max-width: 100%` later in the same rule; `.ddi-reading-lists-panel`
  re-declared `max-height`/`overflow-y` values already inherited unchanged from
  `.ddi-integrity-dashboard-panel` on the same element.
- Verified by compiling the full stylesheet with `sass` after every change (zero errors, all 15
  `@media` blocks present — 5 pre-existing plus 10 new) and computing exact content widths and
  trigger-button pixel positions at 320/375/768/1024px against every changed selector.

## 2026-07-27 — Modal Accessibility: shared focus-trap/Escape/scroll-lock utility for every dialog

- New `lib/ddi-modal.js` — one `createModal(element, options)` used by all five DDI dialogs (Command
  Palette, Favorites, Integrity Dashboard, System Status, Reading Lists). Provides, per dialog: Escape
  closes; focus trapped inside via Tab (recomputed live against the dialog's actual focusable
  elements on every keypress, not cached at open time); focus restored to whatever was focused before
  opening; `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` (or `aria-label` where there's
  no visible title) set on creation; background scroll locked while any dialog is open, via a
  module-level ref count shared across all instances; every listener removed on close/destroy.
- Refactored all five dialogs onto the shared utility in place of their previous implementations:
  Favorites and Command Palette (raw DOM, in `api-initializers/ddi-command-palette.js`) previously
  had two separately hand-rolled Escape/Tab-trap/focus-restore implementations; Integrity Dashboard,
  System Status, and Reading Lists (classic Ember connectors) had none at all. The three Ember
  connectors wire in via `{{did-insert}}`/`{{did-update}}`/`{{will-destroy}}` — free functions closing
  over a captured service/component reference, never `this`, the same lesson already established by
  the Knowledge Graph Viewer's `setupGraphCanvas`.
- Fixed a real bug in the process: Favorites' own Tab-trap previously depended on a Tab having
  already been pressed once before Shift+Tab could be trapped correctly, a narrow window where
  Shift+Tab could escape the dialog. The shared utility's live (not cached) focusable-element lookup
  doesn't have that ordering dependency.
- No UI or visual change. The one behavior genuinely new everywhere (not just Favorites/Command
  Palette, which already prevented it): background scroll is now locked on all five dialogs, including
  the three Ember-connector ones, which never locked it before.
- Removed dead code: Favorites' entire `onFavoritesKeydown` function and its
  `favoritesLastFocusedElement` variable; Command Palette's `onInputKeydown` Escape/Tab branches (its
  Arrow/Enter combobox-navigation logic is untouched); both dialogs' manual `role`/`aria-modal`/
  `aria-label` `setAttribute()` calls, now owned entirely by the shared utility.
- Corrected two now-stale claims in ARCHITECTURE.md's Command Palette and Favorites Panel sections —
  the latter's documented "Shift-Tab-before-first-Tab" limitation no longer applies — rather than
  leaving them alongside the fix. Added a new "Modal Accessibility" section.

## 2026-07-26 — Archive Pagination: shared, paginated, session-cached archive service

- New `services/ddi-archive.js` — the single highest-leverage item flagged in the Version 1
  architecture review. Replaces two independent, duplicated single-page `/latest.json` scans
  (`ddi-intelligence-index.js`'s `_fetchArchiveTopics()` and `ddi-integrity-dashboard.js`'s
  `_fetchArchiveTopicList()`, both deleted) with one shared `getTopics()` that follows
  `topic_list.more_topics_url` until absent, so every archive-wide feature now sees the complete
  archive regardless of size.
- Session-cached: stores the in-flight `Promise` (not the resolved array) so concurrent callers
  share one fetch chain, and every later call for the rest of the page's life reuses the same
  result — one archive listing per session, not one per feature per dialog open.
- Fails gracefully: any page fetch failure stops pagination and returns whatever was already
  collected rather than throwing; `getTopics()` itself never rejects, so the cache is never a
  poisoned rejected Promise.
- Every consumer's public API is unchanged — this was a data-source swap, not a rewrite.
  `ddi-intelligence-index.js#getIndex()` and `ddi-integrity-dashboard.js#getIssues()`/`getSummary()`/
  `open()`/`close()` keep their exact signatures; only their internal fetch call changed. Intelligence
  Dashboard, Archive Navigation, and Timeline needed zero changes (they already called `getIndex()`);
  System Status needed zero changes (it already called `getIndex()`/`getSummary()`) and, as a side
  effect, no longer triggers two independent `/latest.json` fetches per dialog open. Reading Lists
  was never an archive-wide scanner and is unaffected.
- `ddi-related-intelligence.js` (category/tag-scoped related-document lookup) was deliberately left
  unchanged — a fundamentally narrower, intentionally different query than "list the whole archive,"
  not another instance of the duplicated logic this refactor targets.
- Removed the now-unused `ajax` import from `ddi-intelligence-index.js`; `ddi-integrity-dashboard.js`
  keeps its `ajax` import, still needed for each document's own full `/t/{id}.json` fetch.
- Corrected every now-stale "single-page `/latest.json`" limitation note across ARCHITECTURE.md
  (Archive Navigation, Intelligence Index, Timeline, Intelligence Dashboard, Integrity Dashboard,
  System Status, and the Knowledge Graph's own Future Roadmap) rather than leaving factually
  incorrect claims in place after the underlying limitation was fixed.
- Verified pagination directly against a mocked multi-page archive: correct multi-page collection,
  session caching (no re-fetch on a second call), concurrent-caller de-duplication, graceful partial
  failure, graceful total failure, unchanged single-page-archive behavior, and the `MAX_PAGES` safety
  cap halting a runaway pagination loop. Re-verified Intelligence Index's full fetch → shape → sort →
  filter pipeline against a multi-topic mock to confirm existing behavior is untouched.

## 2026-07-26 — Reading Lists: reusable, shareable document reading lists

- New member-facing feature (own trigger button, bottom-left, distinct from the staff-only triggers):
  create named reading lists, add/remove documents by number or link, view Documents, Estimated
  Reading Time, and Completion Progress per list, Open All Documents, and Share.
- Stores only document references — `{ id, name, description, documentIds: [] }` — in `localStorage`,
  the only persistence mechanism available to a theme with no backend of its own. Every displayed
  field is re-resolved from that id list on each open; nothing about a document's content or metadata
  is duplicated into storage.
- Reuses `ddiCitationPreview.getCitationById()` for Document Number, Title, Classification, Document
  Type, Revision, and the Open link — the same cached call Favorites/Command Palette/Document Preview
  already make.
- Reuses the Metadata Engine for Estimated Reading Time (the one field Citation Preview doesn't
  carry), via the same raw-topic-to-Metadata-Engine-shape adapter technique the Integrity Dashboard
  and System Status services already established.
- Completion Progress reuses the *existing* "recently viewed" tracking rather than inventing a new
  read/unread toggle — the task's own required actions have no "mark as read" step, so a document
  counts complete once its id appears in the existing recently-viewed history. Extracted
  `lib/ddi-recently-viewed.js` out of `api-initializers/ddi-command-palette.js` (previously the sole,
  private consumer) so both features share the one implementation.
- Add Document reuses `parseTopicIdFromUrl()`/`parseDocumentId()` (both pre-existing) rather than a
  new document picker UI; Open/hover reuse real `<a href>` navigation and the existing Document
  Preview hover listener, same as the Knowledge Graph Viewer.
- Share encodes `{ name, description, documentIds }` into a URL (base64, Unicode-safe) since there's
  no backend to publish a shareable list to; copies via the clipboard API with a visible-URL fallback
  if that's denied. Importing a shared list always creates a new list named `"{name} (Shared)"` — it
  never overwrites an existing one.
- No delete-list action — not in the task's required action list, so not added; documented as a
  known, stated gap rather than silently left unaddressed or silently added unasked-for.
- Fails gracefully throughout: `localStorage` unavailable/corrupt, an unresolvable document
  number/link, or a tampered share payload all degrade to an empty/unchanged state, never a thrown
  error.
- Verified the full lifecycle directly: create → persist → reload → add (both input forms) → remove →
  Completion Progress recomputing as the list changes → share/decode (including a Unicode name) →
  import as an independent new list, plus corrupt/non-array storage fallback cases.
- New `ddi_reading_lists_enabled` setting (default on).

## 2026-07-26 — Knowledge Graph Viewer: interactive per-document relationship graph

- New topic-page connector (`topic-below-post-stream`): current document at the center, with Parent
  Documents, Child Documents, Cross References, and Related Documents arranged around it in four
  fixed sectors. Click a node to open it, hover to trigger the existing Document Preview, pan/zoom
  the canvas, Reset View.
- Zero fetches of its own: calls `service:ddi-knowledge-graph`'s existing `getDocumentGraph(topic)`
  exactly once and renders what comes back. That service (built in an earlier session, previously
  unconsumed — see **Knowledge Graph** in ARCHITECTURE.md) already composes Relationships, Cross
  References, and Related Documents internally; none of that was touched or duplicated.
- New `lib/ddi-knowledge-graph-view.js` (pure): `buildGraphView()` sorts the graph's edges into the
  4 requested display buckets — a stated judgment call, not a discovered fact, since the graph's 6
  underlying relationship-type labels don't map 1:1 onto 4 buckets (documented in full in
  ARCHITECTURE.md). `layoutGraphView()` places nodes via a fixed 4-sector radial layout (no
  force-directed simulation, no runtime graphing dependency) in a normalized 0–100 space.
- Click and hover needed no new code: nodes are real `<a href>` elements, so Discourse's own routing
  handles clicks and the existing `ddi-document-preview.js` global hover listener (matches any
  `a[href*='/t/']` anywhere in the document) handles hover, unmodified.
- Pan/zoom implemented as plain DOM event listeners updating a CSS transform directly (not routed
  through Ember state, deliberately, for per-pixel-drag performance) via `{{did-insert}}`/
  `{{will-destroy}}` from `@ember/render-modifiers` — genuinely new to this codebase; flagged as an
  unverified-against-a-live-instance assumption, safe-failure-mode being "doesn't pan/zoom," not a
  broken page.
- Node color reuses the existing classification-driven `--ddi-accent` pattern (same as Document
  Relationships, Intelligence Network, Intelligence Index, Timeline) rather than inventing a new
  relationship-type color palette; category is instead conveyed by sector position, quadrant labels,
  and edge line style (solid/dashed/dotted).
- Fails gracefully: no topic loaded, no relationships at all, or the graph service rejecting all
  result in no broken canvas — a plain "no relationships" message or nothing rendered at all.
- Verified categorization (all 6 relationship-type labels routing correctly, edges not sourced from
  center ignored, dangling edge targets skipped, missing center handled) and layout (deterministic
  finite positions, single-node sectors centering exactly, empty views producing no edges/labels
  while keeping the fixed center) directly against mock graph data.
- New `ddi_knowledge_graph_viewer_enabled` setting (default on).
- Corrected the **Knowledge Graph** section's "no visualization is built here" note in
  ARCHITECTURE.md, since that's no longer true, and closed out that section's Future Roadmap item 2.

## 2026-07-26 — Intelligence Timeline: chronological, year-grouped browse view

- New member-facing view, rendered alongside Intelligence Index on `below-main-container`: every
  archive document (or every document in the current department, on a category page) grouped by
  year, most recent year first, each year collapsible (most recent expanded by default). Per
  document: Document Number, Title, Document Type, Classification, Revision, Last Updated.
- Performs zero fetches of its own — reuses `service:ddi-intelligence-index`'s existing `getIndex()`
  verbatim (same department scoping via `ddi-category-context`, same route guard via
  `lib/ddi-route-guard.js#isExcludedRoute()` as Intelligence Index's own connector), and groups
  whatever it returns.
- New `lib/ddi-timeline-view.js#groupDocumentsByYear()` (pure): derives each document's year from the
  citation's existing `updatedAt` field, skips documents with a missing or unparseable date rather
  than mis-bucketing them, returns years sorted descending with each year's documents sorted
  descending by the same date.
- Deliberately did not reuse `lib/ddi-timeline.js#buildTimeline()` — that function builds one
  document's own event history for the per-topic Document Timeline connector, a different problem
  than grouping many documents by year for browsing.
- Verified chronological ordering directly: year-descending order, within-year document-descending
  order, and three "no date" cases (`null`, unparseable string, field absent entirely) all excluded
  cleanly rather than crashing or producing a wrong bucket, plus empty/`null` input handled gracefully.
- Reuses `.ddi-card`, `.ddi-toc-item`/`.ddi-toc-title`, `.ddi-dossier-grid`, and `.ddi-favorites-grid`
  (the Favorites Panel's 5-column variant) verbatim for the per-document rows; only the year
  toggle row (caret, label, document count) is new markup and CSS.
- New `ddi_timeline_view_enabled` setting (default on), matching `ddi_intelligence_index_enabled`'s
  own opt-out convention.

## 2026-07-26 — DDI System Status Dashboard: staff-only archive health summary

- New staff/admin-only, read-only summary card dashboard: Total Documents, Documents Missing
  Metadata, Broken Cross References, Broken Related Documents, Duplicate Document Numbers, Draft
  Documents, Archived Documents, Public/Internal/Restricted/Top Secret Documents. The four
  issue-derived cards open the Document Integrity Dashboard directly.
- New `services/ddi-system-status.js` derives every figure from two existing sources, adding no new
  archive scanning or validation of its own: `ddiIntelligenceIndex.getIndex()` +
  `lib/ddi-archive-statistics.js#buildArchiveStatistics()` for totals and classification counts (same
  call Homepage Dashboard already makes); `ddiIntegrityDashboard.getSummary()` for everything else.
- Extended `services/ddi-integrity-dashboard.js` with `getSummary()` (returns `{ issues,
  lifecycleCounts }` from a single scan) rather than having the new service duplicate its
  scan-and-adapt-to-Metadata-Engine logic to reach lifecycle data. `getIssues()`'s own behavior and
  return shape are unchanged — both methods now share one internal `_buildIssues()`.
- Also moved the Integrity Dashboard's `isOpen`/`isLoading`/`issues` state from local
  connector-component state onto the service itself (`@tracked` fields, `open()`/`close()` methods) —
  needed so System Status's cards can open that same dialog via a plain service call. The Integrity
  Dashboard connector's own visible behavior is unchanged; only where its state lives moved.
- "Documents Missing Metadata" and "Duplicate Document Numbers" count unique documents (a document
  with two missing fields, or a duplicate-number pair, counts once); "Broken Cross References" and
  "Broken Related Documents" count issue rows directly (two broken references in one document are two
  problems, not one) — verified with a mock scenario covering both collapsing behaviors plus an
  empty-archive case (all-zero, no throw).
- New `ddi_system_status_enabled` setting (default on); gated the same way as the Integrity
  Dashboard — connector `shouldRender()` staff check plus a second `currentUser?.staff` check inside
  the service.
- Reuses `.ddi-stat-grid`/`.ddi-stat-tile`/`.ddi-stat-tile-total` (Homepage Dashboard/Division
  Header/Division Cards' own stat-card styling) and `.ddi-integrity-trigger`/`.ddi-command-palette-
  backdrop` verbatim; only a `.ddi-stat-tile-link` clickable-card modifier and a
  `.ddi-system-status-trigger` position modifier (so the two staff corner buttons stack instead of
  overlapping) are new CSS.

## 2026-07-26 — Document Integrity Dashboard: staff-only archive-wide audit table

- New staff/admin-only, read-only dashboard: one table row per detected issue across the whole
  archive — Missing Document Type, Missing Classification, Missing Lifecycle, Missing Department,
  Duplicate Document Numbers, Invalid Cross References, Broken Related Document links. Each row shows
  Document Number, Title, Issue Type, Severity, Suggested Fix, and an Open Document link.
- Reuses existing validation wholesale rather than duplicating it: the four "missing metadata" checks
  run the exact same `lib/ddi-integrity.js#verifyDocumentIntegrity()` and `ddi-document-metadata.js`
  Metadata Engine already used by the per-topic Verification Panel, just against every document in the
  archive instead of only the current topic. The two reference checks run the exact same
  `lib/ddi-cross-reference.js#findDocumentReferences()` and `lib/ddi-relationship.js#findDocumentRelationships()`
  Knowledge Graph and the Relationships panel already use.
- New `lib/ddi-integrity-issues.js` (pure) adds only what didn't already exist: a severity rating and
  a suggested-fix string per issue type, plus severity-order sorting.
- New `services/ddi-integrity-dashboard.js` orchestrates the scan: fetches `/latest.json` (the same
  single-page definition of "the archive" Intelligence Index and Archive Navigation already use),
  fetches each document's full topic JSON, adapts it into the shape the Metadata Engine expects
  (shape translation only — no validation logic reimplemented), runs all six checks, and resolves any
  reference/relationship pointing outside the scanned page through the existing cached
  `ddiCitationPreview.getCitationById()` before calling it broken.
- New connector `connectors/above-main-container/ddi-integrity-dashboard.js` renders a small, fixed
  corner trigger button — gated twice: `shouldRender()` checks `service:current-user`'s `.staff` so it
  never mounts for non-staff, and the service checks `currentUser?.staff` again internally. A new
  `ddi_integrity_dashboard_enabled` setting (default on) controls visibility on top of that, not
  instead of it.
- Reuses `.ddi-card`, `.ddi-card-title`, `.ddi-card-body`, `.ddi-command-palette-backdrop`/`-open`,
  `.ddi-nav-link`, and `.ddi-favorites-actions` verbatim for the dialog shell; only the corner trigger
  button, the data table, and the severity badges are new CSS.
- Verified all seven checks with direct logic simulation: clean document (no issues), each of the
  four missing-metadata cases individually, cross-reference extraction and dedup, relationship
  declaration extraction, broken-vs-resolvable-outside-page reference resolution, duplicate document
  number detection (including a forced-collision scenario, since the real ID scheme can't produce one
  naturally), and severity-order sorting.
- Known, stated limitation: only scans the single `/latest.json` page — an archive with more
  documents than that page holds is only partially scanned. This matches the same limitation already
  present in Intelligence Index and Archive Navigation; fixing it needs real pagination, which exists
  nowhere in this theme yet.

## 2026-07-26 — Favorites Panel: API verification pass, two real bugs fixed

- Verified `services/ddi-favorites.js`'s Discourse bookmark API integration against Discourse's
  actual source (`discourse/discourse` on GitHub — `bookmarks_controller.rb`, `routes.rb`,
  `users_controller.rb`, `user_bookmark_list_serializer.rb`, `user_bookmark_base_serializer.rb`),
  not general knowledge. Found and fixed two genuine defects; confirmed one thing was already right.
- **List endpoint was wrong**: `/bookmarks.json` doesn't exist as a listing route. The real route
  is `GET /u/:username/bookmarks`, a per-user resource. Now builds
  `/u/${currentUser.username}/bookmarks.json` and skips the request entirely if there's no
  `currentUser` (confirmed via `requires_login`), rather than firing a doomed anonymous request.
- **Topic-id resolution was wrong, and would have silently dropped post-level bookmarks.** The
  `topic_id` field it relied on doesn't exist on a bookmark item at all; the fallback
  (`bookmarkable_type === "Topic"`) only handled topic-level bookmarks, meaning any document
  bookmarked via a specific *post* (a common, real case) would never have appeared in Favorites.
  Fixed by reusing `bookmarkable_url` — a real, confirmed field — through the existing
  `parseTopicIdFromUrl()`, which already handles every `/t/...` URL shape. Resolves both topic- and
  post-level bookmarks uniformly, no branching on `bookmarkable_type` needed.
- **Pagination was entirely missing.** Confirmed 20 bookmarks per page, with `more_bookmarks_url`
  signaling another page. A user with more than 20 bookmarks would have silently seen only the most
  recent 20. `_fetchAllBookmarks()` now follows `more_bookmarks_url` until absent, capped at
  `MAX_PAGES = 10` as a runaway-loop safety bound, not a new feature — no caching added.
- **Confirmed already correct:** the deletion endpoint, `DELETE /bookmarks/:id`
  (`BookmarksController#destroy`), matched the real implementation exactly — no change needed.
- `ddi-command-palette.js` needed zero changes — the service's public interface
  (`getFavorites()`/`removeFavorite()`) is unchanged, so the correction is fully contained.
- Verified the corrected logic directly: topic-level bookmarks, post-level bookmarks (including
  dedup when both point at the same topic), a non-topic bookmarkable gracefully skipped, and a
  simulated 3-page/45-bookmark pagination sequence terminating correctly, plus the `MAX_PAGES` cap
  under a simulated runaway-pagination response.
- `ARCHITECTURE.md`'s **Favorites Panel** section corrected in place (not left as a superseded
  note) to describe the verified, current implementation.

## 2026-07-26 — Favorites Panel: quick access to native bookmarks

- Added `services/ddi-favorites.js` and extended `api-initializers/ddi-command-palette.js` with a
  new "Open Favorites" action, opening a panel of the current user's bookmarked documents (Document
  Number, Title, Classification, Department, Document Type, Last Updated, plus Open Document and
  Remove Bookmark per row).
- **No favorites database.** Reading always calls Discourse's own bookmark-list endpoint fresh (not
  cached across opens, unlike the Command Palette's own document/department lists — bookmarks can
  change from any page via Discourse's native bookmark button, so staying synchronized mattered
  more than caching here); removing calls Discourse's own bookmark-delete endpoint directly. A
  removal here is a genuine Discourse bookmark removal, visible (as gone) from Discourse's own
  native bookmarks page too.
- **Confidence caveat, more significant than most:** no prior use of Discourse's bookmark API in
  this theme. The list endpoint (`/bookmarks.json`) and response shape are based on general
  Discourse knowledge, not confirmed live — tried against two plausible envelope shapes, falling
  back to an empty list (indistinguishable from "no bookmarks") if neither matches. Flagged as the
  one part of this feature most needing live verification. The removal endpoint
  (`DELETE /bookmarks/{id}`) is a more standard, higher-confidence REST convention.
- Each bookmark resolves to its topic (handles both topic- and post-level bookmarks), deduplicated
  per topic, then goes through `ddi-citation-preview.js`'s existing `getCitationById()` unchanged —
  the same call Document Quick Preview and Recently Viewed already make, already cached by document
  id. No duplicate metadata logic anywhere in this feature.
- The favorites panel is a second dialog inside the same command-palette initializer (not a
  separate file), sharing the palette's existing backdrop styling and letting `activate()` trigger
  it directly without a cross-initializer communication mechanism. It uses a simpler Tab-trap than
  the search palette's combobox pattern, since it's a plain list of independently-focusable buttons,
  not a single-input virtual-cursor list.
- New `.ddi-favorites-grid` modifier overrides just `grid-template-columns` (5 cells via
  `auto-fit`, vs `.ddi-dossier-grid`'s existing 4-column default) while still inheriting its
  label/value typography — the many other existing consumers of the 4-column layout are untouched.
- Fixed one thing caught in self-review: entries with no real URL (the new "Open Favorites" action)
  would have rendered `href="null"` on their row otherwise — falls back to `"#"` now, since the
  activation logic is handled in JS regardless, but a literal `href="null"` would still have been
  wrong for middle-click/right-click.
- Stated, not silently accepted: two narrow focus-management rough edges (Shift+Tab in the instant
  before the list finishes loading; focus resets to the document body after removing a bookmark
  rather than a nearby control) — judged disproportionate to fully solve for a quick-access panel.
- Verified the pure topic-resolution/dedup logic directly: `topic_id` present, `bookmarkable_type
  === "Topic"` fallback, post-level bookmarks with neither field gracefully skipped, and two
  bookmarks in the same topic correctly collapsing to one entry.

## 2026-07-26 — Deprecated Ember Native Array Extensions audit and fix

- Discourse admin was warning: `Theme "DDI Internal Command Network" contains code which needs
  updating. (id: discourse.native-array-extensions.findBy)`.
- Audited the entire repository (`grep -rn` across all `.js`/`.hbs` files) for all eleven deprecated
  Ember Native Array Extension names (`findBy`, `filterBy`, `mapBy`, `sortBy`, `rejectBy`, `isAny`,
  `isEvery`, `any`, `everyBy`, `firstObject`, `lastObject`). Found exactly one occurrence:
  `services/ddi-citation-preview.js:50`, `this.site.categories?.findBy("id", topic.category_id)`.
- Replaced with the native equivalent: `this.site.categories?.find((category) => category.id ===
  topic.category_id)`. Verified behaviorally identical (matching id, no match, and
  undefined-array short-circuit via `?.` all produce the same result as before) before and after.
  No other line in the file, or anywhere else in the repo, changed.
- Re-ran the same repo-wide audit after the fix: zero remaining occurrences of any of the eleven
  names.
- Added a rule to `CODING_STANDARDS.md`'s JavaScript Style section recording this as a standing
  constraint (with the native replacement for each of the eleven names), so it doesn't reappear
  unnoticed in future work.

## 2026-07-25 — Command Palette: Ctrl+K / Cmd+K archive navigation

- Added `api-initializers/ddi-command-palette.js` — a floating palette opened via `Ctrl+K`/`Cmd+K`
  supporting document search, department search, Open Homepage, Open Category Pages, and recently
  viewed documents. Fully keyboard-navigable (arrows, Enter, Escape) with mouse support too.
- Registered through Discourse's own `api.addKeyboardShortcut()` rather than a raw `keydown`
  listener — the real mechanism behind "preserve native Discourse shortcuts." No history of using
  this API in the theme before, so its exact shape is based on general Discourse API knowledge, not
  confirmed live; wrapped in `try`/`catch` so a wrong assumption fails gracefully (palette just isn't
  keyboard-reachable) rather than breaking theme init. As far as could be checked, Discourse's
  documented default shortcuts don't use Ctrl+K/Cmd+K; some browsers reserve it at the chrome level
  regardless, which is inherent to the shortcut choice, not something a page script controls.
- **No duplicate search logic:** document search reuses `ddi-intelligence-index.js`'s `getIndex()`
  unchanged; a new, narrow `lib/ddi-command-palette.js` does free-text substring matching (title/
  Document Number/department/classification/type) — a genuinely different concern from
  `lib/ddi-document-index.js`'s existing exact-match `filterDocuments()`, not a re-implementation of
  it. Discourse's own search ranking at `/search` is untouched and not reimplemented here.
- **Two real caches, not one generic one:** the full document/department lists are fetched once per
  page session and reused across every palette open (client-side filtering against the cached copy,
  not re-fetched per keystroke); recently viewed documents are tracked via `localStorage` (capped at
  8, deduplicated) and hydrated through Citation Preview's own `getCitationById()`, already cached by
  document ID.
- Recently-viewed tracking is genuinely new (no existing feature tracks per-user browsing history —
  Dashboard/Index's "Recently Updated" is archive-wide by edit time, a different concept). Reuses
  `ddi-dossier-refresh.js`'s established `controller:topic` lookup pattern to detect the current
  topic; wrapped in `try`/`catch` so a `localStorage`-unavailable environment just means no tracking.
- Navigation uses `DiscourseURL.routeTo()` — Discourse's own utility for this. An earlier draft
  called `service:router`'s `transitionTo()` directly with a manual fallback; caught in self-review
  and replaced with the actual established utility before this shipped.
- Accessibility is a real combobox/listbox pattern: `role="combobox"` + `aria-activedescendant` on
  the input, `role="listbox"`/`role="option"` on results (rows are `tabindex="-1"`, not independently
  tabbable, by design), a visually-hidden `aria-live="polite"` region announcing result counts, focus
  moved to the input on open and restored to the previously-focused element on close. Stated
  limitation: background content isn't `aria-hidden` while the palette is open — judged out of scope
  for "keep lightweight."
- New CSS reuses `.ddi-card` (dialog shell), `.ddi-toc-item`/`.ddi-toc-title` (result rows), and
  `.ddi-nav-section-label` (section headers) verbatim; only the backdrop, input, and active-row
  highlight are new.
- Verified the pure filtering logic directly: title/Document Number/department/classification/type
  matching, empty-query behavior (departments and actions shown, documents withheld until typing),
  and no-match cases — plus the full entry-building flow end-to-end against simulated site
  categories and documents, including a non-division category correctly excluded from department
  results.

## 2026-07-25 — Document Quick Preview: global hover card

- Added `api-initializers/ddi-document-preview.js` — a floating hover card (Document Number, Title,
  Classification, Department, Document Type, Revision, Executive Summary) shown after a short delay
  when hovering any `a[href*='/t/']` anywhere on the page. One generic listener, not six
  per-connector integrations: every named surface (Intelligence Index, Search Results, Related
  Documents, Archive Navigation, Homepage Dashboard) already builds its document links through
  `ddi-citation-preview.js`'s `/t/{slug}/{id}` convention, so nothing in any of those connectors
  needed to change.
- **Verified against each surface, not assumed:** grepped every named connector's template. Found a
  genuine gap — **Division Cards has no document link at all**, only a link to its division/category
  page (`/c/{slug}/{id}`). Flagged rather than silently claimed as covered or worked around with an
  invented document link.
- No new fetch, no new service: reuses `ddi-citation-preview.js`'s existing `getCitationById()`
  (already caches by document ID) unchanged. Citation Preview gained one new field,
  `executiveSummary`, reusing the existing `getShortDescription()` (first added for Division Header)
  against `topic.post_stream.posts[0].cooked` — purely additive, every existing consumer unaffected.
  Noted, not silently glossed over: that function's name was written for category descriptions, a
  slightly awkward fit for "first paragraph of a post," but renaming it was judged out of scope here.
- `lib/ddi-document-id.js` gained `parseTopicIdFromUrl()`, shared by this feature and by
  `ddi-search-results.js` (refactored to use it instead of its own copy). Along the way, found and
  fixed a real bug in the original regex: it mis-parsed `/t/{id}/{post_number}` (no slug) by treating
  the topic id itself as a slug segment. Fixed before either consumer shipped the corrected version.
- Fails gracefully at every stage: no parseable topic ID → nothing scheduled; `getCitationById()`
  resolving to `null` → nothing rendered; the user moving to a different link before the delay/fetch
  completes → a request-token check discards the stale response; missing Executive Summary → falls
  back to `"No summary available."`, matching Executive Summary's own existing fallback text.
- Deliberate simplification, stated plainly: the card hides immediately on leaving the link, rather
  than staying open if the mouse moves onto the card itself — a full hover-intent state machine was
  judged unnecessary complexity for "keep the preview lightweight."
- New CSS is minimal: `.ddi-document-preview` only adds fixed positioning and an opacity/visibility
  toggle. The card's shell reuses `.ddi-card` verbatim; its metadata row reuses `.ddi-search-badge`
  (including the same classification color-coding) exactly as Search Results Phase 1 established.

## 2026-07-25 — Intelligence Search Results, Phase 1: badge-annotated search results

- Added `api-initializers/ddi-search-results.js`, decorating Discourse's own native search results
  with a badge row per result — Document Number, Classification (color-coded), Department, Document
  Type. Native title, excerpt/blurb, highlighted matched terms, ranking, permissions, and pagination
  are completely untouched; this only reads already-rendered DOM and prepends new content.
- Not a plugin-outlet connector: search results have no DDI-controlled outlet, so this follows the
  same DOM-decoration technique `ddi-cross-references.js`/`ddi-dossier-refresh.js` already use, now
  applied to a third surface.
- `api.onPageChange` sets up a `MutationObserver` on `.search-results` (recreated per navigation) to
  also catch in-place result updates (new query, pagination) that may not fire a full route
  transition — genuinely uncertain without a live instance, so covered generically rather than
  guessed at. `decorateResult()` is idempotent (`dataset.ddiSearchDecorated`, same pattern Cross
  References already established) specifically because the observer would otherwise re-trigger on
  its own decorations.
- **No new services, no new fetches.** Document Number is the existing `formatDocumentId()` applied
  to a topic ID parsed from each result's own title link. Classification and Document Type are
  derived by handing each result's already-rendered tag text to the *existing*
  `getClassification()`/`isValidDocumentType()`/`getDocumentTypeLabel()` unmodified — `{ tags }` from
  parsed text satisfies `getClassification()`'s signature exactly. Department reads the rendered
  category badge's slug (from its `href`), validated through the existing `isValidDepartment()`.
- Classification color reuses the existing `--ddi-accent` mechanism (classificationClass sets it,
  `.ddi-search-badge` reads it with a neutral fallback) — no new color logic. New CSS was written
  independently of the visually-similar `.ddi-lifecycle-badge` rather than sharing its selector,
  specifically to avoid silently recoloring the existing Lifecycle badge on the topic page (which
  already sits inside a `classificationClass`-scoped ancestor).
- Confidence caveat: `.fps-result`/`a.search-link`/`.badge-category`/`.discourse-tag`/
  `.search-results` are based on general Discourse knowledge, not confirmed against a live instance.
  Failure mode is safe — a wrong selector just means a skipped badge, never broken native behavior.
- Verified the pure extraction/derivation logic directly: topic ID parsing across several href
  shapes, classification/document-type resolution from rendered tag text (including graceful default
  to `PUBLIC RELEASE` when no tag matches), and department slug validation (including correct
  rejection of a non-division category).

## 2026-07-25 — Division Command Center: Directory vs. Division page routing fix

- Fixed a real bug: `ddi-category-context.js`'s `getCurrentCategory()` trusted
  `controller:discovery/category`'s `.category` unconditionally, but that controller is an Ember
  singleton that doesn't reset on route change — after visiting a division page and then navigating
  client-side to `/categories`, it could still hold the previous division, wrongly showing Division
  Header there and wrongly making Dashboard department-scoped instead of archive-wide.
- Added `isCategoriesIndexRoute()` to the service (exact match on `router.currentRouteName ===
  "discovery.categories"`); `getCurrentCategory()` now checks it first and returns `null` on
  `/categories` regardless of stale controller state.
- **Division Header and Intelligence Dashboard needed zero changes** — both already went through
  `getCurrentCategory()`/`getCurrentDepartment()` rather than reading the controller directly, so
  both inherited the fix automatically. Confirmed via `git diff` showing zero delta on either file.
- Division Cards refactored to call the service's `isCategoriesIndexRoute()` instead of keeping its
  own separate `CATEGORIES_ROUTE_NAME` constant and route check — the `"discovery.categories"`
  string now exists in exactly one place instead of two. This also removed Division Cards' own
  `service:router` lookup, since checking the route was its only use for it.
- No new connectors, no CSS changes. Verified by simulating the exact stale-controller scenario
  against fake owner/router objects: a fresh division-page visit still resolves correctly; a
  `/categories` visit with a stale controller correctly resolves to `null`; the homepage is
  unaffected; Division Cards' own route gate is unchanged in behavior.

## 2026-07-25 — Division Command Center, Phase 4: Division Cards

- Replaced the stock `.category-list` grid on `/categories` with DDI-styled Division Cards —
  `connectors/discovery-list-container-top/ddi-division-cards.*` — one per division, showing
  Division Name, Short Description, Total Documents, Last Updated, Primary Classification, and a
  View Division button. Renders only on the `discovery.categories` route.
- Divisions are enumerated from `site.categories` (already-loaded Discourse data, the same source
  Citation Preview already reads) filtered through `lib/ddi-department.js`'s `isValidDepartment()` —
  no new fetch for the category list itself, and non-division categories never get a card.
- Per-division stats are the exact same `getIndex({ department })` + `buildArchiveStatistics()`
  calls Phase 1/3 already make, run once per division in parallel. Primary Classification is
  `statistics.classifications[0]?.name` — the existing sorted breakdown's first entry, not a new
  computation. A division with zero documents shows `"—"`/`"—"`/`0`, gracefully, by the same
  construction as every other statistics consumer here.
- Extracted Division Header's inline paragraph-extraction into a new, shared
  `lib/ddi-division-summary.js` (`getShortDescription()`/`getFullDescriptionText()`), and refactored
  Division Header to use it — avoids duplicating that logic now that Division Cards needs it too.
  Zero behavior change for Division Header.
- View Division links to `/c/{slug}/{id}` — the identical URL expression
  `ddi-archive-navigation.js` already uses for Department Home. No routing changes.
- `.category-list { display: none; }` added to `common.scss`, hiding the stock grid unconditionally
  (a documented trade-off: the only realistic way both the stock grid and Division Cards end up
  hidden is if `site.categories` has none of the six recognized division slugs at all — a
  site-configuration issue, not a transient failure).
- **Dead-code cleanup, direct consequence of hiding `.category-list`:** removed `.category-box` from
  the shared topic/category card-treatment rule (added in Phase 2, no longer reachable), removed
  `.category-list-item` from the shared border-color rule, and removed every
  `.category-list`/`.category-box`/`.categories-list` selector from `desktop.scss`/`mobile.scss`'s
  responsive rules — `.topic-list-item`/`.latest-topic-list-item` entries in those same shared rules
  were kept, since they remain genuinely live.
- Verified: `isValidDepartment` correctly filters out a non-division category in a simulated
  `site.categories` list; per-division stats correctly reflect only that division's documents
  (confirmed against a multi-department test set, including correct "most common classification"
  selection and correct newest-first date picking); a zero-document division degrades gracefully;
  View Division URLs build correctly for every card.

## 2026-07-25 — Division Command Center, Phase 3: Division Header

- Added a new card at the top of every individual category page —
  `connectors/discovery-list-container-top/ddi-division-header.*` — showing Division Name, Division
  Description, Mission Statement, Total Documents, and Last Updated, all scoped to that division.
- `services/ddi-category-context.js`'s private `_getCurrentCategory()` (Phase 1) made public as
  `getCurrentCategory()` instead of duplicating the lookup a second time — `getCurrentDepartment()`
  now calls it. Pure, backward-compatible rename; verified by grep that nothing external referenced
  the private name.
- Mission Statement and Division Description both derive from `category.description` via
  `lib/ddi-cooked-parser.js`'s existing `parseCookedHtml()` — the same HTML-to-text mechanism
  Executive Summary already uses for post content — rather than guessing at unconfirmed Discourse
  plain-text category field names. Division Description is the first paragraph's text; Mission
  Statement is the full parsed body's text. Falls back to `"No mission statement available."`
  (matching Executive Summary's own `"No summary available."` convention) when there's no text.
- Total Documents and Last Updated reuse `buildArchiveStatistics()` completely — same `getIndex({
  department })` call Phase 1 already made, `recentLimit: 1` since only the single most recent
  document is needed. Falls back to `"—"` for a division with no documents; fails gracefully by the
  same construction as Dashboard (`getIndex()` never rejects), no new error handling added.
- **Total Documents now appears twice on a category page** (Dashboard's tile, this card's tile) —
  by the letter of the request, which explicitly asked for it here while explicitly saying to
  preserve Dashboard unchanged. The *computation* isn't duplicated (both call the same
  `buildArchiveStatistics()`), only the display of one number is. Flagged, not silently resolved.
- Zero new CSS — reuses `.ddi-card`/`.ddi-card-title`/`.ddi-card-body`/`.ddi-nav-section-label`/
  `.ddi-stat-grid`/`.ddi-stat-tile`/`.ddi-stat-tile-total` verbatim.
- No dedicated enable/disable setting, matching Archive Navigation's precedent (no per-component
  toggle for topic-page components that weren't explicitly asked to have one).
- `ddi-intelligence-dashboard.js`/`.hbs` confirmed untouched (`git diff` shows zero delta on both).
- Connector named `ddi-division-header` specifically to sort alphabetically before
  `ddi-intelligence-dashboard` within their shared outlet, in case intra-outlet ordering there turns
  out to be filename-based — unconfirmed for this specific outlet (see `ARCHITECTURE.md`'s
  **Division Header** section for the full caveat).

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
