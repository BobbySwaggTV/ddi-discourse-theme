import Service, { service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";
import { parseCookedHtml } from "../lib/ddi-cooked-parser";
import { verifyDocumentIntegrity } from "../lib/ddi-integrity";
import { findDocumentReferences } from "../lib/ddi-cross-reference";
import { findDocumentRelationships } from "../lib/ddi-relationship";
import { formatDocumentId } from "../lib/ddi-document-id";
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
  @service site;

  // Owns the dashboard dialog's open/loading/issues state directly, rather
  // than leaving it local to the connector component — this is what lets
  // System Status Dashboard's summary cards open this same dialog via
  // `open()` instead of duplicating a second copy of it.
  @tracked isOpen = false;
  @tracked isLoading = false;
  @tracked issues = [];

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

  async _buildIssues(documents) {
    const knownIds = new Set(documents.map((doc) => doc.topicId));

    const issues = [
      ...documents.flatMap((doc) => this._metadataIssues(doc)),
      ...this._duplicateIssues(documents),
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

  // The archive is scanned via /latest.json, the same single-page
  // definition of "the archive" already used by the Intelligence Index and
  // Archive Navigation. A genuinely paginated archive would need real
  // pagination to scan every document — out of scope for this dashboard.
  async _scanArchive() {
    const topics = await this._fetchArchiveTopicList();
    const fullTopics = await Promise.all(
      topics.map((topic) => this._fetchFullTopic(topic.id))
    );

    return fullTopics.filter(Boolean).map((topic) => this._toDocument(topic));
  }

  async _fetchArchiveTopicList() {
    const response = await ajax("/latest.json").catch(() => null);
    return response?.topic_list?.topics || [];
  }

  async _fetchFullTopic(topicId) {
    return ajax(`/t/${topicId}.json`).catch(() => null);
  }

  _toDocument(topic) {
    const metadata = this.ddiDocumentMetadata.getMetadata(
      this._adaptTopic(topic)
    );

    return {
      topicId: topic.id,
      title: topic.title,
      url: topic.slug ? `/t/${topic.slug}/${topic.id}` : `/t/${topic.id}`,
      metadata,
      text: parseCookedHtml(topic.post_stream?.posts?.[0]?.cooked)?.body
        ?.textContent,
    };
  }

  // Adapts a raw /t/{id}.json payload (snake_case, no resolved category
  // object) into the shape ddiDocumentMetadata.getMetadata() expects from a
  // live Ember Topic model — shape translation only, none of the Metadata
  // Engine's own resolution/validation logic is reimplemented here.
  _adaptTopic(topic) {
    return {
      id: topic.id,
      title: topic.title,
      tags: topic.tags || [],
      created_at: topic.created_at,
      closed: topic.closed,
      category:
        this.site.categories?.find((c) => c.id === topic.category_id) ||
        null,
      postStream: { posts: topic.post_stream?.posts || [] },
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
