import Service, { service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";
import { parseCookedHtml } from "../lib/ddi-cooked-parser";
import { verifyDocumentIntegrity } from "../lib/ddi-integrity";
import { findDocumentReferences } from "../lib/ddi-cross-reference";
import { findDocumentRelationships } from "../lib/ddi-relationship";
import { formatDocumentId } from "../lib/ddi-document-id";
import { adaptRawTopic } from "../lib/ddi-document-metadata-adapter";
import {
  parseCookedRevisionTable,
  findDuplicateRevisionNumbers,
  isRevisionOrderValid,
} from "../lib/ddi-revision-table";
import {
  getLatestRevision,
  isValidApprovalState,
  findApprovedRevisions,
} from "../lib/ddi-approval-state";
import {
  ISSUE_TYPES,
  buildIssue,
  sortIssuesBySeverity,
} from "../lib/ddi-integrity-issues";

// Maps a WARN check's `field` (from verifyDocumentIntegrity, the shared
// Integrity library also used by the per-topic Verification Panel) to the
// dashboard's issue-type vocabulary. The "Metadata" check (title/author/
// issued date) is intentionally excluded — it isn't one of the issue types
// this dashboard was asked to surface.
const FIELD_TO_ISSUE_TYPE = {
  Classification: ISSUE_TYPES.MISSING_CLASSIFICATION,
  Department: ISSUE_TYPES.MISSING_DEPARTMENT,
  "Document Type": ISSUE_TYPES.MISSING_DOCUMENT_TYPE,
  Lifecycle: ISSUE_TYPES.MISSING_LIFECYCLE,
};

export default class DdiIntegrityDashboardService extends Service {
  @service currentUser;
  @service ddiDocumentMetadata;
  @service ddiCitationPreview;
  @service ddiArchive;
  @service site;

  // Owns the dashboard dialog's open/loading/issues state directly, rather
  // than leaving it local to the connector component — this is what lets
  // System Status Dashboard's summary cards open this same dialog via
  // `open()` instead of duplicating a second copy of it.
  @tracked isOpen = false;
  @tracked isLoading = false;
  @tracked issues = [];

  // See _scanArchive() below for why this exists.
  _scanPromise = null;

  async open() {
    this.isOpen = true;
    this.isLoading = true;
    this.issues = await this.getIssues();
    this.isLoading = false;
  }

  close() {
    this.isOpen = false;
  }

  async getIssues() {
    if (!this.currentUser?.staff) {
      return [];
    }

    const documents = await this._scanArchive();
    return this._buildIssues(documents);
  }

  // Used by System Status Dashboard to get both issue counts and lifecycle
  // counts from a single archive scan, rather than scanning twice.
  async getSummary() {
    if (!this.currentUser?.staff) {
      return { issues: [], lifecycleCounts: {} };
    }

    const documents = await this._scanArchive();

    return {
      issues: await this._buildIssues(documents),
      lifecycleCounts: this._countByLifecycle(documents),
    };
  }

  // The Document Lifecycle Dashboard (v1.9) needs the scanned documents
  // themselves, not just the issues derived from them — this exposes
  // exactly what _scanArchive() already produces internally, unchanged,
  // rather than that dashboard maintaining its own second archive-wide
  // fetch. Combined with _scanArchive()'s own caching below, calling this
  // alongside getIssues()/getSummary() in the same session (or the same
  // page load) triggers the underlying per-topic fetches at most once.
  async getDocuments() {
    if (!this.currentUser?.staff) {
      return [];
    }

    return this._scanArchive();
  }

  async _buildIssues(documents) {
    const knownIds = new Set(documents.map((doc) => doc.topicId));

    const issues = [
      ...documents.flatMap((doc) => this._metadataIssues(doc)),
      ...this._duplicateIssues(documents),
      ...documents.flatMap((doc) => this._revisionIssues(doc)),
      ...documents.flatMap((doc) => this._approvalIssues(doc)),
    ];

    const [crossReferenceIssues, relationshipIssues] = await Promise.all([
      Promise.all(
        documents.map((doc) => this._crossReferenceIssues(doc, knownIds))
      ),
      Promise.all(
        documents.map((doc) => this._relationshipIssues(doc, knownIds))
      ),
    ]);

    issues.push(...crossReferenceIssues.flat(), ...relationshipIssues.flat());

    return sortIssuesBySeverity(issues);
  }

  _countByLifecycle(documents) {
    const counts = {};

    documents.forEach((doc) => {
      const lifecycle = doc.metadata?.lifecycle;

      if (!lifecycle) {
        return;
      }

      counts[lifecycle] = (counts[lifecycle] || 0) + 1;
    });

    return counts;
  }

  // Promise-cached for the life of the session (v1.9) — the same "store the
  // in-flight/resolved Promise itself" technique ddi-archive.js#getTopics()
  // already uses, applied one level up. Before this, getIssues()/getSummary()
  // each triggered their own independent full-archive scan (every topic's
  // own /t/{id}.json fetch) whenever called, so opening the Integrity
  // Dashboard, then System Status, then this session's own Document
  // Lifecycle Dashboard (v1.9, via the new getDocuments() above) — or even
  // opening the same dashboard twice — re-fetched every document's full
  // JSON from scratch each time. Never invalidated, matching every other
  // "cache for the session" service in this theme; a stale result after an
  // edit elsewhere is the same accepted tradeoff ddiArchive/ddiDocumentMetadata/
  // ddiCitationPreview already make.
  async _scanArchive() {
    if (!this._scanPromise) {
      this._scanPromise = this._buildScan();
    }

    return this._scanPromise;
  }

  // The archive's full topic list comes from the shared, paginated,
  // session-cached ddi-archive.js service — see ARCHITECTURE.md's Archive
  // Pagination section. Each topic still needs its own full /t/{id}.json
  // fetch here (for cooked text + tags the list endpoint doesn't carry),
  // which is a different, unavoidable concern from listing the archive.
  async _buildScan() {
    const topics = await this.ddiArchive.getTopics();
    const fullTopics = await Promise.all(
      topics.map((topic) => this._fetchFullTopic(topic.id))
    );

    return fullTopics.filter(Boolean).map((topic) => this._toDocument(topic));
  }

  async _fetchFullTopic(topicId) {
    return ajax(`/t/${topicId}.json`).catch(() => null);
  }

  _toDocument(topic) {
    const metadata = this.ddiDocumentMetadata.getMetadata(
      adaptRawTopic(topic, this.site.categories)
    );

    // Parsed exactly once and reused for both .textContent (cross-
    // reference/relationship scanning, unchanged) and the revision table
    // (new in v1.7) — not a second parse of the same cooked HTML.
    const parsed = parseCookedHtml(topic.post_stream?.posts?.[0]?.cooked);

    return {
      topicId: topic.id,
      title: topic.title,
      url: topic.slug ? `/t/${topic.slug}/${topic.id}` : `/t/${topic.id}`,
      metadata,
      text: parsed?.body?.textContent,
      revisions: parseCookedRevisionTable(parsed),
    };
  }

  _metadataIssues(doc) {
    if (!doc.metadata) {
      return [];
    }

    return verifyDocumentIntegrity(doc.metadata)
      .filter((check) => check.status === "WARN" && FIELD_TO_ISSUE_TYPE[check.field])
      .map((check) =>
        buildIssue({
          documentNumber: doc.metadata.documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: FIELD_TO_ISSUE_TYPE[check.field],
        })
      );
  }

  // Structurally, two documents can't collide here — documentNumber is
  // derived 1:1 from the unique topic id (see ddi-document-id.js). This
  // check runs anyway, defensively, in case that scheme ever changes.
  _duplicateIssues(documents) {
    const byNumber = new Map();

    documents.forEach((doc) => {
      const number = doc.metadata?.documentNumber;

      if (!number) {
        return;
      }

      if (!byNumber.has(number)) {
        byNumber.set(number, []);
      }

      byNumber.get(number).push(doc);
    });

    const issues = [];

    byNumber.forEach((docs, number) => {
      if (docs.length < 2) {
        return;
      }

      docs.forEach((doc) => {
        issues.push(
          buildIssue({
            documentNumber: number,
            title: doc.title,
            url: doc.url,
            issueType: ISSUE_TYPES.DUPLICATE_DOCUMENT_NUMBER,
          })
        );
      });
    });

    return issues;
  }

  // Reuses lib/ddi-revision-table.js's own parser/validators — the exact
  // functions Author Assistant and the Document View panel already call —
  // against doc.revisions, itself already parsed once in _toDocument()
  // above. No archive rescan, no second cooked-HTML parse, no new network
  // request: every input here was already fetched/parsed for
  // _metadataIssues/_crossReferenceIssues on the same document.
  _revisionIssues(doc) {
    const rows = doc.revisions || [];
    const documentNumber =
      doc.metadata?.documentNumber || formatDocumentId(doc.topicId);

    if (rows.length === 0) {
      return [
        buildIssue({
          documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: ISSUE_TYPES.MISSING_REVISION_HISTORY,
        }),
      ];
    }

    const issues = [];
    const duplicates = findDuplicateRevisionNumbers(rows);

    if (duplicates.length) {
      issues.push(
        buildIssue({
          documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: ISSUE_TYPES.DUPLICATE_REVISION_NUMBER,
          detail: `Revision number(s) repeated: ${duplicates.join(", ")}.`,
        })
      );
    }

    if (!isRevisionOrderValid(rows)) {
      issues.push(
        buildIssue({
          documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: ISSUE_TYPES.INVALID_REVISION_ORDER,
        })
      );
    }

    return issues;
  }

  // Reuses lib/ddi-approval-state.js's own getLatestRevision()/
  // isValidApprovalState()/findApprovedRevisions() — the exact functions
  // Author Assistant calls against a composer draft — against doc.revisions,
  // the same already-parsed rows _revisionIssues() above reads. Skipped
  // entirely when there are no rows at all: _revisionIssues() already
  // raised Missing Revision History for that case, and there is no "latest
  // revision" here to have an approval state one way or the other.
  _approvalIssues(doc) {
    const rows = doc.revisions || [];

    if (rows.length === 0) {
      return [];
    }

    const documentNumber =
      doc.metadata?.documentNumber || formatDocumentId(doc.topicId);
    const issues = [];

    const latest = getLatestRevision(rows);
    const rawApprovalStatus = (latest?.approvalStatus || "").trim();

    if (!rawApprovalStatus) {
      issues.push(
        buildIssue({
          documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: ISSUE_TYPES.MISSING_APPROVAL_STATE,
        })
      );
    } else if (!isValidApprovalState(rawApprovalStatus)) {
      issues.push(
        buildIssue({
          documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: ISSUE_TYPES.INVALID_APPROVAL_VALUE,
          detail: `Latest revision's Approval Status is "${rawApprovalStatus}", not one of the 5 recognized values.`,
        })
      );
    }

    const approvedRevisions = findApprovedRevisions(rows);

    if (approvedRevisions.length > 1) {
      issues.push(
        buildIssue({
          documentNumber,
          title: doc.title,
          url: doc.url,
          issueType: ISSUE_TYPES.MULTIPLE_APPROVED_REVISIONS,
          detail: `${approvedRevisions.length} revisions are marked Approved: ${approvedRevisions.map((row) => row.revisionNumber).join(", ")}.`,
        })
      );
    }

    return issues;
  }

  async _crossReferenceIssues(doc, knownIds) {
    const uniqueIds = this._uniqueReferencedIds(
      findDocumentReferences(doc.text),
      doc.topicId
    );
    const broken = await this._brokenIds(uniqueIds, knownIds);

    return broken.map((id) =>
      buildIssue({
        documentNumber: doc.metadata?.documentNumber || formatDocumentId(doc.topicId),
        title: doc.title,
        url: doc.url,
        issueType: ISSUE_TYPES.INVALID_CROSS_REFERENCE,
        detail: `References ${formatDocumentId(id)}, which does not exist.`,
      })
    );
  }

  async _relationshipIssues(doc, knownIds) {
    const uniqueIds = this._uniqueReferencedIds(
      findDocumentRelationships(doc.text),
      doc.topicId
    );
    const broken = await this._brokenIds(uniqueIds, knownIds);

    return broken.map((id) =>
      buildIssue({
        documentNumber: doc.metadata?.documentNumber || formatDocumentId(doc.topicId),
        title: doc.title,
        url: doc.url,
        issueType: ISSUE_TYPES.BROKEN_RELATED_LINK,
        detail: `Declares a relationship to ${formatDocumentId(id)}, which does not exist.`,
      })
    );
  }

  _uniqueReferencedIds(declarations, excludeId) {
    return [...new Set(declarations.map((entry) => entry.documentId))].filter(
      (id) => id && id !== excludeId
    );
  }

  async _brokenIds(ids, knownIds) {
    const results = await Promise.all(
      ids.map(async (id) => {
        if (knownIds.has(id)) {
          return null;
        }

        const citation = await this.ddiCitationPreview
          .getCitationById(id)
          .catch(() => null);

        return citation ? null : id;
      })
    );

    return results.filter((id) => id !== null);
  }
}
