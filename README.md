# DDI Discourse Theme

A custom [Discourse](https://www.discourse.org/) theme that reskins a Discourse forum into the
**DDC Intelligence Archive** — a corporate intelligence / document management interface rather
than a discussion forum. Topics are presented as classified documents ("dossiers"), categories are
framed as operational divisions, and the visual language is a dark, red-accented "command network"
aesthetic.

This is a **theme**, not a plugin: it works entirely through Discourse's theme system (SCSS
overrides, plugin outlet connectors, and API initializers) with no changes to Discourse core.

## Status

Version 1.0 shipped; Version 1.1 is now complete and being prepared for release — see
[ARCHITECTURE.md](ARCHITECTURE.md#known-gaps--unwired-code) for the precise, current list of what's
implemented versus still planned, and [CHANGELOG.md](CHANGELOG.md) for the full v1.1 change list. In
short:

- The **topic page** transformation (dossier-style header, classification banner, summary,
  document intelligence panel, table of contents, related-documents panel, Document Relationships,
  Knowledge Graph Viewer, and a Document Actions bar — Add to Reading List, Favorite, Open Knowledge
  Graph, Share) is implemented and live.
- The **homepage/categories page** now has a real Intelligence Dashboard (archive statistics), a
  Browse Archive section (tabbed: alphabetical Intelligence Index / year-grouped Intelligence
  Timeline), and Division Cards/Header (per-category presentation) — all implemented and live. The
  **sidebar** redesign, and a few of the dashboard's originally-planned sections (Search
  Intelligence, Recent Revisions), are still unbuilt — see **Known Gaps / Unwired Code** in
  ARCHITECTURE.md for exactly what remains.
- The **composer** (v1.1) now shows a Document Author Assistant panel while creating a new topic or
  editing an existing document — real-time ✓/⚠ guidance on 9 metadata/structure items, read-only,
  never blocking publishing.
- **Staff tools** — a Document Integrity Dashboard (archive-wide metadata/reference audit) and a
  System Status Dashboard (archive health summary) — are implemented, staff/admin-only.
- **Member tools** — a global Command Palette (Ctrl+K/Cmd+K, expanded in v1.1 to reach Reading
  Lists, Favorites, Browse Archive, Knowledge Graph, and both staff dashboards), a Favorites panel
  (native Discourse bookmarks), and browser-local Reading Lists — are implemented.
- Most, not all, settings in `settings.yml` are read by code — see **Theme Settings** below for
  exactly which.

## What's actually implemented

On the **topic page**, in render order: Dossier Header, Security Banner, Executive Summary, Document
Intelligence, Table of Contents, Document Relationships, Knowledge Graph Viewer, a Document Actions
bar, and (staff/debug-only) a Verification Panel and Debug Panel. In the **composer**: a Document
Author Assistant panel (v1.1). Archive-wide, on the homepage/category pages: Intelligence
Dashboard, Browse Archive (tabbed Intelligence Index / Intelligence Timeline), Division Cards,
Division Header. Available from
anywhere: Command Palette, Favorites, Reading Lists. Staff-only: Document Integrity Dashboard, System
Status Dashboard. Plus a full dark "command network" visual restyling of standard Discourse chrome
(header, sidebar, topic list, buttons, timeline, scrollbars, dialogs) in `common/common.scss`.

This list is intentionally a summary, not a reference — **[ARCHITECTURE.md](ARCHITECTURE.md)** has a
dedicated section per component (what it does, which files implement it, what it reuses, and any
known limitation), and is the accurate source if this list and that document ever disagree.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the theme is structured, the lib/service/connector
  pattern, the CSS token system, and a precise list of known gaps and unwired code.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — local development setup and process conventions.
- **[CODING_STANDARDS.md](CODING_STANDARDS.md)** — the detailed *how*: naming, JS/SCSS style, and
  the connector/service/lib split, verified against what the live code actually does.
- **[CHANGELOG.md](CHANGELOG.md)** — development history.
- **`docs/`** — design documents written during development:
  - `ddi-design-system.md`, `ddi-command-network-interface.md`, `ddi-prototype-audit.md` — the
    original visual foundation plan.
  - `ddi-archive-information-architecture.md` — proposed Discourse category/tag taxonomy for the
    archive. **This is a design document for Discourse admin configuration, not something the theme
    provisions automatically** — categories and tags still need to be created by hand in
    Discourse's admin panel.
  - `ddi-intelligence-network.md` — design notes for the related-documents feature above.
  - `ddi-intelligence-archive-dashboard.md` — roadmap for the not-yet-built homepage dashboard.
  - `ddi-document-metadata-standard.md` — the formal metadata specification (Document Number,
    Classification, Department, Document Type, Lifecycle, etc.) every document is expected to
    follow; reused directly by the Document Author Assistant (v1.1).
  - `ddi-intelligence-search.md` — proposed structured search design, not yet built.
  - `ddi-revision-history.md` — design for the document-page Revision History component (built;
    see ARCHITECTURE.md).
  - `ddi-roadmap.md` — the prioritized backlog this and prior sessions have been working through.

## Installation

This theme has no build step (no `package.json`, no bundler) — it's raw Discourse theme source,
installed the way any Discourse theme is:

1. In Discourse admin: **Customize → Themes → Install → From a git repository**, using this repo's
   URL (`https://github.com/BobbySwaggTV/ddi-discourse-theme`).
2. Or, for local development against a running Discourse instance, use Discourse's
   [`discourse_theme`](https://github.com/discourse/discourse_theme) CLI gem — see
   [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Theme Settings

Declared in `settings.yml` — 14 settings, 10 of them read by real code, 4 still reserved for planned
work (not orphaned — see [ARCHITECTURE.md](ARCHITECTURE.md#known-gaps--unwired-code) for which plan
each of the 4 maps to). Two settings that had no such mapping (`ddi_header_enabled`,
`ddi_interface_mode_enabled`) were removed in RC cleanup rather than kept as unaccountable toggles.

| Setting | Type | Default | Wired? | Description |
|---|---|---|---|---|
| `ddi_homepage_dashboard_enabled` | bool | `true` | ✅ | Show the Intelligence Dashboard above the page content |
| `ddi_intelligence_index_enabled` | bool | `true` | ✅ | Show the "All Documents" (alphabetical) tab of Browse Archive |
| `ddi_timeline_view_enabled` | bool | `true` | ✅ | Show the "By Year" tab of Browse Archive |
| `ddi_knowledge_graph_viewer_enabled` | bool | `true` | ✅ | Show the interactive Knowledge Graph Viewer |
| `ddi_reading_lists_enabled` | bool | `true` | ✅ | Show the Reading Lists trigger |
| `ddi_integrity_dashboard_enabled` | bool | `true` | ✅ | Show the staff-only Document Integrity Dashboard trigger |
| `ddi_system_status_enabled` | bool | `true` | ✅ | Show the staff-only System Status trigger |
| `ddi_debug_mode_enabled` | bool | `false` | ✅ | Show a diagnostic metadata panel on topic pages — off by default |
| `ddi_document_actions_enabled` | bool | `true` | ✅ | Show the Document Actions bar (Reading List, Favorite, Knowledge Graph, Share) |
| `ddi_document_author_assistant_enabled` | bool | `true` | ✅ | Show the composer-time Document Author Assistant panel |
| `ddi_compact_density` | bool | `true` | reserved | Use compact dashboard spacing density |
| `ddi_red_glow_strength` | enum (`low`/`medium`/`high`) | `medium` | reserved | Controls ambient red glow intensity |
| `ddi_sidebar_command_panel_enabled` | bool | `true` | reserved | Enable command-panel sidebar presentation |
| `ddi_footer_enabled` | bool | `true` | reserved | Enable DDI corporate command footer |

## Project Structure

```
about.json            Theme metadata (name, version, authors)
settings.yml           Theme settings (see above — 10 of 14 wired)
common/                Styles and templates applied on all devices
  common.scss           Main stylesheet — the live CSS token system and all component styling
  footer.html            Empty, but a valid, recognized template target (see Known Gaps in
                          ARCHITECTURE.md) — there is no header.html in this repo
desktop/desktop.scss    Desktop-only breakpoint overrides
mobile/mobile.scss      Mobile-only breakpoint overrides
javascripts/discourse/
  lib/                   Pure, stateless helper functions
  services/               Injectable Ember services (stateful/async logic)
  connectors/             Plugin outlet components (rendering only)
  api-initializers/        Page-lifecycle hooks
assets/ddi-logo.png     Present in the repo but not referenced by any template or asset config
docs/                   Design documents (see Documentation above)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for what each of these actually does and how they fit together.
