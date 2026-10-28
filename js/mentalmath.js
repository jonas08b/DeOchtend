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

let settings = LEVELS.makkelijk;
let ops = OPERATIONS.gemengd;
let activeLevel = "makkelijk";
let activeOp = "gemengd";
let correct = 0, asked = 0, timeLeft = 0, timer = null, current = null;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

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
