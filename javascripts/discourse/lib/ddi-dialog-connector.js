import { createModal } from "./ddi-modal";

// The setupModal/onOpenChange/teardownModal wiring every DDI dialog
// connector (Document Integrity Dashboard, System Status, Document
// Lifecycle Dashboard, Reading Lists) previously duplicated near-verbatim.
// createModal() itself (lib/ddi-modal.js) was already the single shared
// accessibility implementation — this only extracts the surrounding
// free-function wiring around it. `service` is whichever ddi-*-dashboard/
// -lists service owns `isOpen`/`close()`; `labelledBy` is the id of that
// dialog's own title element (the target of its `aria-labelledby`).
//
// did-insert/did-update/will-destroy invoke whatever they're given with
// the element as the first argument but don't guarantee `this` inside it
// is the calling component (see Knowledge Graph Viewer's setupGraphCanvas
// for the same lesson) — these are plain free functions closing over
// `service` for that reason, stashing the modal controller on the element
// itself, exactly as each of the 4 connectors already did independently.
export function buildDialogHandlers(service, { labelledBy }) {
  return {
    setupModal: (element) => {
      element._ddiModal = createModal(element, {
        labelledBy,
        onClose: () => service.close(),
      });

      // A dialog's own service can already have isOpen: true at insert
      // time — Reading Lists is the one existing example (a shared-list
      // URL sets isOpen in its constructor, before this element ever
      // renders). {{did-update}} only fires on later changes, so the
      // initial state has to be handled here too or a dialog that starts
      // open would render with no focus trap. For every other dialog,
      // isOpen is always false at insert time (only ever set by clicking
      // that dialog's own trigger button, which happens after insertion),
      // so this check is a harmless no-op for them — identical behavior
      // to before, not a new code path introduced for them.
      if (service.isOpen) {
        element._ddiModal.activate();
      }
    },

    onOpenChange: (element, [isOpen]) => {
      if (isOpen) {
        element._ddiModal?.activate();
      } else {
        element._ddiModal?.deactivate();
      }
    },

    teardownModal: (element) => {
      element._ddiModal?.destroy();
    },
  };
}
