# DDI Intelligence Archive Dashboard

Version: v0.4.0 (proposed)
Repository: ddi-discourse-theme
Scope: Replace the default Discourse homepage with a custom Intelligence Archive dashboard —
the DDC Intelligence Dashboard, intended as the future homepage. Now covers 7 sections (grew from
5); the 2 new ones and 2 renames are additive to the design below, not a rewrite of it.

## Root Cause: Why The Homepage Still Looks Default

`docs/ddi-command-network-interface.md` (v0.2.1) planned a real plugin outlet connector at
`javascripts/discourse/connectors/above-main-container/ddi-homepage-dashboard.hbs`. That connector
was never created. Instead, `common/homepage.html` was written — but `homepage.html` is not a
filename Discourse's theme compiler recognizes (the only recognized `common/*.html` targets are
`head_tag`, `header`, `after_header`, `body_tag`, and `footer`, plus their embedded variants). The
file sits in the repo but is never compiled into the theme output, so nothing it contains has ever
reached a browser. `common/sidebar.html` has the same problem (`above-main-container/ddi-sidebar-panel.hbs`
was likewise planned but never built). This mirrors the dead-token-file finding from the CSS audit —
a second instance of "documented and written, never wired in."

The fix is mechanical: use the same real plugin-outlet-connector pattern already proven on the topic
page (Dossier Header, Security Banner, Executive Summary, Document Intelligence, Table of Contents,
Intelligence Network), not a bare HTML file.

## Architecture

### Outlet & Rendering

- New connector: `connectors/above-main-container/ddi-intelligence-dashboard.js` + `.hbs`.
- `above-main-container` renders on every route, not just the homepage, so the connector must guard
  itself with a route check (Discourse's connector `shouldRender(args, context)` hook) so it only
  renders on the discovery/homepage routes — otherwise the dashboard would appear on category pages,
  tag pages, etc.
- Gated by the existing `ddi_homepage_dashboard_enabled` theme setting (already defined in
  `settings.yml`, currently unused by anything — this feature is what it was written for).
- Default Discourse homepage furniture (category list / topic list chrome) is suppressed via CSS
  scoped to the same route condition, the same technique already used to hide default topic metadata
  on the topic page (`PHASE 8 - REMOVE DEFAULT TOPIC METADATA` in `common.scss`).
- `common/homepage.html` and `common/sidebar.html` are retired once this connector replaces their
  intended content (sidebar is a separate, later pass — noted but not in this scope).

### Visual & Tone Requirements

"Should resemble a corporate intelligence portal rather than a discussion forum" is already the
premise of every existing DDI topic-page component — this dashboard should extend that same visual
language, not invent a second one. Concretely: reuse the existing `.ddi-card` / `.ddi-card-title` /
`.ddi-card-body` shell for every section below, the existing uppercase/letter-spaced label
convention, and the existing classification accent-color system (`--ddi-accent` / `ddi-restricted`
etc.) wherever a section shows classification-bearing data. No new component vocabulary is needed —
the forum-like feel of the current homepage comes from it being *unstyled default Discourse*, not
from a styling gap this dashboard needs to solve with new patterns.

### Section-to-Data Mapping

Each of the 7 required sections is a distinct sub-component under the one connector, mirroring the
existing "one outlet, several card-style sections" structure already used on the topic page. Two of
these (Search Intelligence, and the service Recent Revisions depends on) now have their own full
design documents — summarized here, detailed there, so the design isn't maintained in two places.

| Section | Data source | New business logic? |
|---|---|---|
| Search Intelligence | Discourse's native search — full design in `docs/ddi-intelligence-search.md` | None — a query-building layer only, no new search backend |
| Operational Divisions | The 6 live categories from `docs/ddi-archive-information-architecture.md` (Executive Command, Fleet Security, CIM, E&S, CSS, Public Affairs), read from Discourse's already-loaded `Site` category data | None — read-only rendering |
| Recent Intelligence | Topics sorted by `created_at` (newest arrivals). Renamed from "Recent Documents" for terminology consistency with Intelligence Network / Document Intelligence — same underlying design, label only | Extends the existing `ddi-related-intelligence` service's fetch pattern, or a small sibling service |
| Recently Updated | Topics sorted by `bumped_at`/activity, explicitly excluding topics that are only there because they're brand-new (else this list just duplicates Recent Intelligence) | Same fetch pattern as above, different sort/filter |
| Document Statistics | Aggregate counts (total documents archive-wide, per-division counts) — reuses the **same** category data already loaded for Operational Divisions; Discourse's category objects already carry a `topic_count` | None — zero new network requests beyond what Operational Divisions already loads |
| Classification Breakdown | Per-classification topic counts from Discourse's existing `/tags.json` (already returns topic counts per tag) filtered to the 5 classification slugs from the archive IA doc. Renamed from "Classification Statistics" — same design | None new — no backend aggregation required |
| Recent Revisions | The most recently edited documents archive-wide — the same recently-bumped topic list as Recently Updated, enriched per item with the document's latest editor and edit summary | Extends `ddi-revision-history` (`docs/ddi-revision-history.md`) with a new lightweight method, rather than inventing a second revision-fetching mechanism — see below |

`Operational Divisions` intentionally replaces `common/homepage.html`'s old 5-group structure
(Corporate Command / Operations Center / Training Command / Division Headquarters / Leadership
Center) — that grouping predates and doesn't match the finalized 6-division archive taxonomy.

### Recent Revisions — Reuse and a Repeated Trade-off

Recent Revisions is not "Recently Updated with a different name" — it's a different emphasis. Recently
Updated is topic-level (title, category, bumped date) and needs no extra fetching. Recent Revisions is
about the *edit event itself* (who edited it, what changed), which only exists at the revision level —
data only `ddi-revision-history`'s service layer has. Rather than building a second fetch mechanism,
this section should call a new, narrower method on that existing service — e.g. "give me just the
latest revision for these topics" — instead of its full per-document history method.

This is the third time in this design sequence the same shape of trade-off has come up (also flagged
for Intelligence Network's proposed Revision field, and for Revision History's own full list): showing
a revision-derived field for *N* items on a list means up to *N* extra requests. The same answer
applies here as it did there — bound it (the dashboard likely only needs 5–10 rows), don't fetch
revision detail for more documents than are actually displayed.

**Sequencing implication:** Recent Revisions should not be built before the per-document Revision
History component it depends on — see Phase 5 below.

### Known Blocking Dependency

`getClassification()` in `lib/ddi-classification.js` has the tag-shape bug already flagged during
the Intelligence Network work (it compares `tag.slug` against what are actually plain tag-name
strings, so it likely always resolves to the default). Classification Breakdown is the second
feature now depending on this function (Recent Intelligence, Recently Updated, Document Statistics,
and Recent Revisions do not depend on it). Two independent features silently no-op'ing on the same
bug is a stronger reason to fix it than either feature alone — it should be resolved before or
alongside the Classification Breakdown phase, not worked around a second time.

## Implementation Phases

**Phase 0 — Groundwork**
Fix the `getClassification()` tag-matching bug. Confirm `ddi_homepage_dashboard_enabled` is the
correct gating setting. Decide the retirement plan for `common/homepage.html` / `common/sidebar.html`
(delete vs. keep as reference during transition).

**Phase 1 — Connector Scaffold**
Stand up `above-main-container/ddi-intelligence-dashboard` as an empty shell: route-guarded, setting-gated,
rendering nothing but a placeholder container. Add the CSS suppression rule for default homepage
furniture, scoped to the same route condition. This phase's only goal is proving the mechanism
actually reaches the browser before any section is built — the exact step that was skipped last time.

**Phase 2 — Search Intelligence + Operational Divisions + Document Statistics**
The three lowest-risk sections: search delegates to Discourse's own search route, divisions read
already-loaded category data, and Document Statistics reuses that exact same category data a second
way (summed `topic_count`) — no new fetching at all. Grouped together because Document Statistics is,
architecturally, free once Operational Divisions exists. Delivers the first visible, meaningfully
different homepage.

**Phase 3 — Recent Intelligence + Recently Updated**
Introduces list-fetching. Extend the existing service pattern from `ddi-related-intelligence` rather
than a new one-off fetch mechanism. Requires explicitly defining the sort/filter distinction between
the two lists so they don't render near-duplicate content.

**Phase 4 — Classification Breakdown**
Depends on Phase 0's fix. Reads `/tags.json`, filters to the 5 classification slugs, renders counts.

**Phase 5 — Recent Revisions**
Depends on `docs/ddi-revision-history.md`'s per-document component existing first — this section
extends that same service rather than introducing a second revision-fetching path, so building it
before the per-document version would mean building the service twice. Bound the number of
documents fetched at revision-level detail (see above), matching Intelligence Network's existing
`MAX_RESULTS` precedent.

**Phase 6 — Retirement & Polish**
Remove `common/homepage.html` and `common/sidebar.html` (or fold any still-relevant copy into the new
connector). Wire remaining relevant settings (`ddi_compact_density`, `ddi_red_glow_strength`) into the
new section styling. Visual QA across desktop/mobile breakpoints.
