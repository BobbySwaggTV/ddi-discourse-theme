# DDI Prototype Audit

Version: v0.1.0 Theme Foundation
Date: 2026-07-19
Repository: ddi-discourse-theme
Reference Repository: ../ddi-command-network

## Purpose

This document records the extracted visual system from the DDI Command Network prototype and defines the foundation mapping for the official Dagger Defense Corporation Discourse theme.

The prototype is the single source of truth for visual language. This audit intentionally avoids introducing new visual direction.

## Source Files Reviewed

### Homepage Core

- ../ddi-command-network/prototype/homepage/index.html
- ../ddi-command-network/prototype/homepage/css/main.css
- ../ddi-command-network/prototype/homepage/components/hero/hero.css

### Header Prototype

- ../ddi-command-network/prototype/header/index.html
- ../ddi-command-network/prototype/header/css/main.css

### Division System (supporting consistency validation)

- ../ddi-command-network/prototype/divisions/index.html
- ../ddi-command-network/prototype/divisions/css/main.css

## Extracted Color Values

### Core Surfaces

- #050607 (void background)
- #0b0d10 (primary panel base)
- #0e1114 (secondary panel base)
- #2a2f34 (steel border/surface)
- #454b52 (steel highlight)

### Text

- #eef1f3 (primary text)
- #8a9099 (muted text)

### Accent System

- #7a1017 (deep red)
- #c31c26 (primary red)
- #ff3b3f (bright red state)
- #35d488 (nominal green)

### Supporting Values Used in Prototype Components

- #0b0c0e
- #08090b
- #f5f7f8
- #d3d8dc
- #9ba2a8
- #c7ccd1
- #8df0b8
- #d4b06a
- #9bb3cb
- #d86f76
- #ffffff

## Typography Patterns

### Font Stack

- Display/UI headings: "Bahnschrift", "Arial Narrow", Oswald, sans-serif
- Body copy: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif

### Hierarchy

- Command labels and section headers are uppercase with expanded tracking.
- Primary operational values use heavy weight (700-800).
- Body/supporting copy uses system body font with moderate line-height.

### Tracking Conventions

- Normal: ~0.08em
- Wide: ~0.18em
- Wider: ~0.28em

## Spacing Rules

### Page-Level Spacing

- Constrained container width with responsive horizontal padding.
- Vertical rhythm built from clamp ranges and module stacks.
- Information density is intentionally compact and dashboard-like.

### Module Spacing

- Cards use tight internal padding (~1rem to 1.3rem).
- Section stacks separated by controlled vertical intervals.
- Header/nav modules align to fixed, mechanical proportions.

## Border and Geometry Styles

### Border Treatment

- Steel border baseline: 1px solid #2a2f34.
- Active/hover states shift toward red-accent border tint.
- Internal inset highlights/shadows create machined depth.

### Angular Geometry

- Repeated chamfer system used in panels:
  - Large: 26px
  - Medium: 16px
  - Small: 10px
- Chamfered shapes are key to command interface identity.

## Card and Panel Patterns

### Shared Pattern (Operational, Division, Intelligence, News)

- Layered background:
  - subtle top highlight gradient
  - radial ambient light
  - steel-to-void diagonal gradient
- Panel overlay:
  - faint angled specular line
  - subtle repeating scanline texture
- Accent rail:
  - 2px red vertical edge treatment on right side
- Hover behavior:
  - slight upward translation
  - border red tint increase
  - stronger shadow response

## Button Styles

### Primary Command Button

- Red-driven gradient background
- Uppercase display font with wide tracking
- Border and hover states intensify toward bright red

### Secondary Command Button

- Steel panel background
- Border-first styling with red-accent hover border
- Same typography/shape family as primary actions

## Header and Navigation Patterns

### Header Chassis

- Three-zone command assembly:
  - ribbon
  - main header body
  - navigation bar
- Ribbon includes center command tab and secure status indicator.
- Main header includes logo module, hero title module, and status module.

### Navigation

- Uppercase links with icon + label convention.
- Active state includes red underline and red-bright text/icon.
- Utility controls (search/notification/user) are styled as integrated modules.

## Section Header Patterns

### Standard Pattern

- Compact uppercase title/subtitle grouping
- muted descriptor text
- thin red horizontal divider
- centered alignment for dashboard section groups

## Reusable UI Components Identified

### Primitive Layers

- Command surface background system
- Scanline/grid overlays
- Red ambient glow fields
- Inset machine shadow stacks

### Reusable Modules

- Command panel shell (for categories, cards, blocks)
- Status badge and readiness color treatments
- Section heading block with divider
- Action button pair (primary + secondary)
- Header command band and nav item treatment

### Discourse Mapping Targets

- Header branding/navigation shell
- Category list and category card containers
- Topic list rows and latest list cards
- Buttons, filters, dropdown headers
- Meta/status indicators and badges

## Foundation Scope for v0.1.0

- Visual foundation only
- No permission, group, automation, or integration systems
- No Discourse core modifications
- Theme files only inside ddi-discourse-theme
