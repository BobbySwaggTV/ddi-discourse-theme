export function createNode(fields) {
  return {
    id: fields.id,
    documentId: fields.documentId,
    title: fields.title,
    classification: fields.classification,
    classificationClass: fields.classificationClass,
    department: fields.department ?? null,
    revision: fields.revision ?? null,
    url: fields.url,
  };
}

export function createEdge(source, target, type, label, rank = null) {
  return { source, target, type, label, rank };
}

function fillGaps(base, extra) {
  const merged = { ...base };

  Object.keys(extra).forEach((key) => {
    if (merged[key] == null && extra[key] != null) {
      merged[key] = extra[key];
    }
  });

  return merged;
}

export function mergeNodes(nodeList) {
  const byId = new Map();

  nodeList.forEach((node) => {
    if (!node || node.id == null) {
      return;
    }

    byId.set(node.id, byId.has(node.id) ? fillGaps(byId.get(node.id), node) : node);
  });

  return [...byId.values()];
}
