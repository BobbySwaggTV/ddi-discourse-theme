# DDI Discourse Theme

A custom [Discourse](https://www.discourse.org/) theme that reskins a Discourse forum into the
**DDC Intelligence Archive** — a corporate intelligence / document management interface rather
than a discussion forum. Topics are presented as classified documents ("dossiers"), categories are
framed as operational divisions, and the visual language is a dark, red-accented "command network"
aesthetic.

This is a **theme**, not a plugin: it works entirely through Discourse's theme system (SCSS
overrides, plugin outlet connectors, and API initializers) with no changes to Discourse core.

## Status

This theme is under active development. Some of what's described in `docs/` is a design/roadmap
for work that hasn't been built yet — see [ARCHITECTURE.md](ARCHITECTURE.md#known-gaps--unwired-code)
for a precise list of what's implemented versus planned. In short:

- The **topic page** transformation (dossier-style header, classification banner, summary,
  document intelligence panel, table of contents, related-documents panel) is implemented and live.
- The **homepage, sidebar, and footer** redesigns are **not** implemented yet. Some early scaffolding
  for them exists in `common/homepage.html` and `common/sidebar.html`, but those files use filenames
  Discourse's theme compiler doesn't recognize, so they are never actually rendered. See
  `docs/ddi-intelligence-archive-dashboard.md` for the roadmap to build this properly.
- All 7 settings in `settings.yml` are declared but **not currently read by any code** — toggling
  them today has no effect. See [ARCHITECTURE.md](ARCHITECTURE.md#theme-settings) for detail.

## What's actually implemented

On the topic page, in render order:

| Component | What it does | Source |
|---|---|---|
| Dossier Header | Classification-colored header block showing document ID, author, status, issued date | `connectors/topic-above-post-stream/ddi-dossier-header.*`, `api-initializers/ddi-dossier-refresh.js` |
| Security Banner | Classification banner (e.g. "RESTRICTED") derived from the topic's tags | `connectors/topic-above-posts/ddi-security-banner.*` |
| Executive Summary | Shows the first paragraph of the topic's first post as a summary | `connectors/topic-above-posts/ddi-executive-summary.*` |
| Document Intelligence | Reading time, word count, category, replies, views, last revision | `connectors/topic-above-posts/ddi-document-intelligence.*` |
| Table of Contents | Auto-generated from `<h2>` headings in the first post | `connectors/topic-above-posts/ddi-document-toc.*` |
| Intelligence Network | Up to 5 related documents, ranked by shared category / classification / tags | `connectors/topic-below-post-stream/ddi-intelligence-network.*`, `services/ddi-related-intelligence.js` |

Plus a full dark "command network" visual restyling of the standard Discourse chrome (header,
sidebar, topic list, buttons, timeline, scrollbars) in `common/common.scss`.

There is a known, unfixed bug in the classification lookup (`lib/ddi-classification.js`) — see
[ARCHITECTURE.md](ARCHITECTURE.md#known-gaps--unwired-code) before relying on classification-based
behavior.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — how the theme is structured, the lib/service/connector
  pattern, the CSS token system, and a precise list of known gaps and unwired code.
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — local development setup and coding conventions.
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

## Installation

This theme has no build step (no `package.json`, no bundler) — it's raw Discourse theme source,
installed the way any Discourse theme is:

1. In Discourse admin: **Customize → Themes → Install → From a git repository**, using this repo's
   URL (`https://github.com/BobbySwaggTV/ddi-discourse-theme`).
2. Or, for local development against a running Discourse instance, use Discourse's
   [`discourse_theme`](https://github.com/discourse/discourse_theme) CLI gem — see
   [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Theme Settings

Declared in `settings.yml`. **The first 7 are not currently consumed by any JS or SCSS in this
repo** — they're reserved names for behavior that hasn't been wired up yet. `ddi_debug_mode_enabled`
is the exception: it's read directly (`settings.ddi_debug_mode_enabled`) by the Debug Mode panel's
connector.

| Setting | Type | Default | Description |
|---|---|---|---|
| `ddi_header_enabled` | bool | `true` | Enable DDI command network header shell |
| `ddi_compact_density` | bool | `true` | Use compact dashboard spacing density |
| `ddi_red_glow_strength` | enum (`low`/`medium`/`high`) | `medium` | Controls ambient red glow intensity |
| `ddi_interface_mode_enabled` | bool | `true` | Enable v0.2.0 DDI command network interface overrides |
| `ddi_homepage_dashboard_enabled` | bool | `true` | Render command dashboard homepage sections from categories |
| `ddi_sidebar_command_panel_enabled` | bool | `true` | Enable command-panel sidebar presentation |
| `ddi_footer_enabled` | bool | `true` | Enable DDI corporate command footer |
| `ddi_debug_mode_enabled` | bool | `false` | Show a diagnostic metadata panel on topic pages — off by default |

## Project Structure

```
about.json            Theme metadata (name, version, authors)
settings.yml           Theme settings (see above — currently unwired)
common/                Styles and templates applied on all devices
  common.scss           Main stylesheet — the live CSS token system and all component styling
  variables.scss         A second token system — NOT imported anywhere, currently dead
  header.html / footer.html / homepage.html / sidebar.html
                          footer.html is empty; homepage.html and sidebar.html are unrecognized
                          filenames and are never compiled in (see ARCHITECTURE.md)
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
