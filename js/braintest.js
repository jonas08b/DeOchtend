// braintest.js — three short offline cognitive exercises. Informal, not diagnostic (see disclaimer).
import { store, load } from './app.js';

const COLORS = [
  { id: 'red', label: 'Rood', hex: '#C0392B' },
  { id: 'blue', label: 'Blauw', hex: '#2E6F9E' },
  { id: 'green', label: 'Groen', hex: '#3C6E71' },
  { id: 'yellow', label: 'Geel', hex: '#C99A1E' }
];
const PRACTICE_ROUNDS = 3;
const STROOP_TEST_ROUNDS = 12;
const REACTION_TEST_ROUNDS = 6;
const REACTION_WAIT_MIN = 1200, REACTION_WAIT_MAX = 3500; // ms, documented fixed bounds
const SEQUENCE_START_LENGTH = 3; // documented growth rule: +1 digit per correct round, 3x3 pad (1-9)

let root, onDoneCb;

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function menuView() {
  root.innerHTML = `
    <div class="brain-menu">
      <button class="brain-card" data-test="stroop"><span>Stroop-test<small>Benoem de inktkleur, niet het woord</small></span><span>→</span></button>
      <button class="brain-card" data-test="reaction"><span>Reactiesnelheid<small>Tik zodra het groen wordt</small></span><span>→</span></button>
      <button class="brain-card" data-test="sequence"><span>Reeksgeheugen<small>Onthoud en herhaal de reeks</small></span><span>→</span></button>
    </div>
  `;
  root.querySelectorAll('.brain-card').forEach(btn => {
    btn.addEventListener('click', () => startTest(btn.dataset.test));
  });
}

function startTest(id) {
  if (id === 'stroop') runStroop();
  if (id === 'reaction') runReaction();
  if (id === 'sequence') runSequence();
}

function backButton() {
  return `<div class="action-row"><button class="btn btn--ghost btn--small" id="brainBack">← Overzicht</button></div>`;
}
function wireBack() {
  root.querySelector('#brainBack')?.addEventListener('click', menuView);
}

/* ================= STROOP ================= */
function randomStroopStimulus(forceIncongruent) {
  const wordColor = COLORS[Math.floor(Math.random() * COLORS.length)];
  let inkColor = wordColor;
  const incongruent = forceIncongruent === undefined ? Math.random() < 0.7 : forceIncongruent;
  if (incongruent) {
    const others = COLORS.filter(c => c.id !== wordColor.id);
    inkColor = others[Math.floor(Math.random() * others.length)];
  }
  return { word: wordColor, ink: inkColor, congruent: wordColor.id === inkColor.id };
}

function runStroop(practice = true, round = 0, results = []) {
  if (practice && round === 0 && results.length === 0) {
    root.innerHTML = `
      <div class="brain-stage">
        <h3>Stroop-test</h3>
        <p>Benoem zo snel mogelijk de <strong>inktkleur</strong> van het woord, niet wat er staat geschreven. Eerst ${PRACTICE_ROUNDS} oefenrondes.</p>
        <button class="btn" id="stroopStart">Start oefenronde</button>
      </div>${backButton()}`;
    root.querySelector('#stroopStart').addEventListener('click', () => runStroop(true, 1, []));
    wireBack();
    return;
  }
  const isPractice = practice;
  const totalRounds = isPractice ? PRACTICE_ROUNDS : STROOP_TEST_ROUNDS;
  if (round > totalRounds) {
    if (isPractice) { runStroop(false, 1, []); return; }
    return stroopResults(results);
  }
  const stim = randomStroopStimulus();
  const start = Date.now();
  const shuffledOptions = [...COLORS].sort(() => Math.random() - 0.5);
  root.innerHTML = `
    <div class="brain-stage">
      <p class="chess-status">${isPractice ? 'Oefening' : 'Test'} ${round}/${totalRounds}</p>
      <div class="stroop-word" style="color:${stim.ink.hex}">${esc(stim.word.label)}</div>
      <div class="stroop-options">
        ${shuffledOptions.map(c => `<button class="color-btn" style="background:${c.hex}" data-id="${c.id}">${esc(c.label)}</button>`).join('')}
      </div>
    </div>`;
  root.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rt = Date.now() - start;
      const correct = btn.dataset.id === stim.ink.id;
      results.push({ correct, rt, congruent: stim.congruent });
      runStroop(isPractice, round + 1, results);
    });
  });
}

function stroopResults(results) {
  const acc = Math.round(100 * results.filter(r => r.correct).length / results.length);
  const avgRt = Math.round(results.reduce((a,r)=>a+r.rt,0) / results.length);
  store('brain:stroop:last', { acc, avgRt, date: Date.now() });
  root.innerHTML = `
    <div class="brain-stage">
      <h3>Resultaat</h3>
      <div class="result-grid">
        <div class="result-tile"><strong>${acc}%</strong><span>nauwkeurigheid</span></div>
        <div class="result-tile"><strong>${avgRt}ms</strong><span>gem. reactietijd</span></div>
      </div>
      <p class="disclaimer">Dit is een informele oefening voor concentratie, geen medische of diagnostische meting.</p>
      <div class="action-row">
        <button class="btn" id="stroopAgain">Opnieuw</button>
      </div>
    </div>${backButton()}`;
  root.querySelector('#stroopAgain').addEventListener('click', () => runStroop(true, 1, []));
  wireBack();
  if (onDoneCb) onDoneCb();
}

/* ================= REACTION TIME ================= */
function runReaction(round = 0, results = [], practiceDone = false) {
  if (round === 0 && !practiceDone) {
    root.innerHTML = `
      <div class="brain-stage">
        <h3>Reactiesnelheid</h3>
        <p>Tik in het vak zodra het <strong>groen</strong> wordt. Tik je te vroeg, dan telt de ronde niet mee.</p>
        <button class="btn" id="reactStart">Start</button>
      </div>${backButton()}`;
    root.querySelector('#reactStart').addEventListener('click', () => runReaction(1, []));
    wireBack();
    return;
  }
  if (round > REACTION_TEST_ROUNDS) return reactionResults(results);

  root.innerHTML = `
    <div class="brain-stage">
      <p class="chess-status">Ronde ${round}/${REACTION_TEST_ROUNDS}</p>
      <div class="reaction-zone" id="reactZone">Wacht op groen…</div>
    </div>${backButton()}`;
  wireBack();
  const zone = root.querySelector('#reactZone');
  let goTime = null;
  let state = 'waiting';
  const wait = REACTION_WAIT_MIN + Math.random() * (REACTION_WAIT_MAX - REACTION_WAIT_MIN);
  const timer = setTimeout(() => {
    state = 'go';
    goTime = Date.now();
    zone.classList.add('go');
    zone.textContent = 'Tik nu!';
  }, wait);

  zone.addEventListener('click', () => {
    if (state === 'waiting') {
      clearTimeout(timer);
      zone.classList.add('early');
      zone.textContent = 'Te vroeg — deze ronde telt niet mee.';
      setTimeout(() => runReaction(round + 1, results, true), 900);
      return;
    }
    if (state === 'go') {
      const rt = Date.now() - goTime;
      results.push(rt);
      state = 'done';
      zone.textContent = `${rt} ms`;
      setTimeout(() => runReaction(round + 1, results, true), 500);
    }
  });
}

function reactionResults(results) {
  const avg = Math.round(results.reduce((a,b)=>a+b,0) / results.length);
  const best = Math.min(...results);
  store('brain:reaction:last', { avg, best, date: Date.now() });
  root.innerHTML = `
    <div class="brain-stage">
      <h3>Resultaat</h3>
      <div class="result-grid">
        <div class="result-tile"><strong>${avg}ms</strong><span>gemiddelde</span></div>
        <div class="result-tile"><strong>${best}ms</strong><span>beste</span></div>
      </div>
      <p class="disclaimer">Dit is een informele oefening, geen medische of diagnostische meting.</p>
      <div class="action-row">
        <button class="btn" id="reactAgain">Opnieuw</button>
      </div>
    </div>${backButton()}`;
  root.querySelector('#reactAgain').addEventListener('click', () => runReaction(1, []));
  wireBack();
  if (onDoneCb) onDoneCb();
}

/* ================= SEQUENCE MEMORY ================= */
// Growth rule (documented, fixed): start at SEQUENCE_START_LENGTH; +1 digit after each fully correct
// reproduction; the test ends on the first mistake. Pad uses digits 1–9 on a 3x3 grid.
function runSequence(length = SEQUENCE_START_LENGTH, best = 0) {
  if (length === SEQUENCE_START_LENGTH && best === 0 && !runSequence._started) {
    runSequence._started = true;
    root.innerHTML = `
      <div class="brain-stage">
        <h3>Reeksgeheugen</h3>
        <p>Onthoud de reeks die oplicht en tik ze na in dezelfde volgorde. Elke juiste ronde wordt de reeks één langer.</p>
        <button class="btn" id="seqStart">Start</button>
      </div>${backButton()}`;
    root.querySelector('#seqStart').addEventListener('click', () => { runSequence._started = false; playSequenceRound(SEQUENCE_START_LENGTH, 0); });
    wireBack();
    return;
  }
  playSequenceRound(length, best);
}

function playSequenceRound(length, best) {
  const seq = Array.from({ length }, () => 1 + Math.floor(Math.random() * 9));
  root.innerHTML = `
    <div class="brain-stage">
      <p class="chess-status">Reeks van ${length}</p>
      <div class="sequence-pad" id="seqPad">
        ${Array.from({length:9}, (_,i) => `<button class="sequence-cell" data-n="${i+1}" disabled>${i+1}</button>`).join('')}
      </div>
    </div>${backButton()}`;
  wireBack();
  const cells = [...root.querySelectorAll('.sequence-cell')];
  let i = 0;
  const showNext = () => {
    if (i >= seq.length) { enableInput(); return; }
    const cell = cells[seq[i]-1];
    cell.classList.add('lit');
    setTimeout(() => {
      cell.classList.remove('lit');
      i++;
      setTimeout(showNext, 250);
    }, 550);
  };
  setTimeout(showNext, 500);

  function enableInput() {
    cells.forEach(c => c.disabled = false);
    let inputIdx = 0;
    cells.forEach(c => c.addEventListener('click', () => {
      const n = Number(c.dataset.n);
      c.classList.add('lit');
      setTimeout(() => c.classList.remove('lit'), 200);
      if (n === seq[inputIdx]) {
        inputIdx++;
        if (inputIdx === seq.length) {
          cells.forEach(cc => cc.disabled = true);
          setTimeout(() => playSequenceRound(length + 1, length), 500);
        }
      } else {
        cells.forEach(cc => cc.disabled = true);
        setTimeout(() => sequenceResults(best), 400);
      }
    }));
  }
}

function sequenceResults(best) {
  store('brain:sequence:last', { best, date: Date.now() });
  root.innerHTML = `
    <div class="brain-stage">
      <h3>Resultaat</h3>
      <div class="result-grid">
        <div class="result-tile"><strong>${best}</strong><span>langste reeks</span></div>
      </div>
      <p class="disclaimer">Dit is een informele oefening, geen medische of diagnostische meting.</p>
      <div class="action-row">
        <button class="btn" id="seqAgain">Opnieuw</button>
      </div>
    </div>${backButton()}`;
  root.querySelector('#seqAgain').addEventListener('click', () => runSequence(SEQUENCE_START_LENGTH, 0));
  wireBack();
  if (onDoneCb) onDoneCb();
}

export function initBrain({ onDone }) {
  root = document.getElementById('brainBody');
  onDoneCb = onDone;
  menuView();
}
