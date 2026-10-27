import { Chessground } from "/js/vendor/chessground.js";

const FILES = "abcdefgh";

let game, solution = [], solIndex = 0, cg, playerColor, puzzleToken = 0;
const boardEl = document.getElementById("chessboard");
const statusEl = document.getElementById("chess-status");

function allSquares() {
  const squares = [];
  for (const f of FILES) for (let r = 1; r <= 8; r++) squares.push(f + r);
  return squares;
}

function turnColor() {
  return game.turn() === "w" ? "white" : "black";
}

// Bouwt de Map die chessground nodig heeft om geldige zetten (en dus de
// bolletjes) te tonen: elk eigen stuk -> lijst van bereikbare velden.
function buildDests() {
  const dests = new Map();
  for (const sq of allSquares()) {
    const piece = game.get(sq);
    if (!piece || piece.color !== game.turn()) continue;
    const to = [...new Set(game.moves({ square: sq, verbose: true }).map((m) => m.to))];
    if (to.length) dests.set(sq, to);
  }
  return dests;
}

function boardConfig(lastMove) {
  const over = game.game_over ? game.game_over() : false;
  // het bord mag alleen bediend worden als het echt de beurt van de speler
  // is; tijdens de (korte) automatische tegenzet van de "tegenstander" staat
  // het op slot, anders kan de speler per ongeluk die zet zelf spelen.
  const playersTurn = !over && turnColor() === playerColor;
  return {
    fen: game.fen(),
    turnColor: turnColor(),
    check: game.in_check(),
    lastMove,
    movable: {
      free: false,
      color: playersTurn ? playerColor : undefined,
      dests: playersTurn ? buildDests() : new Map(),
      events: { after: onUserMove },
    },
  };
}

function sync(lastMove) {
  cg.set(boardConfig(lastMove));
}

function onUserMove(orig, dest) {
  const myToken = puzzleToken;
  const expected = solution[solIndex];
  const result = game.move({ from: orig, to: dest, promotion: "q" });
  if (!result) {
    // zou niet mogen gebeuren (chessground beperkt al tot dests), maar voor de
    // zekerheid: bord terugzetten naar de echte stand.
    sync();
    return;
  }
  const played = result.from + result.to + (result.promotion || "");
  if (expected && played === expected) {
    solIndex++;
    if (solIndex >= solution.length) {
      statusEl.textContent = "✅ Puzzel opgelost!";
      sync([result.from, result.to]);
      return;
    }
    statusEl.textContent = "Juist! Zet " + (solIndex / 2 + 0.5) + " / " + Math.ceil(solution.length / 2);
    sync([result.from, result.to]);
    setTimeout(() => {
      if (myToken !== puzzleToken) return; // ondertussen een andere puzzel geladen
      const next = solution[solIndex];
      if (next) {
        const auto = game.move({ from: next.slice(0, 2), to: next.slice(2, 4), promotion: next[4] || "q" });
        solIndex++;
        sync(auto ? [auto.from, auto.to] : undefined);
        if (solIndex >= solution.length) statusEl.textContent = "✅ Puzzel opgelost!";
      }
    }, 450);
  } else {
    game.undo();
    statusEl.textContent = "❌ Niet de juiste zet — probeer opnieuw.";
    sync();
  }
}

async function loadPuzzle() {
  statusEl.textContent = "Puzzel laden…";
  const myToken = ++puzzleToken; // ongeldig maken van nog lopende timers van een vorige puzzel
  try {
    const res = await fetch("/api/puzzle");
    const data = await res.json();
    const { puzzle } = data;
    if (!puzzle?.game?.pgn || !puzzle?.puzzle?.solution) throw new Error("ongeldige puzzeldata");

    game = new Chess();
    const moves = puzzle.game.pgn.split(" ").filter(Boolean);
    moves.forEach((m) => game.move(m, { sloppy: true }));

    // de kant die net gezet heeft is de tegenstander; de speler speelt de andere kleur
    const orientation = game.turn() === "w" ? "black" : "white";
    playerColor = orientation;
    solution = puzzle.puzzle.solution;
    solIndex = 0;

    // eerste zet in solution is de automatische (geforceerde) zet van de tegenstander
    const firstMove = solution[0];
    const auto = game.move({ from: firstMove.slice(0, 2), to: firstMove.slice(2, 4), promotion: firstMove[4] || "q" });
    solIndex = 1;

    const config = { ...boardConfig(auto ? [auto.from, auto.to] : undefined), orientation, coordinates: true, coordinatesOnSquares: true };

    if (!cg) {
      cg = Chessground(boardEl, config);
    } else {
      cg.set(config);
    }
    cg.setShapes([]);

    statusEl.textContent = `Jouw beurt — vind de beste zet (${data.source === "daily" ? "dagpuzzel" : "willekeurig"}, rating ${puzzle.puzzle.rating ?? "?"}).`;
  } catch (err) {
    statusEl.textContent = "Kon puzzel niet laden. Probeer opnieuw.";
  }
}

document.getElementById("chess-new").addEventListener("click", loadPuzzle);
document.getElementById("chess-hint").addEventListener("click", () => {
  const next = solution[solIndex];
  if (!next || !cg) return;
  cg.setShapes([{ orig: next.slice(0, 2), dest: next.slice(2, 4), brush: "yellow" }]);
  setTimeout(() => cg?.setShapes([]), 1200);
});

export function initChess() {
  if (typeof Chess === "undefined") {
    statusEl.textContent = "Schaakmodule kon niet geladen worden. Zie README voor lokaal vendoren.";
    return;
  }
  loadPuzzle();
}
