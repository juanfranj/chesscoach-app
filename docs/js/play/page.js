// The play page: choose a rival, play in the browser against Stockfish 19 lite (Web Worker),
// and get a review at the end. No account and no server; the game in progress is kept in
// this browser so a reload does not lose it.
import { Chess } from '../vendor/chess.js';
import { createBoard } from '../board/board.js';
import { loadJSON, saveJSON } from '../common/store.js';
import { createEngine } from './engine.js';
import { RIVALS, recipeFor, botMove, shouldResign } from './bot.js';
import { gameAccuracy, keyMoments } from './review.js';
import { t, localSan, pick } from './i18n.js';

const $ = (id) => document.getElementById(id);
const MATE_CP = 10_000;
const REVIEW_MS = 120;
const MIN_BOT_DELAY = 450;

let engine = null;
let enginePromise = null;
let game = null;      // { rival, color, chess, botEvals, over }
let gen = 0;          // bumped on every new game: late engine answers for an old game are dropped
let botThinking = false;
let choice = { rival: 'diego', color: 'w' };

const board = createBoard($('pl-board'), {
    legalDests: (from) => (game && !game.over && !botThinking && game.chess.turn() === game.color
        ? game.chess.moves({ square: from, verbose: true }).map((m) => m.to) : []),
    onMove: playerMove,
});
let reviewBoard = null;

function show(view) {
    for (const v of ['setup', 'game', 'end']) $('pl-' + v).hidden = v !== view;
}

function getEngine() {
    if (!enginePromise) {
        enginePromise = createEngine().then((e) => (engine = e)).catch((err) => { enginePromise = null; throw err; });
    }
    return enginePromise;
}

function rivalOf(id) { return RIVALS.find((r) => r.id === id) || RIVALS[2]; }

// --- setup -------------------------------------------------------------------------------
function selectRival(id) {
    choice.rival = id;
    document.querySelectorAll('.pl-rival').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.rival === id)));
    $('pl-start').textContent = t.playAgainst(rivalOf(id).name);
}
function selectColor(c) {
    choice.color = c;
    document.querySelectorAll('.pl-color').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === c)));
}
document.querySelectorAll('.pl-rival').forEach((b) => b.addEventListener('click', () => selectRival(b.dataset.rival)));
document.querySelectorAll('.pl-color').forEach((b) => b.addEventListener('click', () => selectColor(b.dataset.color)));
// Arrow keys inside each radio group.
for (const sel of ['.pl-rival', '.pl-color']) {
    const items = [...document.querySelectorAll(sel)];
    items.forEach((b, i) => b.addEventListener('keydown', (e) => {
        const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        const next = items[(i + d + items.length) % items.length];
        next.focus();
        next.click();
    }));
}

$('pl-start').addEventListener('click', async () => {
    const btn = $('pl-start');
    btn.disabled = true;
    $('pl-note').textContent = t.loadingEngine;
    try {
        await getEngine();
    } catch (e) {
        btn.disabled = false;
        $('pl-note').innerHTML = t.engineError;
        return;
    }
    btn.disabled = false;
    const color = choice.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : choice.color;
    startGame(choice.rival, color, []);
});

// --- the game ----------------------------------------------------------------------------
function save() {
    if (!game) return;
    saveJSON('play', game.over ? null : { rival: game.rival.id, color: game.color, moves: game.chess.history({ verbose: true }).map((m) => m.lan), botEvals: game.botEvals });
}

function say(text) { $('pl-bubble').textContent = text; }

function renderMoves() {
    const list = $('pl-moves');
    const sans = game.chess.history();
    list.innerHTML = '';
    for (let i = 0; i < sans.length; i += 2) {
        const li = document.createElement('li');
        li.textContent = `${i / 2 + 1}. ${localSan(sans[i])}${sans[i + 1] ? ' ' + localSan(sans[i + 1]) : ''}`;
        list.appendChild(li);
    }
    list.scrollTop = list.scrollHeight;
}

function refresh(lastMove) {
    board.setPosition(game.chess.fen(), lastMove);
    renderMoves();
    const mine = game.chess.turn() === game.color;
    $('pl-status').textContent = game.over ? '' : mine ? t.yourMove : t.thinking;
    $('pl-undo').disabled = botThinking || game.over || game.chess.history().length < (game.color === 'w' ? 1 : 2);
    $('pl-hint').disabled = botThinking || game.over || !mine;
    save();
}

async function startGame(rivalId, color, moves, botEvals = []) {
    gen += 1;
    const rival = rivalOf(rivalId);
    game = { rival, color, chess: new Chess(), botEvals, over: false, recipe: recipeFor(rival.strengthElo) };
    for (const lan of moves) {
        try { game.chess.move(lan); } catch { break; }
    }
    $('pl-rival-avatar').src = `/media/rivals/bot_${rival.id}.webp`;
    $('pl-rival-name').textContent = rival.name;
    $('pl-rival-level').textContent = t.levels[rival.level];
    $('pl-you').textContent = `${t.you} · ${t.colors[color]}`;
    $('pl-hint-text').textContent = '';
    $('pl-confirm').hidden = true;
    board.clearMarks();
    board.setOrientation(color);
    show('game');
    say(pick(t.say.start));
    const last = game.chess.history({ verbose: true }).at(-1);
    refresh(last ? [last.from, last.to] : null);
    if (engine) await engine.newGame();
    if (!checkEnd() && game.chess.turn() !== color) botTurn();
}

function playerMove(from, to, promotion) {
    if (!game || game.over || botThinking) return;
    let move;
    try { move = game.chess.move({ from, to, promotion }); } catch { refresh(); return; }
    board.clearMarks();
    $('pl-hint-text').textContent = '';
    refresh([move.from, move.to]);
    if (!checkEnd()) botTurn();
}

async function botTurn() {
    const g = gen;
    botThinking = true;
    refresh(lastSquares());
    const started = performance.now();
    let result;
    try {
        result = await botMove(engine, game.chess.fen(), game.recipe);
    } catch {
        botThinking = false;
        if (g === gen) $('pl-status').innerHTML = t.engineError;
        return;
    }
    const wait = MIN_BOT_DELAY - (performance.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    if (g !== gen || game.over) { botThinking = false; return; }
    game.botEvals.push(result.eval);
    if (shouldResign(game.botEvals)) {
        botThinking = false;
        finish('win', t.results.byResign(game.rival.name), pick(t.say.resign));
        return;
    }
    const uci = result.move;
    const move = game.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    botThinking = false;
    refresh([move.from, move.to]);
    if (move.captured) say(pick(t.say.capture));
    if (game.chess.inCheck()) say(pick(t.say.check));
    checkEnd();
}

function lastSquares() {
    const last = game.chess.history({ verbose: true }).at(-1);
    return last ? [last.from, last.to] : null;
}

function checkEnd() {
    const c = game.chess;
    if (!c.isGameOver()) return false;
    if (c.isCheckmate()) {
        const playerWon = c.turn() !== game.color;
        finish(playerWon ? 'win' : 'loss', t.results.byMate, pick(playerWon ? t.say.lost : t.say.won));
    } else {
        const why = c.isStalemate() ? t.results.stalemate : c.isThreefoldRepetition() ? t.results.repetition
            : c.isInsufficientMaterial() ? t.results.material : t.results.fifty;
        finish('draw', why, pick(t.say.won));
    }
    return true;
}

// --- controls ----------------------------------------------------------------------------
$('pl-undo').addEventListener('click', () => {
    if (!game || botThinking || game.over) return;
    // Back to the player's previous turn: undo the bot's answer and the player's move.
    game.chess.undo();
    if (game.chess.turn() !== game.color) game.chess.undo();
    game.botEvals.pop();
    board.clearMarks();
    refresh(lastSquares());
});

$('pl-hint').addEventListener('click', async () => {
    if (!game || botThinking || game.over || game.chess.turn() !== game.color) return;
    const g = gen;
    $('pl-hint').disabled = true;
    await engine.setOption('Skill Level', 20);
    const { lines } = await engine.analyse(game.chess.fen(), { depth: 12, movetime: 400, multipv: 1 });
    if (g !== gen || !lines[0]) return;
    const from = lines[0].move.slice(0, 2);
    board.clearMarks();
    board.mark([from], 'hint');
    $('pl-hint-text').textContent = t.hintText(from);
    $('pl-hint').disabled = false;
});

$('pl-flip').addEventListener('click', () => board.setOrientation(board.orientation === 'w' ? 'b' : 'w'));

function downloadPgn() {
    if (!game) return;
    const c = new Chess();
    for (const m of game.chess.history({ verbose: true })) c.move(m.lan);
    const white = game.color === 'w' ? 'You' : game.rival.name;
    const black = game.color === 'b' ? 'You' : game.rival.name;
    c.setHeader('Event', 'Chess Coach — chesscoach-app.com');
    c.setHeader('White', white);
    c.setHeader('Black', black);
    if (game.result) c.setHeader('Result', game.result);
    const blob = new Blob([c.pgn() + '\n'], { type: 'application/x-chess-pgn' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = t.pgnName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('pl-pgn').addEventListener('click', downloadPgn);
$('pl-pgn-end').addEventListener('click', downloadPgn);

$('pl-new').addEventListener('click', () => { gen += 1; game = null; saveJSON('play', null); show('setup'); });

$('pl-resign').addEventListener('click', () => {
    if (!game || game.over) return;
    $('pl-confirm-text').textContent = t.resignConfirm;
    $('pl-confirm-yes').textContent = t.yes;
    $('pl-confirm-no').textContent = t.no;
    $('pl-confirm').hidden = false;
    $('pl-confirm-no').focus();
});
$('pl-confirm-no').addEventListener('click', () => { $('pl-confirm').hidden = true; $('pl-resign').focus(); });
$('pl-confirm-yes').addEventListener('click', () => {
    $('pl-confirm').hidden = true;
    gen += 1;
    botThinking = false;
    finish('loss', t.results.youResigned, pick(t.say.won));
});

// --- end and review ----------------------------------------------------------------------
function finish(outcome, why, line) {
    game.over = true;
    game.result = outcome === 'draw' ? '1/2-1/2' : (outcome === 'win') === (game.color === 'w') ? '1-0' : '0-1';
    saveJSON('play', null);
    board.setInteractive(false);
    $('pl-end-avatar').src = `/media/rivals/bot_${game.rival.id}.webp`;
    $('pl-result').textContent = t.results[outcome];
    $('pl-result-sub').textContent = `${why} · ${t.moves(Math.ceil(game.chess.history().length / 2))}`;
    $('pl-end-bubble').textContent = `«${line}»`;
    $('pl-rematch').textContent = t.playAgainst(game.rival.name);
    show('end');
    review(gen);
}

async function review(g) {
    const moves = game.chess.history({ verbose: true });
    const body = $('pl-review-body');
    body.hidden = true;
    if (moves.length < 2 || !engine) { $('pl-review-progress').textContent = t.noMoments; return; }
    const replay = new Chess();
    const evals = [];   // white POV after each ply
    const best = [];    // engine best move before each ply
    await engine.setOption('Skill Level', 20);
    for (let i = 0; i <= moves.length; i++) {
        if (g !== gen) return;
        $('pl-review-progress').textContent = t.reviewing(Math.round((i / (moves.length + 1)) * 100));
        let whiteCp;
        if (replay.isCheckmate()) whiteCp = replay.turn() === 'w' ? -MATE_CP : MATE_CP;
        else if (replay.isGameOver()) whiteCp = 0;
        else {
            const { lines } = await engine.analyse(replay.fen(), { movetime: REVIEW_MS, multipv: 1 });
            const top = lines[0] || { scoreCp: 0, scoreMate: null, move: null };
            const stm = top.scoreMate != null ? Math.sign(top.scoreMate) * MATE_CP : top.scoreCp;
            whiteCp = replay.turn() === 'w' ? stm : -stm;
            best[i] = top.move;
        }
        if (i > 0) evals.push(whiteCp);
        if (i < moves.length) replay.move(moves[i].lan);
    }
    if (g !== gen) return;
    const acc = gameAccuracy(evals);
    $('pl-accuracy').textContent = acc ? `${Math.round(game.color === 'w' ? acc.white : acc.black)} %` : '—';
    $('pl-accuracy-label').textContent = t.accuracy;
    const moments = keyMoments(moves.map((m) => m.san), evals, best, game.color, 3);
    const list = $('pl-moments');
    list.innerHTML = '';
    $('pl-review-progress').textContent = moments.length ? '' : t.noMoments;
    if (!reviewBoard) reviewBoard = createBoard($('pl-review-board'), { interactive: false });
    reviewBoard.setOrientation(game.color);
    $('pl-legend').innerHTML = `<span class="pl-key played"></span> ${t.legendPlayed} · <span class="pl-key best"></span> ${t.legendBest}`;
    moments.forEach((m, k) => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pl-moment';
        const bestSan = sanOf(moves, m.ply, m.best);
        b.innerHTML = `<span class="pl-moment-move">${Math.floor(m.ply / 2) + 1}${m.ply % 2 ? '…' : '.'}${localSan(m.san)}</span>`
            + `<span><em class="g-${m.grade}">${t.grades[m.grade]}</em> ${bestSan ? t.bestWas(localSan(bestSan)) : ''}</span>`;
        b.addEventListener('click', () => showMoment(moves, m, b));
        li.appendChild(b);
        list.appendChild(li);
        if (k === 0) showMoment(moves, m, b);
    });
    body.hidden = false;
}

function sanOf(moves, ply, uci) {
    if (!uci) return null;
    const c = new Chess();
    for (let i = 0; i < ply; i++) c.move(moves[i].lan);
    try { return c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san; } catch { return null; }
}

function showMoment(moves, m, button) {
    document.querySelectorAll('.pl-moment').forEach((x) => x.setAttribute('aria-pressed', String(x === button)));
    const c = new Chess();
    for (let i = 0; i < m.ply; i++) c.move(moves[i].lan);
    reviewBoard.clearMarks();
    reviewBoard.setPosition(c.fen());
    const played = moves[m.ply];
    reviewBoard.arrow(played.from, played.to, 'played');
    if (m.best && m.best.slice(0, 4) !== played.lan.slice(0, 4)) reviewBoard.arrow(m.best.slice(0, 2), m.best.slice(2, 4), 'best');
}

$('pl-rematch').addEventListener('click', () => { if (game) startGame(game.rival.id, game.color, []); });
$('pl-other').addEventListener('click', () => { gen += 1; show('setup'); });

// --- start: resume a game in progress, if any ----------------------------------------------
const saved = loadJSON('play', null);
selectRival(saved && RIVALS.some((r) => r.id === saved.rival) ? saved.rival : 'diego');
selectColor('w');
if (saved && Array.isArray(saved.moves) && (saved.color === 'w' || saved.color === 'b')) {
    getEngine()
        .then(() => startGame(saved.rival, saved.color, saved.moves.filter((m) => typeof m === 'string'),
            Array.isArray(saved.botEvals) ? saved.botEvals.filter((e) => e && typeof e === 'object') : []))
        .catch(() => { $('pl-note').innerHTML = t.engineError; });
}

