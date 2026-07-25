# DDI Archive Information Architecture

Version: v0.1.0
Repository: ddi-discourse-theme
Scope: Category structure, tag taxonomy, and document placement rules for the DDC Intelligence Archive.

## Purpose

Define the category and tag structure that documents are filed under, so that:

- Every topic carries a category (division), a classification, a document type, and a lifecycle state.
- `javascripts/discourse/lib/ddi-classification.js` continues to resolve classification correctly.
- `javascripts/discourse/services/ddi-related-intelligence.js` has a consistent, structured signal set to build "related documents" recommendations from once implemented.
- Editors have an unambiguous rule for where a new document goes.

This document defines structure only. No theme code is introduced here; the Category, Tag, and Tag Group setup described below is applied through Discourse admin (Categories / Tags), not theme files.

## 1. Category Structure

One top-level category, six subcategories. Subcategories are divisions of the DDC; a topic's category is the primary "who owns this document" signal.

| Category | Slug | Parent |
|---|---|---|
| DDC Intelligence Archive | `ddc-intelligence-archive` | — (top-level) |
| Executive Command | `executive-command` | DDC Intelligence Archive |
| Fleet Security | `fleet-security` | DDC Intelligence Archive |
| Commerce, Industry & Manufacturing (CIM) | `commerce-industry-manufacturing` | DDC Intelligence Archive |
| Exploration & Survey (E&S) | `exploration-survey` | DDC Intelligence Archive |
| Contract Support Services (CSS) | `contract-support-services` | DDC Intelligence Archive |
| Public Affairs | `public-affairs` | DDC Intelligence Archive |

The top-level category is a container only — do not post documents directly into `ddc-intelligence-archive`. Every document belongs in exactly one of the six subcategories.

### Division Scope

**Executive Command** — Directives, command decisions, strategic plans, board/command correspondence, policy issuances. Governs the other five divisions; typically the highest classification tier in the archive.

**Fleet Security** — Threat assessments, incident reports, security directives, defense posture briefings, after-action reports. Second-highest classification tier; the primary consumer of Top Secret / Restricted tags.

**Commerce, Industry & Manufacturing (CIM)** — Production records, manufacturing specifications, supply chain reports, industrial contracts, commerce/trade briefings.

**Exploration & Survey (E&S)** — Survey reports, exploration logs, site/resource assessments, expedition briefings. Classification varies widely by find sensitivity.

**Contract Support Services (CSS)** — Vendor and contractor documentation, statements of work, logistics and support agreements, service reports.

**Public Affairs** — Press releases, public statements, community communications, external-facing briefings. The only division where Public Release is the expected default rather than the exception.

### Placement Rule for Cross-Division Documents

A topic has exactly one category. When a document's subject spans multiple divisions (e.g., a CIM supply contract with CSS involvement), file it under the division that **owns the decision or outcome**, not the division merely referenced in the content. Use Document Type and (future) subject tags to carry the secondary relationship rather than mis-filing the category.

## 2. Tag Groups

Three tag groups, applied identically across all six subcategories so that classification, type, and lifecycle are always present and always comparable division-to-division. This uniformity is what lets a future recommendation engine compare topics across categories instead of only within one.

| Tag Group | Selection | Required | Applies To |
|---|---|---|---|
| Classification | One tag per topic | Yes | All 6 subcategories |
| Document Type | One tag per topic | Yes | All 6 subcategories |
| Lifecycle | One tag per topic | Recommended | All 6 subcategories |

All three groups are single-select ("one tag per topic" in Discourse tag group settings). A document has exactly one classification, one primary type, and one lifecycle state at any given time — this keeps `getClassification()` (which takes the first matching tag) unambiguous and keeps future recommendation matching deterministic rather than probabilistic.

## 3. Classification Tags

These must match `CLASSIFICATIONS` in `javascripts/discourse/lib/ddi-classification.js` exactly — the slugs below are the ones the theme code already looks for.

| Tag slug | Displayed as | Used by division(s) |
|---|---|---|
| `top-secret` | TOP SECRET | Executive Command, Fleet Security |
| `restricted` | RESTRICTED | Executive Command, Fleet Security, CIM, E&S |
| `confidential` | CONFIDENTIAL | CIM, E&S, CSS |
| `internal` | INTERNAL | All divisions except Public Affairs (typical) |
| `public-release` | PUBLIC RELEASE | Public Affairs (typical), occasional cross-division releases |

Implementation note: `ddi-classification.js` currently treats the **absence** of any classification tag as the default (PUBLIC RELEASE, `ddi-public`). `public-release` is not yet a recognized slug in that file's `CLASSIFICATIONS` array — it exists here as an explicit, filterable tag for editors and for the future recommendation engine, but applying it has no visual effect until a matching entry is added to the code. Until then, "no classification tag" and "`public-release` tag applied" render identically. Flagging this as a follow-up, not doing it here since no code changes were requested.

## 4. Document Type Tags

One primary type per document, shared across divisions so the same type (e.g. `incident-report`) means the same thing everywhere.

| Tag slug | Meaning | Primary divisions |
|---|---|---|
| `directive` | Command orders, policy issuance | Executive Command |
| `strategic-plan` | Long-range planning documents | Executive Command |
| `briefing` | Situational or status briefing | All divisions |
| `intel-report` | Intelligence findings/analysis | Fleet Security, E&S |
| `threat-assessment` | Threat/risk evaluation | Fleet Security |
| `incident-report` | Post-incident record | Fleet Security |
| `after-action-report` | Post-operation review | Fleet Security, Executive Command |
| `survey-report` | Field survey/exploration findings | Exploration & Survey |
| `technical-spec` | Engineering/manufacturing specification | CIM |
| `production-record` | Manufacturing/output record | CIM |
| `contract` | Executed contract or agreement | CSS, CIM |
| `statement-of-work` | SOW / scope document | CSS |
| `logistics-report` | Supply/logistics status | CSS, CIM |
| `press-release` | External public statement | Public Affairs |
| `public-statement` | Non-press public communication | Public Affairs |
| `meeting-minutes` | Recorded meeting outcomes | All divisions |
| `correspondence` | Letters, memos, formal messages | All divisions |
| `charter` | Establishes a division, program, or standing body and its governing authority | All divisions |
| `policy` | Standing rule or position, in force until revised | All divisions |
| `manual` | Comprehensive operating reference, consulted repeatedly rather than read start to end | All divisions |
| `procedure` | Specific, repeatable sequence of steps for one task | All divisions |
| `reference` | Lookup material — terminology, tables, standards — with no procedural content of its own | All divisions |
| `training-guide` | Instructional material structured as a learning path toward a skill or certification | All divisions |

Keep this list closed and curated by editors rather than freely created per-topic — an uncontrolled Document Type vocabulary is the fastest way to make "find related documents" unreliable.

**Admin action required, not automatic:** like every tag in this section, a theme cannot create
Discourse tags on its own — an admin must add these six as real tags (**Tags → New Tag**, plain
`type` group, no special configuration) before any document can be tagged with them. The theme-side
support (`lib/ddi-document-type.js`'s `DOCUMENT_TYPES`) recognizes all six as of this pass; the tags
existing in Discourse admin is the other, separate half of "supported."

## 5. Lifecycle Tags

Tracks a document's status independently of Discourse's native open/closed topic state. `ddi-document-toc`/`ddi-dossier-header` currently derive `ACTIVE`/`LOCKED` from `topic.closed`, which is a separate, coarser signal. Lifecycle tags are for archive-status intelligence; topic locking remains an admin/moderation action.

| Tag slug | Meaning |
|---|---|
| `draft` | Not yet finalized; visible only to authorized editors per division |
| `active` | Current, in-force document |
| `under-review` | Pending revision or approval |
| `archived` | No longer current, retained for record |
| `superseded` | Replaced by a newer document (pair with a link to the replacement in-body) |

Recommended convention (process, not code): when a topic is tagged `archived` or `superseded`, close the topic. This keeps the native closed/open state and the lifecycle tag in agreement without requiring new logic.

## 6. Recommended Document Placement

Combined reference for filing a new document.

| Division | Typical Classification | Typical Document Types | Lifecycle Notes |
|---|---|---|---|
| Executive Command | `top-secret`, `restricted` | `directive`, `strategic-plan`, `briefing`, `after-action-report` | Directives usually move `draft` → `under-review` → `active`; superseded on policy change |
| Fleet Security | `top-secret`, `restricted` | `threat-assessment`, `incident-report`, `intel-report`, `after-action-report` | Incident/threat docs typically go `active` → `archived`, rarely `superseded` |
| Commerce, Industry & Manufacturing | `restricted`, `confidential`, `internal` | `technical-spec`, `production-record`, `contract`, `logistics-report` | Specs commonly `superseded` on revision |
| Exploration & Survey | `restricted`, `confidential`, `internal` | `survey-report`, `intel-report`, `briefing` | Sensitivity depends on find; classification set per-topic, not by default |
| Contract Support Services | `confidential`, `internal` | `contract`, `statement-of-work`, `logistics-report` | Contracts go `active` for term duration, then `archived` on expiry |
| Public Affairs | `public-release`, `internal` | `press-release`, `public-statement`, `briefing` | Nearly all content reaches `active`/`archived`; `under-review` for pre-release drafts |

## Design Rationale: Supporting Document Intelligence & Recommendations

`ddi-related-intelligence.js` is currently a stub. This taxonomy is designed so that, once implemented, a related-documents feature can rank candidates using consistent, comparable signals rather than free text:

1. **Same Document Type** is the strongest same-purpose signal (e.g. surface other `incident-report` topics when viewing an `incident-report`).
2. **Same or adjacent Classification** bounds recommendations to what the viewer is entitled to see, and avoids surfacing a Top Secret document as "related" from a Public Release page.
3. **Same category (division)** is a moderate signal — useful, but should not dominate Document Type, since CIM and CSS documents about the same contract are often more related to each other than two unrelated CIM documents.
4. **Lifecycle** can filter noise: prefer `active` over `archived`/`superseded` matches unless the viewer is looking at an archived document, in which case its `superseded` successor should be ranked first.

If the recommendation engine later needs cross-division topical matching (e.g. "this CIM contract and this CSS statement of work are about the same operation"), add a fourth, non-required tag group — a controlled **Subject/Program** vocabulary — rather than overloading Document Type or Classification. Out of scope for this pass; noted here so the three groups above aren't extended ad hoc later.
