import Service, { service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import { ajax } from "discourse/lib/ajax";
import {
  createReadingList,
  addDocumentToList,
  removeDocumentFromList,
  computeCompletionProgress,
  encodeShareableList,
  decodeShareableList,
} from "../lib/ddi-reading-list";
import { readRecentlyViewed } from "../lib/ddi-recently-viewed";
import { parseDocumentId, parseTopicIdFromUrl } from "../lib/ddi-document-id";

const STORAGE_KEY = "ddi-reading-lists";
const SHARE_PARAM = "ddi-shared-list";

export default class DdiReadingListsService extends Service {
  @service ddiCitationPreview;
  @service ddiDocumentMetadata;
  @service site;

  @tracked isOpen = false;
  @tracked lists = [];
  @tracked activeListId = null;
  @tracked activeListDetails = null;
  @tracked isLoadingDetails = false;
  @tracked addDocumentError = null;
  @tracked sharedListPreview = null;

  constructor() {
    super(...arguments);
    this.lists = this._readLists();
    this._checkForSharedList();
  }

  open() {
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
    this.closeList();
  }

  createList(name, description) {
    if (!name?.trim()) {
      return null;
    }

    const list = createReadingList({ name, description });

    this.lists = [...this.lists, list];
    this._saveLists();

    return list;
  }

  async openList(listId) {
    this.activeListId = listId;
    this.addDocumentError = null;

    await this._loadActiveListDetails();
  }

  closeList() {
    this.activeListId = null;
    this.activeListDetails = null;
    this.addDocumentError = null;
  }

  async addDocument(listId, input) {
    const documentId = parseTopicIdFromUrl(input) || parseDocumentId(input);

    if (!documentId) {
      this.addDocumentError = "Enter a valid document number or link.";
      return;
    }

    const citation = await this.ddiCitationPreview
      .getCitationById(documentId)
      .catch(() => null);

    if (!citation) {
      this.addDocumentError = "That document could not be found.";
      return;
    }

    this.addDocumentError = null;
    this._updateList(listId, (list) => addDocumentToList(list, documentId));

    if (this.activeListId === listId) {
      await this._loadActiveListDetails();
    }
  }

  async removeDocument(listId, documentId) {
    this._updateList(listId, (list) =>
      removeDocumentFromList(list, documentId)
    );

    if (this.activeListId === listId) {
      await this._loadActiveListDetails();
    }
  }

  async openAllDocuments(listId) {
    const list = this.lists.find((entry) => entry.id === listId);

    if (!list) {
      return;
    }

    const citations = await Promise.all(
      list.documentIds.map((id) =>
        this.ddiCitationPreview.getCitationById(id).catch(() => null)
      )
    );

    // Browsers commonly block more than one or two window.open() calls
    // triggered from a single click — a real, known limitation, not a bug
    // in this code. Each open() is independently try/caught so one blocked
    // popup doesn't stop the rest from being attempted.
    citations.filter(Boolean).forEach((citation) => {
      try {
        window.open(citation.url, "_blank", "noopener");
      } catch {
        // Ignored — see comment above.
      }
    });
  }

  getShareUrl(listId) {
    const list = this.lists.find((entry) => entry.id === listId);

    if (!list) {
      return null;
    }

    const encoded = encodeShareableList(list);

    return `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${encoded}`;
  }

  async shareList(listId) {
    const url = this.getShareUrl(listId);

    if (!url) {
      return { url: null, copied: false };
    }

    try {
      await navigator.clipboard.writeText(url);
      return { url, copied: true };
    } catch {
      return { url, copied: false };
    }
  }

  importSharedList() {
    if (!this.sharedListPreview) {
      return;
    }

    const list = createReadingList({
      name: `${this.sharedListPreview.name} (Shared)`,
      description: this.sharedListPreview.description,
    });

    list.documentIds = [...this.sharedListPreview.documentIds];

    this.lists = [...this.lists, list];
    this._saveLists();
    this.dismissSharedList();
  }

  dismissSharedList() {
    this.sharedListPreview = null;
  }

  _checkForSharedList() {
    const encoded = new URLSearchParams(window.location.search).get(
      SHARE_PARAM
    );

    if (!encoded) {
      return;
    }

    const decoded = decodeShareableList(encoded);

    if (!decoded) {
      return;
    }

    this.sharedListPreview = decoded;
    this.isOpen = true;
  }

  async _loadActiveListDetails() {
    const list = this.lists.find((entry) => entry.id === this.activeListId);

    if (!list) {
      this.activeListDetails = null;
      return;
    }

    this.isLoadingDetails = true;

    const recentlyViewedIds = readRecentlyViewed().map((entry) => entry.id);

    const documents = (
      await Promise.all(
        list.documentIds.map((id) => this._loadDocumentDetail(id))
      )
    ).filter(Boolean);

    const totalReadingTime = documents.reduce(
      (sum, doc) => sum + (doc.readingTime || 0),
      0
    );

    this.isLoadingDetails = false;
    this.activeListDetails = {
      list,
      documents,
      totalReadingTime,
      progress: computeCompletionProgress(list.documentIds, recentlyViewedIds),
    };
  }

  async _loadDocumentDetail(documentId) {
    const citation = await this.ddiCitationPreview
      .getCitationById(documentId)
      .catch(() => null);

    if (!citation) {
      return null;
    }

    return { ...citation, readingTime: await this._resolveReadingTime(documentId) };
  }

  // _loadActiveListDetails() re-resolves every document in the active list
  // on every mutation (open, add one document, remove one document) — not
  // just the one that changed. Without this, adding a 6th document to a
  // 5-document list re-fetches /t/{id}.json for all 6, including the 5
  // whose reading time was already resolved moments earlier. Reading time
  // only changes if the document's own word count changes, which this
  // theme already treats as stable enough to cache for the session
  // elsewhere (Citation Preview does the same for a document's title,
  // classification, etc.) — extending that same tradeoff to this one
  // additional field, rather than a new one.
  _readingTimeCache = new Map();

  async _resolveReadingTime(documentId) {
    const key = String(documentId);

    if (!this._readingTimeCache.has(key)) {
      this._readingTimeCache.set(key, this._fetchReadingTime(documentId));
    }

    return this._readingTimeCache.get(key);
  }

  async _fetchReadingTime(documentId) {
    const topic = await ajax(`/t/${documentId}.json`).catch(() => null);

    if (!topic) {
      // Don't let a transient fetch failure permanently cache as "0
      // minutes" for the rest of the session — same reasoning as
      // ddi-citation-preview.js's own cache, which evicts on failure for
      // the same reason. The next call for this id gets a fresh attempt.
      this._readingTimeCache.delete(String(documentId));
      return 0;
    }

    return this.ddiDocumentMetadata.getMetadata(this._adaptTopic(topic))
      ?.readingTime || 0;
  }

  // Adapts a raw /t/{id}.json payload into the shape
  // ddiDocumentMetadata.getMetadata() expects from a live Ember Topic model
  // — the same shape-translation-only technique the Integrity Dashboard
  // service already uses for the same reason (see ARCHITECTURE.md).
  _adaptTopic(topic) {
    return {
      id: topic.id,
      title: topic.title,
      tags: topic.tags || [],
      created_at: topic.created_at,
      closed: topic.closed,
      category:
        this.site.categories?.find((c) => c.id === topic.category_id) ||
        null,
      postStream: { posts: topic.post_stream?.posts || [] },
    };
  }

  _readLists() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  _saveLists() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.lists));
    } catch {
      // localStorage unavailable (privacy mode, quota, disabled) — lists
      // still work for the rest of this page life, just won't persist.
    }
  }

  _updateList(listId, updater) {
    this.lists = this.lists.map((list) =>
      list.id === listId ? updater(list) : list
    );
    this._saveLists();
  }
}
