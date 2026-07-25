# DDI Intelligence Search

Version: v0.1.0 (proposed)
Repository: ddi-discourse-theme
Scope: Structured search across Document Number, Title, Department, Classification, Tags, and
Document Type.

## Relationship to Existing Work

This fleshes out the "Search Intelligence" section stubbed (as a single bullet point, no design)
in `docs/ddi-intelligence-archive-dashboard.md`. That roadmap already concluded Search Intelligence
should be "a thin wrapper around Discourse's native search... no new search backend." This document
is that design, made concrete.

It is a different, complementary tool to Intelligence Network (`docs/ddi-intelligence-network.md`):
Intelligence Network is system-suggested ("what's related to the document you're reading");
Intelligence Search is user-initiated ("find a specific document"). Both read the same underlying
category/tag data model defined in `docs/ddi-archive-information-architecture.md` and
`docs/ddi-document-metadata-standard.md` — neither should grow its own parallel data source.

## Architecture

**No new search backend, and no client-side index.** Discourse already provides full-text search
(`/search`, `/search.json`) with operator-based filtering, and it already respects each viewer's
category read permissions. Of the 6 requested search fields, per the metadata standard's existing
data-source mapping:

| Field | Underlying mechanism | Native Discourse support |
|---|---|---|
| Title | Topic title (native) | Full-text matched already |
| Department | Discourse category | `category:` search operator |
| Classification | Discourse tag | `tags:` search operator |
| Document Type | Discourse tag | `tags:` search operator |
| Tags (general) | Discourse tag | `tags:` search operator |
| Document Number | **Not indexed content** — a display value computed client-side from the topic ID (`formatDocumentId()`) | Not natively searchable — see below |

Five of the six fields are things Discourse's search already does. The architecture is therefore a
**query-building layer**, not a search engine:

- **`lib/ddi-document-id.js` gains a second function**, `parseDocumentId(input)` — the inverse of
  the existing `formatDocumentId(id)`. Accepts `"DDI-000482"`, `"000482"`, or `"482"` and returns
  the numeric topic ID, or `null` if the input doesn't look like a document number. This belongs in
  the existing file, not a new one — it's the same concern (document ID formatting) in the opposite
  direction, and keeps both directions of the ID format in one place instead of two.
- **A new `lib/ddi-search-query.js`** (pure function, no I/O): takes structured filter input
  (`{ text, department, classification, documentType, tags }`) and serializes it into a Discourse
  search query string using `category:` and `tags:` operators — e.g.
  `category:fleet-security tags:restricted,incident-report reactor`. Pure string-building, matching
  the existing `lib/` convention (stateless, no Discourse/Ember dependency).
- **No new service required for v1.** Submitting a built query string to Discourse's own `/search`
  results page needs no async state management in the theme at all — Discourse's existing search
  page does the fetching, ranking, pagination, and permission filtering. A service only becomes
  necessary if a later phase wants live in-theme results (see Future Extensibility) — introducing
  one now, before that's needed, would be exactly the kind of premature complexity the project's
  working agreement asks to avoid.
- **Connector**: a single presentational component — the search form. No business logic beyond
  calling the two `lib/` functions above and navigating.

**Explicit constraint, not a suggestion:** nothing here should preload topic lists and filter them
client-side. Discourse's `/search` and `/search.json` already enforce per-viewer category
permissions; a hand-rolled client-side filter would risk surfacing restricted-category document
titles to users who can't see them, which directly undermines the entire point of the Classification
field. Route everything through Discourse's own search endpoint.

## Search Flow

1. User enters a free-text query and/or picks structured filters (Department, Classification,
   Document Type, Tags) in the search form.
2. On submit, `parseDocumentId()` checks the free-text input against the Document Number pattern.
   - **Match, and no other filters set:** this is treated as a direct lookup, not a search — navigate
     straight to the matching topic. Document Numbers are unique identifiers (per the metadata
     standard), so a deterministic redirect is more correct than a fuzzy text match, and skips a
     round trip. If the ID doesn't resolve to a real topic, Discourse's own routing produces its
     normal 404 — no custom error handling needed.
   - **No match, or other filters are also set:** proceed to step 3.
3. `ddi-search-query.js` serializes the free-text term plus any selected Department/Classification/
   Document Type/Tags into a single Discourse search query string.
4. The query is submitted to Discourse's native search (`/search?q=...` for v1 — see Future
   Extensibility for an in-theme results view).
5. Discourse's own backend handles relevance ranking, pagination, and permission filtering — no
   ranking logic is implemented in the theme for this feature, unlike Intelligence Network, which
   needed its own scoring because it's answering a different question ("related," not "matching a
   query").
6. Results render on Discourse's existing search results page, which the theme already partially
   styles (`.search-menu` is already covered by `common.scss`'s Discourse Surface Panels rule).

## User Interface Concept

A single search entry point, visually consistent with the rest of the archive (`.ddi-card`-style
dark panel, red accent), containing:

- A primary free-text field — placeholder text along the lines of "SEARCH ARCHIVE — Document
  Number, Title, or Keyword" — communicating that a Document Number goes in the same box, not a
  separate one.
- A row of structured filters beneath it:
  - **Department** — dropdown, the 6 divisions.
  - **Classification** — dropdown, the 5 tiers.
  - **Document Type** — dropdown, the closed vocabulary from the archive taxonomy.
  - **Tags** — multi-select, reusing Discourse's existing tag-picker widget (the same
    `.tag-drop`/`.select-kit-header` component the theme already styles for category/tag dropdowns
    elsewhere — not a new control).
- A submit action styled like the existing `.btn-primary`.

**Placement:** this is the natural content for the "Search Intelligence" section of the homepage
dashboard once `docs/ddi-intelligence-archive-dashboard.md` Phase 2 is built. It does not have to
wait for the rest of that dashboard, though — as a single, self-contained connector it can ship on
its own, on whatever page makes sense today (e.g. a dedicated outlet), and simply become the
dashboard's Search Intelligence section later without redesign, since its output (a query string
handed to `/search`) doesn't depend on where the form itself lives.

## Future Extensibility

- **Live in-theme results.** If a dropdown-as-you-type experience is wanted later, add a service
  (same shape as `ddi-related-intelligence`: debounced fetch against `/search.json`, present
  results) rather than reimplementing ranking — Discourse's search relevance is reused either way,
  only the presentation layer changes.
- **Lifecycle as a filter.** Once Lifecycle tags are actually implemented (flagged as not yet built
  in `docs/ddi-document-metadata-standard.md` §4.7), it's a 7th filter of the same shape as
  Classification/Document Type — the query-builder doesn't need restructuring, just one more tag
  parameter.
- **Date-range filtering** (Last Reviewed / Effective Date) is possible using Discourse's native
  `before:`/`after:` search operators, but depends entirely on how those two fields end up stored —
  an open question in the metadata standard (§4.8–4.9). Not designable further until that's decided.
- **Saved searches / division presets** (e.g. a one-click "Fleet Security only" filter) — additive
  UI on top of the same query-builder, no architecture change.
- **Division-scoped search**, e.g. searching only within the current division when browsing one —
  straightforward, since Department already maps to `category:`.
