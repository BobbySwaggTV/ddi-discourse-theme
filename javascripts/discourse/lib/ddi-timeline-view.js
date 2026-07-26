// Groups already-shaped Citation Preview documents (as returned by
// ddi-intelligence-index.js#getIndex()) by the year of their existing
// `updatedAt` date — no new date field, no extra fetch, just reusing what
// the Intelligence Index already produced for every document.
export function groupDocumentsByYear(documents) {
  const byYear = new Map();

  (documents || []).forEach((document) => {
    const year = yearOf(document?.updatedAt);

    if (year === null) {
      return;
    }

    if (!byYear.has(year)) {
      byYear.set(year, []);
    }

    byYear.get(year).push(document);
  });

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearDocuments]) => ({
      year,
      documents: sortByUpdatedAtDescending(yearDocuments),
    }));
}

function yearOf(dateValue) {
  if (!dateValue) {
    return null;
  }

  const year = new Date(dateValue).getFullYear();

  return Number.isNaN(year) ? null : year;
}

function sortByUpdatedAtDescending(documents) {
  return [...documents].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  );
}
