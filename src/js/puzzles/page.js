// The puzzles page: train (a local rating picks puzzles from the matching band) or the
// puzzle of the day. No account and no server: the puzzles are static JSON and the
// progress lives in this browser only.
import { createBoard } from '../board/board.js';
import { loadJSON, saveJSON } from '../common/store.js';
import { updateRating, bandFor } from './rating.js';
import { startPuzzle, tryMove, hint, pickNext } from './trainer.js';
import { LANG, t, themeNames, softHint, sanForSpeech } from './i18n.js';

const $ = (id) => document.getElementById(id);
// The day is the UTC day everywhere (index of the daily puzzle, "today" counts and its label),
// so everybody gets the same puzzle and the label never disagrees with it.
const DAY = Math.floor(Date.now() / 86_400_000);
const TODAY = new Date(DAY * 86_400_000).toISOString().slice(0, 10);
const CTA_EVERY = 5;

const count0 = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
const saved = loadJSON('puzzles', null) || {};
const savedToday = saved.today && saved.today.date === TODAY ? saved.today : {};
const progress = {
    rating: Number.isFinite(saved.rating) ? Math.max(400, Math.round(saved.rating)) : 1200,
    seen: Array.isArray(saved.seen) ? saved.seen.filter((id) => typeof id === 'string').slice(-500) : [],
    today: { date: TODAY, solved: count0(savedToday.solved), failed: count0(savedToday.failed) },
    dailyDone: saved.dailyDone === TODAY ? TODAY : null,
};
const bands = new Map();
let mode = 'train';
let puzzle = null;
let gen = 0;          // bumped on every new puzzle or mode: stale timers and loops check it and stop
let counted = false;
let hintUsed = false;
let hintStep = 0;
let finished = true;

const board = createBoard($('pz-board'), {
    legalDests: (from) => (puzzle && !finished ? puzzle.chess.moves({ square: from, verbose: true }).map((m) => m.to) : []),
    onMove,
});

function save() { saveJSON('puzzles', progress); }
function later(ms, fn) { const g = gen; setTimeout(() => { if (g === gen) fn(); }, ms); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function say(html, tone) {
    const box = $('pz-feedback');
    box.className = 'pz-feedback' + (tone ? ' ' + tone : '');
    box.innerHTML = html;
}

function renderStatus() {
    $('pz-rating').textContent = String(progress.rating);
    $('pz-today').innerHTML = t.today(Number(progress.today.solved), Number(progress.today.failed));
    $('pz-cta').hidden = progress.today.solved === 0 || progress.today.solved % CTA_EVERY !== 0;
}

function count(success) {
    if (counted || !puzzle) return;
    counted = true;
    if (mode === 'train' && !hintUsed) progress.rating = updateRating(progress.rating, puzzle.rating, success);
    progress.today[success ? 'solved' : 'failed'] += 1;
    if (!progress.seen.includes(puzzle.id)) progress.seen.push(puzzle.id);
    if (mode === 'daily') progress.dailyDone = TODAY;
    save();
    renderStatus();
}

function uciSquares(uci) { return [uci.slice(0, 2), uci.slice(2, 4)]; }

function setButtons() {
    $('pz-hint').disabled = $('pz-solution').disabled = finished;
    $('pz-next').classList.toggle('primary', finished);
}

function dailyLabel() {
    return t.dailyTitle(new Date(DAY * 86_400_000).toLocaleDateString(LANG === 'es' ? 'es' : 'en-GB',
        { day: 'numeric', month: 'long', timeZone: 'UTC' }));
}

function show(record) {
    gen += 1;
    puzzle = startPuzzle(record);
    counted = hintUsed = finished = false;
    hintStep = 0;
    board.clearMarks();
    board.setInteractive(false);
    board.setOrientation(puzzle.playerColor);
    board.setPosition(record[1]);
    $('pz-turn').textContent = t.toMove[puzzle.playerColor];
    $('pz-turn-piece').setAttribute('href', `/images/pieces/staunty.svg#p-${puzzle.playerColor}k`);
    $('pz-task').textContent = mode === 'daily' ? dailyLabel() : t.find;
    $('pz-meta').textContent = `#${puzzle.id} · ~${puzzle.rating}`;
    say('');
    setButtons();
    const opening = puzzle.opponentMove;
    later(500, () => {
        board.setPosition(puzzle.chess.fen(), uciSquares(opening));
        board.setInteractive(true);
        say(t.opponentPlayed(sanForSpeech(puzzle.chess.history().at(-1))));
    });
}

function finish(text, tone) {
    finished = true;
    board.setInteractive(false);
    const names = themeNames(puzzle.themes);
    say(`<strong>${text}</strong>` + (names.length ? ` <span class="pz-theme">${t.theme}: ${names.join(' · ')}</span>` : ''), tone);
    setButtons();
}

function onMove(from, to, promotion) {
    if (!puzzle || finished) return;
    const uci = from + to + (promotion || '');
    const res = tryMove(puzzle, uci);
    board.clearMarks();
    if (res.result === 'wrong') {
        count(false);
        board.mark([from], 'wrong');
        say(`<strong>${t.wrong}</strong> ${t.tryAgain} <span class="pz-soft">${softHint(puzzle.themes)}</span>`, 'bad');
        later(900, () => board.unmark('wrong'));
        return;
    }
    if (res.result === 'solved') {
        board.setPosition(puzzle.chess.fen(), [from, to]);
        board.mark([to], 'right');
        const clean = !counted; // a miss earlier in this puzzle already counted it as failed
        count(true);
        finish(clean ? t.solved : t.failedSolved, clean ? 'good' : '');
        return;
    }
    // correct: show the player's move, then the opponent's answer
    const reply = puzzle.chess.undo();
    board.setPosition(puzzle.chess.fen(), [from, to]);
    puzzle.chess.move(reply);
    board.setInteractive(false);
    say(`<strong>${t.right}</strong>`, 'good');
    hintStep = 0;
    later(450, () => {
        board.setPosition(puzzle.chess.fen(), uciSquares(res.reply));
        board.setInteractive(true);
        say(`<strong>${t.right}</strong> ${t.opponentPlayed(sanForSpeech(reply.san))} ${t.findAgain}`, 'good');
    });
}

$('pz-hint').addEventListener('click', () => {
    if (!puzzle || finished) return;
    const h = hint(puzzle);
    if (!h) return;
    hintUsed = true;
    board.clearMarks();
    board.mark([h.from], 'hint');
    if (hintStep > 0) board.arrow(h.from, h.to, 'hint');
    hintStep += 1;
});

$('pz-solution').addEventListener('click', async () => {
    if (!puzzle || finished) return;
    const g = gen;
    const p = puzzle;
    count(false);
    board.setInteractive(false);
    finished = true;
    setButtons();
    board.clearMarks();
    for (let i = p.step; i < p.solution.length; i++) {
        const uci = p.solution[i];
        const [from, to] = uciSquares(uci);
        p.chess.move({ from, to, promotion: uci[4] });
        board.setPosition(p.chess.fen(), [from, to]);
        await wait(650);
        if (g !== gen) return; // the visitor moved on to another puzzle
    }
    finish(t.shown, 'bad');
});

async function loadBand(rating) {
    const band = bandFor(rating);
    if (!bands.has(band)) {
        const res = await fetch(`/data/puzzles/band-${String(band).padStart(4, '0')}.json`);
        if (!res.ok) throw new Error(res.status);
        bands.set(band, await res.json());
    }
    return bands.get(band);
}

function showDailyDone() {
    gen += 1;
    puzzle = null;
    finished = true;
    board.clearMarks();
    board.setInteractive(false);
    $('pz-task').textContent = dailyLabel();
    $('pz-meta').textContent = '';
    say(t.dailyDone);
    setButtons();
}

async function next() {
    const g = ++gen;
    try {
        if (mode === 'daily') {
            if (progress.dailyDone === TODAY) { showDailyDone(); return; }
            const res = await fetch('/data/puzzles/daily.json');
            if (!res.ok) throw new Error(res.status);
            const daily = await res.json();
            if (g !== gen) return;
            show(daily.puzzles[DAY % daily.puzzles.length]);
            return;
        }
        const band = await loadBand(progress.rating);
        if (g !== gen) return;
        show(pickNext(band, progress.rating, new Set(progress.seen), puzzle && puzzle.id));
    } catch {
        if (g === gen) say(t.loadError, 'bad');
    }
}

$('pz-next').addEventListener('click', () => {
    if (mode === 'daily' && finished) setMode('train');
    else next();
});

// Tabs: click, or arrow keys between them (WAI-ARIA tabs pattern).
const tabs = [$('pz-tab-train'), $('pz-tab-daily')];
function setMode(m) {
    mode = m;
    tabs.forEach((tab) => {
        const on = tab.id === (m === 'train' ? 'pz-tab-train' : 'pz-tab-daily');
        tab.setAttribute('aria-selected', String(on));
        tab.tabIndex = on ? 0 : -1;
    });
    next();
}
tabs[0].addEventListener('click', () => setMode('train'));
tabs[1].addEventListener('click', () => setMode('daily'));
tabs.forEach((tab, i) => tab.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const other = tabs[1 - i];
    other.focus();
    other.click();
}));

renderStatus();
say(t.loading);
next();
