# DDI Command Network Interface

Version: v0.2.0
Repository: ddi-discourse-theme
Reference: ../ddi-command-network

## Purpose

Transform Discourse from a forum-led UI into the DDI Command Network interface while preserving Discourse backend functionality.

The target user impression is:

Dagger Defense Corporation
Command Network
Authorized Personnel Access

## Prototype References Used

### Header and Navigation
- ../ddi-command-network/prototype/header/index.html
- ../ddi-command-network/prototype/header/css/main.css

### Homepage Command Dashboard Patterns
- ../ddi-command-network/prototype/homepage/index.html
- ../ddi-command-network/prototype/homepage/css/main.css
- ../ddi-command-network/prototype/homepage/components/hero/hero.css

### Division Card and Panel Consistency
- ../ddi-command-network/prototype/divisions/index.html
- ../ddi-command-network/prototype/divisions/css/main.css

## Components Being Replaced

### Discourse Homepage Presentation
- Replace default homepage visual framing with command dashboard layout.
- Recompose categories into operational sections and DDI information cards.

### Category Presentation
- Replace default category look with command panel cards.
- Add classification, status marker, and accent rail language.

### Navigation System
- Replace simplified nav presentation with structured command navigation groups.
- Reflect prototype command/division/personnel grouping hierarchy.

### Topic List
- Restyle rows into briefing-style report panels.
- Keep sort/filter/read state functionality unchanged.

### Sidebar
- Restyle as command navigation panel with sectioned visual hierarchy.
- Add command identity and status strip styling.

### Footer
- Add DDI command footer with corporate signature copy.

## Discourse Components Being Overridden

### Theme Markup
- common/header.html for command header + grouped nav structure.

### Theme Styles
- common/common.scss for shared interface language and component restyling.
- desktop/desktop.scss for desktop command dashboard density and layout.
- mobile/mobile.scss for mobile stack and panel adaptation.

### Theme Behavior
- javascripts/discourse.js for homepage dashboard composition, category-to-section mapping, sidebar command enhancements, and footer injection.

## Planned Interface Structure

### Header Block
1. Command ribbon
2. Command identity chassis
3. Grouped command navigation

### Homepage Block
1. Corporate Command
2. Operations Center
3. Training Command
4. Division Headquarters
5. Leadership Center

Each block renders as a command module section with:
- section heading
- compact subtitle/context
- panel grid

### Category Card Block
- Classification label
- Title and short code marker
- Description
- Status indicator
- Right-side red accent rail

### Topic Briefing Block
- Mission/briefing style row shell
- Metadata hierarchy using prototype typography and density
- Same panel geometry and interaction style as cards

### Sidebar Command Block
- command panel shell
- structured section headers
- status marker treatment

### Footer Block
- Dagger Defense Corporation
- Command Network
- Strength Through Precision

## Implementation Constraints

- No Discourse core file modifications
- Theme-only overrides/components
- Existing token system is mandatory
- No new visual language outside prototype references
