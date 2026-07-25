# DDI Intelligence Network

Version: v0.1.0
Repository: ddi-discourse-theme
Scope: Related-documents feature rendered below the document post stream.

## Purpose

Surface up to five related documents beneath the current document, ranked by relevance signals already established elsewhere in the theme (category, classification, tags). Reuses the archive taxonomy defined in `docs/ddi-archive-information-architecture.md`.

## Folder Structure

```
javascripts/discourse/
├── lib/
│   ├── ddi-classification.js               (existing — reused, not duplicated)
│   ├── ddi-document-id.js                  (existing — reused, not duplicated)
│   └── ddi-format-date.js                  (existing — unused by this feature)
├── services/
│   └── ddi-related-intelligence.js         (filled in — was an empty stub)
└── connectors/
    └── topic-below-post-stream/
        ├── ddi-intelligence-network.js     (new — rendering/wiring only)
        └── ddi-intelligence-network.hbs    (new — template)
```

No existing file's behavior was changed. The only pre-existing file touched is `javascripts/discourse/services/ddi-related-intelligence.js`, which was present but empty — its name and location already matched this feature, so it was implemented in place rather than duplicated under a new filename.

## Why `topic-below-post-stream`

All current dossier components (`ddi-dossier-header`, `ddi-security-banner`, `ddi-executive-summary`, `ddi-document-intelligence`, `ddi-document-toc`) render in `topic-above-post-stream` / `topic-above-posts` — i.e. they wrap the document *before* its content. "Related documents" is conceptually the opposite: it belongs after the document has been read, so it uses the `topic-below-post-stream` outlet, which renders immediately after the post stream and before Discourse's native suggested-topics block.

Outlet availability is tied to the installed Discourse core version. Before shipping, confirm `topic-below-post-stream` is still a registered outlet on the target instance (Admin → Customize → Themes → outlet inspector, or grep Discourse core's `topic.hbs`). If the team specifically wants the panel to sit directly above Discourse's own "Suggested Topics" list rather than merely after the post stream, `topic-above-suggested` is the outlet to target instead — same connector/service, only the folder name changes.

## Service — `ddi-related-intelligence.js`

An injectable Ember `Service` (not a plain lib function), because:

- It performs async I/O (fetching candidate topics), which doesn't belong in a stateless `lib/` helper.
- It's meant to be reusable from anywhere else in the theme later (e.g. a sidebar widget) via `service:ddi-related-intelligence`, without re-implementing scoring.

Responsibilities, split into small single-purpose methods so scoring logic is isolated and independently reasoned about:

| Method | Responsibility |
|---|---|
| `findRelated(topic)` | Public entry point. Orchestrates fetch → rank → limit → present. |
| `_fetchCandidates(topic)` | Pulls candidate topics from the same category and from each of the topic's tags, dedupes by id, excludes the current topic. |
| `_fetchCategoryTopics` / `_fetchTagTopics` | Thin `ajax()` calls against `/c/:slug/:id.json` and `/tag/:name.json`. |
| `_rank(topic, candidates)` | Applies the scoring rules, drops zero-score candidates, sorts. |
| `_score(candidate, ...)` | The point rules, isolated as pure logic (no I/O), easy to unit test in isolation. |
| `_present(candidate)` | Shapes a scored topic into exactly what the template needs (title, url, formatted document id, classification). |

### Ranking Rules

| Signal | Points | Notes |
|---|---|---|
| Same category | +100 | `candidate.category_id === topic.category_id` |
| Same classification | +50 | Classification is resolved via the **existing** `getClassification()` from `lib/ddi-classification.js` — not re-derived here, so any future fix/change to classification resolution automatically applies to ranking too. |
| Shared tags | +25 per shared tag | The brief states "+25 Shared Tags" without specifying per-tag vs. flat. This implementation scores +25 for **each** overlapping tag (a document sharing 2 tags outranks one sharing 1), since that's the more useful recommendation signal and the constant (`SHARED_TAG_SCORE`) is a single line to change to a flat bonus if a fixed +25 was intended instead. |

Candidates scoring 0 are excluded entirely — a topic that shares nothing is not "related." Ties are broken by most recent `created_at`.

### Known Dependency Behavior (not fixed here, per "do not change existing code")

`getClassification()` compares `tag.slug` against tags on `topic.tags`. Discourse's topic model (and topic-list JSON) expose `tags` as plain string arrays, not objects with a `.slug` field — so that comparison likely never matches, and classification always resolves to the default (`PUBLIC RELEASE`) in practice. This service calls the same shared function against both the current topic and every candidate, so the *classification* scoring is internally consistent even if the underlying default-fallback issue exists — but it means the +50 signal may currently behave as "same category always defaults to matching," which in effect double-counts with the category signal. Fixing `getClassification()` was out of scope for this task; flagging it here since it directly affects this feature's ranking quality once addressed.

## Connector — `ddi-intelligence-network.js` / `.hbs`

Follows the exact same shape as every other DDI connector in the codebase: a plain `{ setupComponent(args, component) {...} }` object, no business logic inside it.

- Looks up the service via `getOwner(component).lookup("service:ddi-related-intelligence")` — the only container access the connector needs.
- Sets `isLoading`/`relatedDocuments` as component properties, matching the `component.setProperties({...})` pattern used by `ddi-security-banner.js`, `ddi-document-intelligence.js`, etc.
- Guards against setting state after the component is destroyed (async resolution can outlive a fast page change).
- Contains no scoring, fetching, or formatting logic — all of that lives in the service and the shared `lib/` helpers, satisfying "no duplicate business logic."

## Template — `ddi-intelligence-network.hbs`

Reuses existing, already-styled classes rather than introducing new CSS, so `common.scss` did not need to change:

- `.ddi-card` / `.ddi-card-title` / `.ddi-card-body` — same card shell as every other dossier component.
- `.ddi-toc-item` — the same clickable-row treatment already used by Table of Contents, one row per related document.
- `.ddi-toc-title` — the row's title heading.
- `.ddi-dossier-grid` — reused from the Dossier Header for the 4-field metadata strip (Document Number, Classification, Department, Revision) beneath each row's title. A plain, unstyled `<div>` wraps the title and grid together so they stack vertically inside `.ddi-toc-item`'s flex row, without adding any new CSS.
- The candidate's `classificationClass` (`ddi-public` / `ddi-internal` / `ddi-confidential` / `ddi-restricted` / `ddi-top-secret`) is applied to each row, so each related document's accent color reflects its classification for free via the existing `--ddi-accent` variable system.

Three states are handled: loading, populated (up to 5 rows), and empty (no related documents found).

### Row Enrichment (implemented)

Each row now displays 5 fields — Document Number, Title, Classification, Department, Revision —
sourced from `_present()`, which is now `async`:

- **Department** resolves `candidate.category_id` against the injected `site` service's already-
  loaded `categories` (`@service site`, `this.site.categories.findBy("id", ...)`) — no network
  request, reusing data Discourse already loads app-wide.
- **Revision** requires an additional per-candidate fetch (`_fetchRevisionNumber`), since a
  candidate's first-post `version` isn't in the topic-list JSON already fetched for scoring. This
  fetch only runs for the final top 5 results, after ranking — never for the full candidate pool —
  and is wrapped in `.catch(() => null)` so a failed fetch degrades to a `"—"` placeholder for that
  one field instead of rejecting the whole result. `findRelated`'s `.map` was changed to
  `Promise.all(...)` to accommodate `_present` becoming async; the connector's `.js` file needed no
  changes, since `findRelated`'s public contract (resolves to an array of display-ready objects) is
  unchanged — only the shape of each object grew.

**Visual note carried over from the design pass:** `.ddi-dossier-grid` was built for the Dossier
Header's single, spacious instance. Reused verbatim here across up to 5 repeated rows, it may read
as visually heavy — worth a look once this renders in a real instance. Not addressed now since it
would mean adding new CSS, which wasn't necessary to satisfy the stated requirements.

## Future Extensibility

None of the following are implemented — they're documented here so a future change can extend the
service without altering its existing `findRelated(topic)` contract or breaking current callers:

- **New ranking signals** (e.g. Document Type or Lifecycle matching, once those fields from
  `docs/ddi-document-metadata-standard.md` are implemented) can be added inside `_score()` as
  additional point rules.
- **Configurable result count** — `MAX_RESULTS` could become an optional second argument
  (`findRelated(topic, { limit })`) with the current value kept as the default.
- **Fetch performance** — the one-`ajax()`-call-per-tag pattern in `_fetchCandidates` could be
  replaced with a single `/search.json` call, or supplemented with a cache, entirely inside that
  method, invisible to callers.
- **Resilience** — per-fetch `.catch()` handling (missing today — one failed tag request currently
  rejects the whole `Promise.all`) is an additive fix, not a structural change.
- **Additional consumers** — any future component can inject `service:ddi-related-intelligence` and
  call `findRelated(topic)` as-is. This service answers "what's related to *this* topic" — it is not
  a fit for the separately-planned homepage Recent Documents / Recently Updated sections
  (`docs/ddi-intelligence-archive-dashboard.md`), which ask a different question ("what's recently
  active archive-wide") and should get their own service rather than stretching this one to serve
  both.

## Implementation Plan

1. Confirm the `topic-below-post-stream` outlet (or `topic-above-suggested`, if that placement is preferred) is valid for the target Discourse core version.
2. Implement `services/ddi-related-intelligence.js` (done above).
3. Implement `connectors/topic-below-post-stream/ddi-intelligence-network.{js,hbs}` (done above).
4. Manually verify against the category/tag taxonomy in `docs/ddi-archive-information-architecture.md`: open a document in, e.g., Fleet Security tagged `restricted` + `incident-report`, and confirm the top 5 results are dominated by same-category and same-tag documents in that order.
5. Decide whether to address the `getClassification()` tag-shape issue noted above — doing so will change ranking behavior for the +50 signal, so it should be a deliberate follow-up, not bundled silently into this feature.
6. If category/tag topic lists are large, `_fetchCategoryTopics`/`_fetchTagTopics` fetch full topic lists per request with no pagination or caching — acceptable for initial rollout, but worth revisiting (e.g. caching per topic id, or moving to a single `/search.json` call) if this proves slow on high-traffic categories. Not implemented now to avoid speculative complexity ahead of real usage data.
