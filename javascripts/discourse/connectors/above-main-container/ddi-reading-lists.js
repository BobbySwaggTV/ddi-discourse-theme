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

  actions: {
    open() {
      this.set("shareStatus", null);
      this.ddiReadingLists.open();
    },

    close() {
      this.ddiReadingLists.close();
    },

    // Plain, uncontrolled DOM inputs read directly via this.element rather
    // than two-way template bindings — the same technique already used by
    // the Knowledge Graph Viewer's Reset View action, kept consistent here.
    createList() {
      const nameInput = this.element.querySelector(
        ".ddi-reading-list-name-input"
      );
      const descriptionInput = this.element.querySelector(
        ".ddi-reading-list-description-input"
      );

      if (!nameInput?.value?.trim()) {
        return;
      }

      this.ddiReadingLists.createList(
        nameInput.value,
        descriptionInput?.value || ""
      );

      nameInput.value = "";

      if (descriptionInput) {
        descriptionInput.value = "";
      }
    },

    openList(listId) {
      this.set("shareStatus", null);
      this.ddiReadingLists.openList(listId);
    },

    closeList() {
      this.set("shareStatus", null);
      this.ddiReadingLists.closeList();
    },

    addDocument() {
      const input = this.element.querySelector(".ddi-reading-list-add-input");

      if (!input) {
        return;
      }

      this.ddiReadingLists.addDocument(
        this.ddiReadingLists.activeListId,
        input.value
      );
      input.value = "";
    },

    removeDocument(listId, documentId) {
      this.ddiReadingLists.removeDocument(listId, documentId);
    },

    openAll(listId) {
      this.ddiReadingLists.openAllDocuments(listId);
    },

    share(listId) {
      this.ddiReadingLists.shareList(listId).then(({ url, copied }) => {
        if (this.isDestroying || this.isDestroyed) {
          return;
        }

        if (!url) {
          this.set("shareStatus", "Could not generate a share link.");
          return;
        }

        this.set(
          "shareStatus",
          copied
            ? "Reading list link copied to clipboard."
            : `Could not copy automatically — copy this link: ${url}`
        );
      });
    },

    importSharedList() {
      this.ddiReadingLists.importSharedList();
    },

    dismissSharedList() {
      this.ddiReadingLists.dismissSharedList();
    },
  },
};
