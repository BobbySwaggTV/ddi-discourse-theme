# DDI Theme — Version 1.10 Stabilization Audit

Version: v1.10
Repository: ddi-discourse-theme
Scope: A full-codebase audit across shared components, CSS, JavaScript, performance, accessibility,
documentation, and repository hygiene, requested ahead of Version 2.0 planning under a feature
freeze. This is a report only — no code was changed to produce it. Every finding below is backed by
a specific file, line, or repeatable command; nothing here is speculative. Findings are categorized
at the end into **Safe to remove**, **Should refactor**, **Should document**, **Should postpone to
v2.0**, and **Must fix before v2.0**.

## Method

Automated sweeps already established earlier in this project's own history were re-run
repository-wide (not just against recently-touched files): a duplicate-CSS-selector scan, an
unused-import scan, and an orphaned-`lib/`-export scan. Beyond that, targeted greps located specific
duplication patterns (shared helper functions, dialog boilerplate, heading tag usage, `ajax()` fetch
call sites, `!important` usage, observer/listener usage) and every hit was read in context before
being reported — a raw match count is not treated as a finding on its own. Two things this method
cannot verify and does not claim to: actual color contrast ratios (needs a rendered page and a
contrast tool) and runtime rerender behavior (needs a live instance and Ember Inspector profiling).
Both are called out explicitly below rather than guessed at.

---

## 1. Shared Components

**Verified strength: every dialog in the theme already shares one accessibility layer.** All 6
dialogs — Command Palette, Favorites, Reading Lists, Document Integrity Dashboard, System Status
Dashboard, and Document Lifecycle Dashboard — call the same `lib/ddi-modal.js#createModal()` for
focus trapping, Escape-to-close, Tab cycling, scroll lock, and focus restore. There is no second,
parallel modal implementation anywhere in the codebase. This is exactly the kind of shared component
a v1.10 audit should confirm, not flag.

**Finding — dialog connector boilerplate is duplicated 4 times.**
`connectors/above-main-container/ddi-integrity-dashboard.js`,
`ddi-system-status.js`, `ddi-lifecycle-dashboard.js`, and `ddi-reading-lists.js` each hand-write the
same ~15-line block:
```js
setupModal: (element) => {
  element._ddiModal = createModal(element, { labelledBy: "...", onClose: () => service.close() });
},
onOpenChange: (element, [isOpen]) => {
  if (isOpen) { element._ddiModal?.activate(); } else { element._ddiModal?.deactivate(); }
},
teardownModal: (element) => {
  element._ddiModal?.destroy();
},
```
`createModal()` itself is correctly shared; this is the surrounding wiring around it that is not.
**Should refactor**: extract a small helper (e.g. `lib/ddi-dialog-connector.js#buildModalHandlers(service, { labelledBy })`
returning `{ setupModal, onOpenChange, teardownModal }`) that each of the 4 connectors spreads into
`component.setProperties()`. Each dialog keeps its own `open`/`close`, only the modal-wiring
boilerplate collapses from 4 copies to 1.

**Finding — `_adaptTopic()` (raw `/t/{id}.json` payload → the shape `ddiDocumentMetadata.getMetadata()`
expects) is independently duplicated in two services.** `services/ddi-integrity-dashboard.js#_adaptTopic()`
and `services/ddi-reading-lists.js#_adaptTopic()` are near-identical: both build
`{ id, title, tags, created_at, closed, category: site.categories.find(...), postStream: { posts: ... } }`
from a raw topic payload. **Should refactor**: extract to a shared `lib/ddi-document-metadata-adapter.js#adaptRawTopic(topic, categories)`
reused by both (and any future service that needs the same raw-payload → live-topic-shape
translation).

**No duplicate card/dialog *shells* found.** `.ddi-card`/`.ddi-card-title`/`.ddi-card-body`,
`.ddi-intel-grid`, and `.ddi-dossier-grid` are reused, not reimplemented, everywhere they appear —
this was verified per-feature as each shipped (see ARCHITECTURE.md's own per-section "Reuses..."
notes) and holds up under a fresh repository-wide check.

---

## 2. CSS

**Verified: zero unintentional duplicate selectors.** A repository-wide scan for exact-duplicate
top-level class selectors in `common/common.scss` (4,165 lines) found exactly one repeat —
`.timeline-footer-controls`, defined once for desktop and once for a mobile override, which is a
legitimate breakpoint-scoped redefinition, not an accidental duplicate (already documented as such
earlier in this project).

**Finding — no orphaned CSS from retired components.** Every component this project has retired and
`git rm`'d (the old Table of Contents card, Document Intelligence card, Document Relationships and
Intelligence Network cards) has zero leftover CSS selectors referencing its old class names. This is
worth stating as a verified negative: cleanup discipline across 5+ replace-not-duplicate passes held.

**Finding — repeated "uppercase caption" typography, declared separately rather than shared.**
`.ddi-card-title` (font-size `.82rem`, letter-spacing `.22em`, `color: #e43b3b`) and
`.ddi-nav-section-label` (font-size `.72rem`, letter-spacing `.16em`, `color: var(--ddi-text-muted)`)
and `.ddi-intel-grid span` (font-size `.72rem`, letter-spacing `.16em`, `color: #7d8ea6`) are three
separately-declared rules that converge on the same "small uppercase label" visual role, two of them
(`.ddi-nav-section-label` / `.ddi-intel-grid span`) with identical font-size and letter-spacing
values already. `text-transform: uppercase` appears 34 times across the stylesheet in comparable
"label/caption/badge" contexts. **Should postpone to v2.0**: consolidating these into one shared
"caption" utility class (or a `--ddi-caption-*` set of custom properties) is a real, worthwhile
cleanup, but it's cosmetic, touches many call sites, and isn't a defect — exactly the kind of
non-urgent consolidation a stabilization pass should note and a v2.0 pass should schedule, not do
under a feature freeze.

**Finding — no design-token system for spacing, only for color.** `:root` defines a real token set
for color (`--ddi-red`, `--ddi-bg-panel`, `--ddi-border`, `--ddi-shadow-*`, etc.), but spacing and
sizing (`24px`, `16px`, `8px`, `.82rem`, `.18s ease`, …) are literal values repeated ad hoc
throughout, with no `--ddi-space-*`/`--ddi-radius-*` equivalents. This is architecturally consistent
— every value is a plain literal, nothing is accidentally inconsistent — but it means there's no
single place to retune spacing/timing rhythm archive-wide. **Should postpone to v2.0**: worth
deciding deliberately (introduce spacing tokens, or explicitly accept literals as this theme's
convention) rather than leaving it as an implicit gap.

**Verified fine, not a smell: `!important` (31 uses in `common/common.scss`).** Every single
occurrence targets a *Discourse-native* selector (`.d-header`, `.topic-list`, `#site-logo`,
`.post-controls`, `.categories-and-latest`, `.topic-category`, etc.) — never a DDI-authored `.ddi-*`
class overriding another DDI class. This is the standard, accepted way a theme reliably wins
specificity against a host application's own core styles; it is not evidence of an unresolved
specificity fight within this theme's own code.

**Finding — `prefers-reduced-motion` is honored for 3 of the stylesheet's 16 `transition`/`animation`
declarations.** The one `@media (prefers-reduced-motion: reduce)` block (line 2932) only neutralizes
`.ddi-toc-item.ddi-document-nav-link`, `.ddi-document-nav-sublink`, and
`.ddi-document-nav-toggle::after` — all three specific to the Document Navigation Sidebar (v1.4),
the one feature that originally had an explicit "respect reduced motion" requirement. The base
`.ddi-toc-item:hover { transform: translateX(6px); }` rule it extends from (`transition: all .18s ease`,
line 2723) is used across at least 7 other connector templates (Browse Archive, Intelligence
Relationships, Reading Lists, Command Palette, Document Quick Preview, Lifecycle Dashboard, and
more) and is **not** covered by the reduced-motion query, nor are the other ~13 transition/animation
rules elsewhere in the stylesheet (tab underlines, hover color fades, dialog opacity fades). See
Accessibility section 5 below for the categorization.

---

## 3. JavaScript

**Finding — `createBadge(text, extraClass)` is duplicated verbatim in two API initializers.**
`api-initializers/ddi-search-results.js` and `api-initializers/ddi-document-preview.js` each define
their own identical 6-line DOM-badge-builder function. Both already produce the same
`.ddi-search-badge`/`.ddi-search-badge {extraClass}` markup. **Should refactor**: extract to a
shared `lib/ddi-badge.js#createBadge(text, extraClass)` (a pure DOM-builder function, consistent
with this codebase's existing `lib/` convention) and import it in both.

**Finding — `_adaptTopic()` duplication.** Covered in Section 1 above; listed here too since it's
squarely a JS (not CSS) duplication.

**Verified: no duplicate parsing.** The revision-table parser (`lib/ddi-revision-table.js`), the
approval-state deriver (`lib/ddi-approval-state.js`), the cross-reference/relationship regex parsers
(`lib/ddi-cross-reference.js`, `lib/ddi-relationship.js`), and the cooked-HTML parser
(`lib/ddi-cooked-parser.js`, LRU-cached) each have exactly one implementation, reused by every
consumer that needs them (Author Assistant, the Document View panel, Integrity Dashboard, Citation
Preview, Lifecycle Dashboard) — confirmed by grepping for a second definition of each and finding
none.

**Finding — the `/t/{id}.json` full-topic fetch pattern appears in 4 call sites, 3 of which are
legitimately distinct concerns and 1 of which is unnecessary duplication of a service that already
exists for this purpose.** `services/ddi-integrity-dashboard.js` (archive-wide scan) and
`services/ddi-citation-preview.js` (×2, citation building) are genuinely separate needs already
reasoned about in this project's own architecture docs. `services/ddi-reading-lists.js#_fetchReadingTime()`
fetches a topic solely to run it through the Metadata Engine for `readingTime` — this is the same
data `services/ddi-citation-preview.js` already resolves and caches per document (though Citation
Preview does not currently expose `readingTime` on its citation shape). **Should refactor** (two
options, either is reasonable): (a) add `readingTime` to Citation Preview's citation shape and have
Reading Lists consume `ddiCitationPreview.getCitationById()` instead of its own fetch/cache/adapter
trio, or (b) if Reading Lists' independent cache lifecycle is intentional, at minimum share the
`_adaptTopic()` helper per the Section 1 finding. Not blocking v2.0, but a real, avoidable network
request and a third copy of the same adapter.

**Finding — unused settings are limited to the 4 already documented as intentionally reserved.**
Cross-referencing every key in `settings.yml` (24 total) against `settings.<name>` usage in
`javascripts/discourse/` found exactly 4 with zero references: `ddi_compact_density`,
`ddi_red_glow_strength`, `ddi_sidebar_command_panel_enabled`, `ddi_footer_enabled`. This matches
ARCHITECTURE.md's own **Known Gaps / Unwired Code** section precisely (20 wired, 4 reserved) — no
additional orphaned settings were found beyond what's already tracked.

**Verified: no unused imports, no orphaned `lib/` exports, repository-wide.** Re-running both sweep
scripts against the full tree (not just recently-touched files) found zero unused imports across all
81 JS files and zero `lib/`-exported functions/constants with no consumer anywhere in the tree.

**Verified: no dead code, no `TODO`/`FIXME`/`XXX`/`HACK` comments anywhere in the repository.** A
repository-wide grep across every `.js`, `.hbs`, and `.scss` file found none. There is no backlog of
deferred inline work to clean up.

---

## 4. Performance

**Verified: every archive-wide or per-document service that needs one has a cache, and none scan
twice.** `services/ddi-archive.js` (topic list, Promise-cached for the session),
`services/ddi-citation-preview.js` (per-document citation cache), `services/ddi-document-metadata.js`
(per-topic metadata cache), `services/ddi-intelligence-index.js` (per-filter-combination index
cache), `services/ddi-relationship.js` / `services/ddi-related-intelligence.js` (per-topic result
caches), `lib/ddi-cooked-parser.js` (LRU-bounded parsed-DOM cache), and — as of v1.9 —
`services/ddi-integrity-dashboard.js#_scanArchive()` (Promise-cached for the session, shared by
`getIssues()`/`getSummary()`/`getDocuments()`) all follow the same "cache for the session, no
invalidation" convention. The Document Lifecycle Dashboard (v1.9) consuming the Integrity Dashboard's
scan instead of running Citation Preview or Browse Archive's own indexing independently was a
deliberate design choice specifically to avoid a second archive-wide scan (documented in
ARCHITECTURE.md's Document Lifecycle Dashboard section).

**Verified: observers and listeners are torn down correctly everywhere they're used.** Three uses of
browser observer APIs in the codebase — `IntersectionObserver` (Document Navigation Sidebar, v1.4),
`addObserver`/`removeObserver` (Document Author Assistant, v1.1), and `MutationObserver` (Search
Results decoration) — each has an explicit, verified teardown path (`{{will-destroy}}`, a stored
observer reference `disconnect()`ed on `onPageChange`, or the same). No leaked observer was found.

**Not verifiable by static analysis: unnecessary rerenders.** This would require a live Discourse
instance and Ember Inspector (or similar) profiling to observe actual render-cycle behavior; nothing
in this repository's source can definitively confirm or rule out avoidable rerenders. One plausible
candidate was inspected — `ddi-browse-archive.js#toggleYear`'s `component.years.map(...)` rebuild
on every year-toggle click — but this operates on an already-paginated, already-bounded array and
matches an already-established pattern elsewhere in the codebase; it is not flagged as a defect,
only noted as the kind of thing a live profiling pass would be the right tool to confirm either way.
**Should postpone to v2.0**: a real Ember Inspector pass against a populated staging archive, not a
static-analysis task.

---

## 5. Accessibility

**Finding — heading hierarchy is inconsistent across connectors, and this project has already
self-documented the gap once without closing it.** Of ~21 components using the `.ddi-card-title`
class for their panel title, 17 render it on a plain `<div>` (Debug Panel, Document Footer,
Knowledge Graph Viewer, Archive Navigation, Verification Panel, Browse Archive, Executive Summary,
Intelligence Timeline, Revision History, Document Template Library, Document Author Assistant,
Division Cards, Division Header, Intelligence Dashboard, Document Integrity Dashboard, System Status
Dashboard, Reading Lists), while only Intelligence Relationships (v1.5), the Document Lifecycle
Dashboard (v1.9), and the Homepage Hero use a real `<h2>`/`<h3>`. ARCHITECTURE.md's own Document
Lifecycle Dashboard section already states this plainly: "a deliberate improvement over the
Integrity/System Status Dashboards' own plain `<div class="ddi-card-title">`... not retrofitted onto
those two, which this task didn't ask to touch." That's an honest, accurate note, but it means the
gap it names is still open. **Must fix before v2.0**: promoting `.ddi-card-title` from `<div>` to a
real heading element (`<h2>` for a page-level panel, `<h3>` for a nested one, matching the
convention v1.5/v1.9 already established) is a template-only change per file, low risk, and directly
closes an accessibility gap this project itself has already flagged twice without acting on.

**Finding — `prefers-reduced-motion` coverage is incomplete.** Detailed in Section 2 above. The
practical effect: a user with `prefers-reduced-motion: reduce` set still receives every `.ddi-toc-item:hover`
translateX slide (used in at least 7 templates) and every other hover/tab/dialog transition in the
stylesheet except the 3 the Navigation Sidebar's own reduced-motion rule covers. **Should refactor**
(not "must fix" — these are all short, subtle hover transitions, not large or looping motion, so the
severity is real but moderate): broaden the existing `@media (prefers-reduced-motion: reduce)` block
to cover `.ddi-toc-item:hover`'s `transform`/`transition` at the base-class level, and audit the
remaining ~13 transition rules for the same treatment, in one pass rather than per-feature.

**Verified: ARIA usage is real and varied, not neglected.** 11 distinct ARIA attributes are in active
use across connectors and API initializers — `aria-expanded`/`aria-controls` (disclosure widgets:
mobile nav sidebar, Command Palette), `aria-selected` (tabs: Browse Archive, Command Palette),
`aria-labelledby`/`aria-label` (dialogs, relationship items' precomputed labels),
`aria-activedescendant`/`aria-haspopup` (Command Palette's combobox-style keyboard navigation),
`aria-live` (a dynamic status region), `aria-current`, `aria-checked`, `aria-hidden` (decorative
icons). This reflects a genuine, sustained accessibility effort across the project's history, not an
afterthought — the heading-hierarchy gap above is a real, specific exception to an otherwise solid
pattern, not representative of the whole.

**Verified: keyboard access and focus management are centralized and consistent.** Every dialog gets
Tab-cycling, Escape-to-close, and focus-restore-on-close from the single shared
`lib/ddi-modal.js#createModal()` (see Section 1). Every interactive control audited this session uses
a real native element (`<button>`, `<a href>`, `<select>`, `<label for>`) rather than a
`<div>`/`onClick` pattern — confirmed by the complete absence of any non-semantic clickable-div
pattern in the templates reviewed.

**Not verifiable by static analysis: actual color contrast ratios.** The color tokens
(`--ddi-text-muted: #94a3b8`, `--ddi-text-faint: #64748b`, `--ddi-red: #c31c26`, etc.) can be checked
against their various backgrounds with a contrast-ratio calculation, but doing that correctly means
accounting for every background a given text color actually renders against (several are used across
multiple background contexts), which this audit did not attempt to enumerate exhaustively.
**Should postpone to v2.0**: run the existing token set through a contrast-checking tool (browser
DevTools, axe, or Lighthouse) against a live rendered instance rather than estimating from hex values
in isolation.

---

## 6. Documentation

**Finding — `CONTRIBUTING.md` is significantly out of date.** It states "Most settings in
`settings.yml` (13 of 17) are read by real code." The actual current count, verified in Section 3
above, is 24 settings, 20 wired. This line has not been updated since at least the v1.1 era and has
silently drifted through the entire v1.2–v1.9 arc. **Must fix before v2.0**: update the count (and
consider replacing the hardcoded number with a pointer to ARCHITECTURE.md's own **Known Gaps**
section, which has been kept current every release, rather than a second number that can drift
again).

**Verified: README.md, ARCHITECTURE.md, and CHANGELOG.md are current as of v1.9.** Spot-checked
settings counts (24/20), the render-order lists, and the per-version feature descriptions in all
three against the actual source — all match. This is the product of updating all three at the end of
every version this project has shipped; the pattern held.

**Finding — `about.json`'s `version`/`theme_version` fields are still `"1.1.0"`**, despite the
theme's own README/CHANGELOG describing v1.9 as shipped. This is the version string Discourse's own
admin panel displays for this theme. **Must fix before v2.0**: bump both fields to match the actual
shipped version (or, if this project wants `about.json` to track only major stable releases rather
than every minor version, document that convention explicitly in CODING_STANDARDS.md or
CONTRIBUTING.md — the current state, an unexplained 8-version-old string, isn't that; it reads as
neglect rather than a deliberate versioning policy).

**Verified: `CODING_STANDARDS.md` was spot-checked and found consistent** with actual naming/file-
organization conventions in the current codebase (kebab-case `ddi-` prefixed files, the lib/service/
connector split, no BEM in CSS class names) — no drift found there.

**Verified: `docs/` design documents are each still an accurate description of their own scope.**
`ddi-intelligence-search.md` ("proposed structured search design, not yet built") is correctly
distinct from the *already-built* Search Results badge decoration (ARCHITECTURE.md's own "Search
Results (Intelligence Search, Phase 1)" section) — the design doc describes a structured search
*form*, a different, still-unbuilt piece of the same broader roadmap, not a stale description of
what's already shipped. No other `docs/` file was found describing since-built work as unbuilt or
vice versa.

---

## 7. Repository Hygiene

**Finding — `assets/ddi-logo.png` (2.3MB) remains unreferenced by any template, stylesheet, or
`about.json` asset entry.** This was already identified and explicitly left in place pending a human
decision (ARCHITECTURE.md's Known Gaps: "deleting a branding asset outright felt like it warranted a
human call rather than a unilateral one"). Re-confirmed still true and still unreferenced. **Safe to
remove** if that decision is now made — nothing in the current codebase depends on it — but the
decision itself remains a product/branding call, not an engineering one, so it's listed here rather
than in a "must fix" bucket.

**Verified: no dead or historical files remain in the repository root or `common/`.** The three files
CONTRIBUTING.md itself flags as removed in RC cleanup (`common/homepage.html`, `common/sidebar.html`,
`common/variables.scss`) are in fact absent from the current tree — that historical note is accurate,
not itself stale.

**Verified: zero outdated `TODO`/`FIXME`/deprecated-marker comments anywhere in the repository** (see
Section 3). There is nothing in this category to clean up.

**Not code, but a repository-state finding relevant to "recommend commit grouping":** the working
tree currently holds all of Version 1.8 and Version 1.9's changes uncommitted (23 files: 18 modified,
5 new) on top of a HEAD that ends at v1.7 (`e89b267`). See **Recommended Commit Grouping** below.

---

## Categorized Findings

### Safe to remove
- `assets/ddi-logo.png` — unreferenced 2.3MB asset, pending only a human branding decision (already
  flagged once before; re-confirmed still unreferenced).

### Should refactor
- Extract shared dialog-connector wiring (`setupModal`/`onOpenChange`/`teardownModal`) out of the 4
  connectors that currently duplicate it (Integrity Dashboard, System Status, Lifecycle Dashboard,
  Reading Lists) into one `lib/` helper.
- Extract the duplicated `_adaptTopic()` (raw topic → Metadata-Engine-ready shape) out of
  `ddi-integrity-dashboard.js` and `ddi-reading-lists.js` into one shared `lib/` function.
- Extract the duplicated `createBadge()` DOM helper out of `ddi-search-results.js` and
  `ddi-document-preview.js` into one shared `lib/ddi-badge.js`.
- Have `ddi-reading-lists.js#_fetchReadingTime()` reuse Citation Preview (extended with a
  `readingTime` field) instead of its own independent fetch/cache/adapter for the same data.
- Broaden `prefers-reduced-motion` coverage from the 3 Navigation-Sidebar-specific selectors to the
  base `.ddi-toc-item:hover` transform (used in 7+ templates) and audit the remaining transition
  rules in the same pass.

### Should document
- `CONTRIBUTING.md`'s stale "13 of 17 settings" line — update to the current count or point at
  ARCHITECTURE.md's Known Gaps instead of maintaining a second number.
- If `about.json`'s version is meant to track only major releases rather than every minor version,
  say so explicitly somewhere (CODING_STANDARDS.md or CONTRIBUTING.md) — otherwise it just reads as
  drifted.

### Should postpone to v2.0
- Consolidate the repeated "uppercase caption" typography pattern (`.ddi-card-title`/
  `.ddi-nav-section-label`/`.ddi-intel-grid span`) into one shared caption style or token set.
- Decide deliberately on a spacing/sizing token system (or explicitly document literals-only as this
  theme's convention) — colors are tokenized, spacing currently isn't.
- A live-instance color-contrast audit (DevTools/axe/Lighthouse) against the actual `--ddi-*` token
  set and every background it renders against.
- A live-instance Ember Inspector profiling pass to confirm or rule out unnecessary rerenders —
  not something static analysis of this repository can determine.
- Whether to introduce an automated test suite is a real, known, already-acknowledged gap
  (CONTRIBUTING.md states plainly that verification is manual) — worth a deliberate v2.0 decision
  rather than continuing by default.

### Must fix before v2.0
- Heading hierarchy: promote `.ddi-card-title` from `<div>` to a real `<h2>`/`<h3>` across the 17
  components still using a plain div, closing the gap this project has already self-documented twice
  (v1.5's Intelligence Relationships and v1.9's Lifecycle Dashboard sections) without acting on it.
- `about.json`'s `version`/`theme_version` — bump from the current `"1.1.0"` to match what's actually
  shipped; this is the version string visible in Discourse's own admin panel.
- `CONTRIBUTING.md`'s settings-count drift (also listed under "Should document" — it's low-effort
  enough to fix immediately rather than schedule).

---

## Recommended Commit Grouping

Nothing has been committed since `e89b267` ("feat(revisions): add Document Revision Management
(v1.7)"). All of v1.8 (Document Approval Workflow) and v1.9 (Document Lifecycle Dashboard) are still
uncommitted working-tree changes — 18 modified files and 5 new files, none of it split.

A handful of files were touched by **both** v1.8 and v1.9 without an intervening commit
(`common/common.scss`, `javascripts/discourse/lib/ddi-document-index.js`,
`javascripts/discourse/services/ddi-citation-preview.js`,
`javascripts/discourse/services/ddi-integrity-dashboard.js`, and all three of `ARCHITECTURE.md`/
`README.md`/`CHANGELOG.md`), so a perfectly clean per-version split isn't a plain `git add <file>`
operation for those six — it needs `git add -p` to separate the v1.8 hunks from the v1.9 hunks
within each. Everything else attributes cleanly to one version or the other.

**If a single combined commit is acceptable** (the pragmatic option, given the entanglement above):
```
feat(governance): add Document Approval Workflow (v1.8) and Document Lifecycle Dashboard (v1.9)
```
one commit, all 23 files.

**If the two versions should land as separate commits**, stage the cleanly-attributable files
directly per version, and use `git add -p` on the six mixed files to split their hunks:

- v1.8 (cleanly attributable): `lib/ddi-approval-state.js`,
  `connectors/topic-above-posts/ddi-document-intelligence-header.{js,hbs}`,
  `connectors/topic-above-posts/ddi-document-intelligence-relationships.hbs`,
  `lib/ddi-intelligence-relationships.js`,
  `connectors/below-main-container/ddi-browse-archive.{js,hbs}`,
  `connectors/composer-fields/ddi-document-template-library.hbs`,
  `lib/ddi-integrity-issues.js`, `services/ddi-relationship.js`.
- v1.9 (cleanly attributable): `lib/ddi-lifecycle-dashboard.js`,
  `services/ddi-lifecycle-dashboard.js`,
  `connectors/above-main-container/ddi-lifecycle-dashboard.{js,hbs}`,
  `services/ddi-document-metadata.js`, `lib/ddi-classification.js`, `settings.yml`.
- Mixed, needs `git add -p`: `common/common.scss`, `lib/ddi-document-index.js`,
  `services/ddi-citation-preview.js`, `services/ddi-integrity-dashboard.js`, `ARCHITECTURE.md`,
  `README.md`, `CHANGELOG.md`.

**Once this stabilization pass's own findings are actually acted on** (a separate step from this
report — nothing has been changed yet), a reasonable grouping by category:
```
refactor(dialogs): extract shared dialog-connector wiring from 4 duplicated copies
refactor(services): extract shared _adaptTopic()/createBadge() helpers
fix(a11y): promote .ddi-card-title to real heading elements across remaining components
fix(a11y): extend prefers-reduced-motion coverage to base hover transitions
chore(docs): correct CONTRIBUTING.md's settings count and about.json's version
```
