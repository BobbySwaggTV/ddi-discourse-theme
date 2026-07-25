import Service, { service } from "@ember/service";
import { parseCookedHtml } from "../lib/ddi-cooked-parser";
import { findDocumentRelationships } from "../lib/ddi-relationship";

export default class DdiRelationshipService extends Service {
  @service ddiCitationPreview;
  @service ddiDocumentMetadata;

  async getRelationships(topic) {
    if (!topic) {
      return [];
    }

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
      revision: citation.revision,
      url: citation.url,
    };
  }

  _citationFromMetadata(topic) {
    const metadata = this.ddiDocumentMetadata.getMetadata(topic);

    if (!metadata) {
      return null;
    }

    return {
      documentId: metadata.documentNumber,
      title: metadata.title,
      classification: metadata.classification,
      classificationClass: metadata.classificationClass,
      revision: metadata.revision,
      url: `/t/${topic.id}`,
    };
  }
}
