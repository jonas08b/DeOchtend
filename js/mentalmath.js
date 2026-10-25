// mentalmath.js — fully offline-capable arithmetic drills (tables, multiply, add, subtract).
import { store, load } from './app.js';

const TYPES = [
  { id: 'tables', label: 'Maaltafels' },
  { id: 'multiply', label: 'Vermenigvuldigen' },
  { id: 'add', label: 'Optellen' },
  { id: 'subtract', label: 'Aftrekken' }
];
const LEVELS = ['makkelijk', 'gemiddeld', 'moeilijk', 'custom'];

const DEFAULT_PRESETS = {
  tables:   { makkelijk: { min: 1, max: 10 },   gemiddeld: { min: 1, max: 12 },    moeilijk: { min: 1, max: 12 } },
  multiply: { makkelijk: { min: 1, max: 10 },   gemiddeld: { min: 1, max: 25 },    moeilijk: { min: 1, max: 100 } },
  add:      { makkelijk: { min: 0, max: 20 },   gemiddeld: { min: 0, max: 100 },   moeilijk: { min: 0, max: 1000 } },
  subtract: { makkelijk: { min: 0, max: 20 },   gemiddeld: { min: 0, max: 100 },   moeilijk: { min: 0, max: 1000 } }
};
const DEFAULT_SESSION_LENGTH = 10; // exercises
const DEFAULT_CUSTOM = (typeId) => ({
  min: DEFAULT_PRESETS[typeId].makkelijk.min,
  max: DEFAULT_PRESETS[typeId].gemiddeld.max,
  count: DEFAULT_SESSION_LENGTH,
  timeLimitSeconds: 0,
  allowNegative: false
});

function settingsKey(typeId) { return `math:settings:${typeId}`; }

function getSettings(typeId) {
  return load(settingsKey(typeId), {
    level: 'makkelijk',
    custom: DEFAULT_CUSTOM(typeId)
  });
}
function saveSettings(typeId, settings) { store(settingsKey(typeId), settings); }

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function generateQuestion(typeId, settings, state) {
  const level = settings.level;
  let bounds;
  if (level === 'custom') bounds = settings.custom;
  else bounds = DEFAULT_PRESETS[typeId][level];

  if (typeId === 'tables') {
    const table = randInt(bounds.min, bounds.max);
    const factor = randInt(1, 10);
    return { text: `${table} × ${factor}`, answer: table * factor };
  }
  if (typeId === 'multiply') {
    const a = randInt(bounds.min, bounds.max);
    const b = randInt(bounds.min, bounds.max);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  if (typeId === 'add') {
    const a = randInt(bounds.min, bounds.max);
    const b = randInt(bounds.min, bounds.max);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  if (typeId === 'subtract') {
    let a = randInt(bounds.min, bounds.max);
    let b = randInt(bounds.min, bounds.max);
    const allowNegative = level === 'custom' ? !!settings.custom.allowNegative : false;
    if (!allowNegative && b > a) [a, b] = [b, a];
    return { text: `${a} − ${b}`, answer: a - b };
  }
  return { text: '?', answer: 0 };
}

function sessionLength(typeId, settings) {
  return settings.level === 'custom' ? (settings.custom.count || DEFAULT_SESSION_LENGTH) : DEFAULT_SESSION_LENGTH;
}
function timeLimit(settings) {
  return settings.level === 'custom' ? (settings.custom.timeLimitSeconds || 0) : 0;
}

let state = { typeId: 'tables', question: null, index: 0, correct: 0, times: [], qStart: 0, timer: null };

function renderShell(container, onType, onLevel) {
  const tabsHtml = TYPES.map(t => `<button class="math-tab" data-type="${t.id}" role="tab" aria-selected="${t.id === state.typeId}">${t.label}</button>`).join('');
  container.innerHTML = `
    <div class="math-tabs" role="tablist">${tabsHtml}</div>
    <div id="mathLevelArea"></div>
    <div id="mathSessionArea"></div>
  `;
  container.querySelectorAll('.math-tab').forEach(btn => {
    btn.addEventListener('click', () => { state.typeId = btn.dataset.type; onType(); });
  });
}

function renderLevelArea(container, onStart, onCustomChange) {
  const settings = getSettings(state.typeId);
  const area = container.querySelector('#mathLevelArea');
  area.innerHTML = `
    <div class="level-tabs" role="group" aria-label="Niveau">
      ${LEVELS.map(l => `<button class="level-tab" data-level="${l}" aria-pressed="${settings.level === l}">${l[0].toUpperCase()+l.slice(1)}</button>`).join('')}
    </div>
    <div id="customFields"></div>
    <button class="btn" id="startSessionBtn">Start oefening</button>
  `;
  area.querySelectorAll('.level-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      settings.level = btn.dataset.level;
      saveSettings(state.typeId, settings);
      renderLevelArea(container, onStart, onCustomChange);
    });
  });
  if (settings.level === 'custom') {
    const c = settings.custom;
    const subtractExtra = state.typeId === 'subtract'
      ? `<label class="field field--checkbox"><input type="checkbox" id="customAllowNeg" ${c.allowNegative ? 'checked' : ''}><span>Negatieve uitkomsten toestaan</span></label>`
      : '';
    area.querySelector('#customFields').innerHTML = `
      <div class="custom-grid">
        <label class="field"><span>Minimum</span><input type="number" id="customMin" value="${c.min}"></label>
        <label class="field"><span>Maximum</span><input type="number" id="customMax" value="${c.max}"></label>
        <label class="field"><span>Aantal oefeningen</span><input type="number" id="customCount" value="${c.count}" min="1"></label>
        <label class="field"><span>Tijdslimiet per vraag (s, 0 = geen)</span><input type="number" id="customTime" value="${c.timeLimitSeconds}" min="0"></label>
      </div>
      ${subtractExtra}
    `;
    const persist = () => {
      c.min = Number(area.querySelector('#customMin').value) || 0;
      c.max = Number(area.querySelector('#customMax').value) || c.min;
      c.count = Math.max(1, Number(area.querySelector('#customCount').value) || DEFAULT_SESSION_LENGTH);
      c.timeLimitSeconds = Math.max(0, Number(area.querySelector('#customTime').value) || 0);
      if (state.typeId === 'subtract') c.allowNegative = area.querySelector('#customAllowNeg').checked;
      saveSettings(state.typeId, settings);
    };
    ['customMin','customMax','customCount','customTime'].forEach(id => area.querySelector('#'+id).addEventListener('change', persist));
    if (state.typeId === 'subtract') area.querySelector('#customAllowNeg').addEventListener('change', persist);
  }
  area.querySelector('#startSessionBtn').addEventListener('click', onStart);
}

function startSession(container, onDone) {
  const settings = getSettings(state.typeId);
  state.index = 0;
  state.correct = 0;
  state.times = [];
  const total = sessionLength(state.typeId, settings);
  const limit = timeLimit(settings);

  function nextQuestion() {
    if (state.index >= total) return finishSession(container, settings, onDone);
    state.question = generateQuestion(state.typeId, settings, state);
    state.qStart = Date.now();
    renderQuestion(container, limit, total, nextQuestion);
  }
  nextQuestion();
}

function renderQuestion(container, limit, total, onNext) {
  const area = container.querySelector('#mathSessionArea');
  clearTimeout(state.timer);
  area.innerHTML = `
    <p class="chess-status">Vraag ${state.index + 1} van ${total}</p>
    <div class="math-question">${state.question.text}</div>
    <form class="math-input-row" id="mathForm">
      <input type="number" inputmode="numeric" id="mathAnswer" autocomplete="off" required>
      <button class="btn" type="submit">OK</button>
    </form>
    <div class="math-feedback" id="mathFeedback" aria-live="polite"></div>
  `;
  const input = area.querySelector('#mathAnswer');
  input.focus();
  area.querySelector('#mathForm').addEventListener('submit', (e) => {
    e.preventDefault();
    submitAnswer(Number(input.value), area, onNext);
  });
  if (limit > 0) {
    state.timer = setTimeout(() => submitAnswer(NaN, area, onNext, true), limit * 1000);
  }
}

function submitAnswer(value, area, onNext, timedOut = false) {
  clearTimeout(state.timer);
  const elapsed = (Date.now() - state.qStart) / 1000;
  state.times.push(elapsed);
  const correct = !timedOut && value === state.question.answer;
  if (correct) state.correct++;
  const fb = area.querySelector('#mathFeedback');
  fb.className = 'math-feedback ' + (correct ? 'correct' : 'incorrect');
  fb.textContent = correct ? 'Correct!' : `Fout — juiste antwoord: ${state.question.answer}`;
  area.querySelector('#mathForm')?.querySelectorAll('input,button').forEach(el => el.disabled = true);
  state.index++;
  setTimeout(onNext, 700);
}

function finishSession(container, settings, onDone) {
  const area = container.querySelector('#mathSessionArea');
  const total = sessionLength(state.typeId, settings);
  const acc = Math.round((state.correct / total) * 100);
  const avgTime = (state.times.reduce((a,b)=>a+b,0) / state.times.length).toFixed(1);
  area.innerHTML = `
    <div class="math-stats">
      <div><strong>${state.correct}/${total}</strong>score</div>
      <div><strong>${acc}%</strong>nauwkeurigheid</div>
      <div><strong>${avgTime}s</strong>gem. tijd</div>
    </div>
    <div class="action-row">
      <button class="btn" id="mathAgainBtn">Nog een sessie</button>
    </div>
  `;
  area.querySelector('#mathAgainBtn').addEventListener('click', () => startSession(container, onDone));
  if (onDone) onDone();
}

export function initMath({ onDone }) {
  const container = document.getElementById('mathBody');
  function draw() {
    renderShell(container, draw, draw);
    renderLevelArea(container, () => startSession(container, onDone), draw);
  }
  draw();
}
