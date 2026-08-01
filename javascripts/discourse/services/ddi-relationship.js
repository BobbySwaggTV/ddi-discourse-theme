import Service, { service } from "@ember/service";
import { parseCookedHtml } from "../lib/ddi-cooked-parser";
import { findDocumentRelationships } from "../lib/ddi-relationship";
import { parseCookedRevisionTable } from "../lib/ddi-revision-table";
import { getCurrentApprovalState } from "../lib/ddi-approval-state";

export default class DdiRelationshipService extends Service {
  @service ddiCitationPreview;
  @service ddiDocumentMetadata;

  // Document Relationships and Knowledge Graph Viewer both call
  // getRelationships() for the same current topic on every topic page view
  // — without this, that's the declaration regex scan and every declared
  // document's citation lookup done twice. A topic's own declared
  // relationships can't change within one page view, so caching by topic id
  // for the life of this session-lived service is safe — same reasoning as
  // ddi-related-intelligence.js's identical fix.
  _cache = new Map();

  async getRelationships(topic) {
    if (!topic) {
      return [];
    }

    const key = topic.id;

    if (!this._cache.has(key)) {
      this._cache.set(key, this._getRelationships(topic));
    }

    return this._cache.get(key);
  }

  async _getRelationships(topic) {
    const post = topic.postStream?.posts?.[0];
    const doc = parseCookedHtml(post?.cooked);
    const declarations = this._dedupe(
      findDocumentRelationships(doc.body.textContent)
    );

    if (!declarations.length) {
      return [];
    }

    const resolved = await Promise.all(
      declarations.map((declaration) => this._resolve(declaration, topic))
    );

    return resolved.filter(Boolean);
  }

  _dedupe(declarations) {
    const seen = new Set();

    return declarations.filter((declaration) => {
      const key = `${declaration.type}:${declaration.documentId}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }

  async _resolve(declaration, topic) {
    const citation =
      declaration.documentId === topic.id
        ? this._citationFromMetadata(topic)
        : await this.ddiCitationPreview.getCitationById(declaration.documentId);

    if (!citation) {
      return null;
    }

    return {
      type: declaration.type,
      documentNumber: citation.documentId,
      title: citation.title,
      classification: citation.classification,
      classificationClass: citation.classificationClass,
      department: citation.department,
      revision: citation.revision,
      approvalState: citation.approvalState,
      url: citation.url,
    };
  }

  _citationFromMetadata(topic) {
    const metadata = this.ddiDocumentMetadata.getMetadata(topic);

    if (!metadata) {
      return null;
    }

    // parseCookedHtml() here is the same LRU-cached parse
    // _getRelationships() above already triggered for this exact topic's
    // cooked post — reuses that cache rather than re-parsing.
    const rows = parseCookedRevisionTable(
      parseCookedHtml(topic.postStream?.posts?.[0]?.cooked)
    );

    return {
      documentId: metadata.documentNumber,
      title: metadata.title,
      classification: metadata.classification,
      classificationClass: metadata.classificationClass,
      department: metadata.departmentDisplay,
      revision: metadata.revision,
      approvalState: getCurrentApprovalState(rows),
      url: `/t/${topic.id}`,
    };
  }
}
