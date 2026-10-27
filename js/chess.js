const PIECES = {
  p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚",
  P: "♙", N: "♘", B: "♗", R: "♖", Q: "♕", K: "♔"
};

let game, solution = [], solIndex = 0, selected = null, boardFlipped = false;
const boardEl = document.getElementById("chessboard");
const statusEl = document.getElementById("chess-status");

function render() {
  boardEl.innerHTML = "";
  const board = game.board(); // 8x8, [0]=rank8
  const rows = boardFlipped ? [...board].reverse() : board;
  rows.forEach((row, ri) => {
    const cols = boardFlipped ? [...row].reverse() : row;
    cols.forEach((cell, ci) => {
      const fileIdx = boardFlipped ? 7 - ci : ci;
      const rankIdx = boardFlipped ? ri : ri;
      const file = "abcdefgh"[fileIdx];
      const rank = 8 - (boardFlipped ? 7 - ri : ri);
      const square = file + rank;
      const sq = document.createElement("div");
      const light = (fileIdx + (8 - rank)) % 2 === 0;
      sq.className = "sq " + (light ? "light" : "dark");
      sq.dataset.square = square;
      if (cell) sq.textContent = PIECES[cell.type === cell.type.toUpperCase() && cell.color === "w" ? cell.type.toUpperCase() : cell.type.toLowerCase()];
      if (selected === square) sq.classList.add("selected");
      sq.addEventListener("click", () => onSquareClick(square));
      boardEl.appendChild(sq);
    });
  });
}

function onSquareClick(square) {
  if (!game) return;
  const piece = game.get(square);
  if (selected) {
    const move = tryMove(selected, square);
    selected = null;
    render();
    if (move) handlePlayerMove(move);
    return;
  }
  if (piece && piece.color === game.turn()) {
    selected = square;
    render();
  }
}

function tryMove(from, to) {
  const legal = game.moves({ square: from, verbose: true });
  const match = legal.find((m) => m.to === to);
  if (!match) return null;
  return game.move({ from, to, promotion: "q" });
}

function handlePlayerMove(move) {
  const expected = solution[solIndex];
  const played = move.from + move.to + (move.promotion || "");
  if (expected && played === expected) {
    solIndex++;
    if (solIndex >= solution.length) {
      statusEl.textContent = "✅ Puzzel opgelost!";
      return;
    }
    statusEl.textContent = "Juist! Zet " + (solIndex / 2 + 0.5) + " / " + Math.ceil(solution.length / 2);
    setTimeout(() => {
      const next = solution[solIndex];
      if (next) {
        game.move({ from: next.slice(0, 2), to: next.slice(2, 4), promotion: next[4] || "q" });
        solIndex++;
        render();
        if (solIndex >= solution.length) statusEl.textContent = "✅ Puzzel opgelost!";
      }
    }, 450);
  } else {
    game.undo();
    render();
    statusEl.textContent = "❌ Niet de juiste zet — probeer opnieuw.";
  }
}

async function loadPuzzle() {
  statusEl.textContent = "Puzzel laden…";
  selected = null;
  try {
    const res = await fetch("/api/puzzle");
    const data = await res.json();
    const { puzzle } = data;
    if (!puzzle?.game?.pgn || !puzzle?.puzzle?.solution) throw new Error("ongeldige puzzeldata");

    game = new Chess();
    const moves = puzzle.game.pgn.split(" ").filter(Boolean);
    moves.forEach((m) => game.move(m, { sloppy: true }));

    boardFlipped = game.turn() === "w"; // de kant die net gezet heeft is tegenstander; speler speelt de andere kleur
    solution = puzzle.puzzle.solution;
    solIndex = 0;

    // eerste zet in solution is de automatische zet van de tegenstander
    const firstMove = solution[0];
    game.move({ from: firstMove.slice(0, 2), to: firstMove.slice(2, 4), promotion: firstMove[4] || "q" });
    solIndex = 1;

    render();
    statusEl.textContent = `Jouw beurt — vind de beste zet (${data.source === "daily" ? "dagpuzzel" : "willekeurig"}, rating ${puzzle.puzzle.rating ?? "?"}).`;
  } catch (err) {
    statusEl.textContent = "Kon puzzel niet laden. Probeer opnieuw.";
  }
}

document.getElementById("chess-new").addEventListener("click", loadPuzzle);
document.getElementById("chess-hint").addEventListener("click", () => {
  const next = solution[solIndex];
  if (!next) return;
  render();
  const sq = boardEl.querySelector(`[data-square="${next.slice(0, 2)}"]`);
  if (sq) sq.classList.add("hint");
  setTimeout(() => sq?.classList.remove("hint"), 1200);
});

export function initChess() {
  if (typeof Chess === "undefined") {
    statusEl.textContent = "Schaakmodule kon niet geladen worden (geen internetverbinding voor CDN). Zie README voor lokaal vendoren.";
    return;
  }
  loadPuzzle();
}
