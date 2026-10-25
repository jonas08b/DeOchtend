// Shared helpers for the /api serverless functions.

const DEFAULT_TIMEOUT_MS = 8000;

/** fetch() with a hard timeout so one slow source can't hang the whole request. */
async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT_MS, ...opts } = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/** Only allow http/https URLs through — defence against odd/unsafe schemes in feed content. */
function isSafeHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Strip tags and collapse whitespace; RSS text is untrusted and must never be executed as HTML. */
function stripHtml(input) {
  if (!input) return '';
  return String(input)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, max = 220) {
  if (!text || text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '…';
}

/** Normalize a title for duplicate detection: lowercase, strip punctuation/whitespace noise. */
function normalizeTitleForDedupe(title) {
  return stripHtml(title)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titlesAreSimilar(a, b) {
  const na = normalizeTitleForDedupe(a);
  const nb = normalizeTitleForDedupe(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // crude containment check catches "X zegt Y" vs "X zegt Y — reacties" style republishes
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  return shorter.length > 20 && longer.includes(shorter);
}

module.exports = { fetchWithTimeout, isSafeHttpUrl, stripHtml, truncate, normalizeTitleForDedupe, titlesAreSimilar };
