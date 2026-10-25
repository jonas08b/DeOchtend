// news.js — fetches /api/news and renders the top-3 (politiek, economie, overige)
const CATEGORY_LABELS = { politiek: 'Politiek', economie: 'Economie', overige: 'Overige' };
const CACHE_KEY = 'deochtend:cache:news';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000; // 30 min soft cache for offline/fallback display

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('nl-BE', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Brussels'
    });
  } catch { return ''; }
}

function isSafeHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function renderArticle(article) {
  const safeUrl = isSafeHttpUrl(article.url) ? article.url : null;
  const titleHtml = safeUrl
    ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(article.title)}</a>`
    : escapeHtml(article.title);
  return `
    <article class="news-item">
      <div class="news-category">${escapeHtml(CATEGORY_LABELS[article.category] || article.category)}</div>
      <h3>${titleHtml}</h3>
      <div class="news-meta">${escapeHtml(article.source)} · ${formatTime(article.publishedAt)}</div>
      ${article.summary ? `<p class="news-summary">${escapeHtml(article.summary)}</p>` : ''}
    </article>`;
}

function renderErrors(errors) {
  if (!errors || !errors.length) return '';
  return `<p class="news-fallback">Niet beschikbaar: ${errors.map(e => escapeHtml(e.source)).join(', ')}.</p>`;
}

export async function initNews({ onDone }) {
  const body = document.getElementById('newsBody');

  function render(data, { stale = false } = {}) {
    const order = ['politiek', 'economie', 'overige'];
    let html = '';
    let anyArticle = false;
    order.forEach(cat => {
      const entry = data.categories?.[cat];
      if (entry?.article) {
        anyArticle = true;
        html += renderArticle(entry.article);
      } else {
        html += `
          <div class="news-item">
            <div class="news-category">${escapeHtml(CATEGORY_LABELS[cat])}</div>
            <p class="news-fallback">Geen recent artikel in deze categorie gevonden.</p>
          </div>`;
      }
    });
    html += renderErrors(data.errors);
    if (stale) {
      html = `<p class="news-fallback">Kon niet verversen — laatst bekende artikelen (${formatTime(data.generatedAt)}).</p>` + html;
    }
    body.innerHTML = html;
    if (anyArticle && onDone) onDone();
  }

  try {
    const res = await fetch('/api/news', { headers: { Accept: 'application/json' } });
    if (!res.ok && res.status !== 207) throw new Error('news http ' + res.status);
    const data = await res.json();
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, cachedAt: Date.now() }));
    render(data);
  } catch (err) {
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      try {
        const { data, cachedAt } = JSON.parse(cachedRaw);
        if (Date.now() - cachedAt < CACHE_MAX_AGE_MS * 8) { // allow a stale view even if older, clearly labeled
          render(data, { stale: true });
          return;
        }
      } catch { /* ignore corrupt cache */ }
    }
    body.innerHTML = `<p class="state state--error">Nieuws kon niet geladen worden. Controleer je verbinding.</p>`;
  }
}
