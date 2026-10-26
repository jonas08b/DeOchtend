// chess.js — Lichess puzzle integration, chess.js for rules, custom touch board.
// Notes on the Lichess puzzle API (see spec §3.2):
//  - GET https://lichess.org/api/puzzle/daily   → today's puzzle, same for everyone, no auth, cacheable.
//  - GET https://lichess.org/api/puzzle/next    → an anonymous "next" puzzle; not guaranteed to be an
//    unlimited random generator for anonymous/unauthenticated use and may be rate-limited, so we treat
//    failures here as expected and fall back to the daily puzzle rather than erroring the whole module.
// Puzzle shape: { game: { pgn, id, ... }, puzzle: { id, rating, solution: [uci...], initialPly, themes } }
// Convention: position is built by replaying `pgn` to `initialPly`; solution[0] is the opponent's
// setup move (auto-played), and the human solves solution[1], solution[3], ... in turn.
//
// chess.js 1.x (beta) no longer ships a browser-global/UMD build (it's ESM/CJS only), so it can't be
// loaded with a plain <script src="..."> tag anymore — that used to define window.Chess, but on 1.x
// it silently does nothing (window.Chess stays undefined). We import it directly as an ES module here
// instead, since this file is itself loaded as a module.
import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.0.0-beta.8/+esm';

const PUZZLE_CACHE_KEY = 'deochtend:cache:chessPuzzle';
const FETCHED_AT_KEY = 'deochtend:cache:chessPuzzleAt';
const MIN_SECONDS_BETWEEN_FETCH = 2; // light client-side rate-limit courtesy

const PIECE_GLYPH = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
  P: '♙', N: '♘', B: '♗', R: '♖', Q: '♕', K: '♔'
};

let game = null;          // chess.js instance
let solution = [];        // remaining UCI moves to solve (human + auto opponent replies)
let solvedPly = 0;
let orientation = 'white';
let selectedSquare = null;
let startTime = null;
let moveCount = 0;
let finished = false;
let onDoneCb = null;

function files() { return ['a','b','c','d','e','f','g','h']; }

function squareId(file, rank) { return files()[file] + rank; } // rank 1-8

function boardSquares(orient) {
  const ranks = orient === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8];
  const fileOrder = orient === 'white' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];
  const out = [];
  for (const r of ranks) for (const f of fileOrder) out.push(squareId(f, r));
  return out;
}

async function fetchPuzzle({ forceNext = false } = {}) {
  const now = Date.now();
  const lastFetch = Number(sessionStorage.getItem('deochtend:chessLastFetch') || 0);
  if ((now - lastFetch) / 1000 < MIN_SECONDS_BETWEEN_FETCH) {
    await new Promise(r => setTimeout(r, MIN_SECONDS_BETWEEN_FETCH * 1000));
  }
  sessionStorage.setItem('deochtend:chessLastFetch', String(Date.now()));

  const endpoints = forceNext
    ? ['https://lichess.org/api/puzzle/next', 'https://lichess.org/api/puzzle/daily']
    : ['https://lichess.org/api/puzzle/daily'];

  let lastErr = null;
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) { lastErr = new Error('puzzle http ' + res.status); continue; }
      const data = await res.json();
      localStorage.setItem(PUZZLE_CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(FETCHED_AT_KEY, String(Date.now()));
      return data;
    } catch (e) { lastErr = e; }
  }
  // fall back to cache if nothing worked
  const cached = localStorage.getItem(PUZZLE_CACHE_KEY);
  if (cached) return JSON.parse(cached);
  throw lastErr || new Error('Geen puzzel beschikbaar');
}

function setupFromPuzzleData(data) {
  const pgn = data.game.pgn;
  const initialPly = data.puzzle.initialPly;
  const replay = new Chess();
  // chess.js v1 beta: load PGN move list (pgn here is space-separated SAN moves per Lichess format)
  const sanMoves = pgn.trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < initialPly && i < sanMoves.length; i++) {
    try { replay.move(sanMoves[i]); } catch { /* stop replay on malformed move */ break; }
  }
  game = replay;
  solution = data.puzzle.solution.slice();
  solvedPly = 0;
  moveCount = 0;
  finished = false;
  startTime = Date.now();
  selectedSquare = null;

  // auto-play the opponent's first setup move (solution[0])
  if (solution.length) {
    const uci = solution[0];
    applyUci(uci, { auto: true });
    solvedPly = 1;
  }
  orientation = game.turn() === 'w' ? 'white' : 'black';
}

function uciToMoveObj(uci) {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci.length > 4 ? uci.slice(4) : undefined
  };
}

function applyUci(uci, { auto = false } = {}) {
  const mv = uciToMoveObj(uci);
  try {
    game.move(mv);
    return true;
  } catch {
    return false;
  }
}

function render(container) {
  if (!game) return;
  const squares = boardSquares(orientation);
  const boardEl = container.querySelector('#chessBoard');
  boardEl.innerHTML = '';
  const board = game.board(); // 8x8, [0]=rank8..[7]=rank1, each row [a..h]
  const pieceAt = (sq) => {
    const file = files().indexOf(sq[0]);
    const rank = Number(sq[1]);
    const row = 8 - rank;
    const piece = board[row][file];
    if (!piece) return null;
    const letter = piece.type.toUpperCase();
    return piece.color === 'w' ? letter : letter.toLowerCase();
  };

  const legalTargets = selectedSquare
    ? game.moves({ square: selectedSquare, verbose: true }).map(m => m.to)
    : [];

  squares.forEach((sq, i) => {
    const file = files().indexOf(sq[0]);
    const rank = Number(sq[1]);
    const isLight = (file + rank) % 2 === 1;
    const div = document.createElement('div');
    div.className = 'sq ' + (isLight ? 'light' : 'dark');
    div.dataset.square = sq;
    if (sq === selectedSquare) div.classList.add('selected');
    if (legalTargets.includes(sq)) div.classList.add('legal');
    const glyph = pieceAt(sq);
    if (glyph) div.textContent = PIECE_GLYPH[glyph] || '';
    div.addEventListener('click', () => onSquareClick(sq, container));
    boardEl.appendChild(div);
  });

  const statusEl = container.querySelector('.chess-status');
  if (finished) {
    const secs = Math.round((Date.now() - startTime) / 1000);
    statusEl.textContent = `Opgelost in ${moveCount} zet(ten), ${secs}s.`;
  } else {
    statusEl.textContent = game.turn() === (orientation === 'white' ? 'w' : 'b')
      ? 'Jouw zet.'
      : 'Tegenzet…';
  }
}

function onSquareClick(sq, container) {
  if (finished) return;
  if (!selectedSquare) {
    const piece = game.get(sq);
    if (piece && piece.color === game.turn()[0]) selectedSquare = sq;
    render(container);
    return;
  }
  if (sq === selectedSquare) { selectedSquare = null; render(container); return; }

  const legal = game.moves({ square: selectedSquare, verbose: true });
  const match = legal.find(m => m.to === sq);
  if (!match) {
    // reselect if clicking another own piece
    const piece = game.get(sq);
    selectedSquare = (piece && piece.color === game.turn()[0]) ? sq : null;
    render(container);
    return;
  }

  let promotion;
  if (match.flags.includes('p')) promotion = 'q'; // auto-queen; most puzzle lines don't require underpromotion

  const expected = solution[solvedPly];
  const attemptedUci = selectedSquare + sq + (promotion || '');
  selectedSquare = null;

  if (expected && attemptedUci.slice(0, 4) === expected.slice(0, 4)) {
    game.move({ from: attemptedUci.slice(0,2), to: attemptedUci.slice(2,4), promotion });
    moveCount++;
    solvedPly++;
    if (solvedPly >= solution.length) {
      finished = true;
      render(container);
      if (onDoneCb) onDoneCb();
      return;
    }
    // auto-play opponent's reply
    setTimeout(() => {
      applyUci(solution[solvedPly]);
      solvedPly++;
      if (solvedPly >= solution.length) {
        finished = true;
        if (onDoneCb) onDoneCb();
      }
      render(container);
    }, 350);
    render(container);
  } else {
    const statusEl = container.querySelector('.chess-status');
    statusEl.textContent = 'Niet de juiste zet — probeer opnieuw.';
    render(container);
  }
}

function markup() {
  return `
    <div class="chess-layout">
      <div id="chessBoard" role="group" aria-label="Schaakbord"></div>
      <p class="chess-status"></p>
      <div class="chess-controls">
        <button class="btn btn--small" data-action="hint">Hint</button>
        <button class="btn btn--small btn--ghost" data-action="retry">Opnieuw</button>
        <button class="btn btn--small btn--ghost" data-action="next">Volgende puzzel</button>
        <button class="btn btn--small btn--ghost" data-action="flip">Draai bord</button>
      </div>
    </div>`;
}

export async function initChess({ onDone }) {
  onDoneCb = onDone;
  const body = document.getElementById('chessBody');
  body.innerHTML = '<div class="state state--loading">Puzzel laden…</div>';

  async function load({ forceNext = false } = {}) {
    body.innerHTML = '<div class="state state--loading">Puzzel laden…</div>';
    try {
      const data = await fetchPuzzle({ forceNext });
      setupFromPuzzleData(data);
      body.innerHTML = markup();
      render(body);
      body.querySelector('[data-action="hint"]').addEventListener('click', () => {
        if (finished || !solution[solvedPly]) return;
        const from = solution[solvedPly].slice(0, 2);
        selectedSquare = from;
        render(body);
        body.querySelector('.chess-status').textContent = `Hint: speel vanaf ${from}.`;
      });
      body.querySelector('[data-action="retry"]').addEventListener('click', () => {
        const cached = JSON.parse(localStorage.getItem(PUZZLE_CACHE_KEY));
        setupFromPuzzleData(cached);
        render(body);
      });
      body.querySelector('[data-action="next"]').addEventListener('click', () => load({ forceNext: true }));
      body.querySelector('[data-action="flip"]').addEventListener('click', () => {
        orientation = orientation === 'white' ? 'black' : 'white';
        render(body);
      });
    } catch (err) {
      body.innerHTML = `<p class="state state--error">Schaakpuzzel kon niet geladen worden (${escapeMsg(err)}).</p>
        <button class="btn btn--small btn--ghost" id="chessRetryBtn">Opnieuw proberen</button>`;
      body.querySelector('#chessRetryBtn')?.addEventListener('click', () => load());
    }
  }

  if (typeof Chess !== 'function') {
    body.innerHTML = '<p class="state state--error">Schaakbibliotheek kon niet geladen worden.</p>';
    return;
  }
  load();
}

function escapeMsg(err) {
  return String(err?.message || err).replace(/[<>&]/g, '');
}
