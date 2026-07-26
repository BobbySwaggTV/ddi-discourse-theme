import { getOwner } from "@ember/owner";
import {
  buildGraphView,
  hasAnyRelationships,
  layoutGraphView,
} from "../../lib/ddi-knowledge-graph-view";

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.1;

// Free functions, not component methods — {{did-insert}}/{{will-destroy}}
// invoke whatever function value they're given with the element as the
// first argument, but don't guarantee `this` inside it is the component.
// Neither function below needs `this`: state lives in the closure, and the
// reset/teardown handles are stashed directly on the element so the
// `resetView` action (a normal {{action}}, which does bind `this`) can find
// them again via `this.element` without needing to share any other state.
function setupGraphCanvas(element) {
  const inner = element.querySelector(".ddi-graph-canvas-inner");

  if (!inner) {
    return;
  }

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;

  const applyTransform = () => {
    inner.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  };

  const onWheel = (event) => {
    event.preventDefault();

    const delta = event.deltaY > 0 ? -SCALE_STEP : SCALE_STEP;
    scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale + delta));

    applyTransform();
  };

  const onPointerDown = (event) => {
    isDragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
  };

  const onPointerMove = (event) => {
    if (!isDragging) {
      return;
    }

    translateX += event.clientX - lastX;
    translateY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;

    applyTransform();
  };

  const onPointerUp = () => {
    isDragging = false;
  };

  element.addEventListener("wheel", onWheel, { passive: false });
  element.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);

  element._ddiResetGraphView = () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    applyTransform();
  };

  element._ddiTeardownGraphView = () => {
    element.removeEventListener("wheel", onWheel);
    element.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
  };
}

function teardownGraphCanvas(element) {
  element._ddiTeardownGraphView?.();
}

export default {
  shouldRender() {
    return settings.ddi_knowledge_graph_viewer_enabled;
  },

  setupComponent(args, component) {
    const topic = args.model;

    component.setProperties({
      isLoading: true,
      hasRelationships: false,
      center: null,
      parents: [],
      children: [],
      crossReferences: [],
      related: [],
      edges: [],
      quadrantLabels: [],
      setupGraph: setupGraphCanvas,
      teardownGraph: teardownGraphCanvas,
    });

    if (!topic) {
      component.set("isLoading", false);
      return;
    }

    getOwner(component)
      .lookup("service:ddi-knowledge-graph")
      .getDocumentGraph(topic)
      .then((graph) => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        const view = buildGraphView(graph, topic.id);
        const layout = layoutGraphView(view);

        component.setProperties({
          isLoading: false,
          hasRelationships: hasAnyRelationships(view),
          center: view.center,
          parents: layout.parents,
          children: layout.children,
          crossReferences: layout.crossReferences,
          related: layout.related,
          edges: layout.edges,
          quadrantLabels: layout.quadrantLabels,
        });
      })
      .catch(() => {
        if (component.isDestroying || component.isDestroyed) {
          return;
        }

        component.setProperties({ isLoading: false, hasRelationships: false });
      });
  },

  actions: {
    resetView() {
      this.element
        ?.querySelector(".ddi-graph-canvas")
        ?._ddiResetGraphView?.();
    },
  },
};
