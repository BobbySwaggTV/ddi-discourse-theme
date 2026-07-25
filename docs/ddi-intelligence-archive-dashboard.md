# DDI Intelligence Archive Dashboard

Version: v0.3.0 (proposed)
Repository: ddi-discourse-theme
Scope: Replace the default Discourse homepage with a custom Intelligence Archive dashboard.

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

### Section-to-Data Mapping

Each of the 5 required sections is a distinct sub-component under the one connector, mirroring the
existing "one outlet, several card-style sections" structure already used on the topic page.

| Section | Data source | New business logic? |
|---|---|---|
| Search Intelligence | Discourse's native search (submits to `/search`) | None — thin presentational wrapper, no second search implementation |
| Operational Divisions | The 6 live categories from `docs/ddi-archive-information-architecture.md` (Executive Command, Fleet Security, CIM, E&S, CSS, Public Affairs), read from Discourse's already-loaded `Site` category data | None — read-only rendering |
| Recent Documents | Topics sorted by `created_at` (newest arrivals) | Extends the existing `ddi-related-intelligence` service's fetch pattern, or a small sibling service — not a second AJAX approach invented from scratch |
| Recently Updated | Topics sorted by `bumped_at`/activity, explicitly excluding topics that are only there because they're brand-new (else this list just duplicates Recent Documents) | Same fetch pattern as above, different sort/filter |
| Classification Statistics | Per-classification topic counts from Discourse's existing `/tags.json` (already returns topic counts per tag) filtered to the 5 classification slugs from the archive IA doc | None new — no backend aggregation required, purely a filtered read of an existing endpoint |

`Operational Divisions` intentionally replaces `common/homepage.html`'s old 5-group structure
(Corporate Command / Operations Center / Training Command / Division Headquarters / Leadership
Center) — that grouping predates and doesn't match the finalized 6-division archive taxonomy.

### Known Blocking Dependency

`getClassification()` in `lib/ddi-classification.js` has the tag-shape bug already flagged during
the Intelligence Network work (it compares `tag.slug` against what are actually plain tag-name
strings, so it likely always resolves to the default). Classification Statistics is the second
feature now depending on this function. Two independent features silently no-op'ing on the same bug
is a stronger reason to fix it than either feature alone — it should be resolved before or alongside
the Classification Statistics phase, not worked around a second time.

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

**Phase 2 — Search Intelligence + Operational Divisions**
The two lowest-risk sections: no new data-fetching pattern (search delegates to Discourse's own
search route; divisions read already-loaded category data). Delivers the first visible, meaningfully
different homepage.

**Phase 3 — Recent Documents + Recently Updated**
Introduces list-fetching. Extend the existing service pattern from `ddi-related-intelligence` rather
than a new one-off fetch mechanism. Requires explicitly defining the sort/filter distinction between
the two lists so they don't render near-duplicate content.

**Phase 4 — Classification Statistics**
Depends on Phase 0's fix. Reads `/tags.json`, filters to the 5 classification slugs, renders counts.

**Phase 5 — Retirement & Polish**
Remove `common/homepage.html` and `common/sidebar.html` (or fold any still-relevant copy into the new
connector). Wire remaining relevant settings (`ddi_compact_density`, `ddi_red_glow_strength`) into the
new section styling. Visual QA across desktop/mobile breakpoints.
