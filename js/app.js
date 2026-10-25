// app.js — shell: theme, settings drawer, clock, module collapse, session progress, SW registration
import { initNews } from './news.js';
import { initChess } from './chess.js';
import { initPodcast } from './podcast.js';
import { initMath } from './mentalmath.js';
import { initBrain } from './braintest.js';

export const STORAGE_PREFIX = 'deochtend:';

export function store(key, value) {
  try {
    if (value === undefined) { localStorage.removeItem(STORAGE_PREFIX + key); return; }
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch (e) { /* storage unavailable — fail silently, app still works */ }
}
export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) { return fallback; }
}

export function showToast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { el.hidden = true; }, ms);
}

export function markModuleDone(moduleId) {
  const done = load('progress:' + todayKey(), {});
  done[moduleId] = true;
  store('progress:' + todayKey(), done);
  renderProgress();
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}

const MODULES = ['news', 'chess', 'podcast', 'math', 'brain'];
const MODULE_LABELS = { news: 'Nieuws', chess: 'Schaak', podcast: 'Podcast', math: 'Rekenen', brain: 'Braintest' };

function renderProgress() {
  const bar = document.getElementById('sessionProgress');
  const show = load('settings:progress', false);
  bar.hidden = !show;
  if (!show) return;
  const done = load('progress:' + todayKey(), {});
  const dots = document.getElementById('progressDots');
  dots.innerHTML = '';
  MODULES.forEach(m => {
    const dot = document.createElement('span');
    dot.className = 'progress-dot' + (done[m] ? ' done' : '');
    dot.title = MODULE_LABELS[m] + (done[m] ? ' — afgerond' : '');
    dots.appendChild(dot);
  });
}

// ---------- Theme ----------
function applyTheme(pref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}
function initTheme() {
  const select = document.getElementById('themeSelect');
  const pref = load('settings:theme', 'system');
  select.value = pref;
  applyTheme(pref);
  select.addEventListener('change', () => {
    store('settings:theme', select.value);
    applyTheme(select.value);
  });
  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = load('settings:theme', 'system');
    const mql = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveDark = current === 'dark' || (current === 'system' && mql);
    const next = effectiveDark ? 'light' : 'dark';
    store('settings:theme', next);
    select.value = next;
    applyTheme(next);
  });
}

// ---------- Clock ----------
function initClock() {
  const el = document.getElementById('clock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleString('nl-BE', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels'
    });
  }
  tick();
  setInterval(tick, 30000);
}

// ---------- Collapse ----------
function initCollapse() {
  document.querySelectorAll('.module__collapse').forEach(btn => {
    const targetId = btn.dataset.collapseFor;
    const collapsedKey = 'collapsed:' + targetId;
    const section = document.getElementById(targetId);
    if (load(collapsedKey, false)) {
      section.classList.add('is-collapsed');
      btn.setAttribute('aria-expanded', 'false');
      btn.textContent = '+';
    }
    btn.addEventListener('click', () => {
      const collapsed = section.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      btn.textContent = collapsed ? '+' : '—';
      store(collapsedKey, collapsed);
    });
  });
}

// ---------- Settings drawer ----------
function initDrawer() {
  const drawer = document.getElementById('settingsDrawer');
  const open = () => { drawer.setAttribute('aria-hidden', 'false'); };
  const close = () => { drawer.setAttribute('aria-hidden', 'true'); };
  document.getElementById('settingsToggle').addEventListener('click', open);
  document.getElementById('closeSettings').addEventListener('click', close);
  document.getElementById('drawerScrim').addEventListener('click', close);

  const progressToggle = document.getElementById('progressToggle');
  progressToggle.checked = load('settings:progress', false);
  progressToggle.addEventListener('change', () => {
    store('settings:progress', progressToggle.checked);
    renderProgress();
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (!confirm('Alle lokale instellingen, voortgang en scores wissen?')) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith(STORAGE_PREFIX))
      .forEach(k => localStorage.removeItem(k));
    showToast('Lokale gegevens gewist.');
    setTimeout(() => location.reload(), 600);
  });
}

// ---------- Offline indicator ----------
function initOffline() {
  const pill = document.getElementById('offlineIndicator');
  function update() { pill.hidden = navigator.onLine; }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}

// ---------- Service worker ----------
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // registration can fail in local/dev or non-HTTPS contexts — non-fatal
      });
    });
  }
}

// ---------- Boot ----------
function boot() {
  initTheme();
  initClock();
  initCollapse();
  initDrawer();
  initOffline();
  initServiceWorker();
  renderProgress();

  initNews({ onDone: () => markModuleDone('news') });
  initChess({ onDone: () => markModuleDone('chess') });
  initPodcast({ onDone: () => markModuleDone('podcast') });
  initMath({ onDone: () => markModuleDone('math') });
  initBrain({ onDone: () => markModuleDone('brain') });
}

document.addEventListener('DOMContentLoaded', boot);
