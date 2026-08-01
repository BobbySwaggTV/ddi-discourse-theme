import Service from "@ember/service";
import { getClassification } from "../lib/ddi-classification";
import { formatDocumentId } from "../lib/ddi-document-id";
import { formatDocumentDate } from "../lib/ddi-format-date";
import { formatRevision } from "../lib/ddi-revision";
import { formatDocumentAuthor } from "../lib/ddi-author";
import { analyzeReadingTime } from "../lib/ddi-reading-time";
import { isValidDocumentType } from "../lib/ddi-document-type";
import { isValidLifecycle } from "../lib/ddi-lifecycle";
import { isValidDepartment } from "../lib/ddi-department";
import { UNCATEGORIZED_LABEL } from "../lib/ddi-category";
import { buildTimeline } from "../lib/ddi-timeline";

export default class DdiDocumentMetadataService extends Service {
  // A single-slot cache here previously only helped two *consecutive* calls
  // for the same topic — on a real topic page, 10+ independent connectors
  // (Dossier Header, Executive Summary, Document Footer, Verification
  // Panel, Debug Panel, Document Timeline, Revision History, Document
  // Intelligence, plus the Archive Navigation/Knowledge Graph/Relationship
  // services) each call getMetadata(topic) for the *same* current topic
  // during one page render, and any archive-wide scan (Integrity Dashboard,
  // System Status) that happens to interleave — even from a dialog opened
  // on a totally different page earlier in the session — evicted the one
  // slot between them, forcing a full re-resolve (classification, reading
  // time via cooked-HTML parsing, timeline building) for the same document
  // every time. A Map, keyed by topic id, keeps every distinct topic's
  // metadata for the life of the session instead of just the last one —
  // same "cache for the session, no invalidation" tradeoff this theme
  // already makes in ddi-citation-preview.js and ddi-archive.js. Metadata
  // objects are small (plain strings/numbers), so — unlike the cooked-HTML
  // parse cache below, which holds full parsed Documents — this doesn't
  // need a size bound to stay cheap even across a full archive scan.
  _cache = new Map();

  getMetadata(topic) {
    if (!topic) {
      return null;
    }

    const key = topic.id;

    if (!this._cache.has(key)) {
      this._cache.set(key, this._resolve(topic));
    }

    return this._cache.get(key);
  }

  _resolve(topic) {
    const post = topic.postStream?.posts?.[0];
    const tags = topic.tags || [];

    const {
      classification,
      className: classificationClass,
      message: classificationMessage,
    } = getClassification(topic);

    const departmentDisplay = topic.category?.name ?? UNCATEGORIZED_LABEL;
    const departmentSlug = topic.category?.slug;
    const department = isValidDepartment(departmentSlug)
      ? departmentSlug
      : null;

    const { wordCount, readingTime } = analyzeReadingTime(post?.cooked);

    const metadata = {
      documentNumber: formatDocumentId(topic.id),
      title: topic.title,
      classification,
      classificationClass,
      classificationMessage,
      department,
      departmentDisplay,
      category: departmentDisplay,
      documentType: tags.find((tag) => isValidDocumentType(tag)) || null,
      lifecycle: tags.find((tag) => isValidLifecycle(tag)) || null,
      revision: formatRevision(post?.version),
      author: formatDocumentAuthor(post?.username),
      createdDate: formatDocumentDate(topic.created_at),
      updatedDate: formatDocumentDate(post?.updated_at || post?.created_at),
      // Raw ISO value alongside the already-existing formatted updatedDate
      // above — added for the Document Lifecycle Dashboard's (v1.9) own
      // "Recently Updated" sort, which needs a real Date-parseable value
      // the way services/ddi-citation-preview.js#_buildCitation()'s own
      // `updatedAt` already does. Purely additive; every existing consumer
      // of getMetadata() reads only the fields it already read.
      updatedAt: post?.updated_at || post?.created_at || topic.created_at || null,
      readingTime,
      wordCount,
      tags,
      status: topic.closed ? "LOCKED" : "ACTIVE",
    };

    metadata.timeline = buildTimeline(metadata);

    return metadata;
  }
}
