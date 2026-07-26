// Turns the Knowledge Graph service's { nodes, edges } (always a single-level
// star centered on the current document — see ddi-knowledge-graph.js) into
// the 4 display buckets this viewer was asked for. The graph's 6 declared
// relationship types don't map 1:1 onto those 4 buckets, so two judgment
// calls are made here, deliberately, not discovered from the data:
//
// - "Superseded By" / "Required Reading" -> Parent Documents (documents this
//   one's lineage sits below: a newer authoritative version, or a
//   prerequisite that comes before it).
// - "Supersedes" / "Supporting Documentation" -> Child Documents (documents
//   subordinate to this one: an older version this one replaces, or
//   material that elaborates on it).
// - The declared "References" relationship type is folded into Cross
//   References (alongside the separately-scanned inline DDI-###### mentions)
//   — both mean "this document references that one."
// - The declared "Related Intelligence" relationship type is folded into
//   Related Documents (alongside the separately-scored related-topic
//   matches) — both mean "this document is related to that one."
const PARENT_LABELS = new Set(["Superseded By", "Required Reading"]);
const CHILD_LABELS = new Set(["Supersedes", "Supporting Documentation"]);

function categoryFor(edge) {
  if (edge.type === "cross-reference") {
    return "crossReferences";
  }

  if (edge.type === "related") {
    return "related";
  }

  if (edge.type === "relationship") {
    if (PARENT_LABELS.has(edge.label)) {
      return "parents";
    }

    if (CHILD_LABELS.has(edge.label)) {
      return "children";
    }

    if (edge.label === "References") {
      return "crossReferences";
    }

    if (edge.label === "Related Intelligence") {
      return "related";
    }
  }

  return null;
}

export function buildGraphView(graph, centerId) {
  const nodesById = new Map((graph?.nodes || []).map((node) => [node.id, node]));

  const view = {
    center: nodesById.get(centerId) || null,
    parents: [],
    children: [],
    crossReferences: [],
    related: [],
  };

  (graph?.edges || []).forEach((edge) => {
    if (edge.source !== centerId) {
      return;
    }

    const category = categoryFor(edge);

    if (!category) {
      return;
    }

    const node = nodesById.get(edge.target);

    if (!node) {
      return;
    }

    view[category].push({ ...node, relationshipLabel: edge.label });
  });

  return view;
}

export function hasAnyRelationships(view) {
  return Boolean(
    view.parents.length ||
      view.children.length ||
      view.crossReferences.length ||
      view.related.length
  );
}

const CENTER = 50;
const NODE_RADIUS = 32;
const LABEL_RADIUS = 45;
const SECTOR_WIDTH = 80;

// 0deg = right, 90deg = down (standard screen/SVG orientation) — Parent
// above and Child below reads as "this document's lineage," Cross
// References and Related to the sides reads as "lateral" connections.
const SECTORS = [
  { key: "crossReferences", cssCategory: "cross-references", label: "Cross References", angle: 0 },
  { key: "children", cssCategory: "children", label: "Child Documents", angle: 90 },
  { key: "related", cssCategory: "related", label: "Related Documents", angle: 180 },
  { key: "parents", cssCategory: "parents", label: "Parent Documents", angle: -90 },
];

function pointAt(angleDeg, radius) {
  const angleRad = (angleDeg * Math.PI) / 180;

  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  };
}

function layoutSector(nodes, sectorAngle) {
  const count = nodes.length;

  return nodes.map((node, index) => {
    const angle =
      count === 1
        ? sectorAngle
        : sectorAngle -
          SECTOR_WIDTH / 2 +
          (SECTOR_WIDTH * (index + 1)) / (count + 1);

    return { ...node, ...pointAt(angle, NODE_RADIUS) };
  });
}

export function layoutGraphView(view) {
  const layout = { center: { x: CENTER, y: CENTER } };
  const edges = [];
  const quadrantLabels = [];

  SECTORS.forEach((sector) => {
    const nodes = layoutSector(view[sector.key] || [], sector.angle);

    layout[sector.key] = nodes;

    nodes.forEach((node) => {
      edges.push({
        x1: CENTER,
        y1: CENTER,
        x2: node.x,
        y2: node.y,
        category: sector.cssCategory,
      });
    });

    if (nodes.length) {
      quadrantLabels.push({
        key: sector.key,
        label: sector.label,
        ...pointAt(sector.angle, LABEL_RADIUS),
      });
    }
  });

  layout.edges = edges;
  layout.quadrantLabels = quadrantLabels;

  return layout;
}
