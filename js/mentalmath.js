const LEVELS = {
  makkelijk: { min: 1, max: 10, ops: ["+", "-"], count: 20, time: 90, neg: false },
  gemiddeld: { min: 2, max: 20, ops: ["+", "-", "*"], count: 25, time: 90, neg: false },
  moeilijk: { min: 5, max: 50, ops: ["+", "-", "*", "/"], count: 30, time: 90, neg: true }
};

let settings = LEVELS.makkelijk;
let activeLevel = "makkelijk";
let correct = 0, asked = 0, timeLeft = 0, timer = null, current = null;

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function genProblem() {
  const op = settings.ops[rand(0, settings.ops.length - 1)];
  let a = rand(settings.min, settings.max);
  let b = rand(settings.min, settings.max);
  let answer;
  if (op === "+") answer = a + b;
  else if (op === "-") {
    if (!settings.neg && b > a) [a, b] = [b, a];
    answer = a - b;
  } else if (op === "*") {
    a = rand(settings.min, Math.min(settings.max, 12));
    b = rand(settings.min, Math.min(settings.max, 12));
    answer = a * b;
  } else {
    // deling: zorg dat het exact uitkomt
    b = rand(Math.max(2, settings.min), Math.min(settings.max, 12));
    const q = rand(settings.min, Math.min(settings.max, 12));
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

function readCustom() {
  const min = Number(document.getElementById("c-min").value) || 1;
  const max = Number(document.getElementById("c-max").value) || 20;
  const count = Number(document.getElementById("c-count").value) || 20;
  const time = Number(document.getElementById("c-time").value) || 120;
  const neg = document.getElementById("c-neg").checked;
  const ops = [...document.querySelectorAll(".c-op:checked")].map((c) => c.value);
  return { min, max, count, time, neg, ops: ops.length ? ops : ["+"] };
}

export function initMath() {
  document.querySelectorAll(".chip[data-level]").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-level]").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      activeLevel = chip.dataset.level;
      document.getElementById("custom-panel").style.display = activeLevel === "custom" ? "grid" : "none";
    });
  });

  document.getElementById("math-start").addEventListener("click", () => {
    settings = activeLevel === "custom" ? readCustom() : LEVELS[activeLevel];
    startSession();
  });

  document.getElementById("math-answer").addEventListener("input", (e) => checkAnswer(e.target.value));

  document.getElementById("math-again").addEventListener("click", () => {
    document.querySelectorAll(".math-stage").forEach((s) => s.classList.remove("active"));
    document.getElementById("math-setup").classList.add("active");
  });
}
