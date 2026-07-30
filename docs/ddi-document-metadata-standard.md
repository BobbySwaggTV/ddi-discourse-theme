# DDI Document Metadata Standard

Version: v1.0 (proposed)
Repository: ddi-discourse-theme
Scope: A formal metadata specification for every document filed in the DDI Intelligence Archive.

## 1. Purpose

Defines the metadata every DDI document must (or may) carry, so that documents are consistent
across all six operational divisions regardless of author or division. This standard does not
introduce new architecture — every field below is defined in terms of mechanisms the theme and
Discourse already provide (categories, tags, native topic/post fields), consistent with
`docs/ddi-archive-information-architecture.md` (category/tag taxonomy) and `ARCHITECTURE.md`
(lib/service/connector pattern). Where a field has no existing home in the system, this document
says so explicitly rather than inventing storage for it.

## 2. Operational Divisions (Department)

The 6 divisions a document may belong to, unchanged from `docs/ddi-archive-information-architecture.md`:

| Division | Category slug |
|---|---|
| Executive Command | `executive-command` |
| Fleet Security (FS) | `fleet-security` |
| Commerce, Industry & Manufacturing (CIM) | `commerce-industry-manufacturing` |
| Exploration & Survey (E&S) | `exploration-survey` |
| Contract Support Services (CSS) | `contract-support-services` |
| Public Affairs | `public-affairs` |

## 3. Field Summary

| Field | Required? | Type | Source today |
|---|---|---|---|
| Document Number | Required | System-generated identifier | Implemented — `lib/ddi-document-id.js` |
| Classification | Required (defaults if unset) | Enum (5 tiers) | Implemented — `lib/ddi-classification.js` |
| Department | Required | Enum (6 divisions) | Implemented — Discourse category (mandatory by platform) |
| Document Type | Required | Enum (closed vocabulary) | Designed, not enforced — see §4.4 |
| Author | Required | System-derived | Implemented — Dossier Header |
| Revision | Required | System-generated identifier | Computed, not yet displayed — see §4.6 |
| Lifecycle | Required | Enum (5 states) | Designed, not implemented — see §4.7 |
| Last Reviewed | Optional | Date | Not implemented — see §4.8 |
| Effective Date | Optional | Date | Not implemented — see §4.9 |

A document's Title is out of scope for this standard — it's Discourse's native topic title and
needs no DDI-specific convention.

## 4. Field Definitions

### 4.1 Document Number — Required

**Definition:** The unique identifier for the document.

**Format:** `DDI-NNNNNN` — a 6-digit, zero-padded number.

**Source of truth:** Generated 1:1 from the Discourse topic ID by `formatDocumentId()` in
`lib/ddi-document-id.js`. It is not manually assigned and cannot collide, since it inherits
Discourse's own topic ID uniqueness. No new field or storage is needed for this — it is already
correct and should not be redesigned.

**Example:** `DDI-000482`

### 4.2 Classification — Required (system-enforced default)

**Definition:** The document's sensitivity tier, controlling its security banner and (per
`docs/ddi-intelligence-network.md`) its relevance to other documents' "related documents" ranking.

**Allowed values**, ascending sensitivity, exactly as defined in `lib/ddi-classification.js`:

| Value | Tag slug | Notes |
|---|---|---|
| PUBLIC RELEASE | *(no tag — default)* | System fallback when no classification tag is present |
| INTERNAL | `internal` | |
| CONFIDENTIAL | `confidential` | |
| RESTRICTED | `restricted` | |
| TOP SECRET | `top-secret` | |

**Note:** Because the system always resolves *some* classification (falling back to PUBLIC
RELEASE when no tag is applied), a document technically always "has" a classification even if the
author never set one. This standard requires authors to apply an explicit classification tag
rather than relying on the default — the default exists as a safety fallback, not as a substitute
for deliberate classification.

### 4.3 Department — Required

**Definition:** The operational division that owns the document. See §2 for the 6 allowed values.

**Source of truth:** Discourse's native category system. A document's Department is its Discourse
category — every topic belongs to exactly one category, so this field is enforced by the platform
itself, not by DDI-specific logic. A document must not be filed in the top-level `ddi-intelligence-archive`
category directly (per `docs/ddi-archive-information-architecture.md`) — it must be in one of the
6 divisional subcategories.

### 4.4 Document Type — Required (not yet enforced)

**Definition:** The kind of document (directive, briefing, incident report, etc.).

**Allowed values:** The closed vocabulary already defined in
`docs/ddi-archive-information-architecture.md` §4 (`directive`, `strategic-plan`, `briefing`,
`intel-report`, `threat-assessment`, `incident-report`, `after-action-report`, `survey-report`,
`technical-spec`, `production-record`, `contract`, `statement-of-work`, `logistics-report`,
`press-release`, `public-statement`, `meeting-minutes`, `correspondence`). This vocabulary is
intentionally closed — new document types should be added to that list deliberately, not created
ad hoc per document.

**Current gap:** `ddi-dossier-header.hbs` currently renders a hardcoded literal
(`<strong>INTELLIGENCE BRIEF</strong>`) in the Document Type slot — every document displays the
same type today regardless of its actual tag. This standard defines what the field *should* be
once the connector is updated to read the document's type tag; that update is an implementation
task, not something this specification performs.

### 4.5 Author — Required

**Definition:** The individual who filed the document.

**Source of truth:** Already implemented in `ddi-dossier-header.js` — the username of the topic's
first post, uppercased for display. No change needed.

### 4.6 Revision — Required

**Definition:** The document's edit-revision marker.

**Format:** `Rnn` — a 2-digit, zero-padded revision number, starting at `R01`.

**Source of truth:** Already computed in `ddi-document-intelligence.js` from Discourse's native
post-edit version counter (`post.version`), so it requires no new tracking mechanism — Discourse
already versions every post edit.

**Current gap:** This value is computed (`revision`) but the Document Intelligence panel currently
only displays a *different*, date-based field also labeled "Last REVISION" (`lastRevision`, the
date of the most recent edit) — the `Rnn` code itself is not shown anywhere in the UI today. This
standard treats the `Rnn` code as the canonical Revision field; whether the UI should display the
code, the date, or both is a presentation decision for whoever implements this connector update,
not a metadata-standard question.

### 4.7 Lifecycle — Required (not yet implemented)

**Definition:** The document's status within its own lifecycle, independent of whether the
Discourse topic is open or closed.

**Allowed values:** The 5-state vocabulary already defined in
`docs/ddi-archive-information-architecture.md` §5: `draft`, `active`, `under-review`, `archived`,
`superseded`.

**Relationship to the existing STATUS field:** The Dossier Header already shows a `STATUS` field,
but it is a different, coarser signal — `LOCKED` / `ACTIVE`, derived directly from Discourse's
native `topic.closed` boolean. Lifecycle and STATUS are not the same field and should not be
conflated: STATUS reflects whether the *topic* accepts replies; Lifecycle reflects where the
*document* is in its editorial life. A document can be `active` (lifecycle) and still be `LOCKED`
(status) if replies were disabled for an unrelated moderation reason.

**Open question (architecture trade-off, not decided here):** Unlike Classification, no default
Lifecycle value is defined anywhere in the codebase today — an untagged document currently has no
Lifecycle at all. Before implementing, it's worth deciding whether Lifecycle should default to
`active` (mirroring Classification's fallback-to-safe-default pattern) or should have no default,
forcing every document to be tagged explicitly. This is a real design decision with a real
trade-off — a default is more forgiving but risks silently mislabeling stale documents as active —
and should be settled deliberately before implementation, not defaulted incidentally.

### 4.8 Last Reviewed — Optional

**Definition:** The date this document's content was last formally reviewed for accuracy, distinct
from the date it was last *edited* (which Discourse already tracks natively via `post.updated_at`,
already surfaced as `lastRevision` per §4.6).

**Format:** ISO-8601 date (`YYYY-MM-DD`) recommended for consistency and sortability.

**Current gap:** Not captured anywhere in the system today — there is no tag, custom field, or UI
slot for it. A tag is not a natural fit for an arbitrary date value (Discourse tags are discrete
slugs, not free values). The two realistic options are a Discourse topic custom field (a supported
per-topic key/value extension point, entirely separate from tags) or a structured convention within
the document body itself (e.g., a metadata line the Executive Summary or a new component parses).
Choosing between those is an architectural decision for the implementation task that adds this
field, not something this standard resolves.

**Applicability:** Primarily relevant to Document Types with an ongoing review obligation
(`directive`, `technical-spec`, `contract`) — a one-off `press-release` or `incident-report` has no
natural review cycle, which is why this field is optional rather than required.

### 4.9 Effective Date — Optional

**Definition:** The date from which the document's content is considered active or binding. May be
later than the document's issue date (e.g., a policy published today but effective next month).

**Format:** ISO-8601 date (`YYYY-MM-DD`).

**Current gap:** Same as §4.8 — not captured anywhere today, and the same storage trade-off
(topic custom field vs. body convention) applies.

**Applicability:** Meaningful for `directive`, `strategic-plan`, and `contract` document types;
generally not applicable to `briefing`, `incident-report`, or `press-release` types, which take
effect immediately by nature. Optional rather than required for this reason.

## 5. Data Source Summary

For quick reference when implementing against this standard:

| Field | Lives in |
|---|---|
| Document Number | Discourse topic ID (native) |
| Classification | Discourse tag |
| Department | Discourse category (native) |
| Document Type | Discourse tag |
| Author | Discourse post author (native) |
| Revision | Discourse post version (native) |
| Lifecycle | Discourse tag |
| Last Reviewed | Not yet stored — needs a decision (topic custom field vs. body convention) |
| Effective Date | Not yet stored — needs a decision (topic custom field vs. body convention) |

## 6. Non-Goals

This standard does not require any code changes on its own. It defines the target shape of DDI
document metadata; wiring individual fields (Document Type, Lifecycle, Last Reviewed, Effective
Date) into connectors is separate, incremental implementation work, each independently committable,
per the project's existing "one feature at a time" practice.
