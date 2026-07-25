import Service, { service } from "@ember/service";
import { parseCookedHtml } from "../lib/ddi-cooked-parser";
import { findDocumentReferences } from "../lib/ddi-cross-reference";
import { parseDocumentId } from "../lib/ddi-document-id";
import { createNode, createEdge, mergeNodes } from "../lib/ddi-graph";

export default class DdiKnowledgeGraphService extends Service {
  @service ddiDocumentMetadata;
  @service ddiRelationship;
  @service ddiRelatedIntelligence;
  @service ddiCitationPreview;

  async getDocumentGraph(topic) {
    const metadata = this.ddiDocumentMetadata.getMetadata(topic);

    if (!topic || !metadata) {
      return { nodes: [], edges: [] };
    }

    const centerNode = createNode({
      id: topic.id,
      documentId: metadata.documentNumber,
      title: metadata.title,
      classification: metadata.classification,
      classificationClass: metadata.classificationClass,
      department: metadata.departmentDisplay,
      revision: metadata.revision,
      url: topic.slug ? `/t/${topic.slug}/${topic.id}` : `/t/${topic.id}`,
    });

    const empty = { nodes: [], edges: [] };

    const [relationships, crossReferences, related] = await Promise.all([
      this._buildRelationshipEdges(topic, centerNode.id).catch(() => empty),
      this._buildCrossReferenceEdges(topic, centerNode.id).catch(() => empty),
      this._buildRelatedEdges(topic, centerNode.id).catch(() => empty),
    ]);

    return {
      nodes: mergeNodes([
        centerNode,
        ...relationships.nodes,
        ...crossReferences.nodes,
        ...related.nodes,
      ]),
      edges: [...relationships.edges, ...crossReferences.edges, ...related.edges],
    };
  }

  async _buildRelationshipEdges(topic, centerId) {
    const declarations = await this.ddiRelationship.getRelationships(topic);

    const nodes = [];
    const edges = [];

    declarations.forEach((declaration) => {
      const targetId = parseDocumentId(declaration.documentNumber);

      if (!targetId || targetId === centerId) {
        return;
      }

      nodes.push(
        createNode({
          id: targetId,
          documentId: declaration.documentNumber,
          title: declaration.title,
          classification: declaration.classification,
          classificationClass: declaration.classificationClass,
          revision: declaration.revision,
          url: declaration.url,
        })
      );

      edges.push(createEdge(centerId, targetId, "relationship", declaration.type));
    });

    return { nodes, edges };
  }

  async _buildCrossReferenceEdges(topic, centerId) {
    const post = topic.postStream?.posts?.[0];
    const text = parseCookedHtml(post?.cooked)?.body?.textContent;

    const uniqueIds = [
      ...new Set(findDocumentReferences(text).map((reference) => reference.documentId)),
    ].filter((id) => id && id !== centerId);

    const citations = await Promise.all(
      uniqueIds.map((id) => this.ddiCitationPreview.getCitationById(id).catch(() => null))
    );

    const nodes = [];
    const edges = [];

    citations.filter(Boolean).forEach((citation) => {
      nodes.push(createNode(citation));
      edges.push(createEdge(centerId, citation.id, "cross-reference", "Cross Reference"));
    });

    return { nodes, edges };
  }

  async _buildRelatedEdges(topic, centerId) {
    const candidates = await this.ddiRelatedIntelligence.findRelated(topic);

    const nodes = [];
    const edges = [];

    candidates.forEach((citation, index) => {
      if (!citation || citation.id === centerId) {
        return;
      }

      nodes.push(createNode(citation));
      edges.push(
        createEdge(centerId, citation.id, "related", "Related", index + 1)
      );
    });

    return { nodes, edges };
  }
}
