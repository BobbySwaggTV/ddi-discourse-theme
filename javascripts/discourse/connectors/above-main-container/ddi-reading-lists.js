import { getOwner } from "@ember/owner";
import { createModal } from "../../lib/ddi-modal";

export default {
  shouldRender() {
    return settings.ddi_reading_lists_enabled;
  },

  setupComponent(args, component) {
    const ddiReadingLists = getOwner(component).lookup(
      "service:ddi-reading-lists"
    );

    component.setProperties({
      ddiReadingLists,
      shareStatus: null,

      // {{action}} is deprecated (discourse.template-action) — replaced
      // with {{on "click"}} (plus {{fn}} for the three that take an
      // argument) in the template. {{on}} needs a plain function reference
      // rather than an `actions` hash entry and doesn't auto-bind `this`,
      // so each of these closes over `component`/`ddiReadingLists` directly
      // instead — the same free-function, no-`this` pattern the
      // did-insert/did-update/will-destroy handlers below already use for
      // the identical reason. Bodies are otherwise unchanged from the old
      // `actions` hash (`this.` -> `component.`/`ddiReadingLists.` only).
      open: () => {
        component.set("shareStatus", null);
        ddiReadingLists.open();
      },

      close: () => ddiReadingLists.close(),

      // Plain, uncontrolled DOM inputs read directly via component.element
      // rather than two-way template bindings — the same technique already
      // used by the Knowledge Graph Viewer's Reset View action, kept
      // consistent here.
      createList: () => {
        const nameInput = component.element.querySelector(
          ".ddi-reading-list-name-input"
        );
        const descriptionInput = component.element.querySelector(
          ".ddi-reading-list-description-input"
        );

        if (!nameInput?.value?.trim()) {
          return;
        }

        ddiReadingLists.createList(
          nameInput.value,
          descriptionInput?.value || ""
        );

        nameInput.value = "";

        if (descriptionInput) {
          descriptionInput.value = "";
        }
      },

      openList: (listId) => {
        component.set("shareStatus", null);
        ddiReadingLists.openList(listId);
      },

      closeList: () => {
        component.set("shareStatus", null);
        ddiReadingLists.closeList();
      },

      addDocument: () => {
        const input = component.element.querySelector(
          ".ddi-reading-list-add-input"
        );

        if (!input) {
          return;
        }

        ddiReadingLists.addDocument(ddiReadingLists.activeListId, input.value);
        input.value = "";
      },

      removeDocument: (listId, documentId) => {
        ddiReadingLists.removeDocument(listId, documentId);
      },

      openAll: (listId) => {
        ddiReadingLists.openAllDocuments(listId);
      },

      share: (listId) => {
        ddiReadingLists.shareList(listId).then(({ url, copied }) => {
          if (component.isDestroying || component.isDestroyed) {
            return;
          }

          if (!url) {
            component.set("shareStatus", "Could not generate a share link.");
            return;
          }

          component.set(
            "shareStatus",
            copied
              ? "Reading list link copied to clipboard."
              : `Could not copy automatically — copy this link: ${url}`
          );
        });
      },

      importSharedList: () => {
        ddiReadingLists.importSharedList();
      },

      dismissSharedList: () => {
        ddiReadingLists.dismissSharedList();
      },

      // Same free-function pattern as the Integrity Dashboard connector —
      // see its setupModal for why these can't be `this`-bound methods.
      setupModal: (element) => {
        element._ddiModal = createModal(element, {
          labelledBy: "ddi-reading-lists-title",
          onClose: () => ddiReadingLists.close(),
        });

        // Unlike the other DDI dialogs, this one can already be open at
        // insert time — a shared-list URL sets isOpen in the service's
        // constructor, before this panel ever renders. did-update only
        // fires on later changes, so the initial state has to be handled
        // here too or the dialog would render open with no focus trap.
        if (ddiReadingLists.isOpen) {
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
    });
  },
};
