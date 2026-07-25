# DDI Revision History

Version: v0.1.0 (proposed)
Repository: ddi-discourse-theme
Scope: A document-page component listing a document's edit history (Revision, Date, Editor,
Summary), designed to support future version comparison without building it yet.

## Architecture

**Discourse already tracks post revision history natively** — every post edit is versioned, with
`created_at`, editor username, and an optional free-text `edit_reason` per revision, retrievable via
Discourse's own `/posts/{id}/revisions/{n}.json` endpoint. This component surfaces that existing
data in DDI's dossier styling; it does not introduce a new revision-tracking mechanism, matching
the project's working agreement against redesigning existing architecture.

Scope of "the document" matches every other dossier component: the topic's **first post**
(`postStream.posts[0]`) — the same post `ddi-document-toc`, `ddi-document-intelligence`, and
`ddi-executive-summary` already treat as "the document," consistent with the "DDI DOCUMENT MODE"
CSS section that hides other posts' metadata. Revision History is that first post's edit history,
not the whole topic's.

### Field-to-source mapping

| Field | Source | Notes |
|---|---|---|
| Revision | Revision number, formatted `Rnn` | Same format Document Intelligence already computes (`"R" + version.padStart(2,"0")`) but never renders — see below |
| Date | Revision's `created_at` | Reuse the existing `formatDocumentDate()` from `lib/ddi-format-date.js` directly — no new date logic needed |
| Editor | Revision's `username`/`display_username` | Recommend the same uppercase + `"SYSTEM"` fallback convention `ddi-dossier-header.js` already uses for its Author field, for visual consistency |
| Summary | Revision's `edit_reason` | Discourse-native, optional. Most edits won't have one filled in — needs a fallback string, matching the codebase's existing empty-state convention (Executive Summary's `"No summary available."`, Intelligence Network's `"NO RELATED DOCUMENTS FOUND"`) |

**A small existing-duplication note, not a new problem this creates:** the `Rnn` formatting logic
is currently inlined once, in `ddi-document-intelligence.js`, and unused there (see
`ARCHITECTURE.md`'s Known Gaps). This component needs the identical formatting applied to *every*
historical revision, not just the current one. The clean move — consistent with "use shared
libraries for duplicated logic" — is a small new `lib/ddi-revision.js` exporting
`formatRevision(version)`, matching the project's existing one-concern-per-file `lib/` convention
(`ddi-classification.js`, `ddi-document-id.js`, `ddi-format-date.js` are each a single small
concept). `ddi-document-intelligence.js`'s inline computation could then import from it too,
eliminating the duplicate — worth doing at implementation time, but that's a one-line follow-up, not
something this design needs to force.

I'm not proposing extracting the Editor uppercase/fallback formatting into a shared helper — it's a
single line, and it would only be used in two places today. Worth revisiting if a third consumer
ever needs it (rule of three), not before.

## Service

A new `services/ddi-revision-history.js`, same shape as the existing `ddi-related-intelligence`
service (injectable Ember `Service`, since this does async I/O):

| Method | Responsibility |
|---|---|
| `getRevisionHistory(topic)` | Public entry point. Fetches the first post's revisions, formats each into `{ revisionNumber, revision, date, editor, summary }`, returns newest-first. |
| `_fetchRevisions(postId)` | Calls Discourse's revision endpoint. See the fetch-cost trade-off below — this is where pagination/bounding is implemented, not in the connector. |
| `_present(revisionPayload)` | Shapes one raw revision into display-ready fields, reusing `formatDocumentDate()` and the new `formatRevision()`. |

**Fetch-cost trade-off — flagging, not deciding:** Discourse's revision detail endpoint appears to
be fetched one revision at a time (confirm the exact current-core behavior before implementing —
I can't verify the live API surface from here, the same caveat already noted for outlet names in
`docs/ddi-intelligence-network.md`). A document edited 40 times means up to 40 requests to show its
full history. Three options:

- **(a) Eager, unbounded** — fetch every revision on load. Simplest, doesn't scale, the same class
  of problem already flagged for showing per-item Revision in Intelligence Network
  (`docs/ddi-intelligence-network.md`'s "Proposed Row Enrichment" note).
- **(b) Bounded / paginated** — fetch only the most recent N (e.g. 5–10) up front, with a "load
  more" affordance for the rest. This mirrors a pattern already established in this exact codebase —
  Intelligence Network caps itself at `MAX_RESULTS = 5` rather than fetching everything.
- **(c) Lighter-weight listing endpoint**, if one exists, to avoid pulling full diff payloads for
  revisions the user never expands. Worth checking at implementation time rather than assuming.

**(b) is the recommended default**, on the strength of the existing precedent in (b)'s description —
following the project's own established idiom rather than introducing a new one.

## Connector

`connectors/topic-below-post-stream/ddi-revision-history.js` + `.hbs` — placed alongside Intelligence
Network rather than in the `topic-above-posts` group. Reasoning, extending the same logic already
used to justify Intelligence Network's placement (`docs/ddi-intelligence-network.md`, "Why
`topic-below-post-stream`"): the `topic-above-posts` cards are the document's essential
at-a-glance identity (classification, summary, key stats) — read *before* the document. Revision
History, like related documents, is reference material consulted *after* — an audit trail, not a
first-glance fact. Keeping that above/below split consistent is more valuable than finding a
slightly-more-specific outlet for one more card.

Lifecycle matches every other DDI connector, unchanged in shape:

1. `setupComponent` sets `isLoading: true`, `revisions: []`.
2. Looks up `service:ddi-revision-history` via `getOwner(component)`.
3. Calls `getRevisionHistory(args.model)`.
4. On resolution (guarded against a destroyed component), sets `isLoading: false` and `revisions`.

No business logic in the connector — identical boundary to every existing DDI connector.

## Template

Reuses the existing card shell (`.ddi-card` / `.ddi-card-title` / `.ddi-card-body`) — no new
top-level container pattern.

Per-revision row: **not** a reuse of `.ddi-toc-item` (a clickable anchor), because — unlike Table of
Contents or Intelligence Network rows — a revision row has no navigation target yet; there's no page
or anchor a v1 "view this revision" click would go to. Instead, reuse the label/value grid pattern
already established for `.ddi-dossier-grid`: a plain (non-link) row showing the 4 fields — Revision,
Date, Editor, Summary — the same structural choice already proposed for Intelligence Network's row
enrichment two design passes ago, applied here to a new, non-clickable context.

States, matching the existing tone/capitalization convention (`"SCANNING ARCHIVE…"`,
`"NO RELATED DOCUMENTS FOUND"`):

- Loading: `"LOADING REVISION HISTORY…"`
- Empty (`total_revisions <= 1`, i.e. never edited): `"NO REVISION HISTORY — DOCUMENT UNCHANGED SINCE ISSUE."`
- Populated: revisions listed newest-first, with a "load more" affordance if pagination (service
  option (b)) is used.

## Future Extensibility — Version Comparison

The requirement is to *support* future comparison, not build it now. The design choice that makes
that true without over-building today: **`_present()`'s output must retain each revision's raw
number**, not only its formatted `Rnn` string. That's the entire seam a comparison feature needs.

When comparison is actually built, it doesn't need new diffing logic — Discourse's own revision
endpoint already returns a computed diff between a revision and its predecessor (`body_changes`,
with inline and side-by-side variants). A future `compareRevisions(topic, fromRevision, toRevision)`
service method would fetch and expose that existing diff, the same "reuse what Discourse already
computes" pattern already used for search (`docs/ddi-intelligence-search.md`) and classification.
The connector/template for a comparison view is a separate, later design — not scoped here.
