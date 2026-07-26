import { getOwner } from "@ember/owner";

export default {
  shouldRender() {
    return settings.ddi_reading_lists_enabled;
  },

  setupComponent(args, component) {
    component.setProperties({
      ddiReadingLists: getOwner(component).lookup("service:ddi-reading-lists"),
      shareStatus: null,
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
