const COLORS = [
  { name: "ROOD", hex: "#dc2626" },
  { name: "GROEN", hex: "#16a34a" },
  { name: "BLAUW", hex: "#2563eb" },
  { name: "GEEL", hex: "#ca8a04" },
  { name: "PAARS", hex: "#9333ea" }
];
const content = document.getElementById("brain-content");
const menu = document.getElementById("brain-menu");
const play = document.getElementById("brain-play");
const resultBox = document.getElementById("brain-result");
const scoreEl = document.getElementById("brain-score");

function showMenu() {
  menu.style.display = "grid";
  play.style.display = "none";
  resultBox.style.display = "none";
}
function showResult(scoreText) {
  content.innerHTML = "";
  resultBox.style.display = "block";
  scoreEl.textContent = scoreText;
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

/* ---------- STROOP ---------- */
let stroopRound = 0, stroopCorrect = 0, stroopTotal = 12, stroopWord = null;

function stroopRender() {
  const word = COLORS[rand(0, COLORS.length - 1)];
  let ink = COLORS[rand(0, COLORS.length - 1)];
  stroopWord = { word, ink };
  const opts = shuffle([...COLORS]).slice(0, 4);
  if (!opts.includes(ink)) opts[0] = ink;
  content.innerHTML = `
    <div class="math-box">
      <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px">Ronde ${stroopRound + 1}/${stroopTotal} — benoem de KLEUR van het woord</div>
      <div id="stroop-word" style="color:${ink.hex}">${word.name}</div>
    </div>
    <div class="opt-grid" id="stroop-opts"></div>`;
  const grid = document.getElementById("stroop-opts");
  shuffle(opts).forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.style.background = c.hex;
    btn.textContent = c.name;
    btn.addEventListener("click", () => {
      if (c.hex === ink.hex) stroopCorrect++;
      stroopRound++;
      if (stroopRound >= stroopTotal) showResult(`${stroopCorrect}/${stroopTotal}`);
      else stroopRender();
    });
    grid.appendChild(btn);
  });
}
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }
function startStroop() { stroopRound = 0; stroopCorrect = 0; stroopRender(); }

/* ---------- REACTIE ---------- */
let reactTimes = [], reactRound = 0, reactTotal = 5, reactStart = 0, reactTimeout = null;

function reactRender() {
  content.innerHTML = `
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;text-align:center">Ronde ${reactRound + 1}/${reactTotal}</div>
    <div class="reaction-pad" id="reaction-pad">Wacht op groen…</div>`;
  const pad = document.getElementById("reaction-pad");
  const delay = rand(1200, 3500);
  let armed = false;
  reactTimeout = setTimeout(() => {
    armed = true;
    pad.classList.add("go");
    pad.textContent = "TIK NU!";
    reactStart = performance.now();
  }, delay);

  pad.addEventListener("click", () => {
    if (!armed) {
      clearTimeout(reactTimeout);
      pad.textContent = "Te vroeg! Opnieuw…";
      pad.classList.remove("go");
      setTimeout(reactRender, 800);
      return;
    }
    const t = Math.round(performance.now() - reactStart);
    reactTimes.push(t);
    reactRound++;
    pad.classList.remove("go");
    if (reactRound >= reactTotal) {
      const avg = Math.round(reactTimes.reduce((a, b) => a + b, 0) / reactTimes.length);
      showResult(avg + " ms");
    } else {
      pad.textContent = `${t} ms`;
      setTimeout(reactRender, 700);
    }
  }, { once: true });
}
function startReaction() { reactTimes = []; reactRound = 0; reactRender(); }

/* ---------- REEKSGEHEUGEN ---------- */
let seqArr = [], seqLevel = 3, seqUserIdx = 0, seqShowing = false;

function seqRender() {
  content.innerHTML = `
    <div style="font-size:12.5px;color:var(--text-muted);margin-bottom:10px;text-align:center">Niveau ${seqLevel - 2}</div>
    <div class="seq-grid" id="seq-grid"></div>
    <div style="text-align:center;margin-top:10px;color:var(--text-muted);font-size:13px" id="seq-status">Kijk goed…</div>`;
  const grid = document.getElementById("seq-grid");
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("div");
    cell.className = "seq-cell";
    cell.dataset.i = i;
    cell.addEventListener("click", () => onSeqClick(i));
    grid.appendChild(cell);
  }
  seqArr = Array.from({ length: seqLevel }, () => rand(0, 8));
  seqUserIdx = 0;
  seqShowing = true;
  playSequence();
}

async function playSequence() {
  const cells = [...document.querySelectorAll(".seq-cell")];
  await new Promise((r) => setTimeout(r, 500));
  for (const idx of seqArr) {
    cells[idx].classList.add("lit");
    await new Promise((r) => setTimeout(r, 450));
    cells[idx].classList.remove("lit");
    await new Promise((r) => setTimeout(r, 200));
  }
  seqShowing = false;
  const statusEl = document.getElementById("seq-status");
  if (statusEl) statusEl.textContent = "Jouw beurt — herhaal de volgorde";
}

function onSeqClick(i) {
  if (seqShowing) return;
  if (i === seqArr[seqUserIdx]) {
    seqUserIdx++;
    if (seqUserIdx >= seqArr.length) {
      seqLevel++;
      if (seqLevel > 9) { showResult(`Niveau ${seqLevel - 3} bereikt!`); return; }
      setTimeout(seqRender, 500);
    }
  } else {
    showResult(`Niveau ${seqLevel - 3} bereikt`);
  }
}
function startMemory() { seqLevel = 3; seqRender(); }

/* ---------- init ---------- */
export function initBrain() {
  document.querySelectorAll(".brain-card").forEach((card) => {
    card.addEventListener("click", () => {
      menu.style.display = "none";
      play.style.display = "block";
      resultBox.style.display = "none";
      const test = card.dataset.test;
      play.dataset.test = test;
      if (test === "stroop") startStroop();
      if (test === "reaction") startReaction();
      if (test === "memory") startMemory();
    });
  });
  document.getElementById("brain-back").addEventListener("click", showMenu);
  document.getElementById("brain-again").addEventListener("click", () => {
    const test = play.dataset.test;
    resultBox.style.display = "none";
    if (test === "stroop") startStroop();
    if (test === "reaction") startReaction();
    if (test === "memory") startMemory();
  });
}
