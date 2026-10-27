import { initChess } from "./chess.js";
import { initMath } from "./mentalmath.js";
import { initBrain } from "./braintest.js";

const PAGE_TITLES = { home: "DeOchtend", schaak: "Schaakpuzzel", rekenen: "Hoofdrekenen", test: "Braintest" };
let chessStarted = false, mathStarted = false, brainStarted = false;

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  document.getElementById("view-" + name)?.classList.add("active");
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.getElementById("page-heading").textContent = PAGE_TITLES[name] || "DeOchtend";
  window.scrollTo(0, 0);
  if (name === "schaak" && !chessStarted) { chessStarted = true; initChess(); }
  if (name === "rekenen" && !mathStarted) { mathStarted = true; initMath(); }
  if (name === "test" && !brainStarted) { brainStarted = true; initBrain(); }
}

function route() {
  const name = (location.hash || "#home").slice(1);
  showView(["home", "schaak", "rekenen", "test"].includes(name) ? name : "home");
}
window.addEventListener("hashchange", route);
document.getElementById("home-btn").addEventListener("click", () => (location.hash = "#home"));
document.querySelectorAll(".tab-btn").forEach((b) => b.addEventListener("click", () => (location.hash = "#" + b.dataset.tab)));
route();

// ---- Expandable widgets ----
document.querySelectorAll("[data-toggle]").forEach((head) => {
  head.addEventListener("click", () => {
    document.getElementById(head.dataset.toggle).classList.toggle("open");
  });
});
document.getElementById("news-widget").classList.add("open");

// ---- Weather (Mechelen, Open-Meteo, geen key nodig) ----
const WMO_ICON = (code) => {
  if (code === 0) return "☀️";
  if ([1, 2].includes(code)) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 85, 86].includes(code)) return "❄️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌡️";
};
const WMO_DESC = (code) => ({
  0: "Helder", 1: "Vrijwel helder", 2: "Half bewolkt", 3: "Bewolkt",
  45: "Mist", 48: "Rijp-mist", 51: "Lichte motregen", 61: "Lichte regen",
  63: "Regen", 65: "Zware regen", 71: "Lichte sneeuw", 80: "Buien",
  95: "Onweer"
}[code] || "Wisselend");

async function loadWeather() {
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=51.0284&longitude=4.4803&current=temperature_2m,weather_code&timezone=Europe%2FBrussels"
    );
    const data = await res.json();
    const c = data.current;
    document.getElementById("weather-temp").textContent = Math.round(c.temperature_2m) + "°";
    document.getElementById("weather-desc").textContent = WMO_DESC(c.weather_code);
    document.getElementById("weather-icon").textContent = WMO_ICON(c.weather_code);
  } catch (err) {
    document.getElementById("weather-desc").textContent = "Weer niet beschikbaar";
  }
}
loadWeather();

// ---- Nieuws ----
function timeAgo(iso) {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 60) return diffMin + " min geleden";
  return Math.round(diffMin / 60) + " u geleden";
}

async function loadNews() {
  const el = document.getElementById("news-list");
  try {
    const res = await fetch("/api/news");
    const data = await res.json();
    if (!data.items?.length) { el.innerHTML = '<div class="empty-state">Geen recent nieuws (laatste 12u) gevonden.</div>'; return; }
    el.innerHTML = data.items.map((it) => `
      <div class="news-item">
        <a href="${it.url}" target="_blank" rel="noopener">${it.title}</a>
        <div class="meta">${it.source} · ${it.category} · ${timeAgo(it.pubDate)}</div>
        ${it.description ? `<div class="desc">${it.description}</div>` : ""}
      </div>`).join("");
  } catch (err) {
    el.innerHTML = '<div class="empty-state">Nieuws kon niet geladen worden.</div>';
  }
}
loadNews();

// ---- Podcast ----
async function loadPodcast() {
  const el = document.getElementById("podcast-list");
  try {
    const res = await fetch("/api/podcast");
    const data = await res.json();
    if (!data.episodes?.length) { el.innerHTML = '<div class="empty-state">Geen afleveringen gevonden.</div>'; return; }
    el.innerHTML = data.episodes.map((ep) => `
      <div class="podcast-item">
        ${ep.cover ? `<img src="${ep.cover}" alt="">` : ""}
        <div style="flex:1;min-width:0">
          <div class="meta-title">${ep.title}</div>
          <div class="meta-sub">${ep.show} · ${ep.publisher} · ${new Date(ep.pubDate).toLocaleDateString("nl-BE")}</div>
          ${ep.audioUrl ? `<audio controls preload="none" src="${ep.audioUrl}"></audio>` : `<a href="${ep.link}" target="_blank" rel="noopener">Beluister aflevering →</a>`}
        </div>
      </div>`).join("");
  } catch (err) {
    el.innerHTML = '<div class="empty-state">Podcasts konden niet geladen worden.</div>';
  }
}
loadPodcast();

// ---- Service worker ----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
