// The single place that understands what a revision-table row means. Two
// thin extraction adapters below (one for raw composer markdown, one for a
// published post's cooked HTML) get raw per-row cell arrays out of two
// fundamentally different source representations — that split is
// unavoidable (a markdown pipe table and a rendered <table>'s DOM have no
// common text-scanning shortcut the way inline "DDI-NNNNNN" patterns do,
// since a <table>'s own .textContent drops cell boundaries entirely) — but
// both funnel into this one function to turn raw cells into a structured
// row. No consumer (Author Assistant, the Document View panel, Integrity
// Dashboard) parses a revision table any other way.
const REVISION_HEADING_PATTERN = /^##\s+Revision History\s*$/i;
const COLUMN_COUNT = 5;

function isTableRowLine(line) {
  return /^\|.*\|\s*$/.test((line || "").trim());
}

function splitRowLine(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell));
}

function normalizeRow(cells) {
  if (!cells || cells.length < COLUMN_COUNT) {
    return null;
  }

  const [revisionNumber, date, author, summary, approvalStatus] = cells
    .slice(0, COLUMN_COUNT)
    .map((cell) => (cell || "").trim());

  if (!revisionNumber) {
    return null;
  }

  return { revisionNumber, date, author, summary, approvalStatus };
}

function buildRevisionRows(rawRows) {
  return rawRows.map(normalizeRow).filter(Boolean);
}

// Raw composer markdown (draft body, no cooked HTML yet) — the same
// "operate on the source text directly" approach Author Assistant's other
// checks already use for Cross References/Related Documents, applied here
// to a pipe-table instead of single-line patterns.
export function parseMarkdownRevisionTable(raw) {
  if (!raw) {
    return [];
  }

  const lines = raw.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) =>
    REVISION_HEADING_PATTERN.test(line.trim())
  );

  if (headingIndex === -1) {
    return [];
  }

  let i = headingIndex + 1;

  while (i < lines.length && !isTableRowLine(lines[i])) {
    if (/^##\s+\S/.test(lines[i])) {
      return [];
    }

    i++;
  }

  if (i >= lines.length) {
    return [];
  }

  const separatorCells = lines[i + 1] ? splitRowLine(lines[i + 1]) : [];

  if (!isSeparatorRow(separatorCells)) {
    return [];
  }

  const rawRows = [];
  let j = i + 2;

  while (j < lines.length && isTableRowLine(lines[j])) {
    rawRows.push(splitRowLine(lines[j]));
    j++;
  }

  return buildRevisionRows(rawRows);
}

// A published post's already-parsed cooked HTML (services/ddi-integrity-
// dashboard.js and the Document View panel both already call
// lib/ddi-cooked-parser.js#parseCookedHtml() for their own needs — this
// takes that same parsed Document, it never re-fetches or re-parses
// anything itself).
export function parseCookedRevisionTable(parsedDoc) {
  const body = parsedDoc?.body;

  if (!body) {
    return [];
  }

  const heading = [...body.querySelectorAll("h2, h3")].find((el) =>
    /revision history/i.test(el.textContent || "")
  );

  if (!heading) {
    return [];
  }

  let node = heading.nextElementSibling;

  while (node && !/^H[1-6]$/.test(node.tagName)) {
    if (node.tagName === "TABLE") {
      return extractHtmlTableRows(node);
    }

    node = node.nextElementSibling;
  }

  return [];
}

function extractHtmlTableRows(table) {
  const bodyRows = [...table.querySelectorAll("tbody tr")];
  const rows = bodyRows.length
    ? bodyRows
    : [...table.querySelectorAll("tr")].slice(1);

  const rawRows = rows.map((tr) =>
    [...tr.querySelectorAll("td, th")].map((cell) =>
      (cell.textContent || "").trim()
    )
  );

  return buildRevisionRows(rawRows);
}

// Display order is always "however the table reads bottom-to-top" — an
// author appends each new revision as a new row at the bottom, so reversing
// source order is newest-first with no dependency on revision numbers
// actually being parseable version strings.
export function getRevisionsNewestFirst(rows) {
  return [...(rows || [])].reverse();
}

export function findDuplicateRevisionNumbers(rows) {
  const seen = new Set();
  const duplicates = new Set();

  (rows || []).forEach((row) => {
    const key = row.revisionNumber.toLowerCase();

    if (seen.has(key)) {
      duplicates.add(row.revisionNumber);
    }

    seen.add(key);
  });

  return [...duplicates];
}

// "R1.0" / "R2.3" / "1.0" — an optional leading R, then one or more
// dot-separated integers, compared the same way semantic-version major.minor
// segments are: left to right, missing trailing segments treated as 0.
// Anything else (free-form text, a scheme this doesn't recognize) returns
// null rather than guessing, so it's simply skipped by the ordering check
// below instead of producing a false positive.
function parseVersionKey(revisionNumber) {
  const match = (revisionNumber || "").match(/^R?(\d+(?:\.\d+)*)$/i);

  if (!match) {
    return null;
  }

  return match[1].split(".").map((segment) => parseInt(segment, 10));
}

function compareVersionKeys(a, b) {
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i++) {
    const diff = (a[i] || 0) - (b[i] || 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

// Rows are expected in stored (chronological, oldest-first) order — the
// same order an author naturally appends them in. Unparseable revision
// numbers are skipped rather than failing the check, the same
// fail-gracefully convention Author Assistant's other soft checks use.
export function isRevisionOrderValid(rows) {
  let previousKey = null;

  for (const row of rows || []) {
    const key = parseVersionKey(row.revisionNumber);

    if (!key) {
      continue;
    }

    if (previousKey && compareVersionKeys(key, previousKey) < 0) {
      return false;
    }

    previousKey = key;
  }

  return true;
}

export function findRowsMissingSummary(rows) {
  return (rows || []).filter((row) => !row.summary);
}
