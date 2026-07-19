# DDI Design System

Version: v0.1.0 Theme Foundation

## Source of Truth

All visual definitions originate from the DDI Command Network prototype in:

- ../ddi-command-network/prototype/homepage
- ../ddi-command-network/prototype/header
- ../ddi-command-network/prototype/divisions

For extracted details, see:

- docs/ddi-prototype-audit.md

## Theme Token Model

Core token variables are defined in:

- common/variables.scss

The theme uses two token layers:

1. Prototype-native tokens (exact extracted values)
2. Semantic aliases for Discourse mapping

## Foundation Modules

Shared foundation styles:

- common/common.scss

Header markup:

- common/header.html

Desktop refinements:

- desktop/desktop.scss

Mobile refinements:

- mobile/mobile.scss

Theme metadata/settings:

- about.json
- settings.yml

## Visual Rules

- Dark tactical background with fixed subtle grid/noise overlays
- Steel panel surfaces with chamfered geometry
- Red command accent rails and active states
- Dense command-terminal spacing rhythm
- Uppercase display hierarchy with widened tracking
- Primary/secondary button grammar consistent with prototype

## Scope Boundaries (v0.1.0)

- Visual theme foundation only
- No automation, permissions, group, or integration systems
- No modification of Discourse core files
