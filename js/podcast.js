// podcast.js — fetches /api/podcast and renders the latest episode per source.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' });
  } catch { return ''; }
}
function formatDuration(seconds) {
  if (!seconds) return '';
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m/60)}u${String(m%60).padStart(2,'0')}` : `${m} min`;
}
function isSafeHttpUrl(url) {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; }
  catch { return false; }
}

function renderEpisode(ep) {
  const cover = ep.coverUrl && isSafeHttpUrl(ep.coverUrl)
    ? `<img class="podcast-cover" src="${escapeHtml(ep.coverUrl)}" alt="" loading="lazy">`
    : `<div class="podcast-cover" aria-hidden="true"></div>`;
  const audio = ep.audioUrl && isSafeHttpUrl(ep.audioUrl)
    ? `<audio controls preload="none" src="${escapeHtml(ep.audioUrl)}"></audio>`
    : (isSafeHttpUrl(ep.pageUrl)
        ? `<a href="${escapeHtml(ep.pageUrl)}" target="_blank" rel="noopener noreferrer nofollow">Beluister op de website →</a>`
        : '');
  return `
    <article class="podcast-item">
      ${cover}
      <div class="podcast-info">
        <h3>${escapeHtml(ep.title)}</h3>
        <div class="podcast-meta">${escapeHtml(ep.sourceLabel)} · ${formatDate(ep.publishedAt)}${ep.durationSeconds ? ' · ' + formatDuration(ep.durationSeconds) : ''}</div>
        ${audio}
      </div>
    </article>`;
}

export async function initPodcast({ onDone }) {
  const body = document.getElementById('podcastBody');
  try {
    const res = await fetch('/api/podcast', { headers: { Accept: 'application/json' } });
    if (!res.ok && res.status !== 207) throw new Error('podcast http ' + res.status);
    const data = await res.json();
    const episodes = data.episodes || [];
    if (!episodes.length) {
      body.innerHTML = '<p class="state state--empty">Geen afleveringen gevonden.</p>';
      return;
    }
    body.innerHTML = episodes.map(renderEpisode).join('') +
      (data.errors?.length ? `<p class="news-fallback">Niet beschikbaar: ${data.errors.map(e => escapeHtml(e.source)).join(', ')}.</p>` : '');
    if (onDone) onDone();
  } catch (err) {
    body.innerHTML = '<p class="state state--error">Podcasts konden niet geladen worden. Controleer je verbinding.</p>';
  }
}
