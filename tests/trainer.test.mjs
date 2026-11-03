import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startPuzzle, tryMove, hint, pickNext } from '../src/js/puzzles/trainer.js';

// Real puzzles from the app's puzzles.db (Lichess Puzzle Database, CC0).
const FORK = ['xJM4l', 'rn1qk1r1/pbpp4/1p1bN2p/5p2/8/3B1N2/PPP1QPPP/R4RK1 b q - 0 15', 'd7e6 e2e6 d8e7 e6g8', 1101, 'crushing fork'];
const TWO_MATES = ['MSHpe', 'r1br3k/2q1pQ1p/2p2pp1/2N1P3/PP1B2n1/8/6P1/2R1K2R b K - 3 23', 'g4e5 f7h7', 994, 'mate mateIn1'];
const UNDERPROMOTION = ['thYKI', '8/pR1P4/7p/1kP3p1/3K4/8/P7/4r3 b - - 4 45', 'b5c6 d7d8n', 910, 'mate mateIn1 underPromotion'];

test('startPuzzle plays the opponent move and hands the turn to the player', () => {
    const s = startPuzzle(FORK);
    assert.equal(s.opponentMove, 'd7e6');
    assert.equal(s.playerColor, 'w');
    assert.equal(s.chess.fen(), 'rn1qk1r1/pbp5/1p1bp2p/5p2/8/3B1N2/PPP1QPPP/R4RK1 w q - 0 16');
    assert.deepEqual(s.solution, ['e2e6', 'd8e7', 'e6g8']);
});

test('the solution line: correct with the reply, then solved', () => {
    const s = startPuzzle(FORK);
    assert.deepEqual(tryMove(s, 'e2e6'), { result: 'correct', reply: 'd8e7' });
    assert.deepEqual(tryMove(s, 'e6g8'), { result: 'solved', reply: null });
});

test('a different legal move is wrong and leaves the position as it was', () => {
    const s = startPuzzle(FORK);
    const before = s.chess.fen();
    assert.deepEqual(tryMove(s, 'a2a3'), { result: 'wrong', reply: null });
    assert.equal(s.chess.fen(), before);
    assert.equal(s.step, 0);
});

test('another mate than the stored one also solves the puzzle', () => {
    assert.deepEqual(tryMove(startPuzzle(TWO_MATES), 'h1h7'), { result: 'solved', reply: null });
    assert.deepEqual(tryMove(startPuzzle(TWO_MATES), 'f7h7'), { result: 'solved', reply: null });
});

test('promotion counts: the knight mates, the queen does not', () => {
    assert.deepEqual(tryMove(startPuzzle(UNDERPROMOTION), 'd7d8q'), { result: 'wrong', reply: null });
    assert.deepEqual(tryMove(startPuzzle(UNDERPROMOTION), 'd7d8n'), { result: 'solved', reply: null });
});

test('an illegal move is wrong, not an exception', () => {
    assert.deepEqual(tryMove(startPuzzle(FORK), 'e2e8'), { result: 'wrong', reply: null });
});

test('hint points at the next move of the solution', () => {
    const s = startPuzzle(FORK);
    assert.deepEqual(hint(s), { from: 'e2', to: 'e6' });
    tryMove(s, 'e2e6');
    assert.deepEqual(hint(s), { from: 'e6', to: 'g8' });
});

test('pickNext: the unseen puzzle closest to the rating, or the closest if all were seen', () => {
    const band = { band: 1000, puzzles: [['a', '', '', 1010, ''], ['b', '', '', 1150, ''], ['c', '', '', 1190, '']] };
    assert.equal(pickNext(band, 1180, new Set())[0], 'c');
    assert.equal(pickNext(band, 1180, new Set(['c']))[0], 'b');
    assert.equal(pickNext(band, 1180, new Set(['a', 'b', 'c']))[0], 'c');
});

test('pickNext never repeats the current puzzle, even when every puzzle was seen', () => {
    const band = { band: 1000, puzzles: [['a', '', '', 1010, ''], ['b', '', '', 1150, ''], ['c', '', '', 1190, '']] };
    assert.equal(pickNext(band, 1180, new Set(), 'c')[0], 'b');
    assert.notEqual(pickNext(band, 1180, new Set(['a', 'b', 'c']), 'c')[0], 'c');
});
