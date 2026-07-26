import Service, { service } from "@ember/service";
import { buildArchiveStatistics } from "../lib/ddi-archive-statistics";
import { ISSUE_TYPES } from "../lib/ddi-integrity-issues";

const MISSING_METADATA_ISSUE_TYPES = new Set([
  ISSUE_TYPES.MISSING_CLASSIFICATION,
  ISSUE_TYPES.MISSING_DEPARTMENT,
  ISSUE_TYPES.MISSING_DOCUMENT_TYPE,
  ISSUE_TYPES.MISSING_LIFECYCLE,
]);

export default class DdiSystemStatusService extends Service {
  @service currentUser;
  @service ddiIntelligenceIndex;
  @service ddiIntegrityDashboard;

  async getStatus() {
    if (!this.currentUser?.staff) {
      return null;
    }

    const [documents, summary] = await Promise.all([
      this.ddiIntelligenceIndex.getIndex(),
      this.ddiIntegrityDashboard.getSummary(),
    ]);

    const statistics = buildArchiveStatistics(documents);
    const classificationCount = (name) =>
      statistics.classifications.find((entry) => entry.name === name)
        ?.count || 0;

    const countIssues = (issueType) =>
      summary.issues.filter((issue) => issue.issueType === issueType).length;

    const uniqueDocumentsWithIssue = (issueTypes) =>
      new Set(
        summary.issues
          .filter((issue) => issueTypes.has(issue.issueType))
          .map((issue) => issue.documentNumber)
      ).size;

    return {
      totalDocuments: statistics.totalDocuments,
      missingMetadata: uniqueDocumentsWithIssue(MISSING_METADATA_ISSUE_TYPES),
      brokenCrossReferences: countIssues(ISSUE_TYPES.INVALID_CROSS_REFERENCE),
      brokenRelatedDocuments: countIssues(ISSUE_TYPES.BROKEN_RELATED_LINK),
      duplicateDocumentNumbers: uniqueDocumentsWithIssue(
        new Set([ISSUE_TYPES.DUPLICATE_DOCUMENT_NUMBER])
      ),
      draftDocuments: summary.lifecycleCounts.draft || 0,
      archivedDocuments: summary.lifecycleCounts.archived || 0,
      publicDocuments: classificationCount("PUBLIC RELEASE"),
      internalDocuments: classificationCount("INTERNAL"),
      restrictedDocuments: classificationCount("RESTRICTED"),
      topSecretDocuments: classificationCount("TOP SECRET"),
    };
  }
}
