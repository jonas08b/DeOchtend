// Niveaus bepalen het getallenbereik/tempo; de bewerking (OPERATIONS) bepaalt
// welke som-types er langskomen. Beide zijn onafhankelijk instelbaar via chips.
const LEVELS = {
  makkelijk: { min: 1, max: 10, count: 20, time: 90, neg: false, mulMin: 1, mulMax: 10 },
  gemiddeld: { min: 2, max: 30, count: 20, time: 90, neg: false, mulMin: 2, mulMax: 12 },
  gevorderd: { min: 5, max: 100, count: 25, time: 90, neg: true, mulMin: 3, mulMax: 20 },
  expert: { min: 10, max: 500, count: 25, time: 90, neg: true, mulMin: 5, mulMax: 25 },
};

const OPERATIONS = {
  optellen: ["+"],
  aftrekken: ["-"],
  vermenigvuldigen: ["*"],
  delen: ["/"],
  gemengd: ["+", "-", "*", "/"],
};

const HISTORY_KEY = "deochtend_math_history";
const HISTORY_MAX = 50; // oudste sessies vallen eraf zodra dit overschreden wordt

const LEVEL_LABELS = { makkelijk: "Makkelijk", gemiddeld: "Gemiddeld", gevorderd: "Gevorderd", expert: "Expert" };
const OP_LABELS = { optellen: "Optellen", aftrekken: "Aftrekken", vermenigvuldigen: "Vermenigvuldigen", delen: "Delen", gemengd: "Gemengd" };

let settings = LEVELS.makkelijk;
let ops = OPERATIONS.gemengd;
let activeLevel = "makkelijk";
let activeOp = "gemengd";
let correct = 0, asked = 0, timeLeft = 0, timer = null, current = null;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveHistory(list) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
  } catch {
    // localStorage kan ontbreken/vol zijn (bv. privénavigatie) — dan slaan we gewoon niet op
  }
}

function addHistoryEntry(entry) {
  const list = loadHistory();
  list.unshift(entry); // meest recente eerst
  saveHistory(list);
  renderHistory();
}

function formatDate(ts) {
  try {
    return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function renderHistory() {
  const el = document.getElementById("math-history");
  if (!el) return;
  const list = loadHistory();
  if (!list.length) {
    el.innerHTML = `<div class="math-history-empty">Nog geen sessies gespeeld.</div>`;
    return;
  }
  el.innerHTML = "";
  for (const entry of list) {
    const row = document.createElement("div");
    row.className = "math-history-item";
    row.innerHTML = `
      <div class="mh-main">
        <div class="mh-score">Score: ${entry.score}${entry.rate != null ? ` · Rate: ${entry.rate.toFixed(2)}` : ""}</div>
        <div class="mh-meta">${OP_LABELS[entry.op] || entry.op} · ${LEVEL_LABELS[entry.level] || entry.level}</div>
      </div>
      <div class="mh-date">${formatDate(entry.date)}</div>
      <button class="math-history-delete" type="button" aria-label="Sessie verwijderen" title="Verwijderen">✕</button>
    `;
    row.querySelector(".math-history-delete").addEventListener("click", () => {
      const remaining = loadHistory().filter((e) => e.id !== entry.id);
      saveHistory(remaining);
      renderHistory();
    });
    el.appendChild(row);
  }
}

function genProblem() {
  const op = ops[rand(0, ops.length - 1)];
  let a = rand(settings.min, settings.max);
  let b = rand(settings.min, settings.max);
  let answer;
  if (op === "+") {
    answer = a + b;
  } else if (op === "-") {
    if (!settings.neg && b > a) [a, b] = [b, a];
    answer = a - b;
  } else if (op === "*") {
    a = rand(settings.mulMin, settings.mulMax);
    b = rand(settings.mulMin, settings.mulMax);
    answer = a * b;
  } else {
    // deling: zorg dat het exact uitkomt
    b = rand(Math.max(2, settings.mulMin), settings.mulMax);
    const q = rand(settings.mulMin, settings.mulMax);
    a = b * q;
    answer = q;
  }
  const symbol = { "+": "+", "-": "−", "*": "×", "/": "÷" }[op];
  return { text: `${a} ${symbol} ${b}`, answer };
}

function nextProblem() {
  if (asked >= settings.count) return finish();
  current = genProblem();
  document.getElementById("math-problem").textContent = current.text;
  document.getElementById("math-progress").textContent = `${asked}/${settings.count}`;
  const input = document.getElementById("math-answer");
  input.value = "";
  input.focus();
}

function startTimer() {
  timeLeft = settings.time;
  document.getElementById("math-timer").textContent = timeLeft + "s";
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    document.getElementById("math-timer").textContent = timeLeft + "s";
    if (timeLeft <= 0) finish();
  }, 1000);
}

function finish() {
  clearInterval(timer);
  document.querySelectorAll(".math-stage").forEach((s) => s.classList.remove("active"));
  document.getElementById("math-result").classList.add("active");
  document.getElementById("math-score").textContent = `${correct}/${asked}`;

  // elapsed = effectief verstreken tijd; als de speler alle sommen af had vóór
  // de tijd om was, telt enkel de tijd die echt gebruikt is (zoals Zetamac).
  const elapsed = Math.max(settings.time - Math.max(timeLeft, 0), 1);
  const rate = correct / elapsed;
  document.getElementById("math-rate").textContent = `Rate: ${rate.toFixed(2)} (${correct} goed in ${elapsed}s)`;

  addHistoryEntry({
    id: Date.now() + Math.random().toString(36).slice(2),
    date: Date.now(),
    level: activeLevel,
    op: activeOp,
    score: correct,
    duration: elapsed,
    rate,
  });
}

function startSession() {
  correct = 0; asked = 0;
  document.querySelectorAll(".math-stage").forEach((s) => s.classList.remove("active"));
  document.getElementById("math-play").classList.add("active");
  startTimer();
  nextProblem();
}

function checkAnswer(val) {
  if (val === "" || val === "-") return;
  const num = Number(val);
  if (Number.isNaN(num)) return;
  if (num === current.answer) {
    correct++;
    asked++;
    nextProblem();
  }
}

export function initMath() {
  renderHistory();

  document.querySelectorAll(".chip[data-op]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-op]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeOp = chip.dataset.op;
    });
  });

  document.querySelectorAll(".chip[data-level]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-level]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeLevel = chip.dataset.level;
    });
  });

  document.getElementById("math-start").addEventListener("click", () => {
    settings = LEVELS[activeLevel];
    ops = OPERATIONS[activeOp];
    startSession();
  });

  document.getElementById("math-answer").addEventListener("input", (e) => checkAnswer(e.target.value));

  document.getElementById("math-again").addEventListener("click", () => {
    document.querySelectorAll(".math-stage").forEach((s) => s.classList.remove("active"));
    document.getElementById("math-setup").classList.add("active");
  });
}
