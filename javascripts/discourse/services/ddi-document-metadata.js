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

export default class DdiDocumentMetadataService extends Service {
  _cache = null;

  getMetadata(topic) {
    if (!topic) {
      return null;
    }

    if (this._cache && this._cache.topicId === topic.id) {
      return this._cache.metadata;
    }

    const metadata = this._resolve(topic);
    this._cache = { topicId: topic.id, metadata };

    return metadata;
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

    return {
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
      readingTime,
      wordCount,
      tags,
      status: topic.closed ? "LOCKED" : "ACTIVE",
    };
  }
}
