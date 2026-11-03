import { test } from 'node:test';
import assert from 'node:assert/strict';
import { winningChances, classifyMove, moveAccuracy, gameAccuracy, keyMoments } from '../src/js/play/review.js';

// Same cases as the app's MoveClassifierTest / MoveClassifierSaturationTest (Kotlin).
test('winning chances: Lichess sigmoid, clamped to ±1000', () => {
    assert.ok(Math.abs(winningChances(0)) < 0.001);
    assert.ok(Math.abs(winningChances(100) - 0.182) < 0.01);
    assert.equal(winningChances(2000), winningChances(1000));
});

test('classify: the app verdicts', () => {
    assert.equal(classifyMove(1500, 200), 'blunder');
    assert.equal(classifyMove(-450, -3000), 'blunder');
    assert.equal(classifyMove(-600, -1500), 'inaccuracy');
    assert.equal(classifyMove(-800, -100), 'good');
    assert.equal(classifyMove(-5000, 5000), 'good');
});

test('classify: saturated scale stays silent instead of saying good', () => {
    assert.equal(classifyMove(-616, -734), 'undecided');
    assert.equal(classifyMove(-844, -1086), 'undecided');
    assert.equal(classifyMove(-9999, -9999), 'undecided');
});

test('classify: mates lost and allowed', () => {
    assert.equal(classifyMove(9990, 300), 'blunder');
    assert.equal(classifyMove(-100, -9999), 'blunder');
    assert.equal(classifyMove(-800, -9999), 'mistake');
    assert.equal(classifyMove(-1200, -9999), 'inaccuracy');
});

test('move accuracy: Lichess exponential', () => {
    assert.equal(moveAccuracy(50, 70), 100);
    assert.ok(Math.abs(moveAccuracy(55, 50) - 81) < 2);
    assert.ok(moveAccuracy(100, 0) < 1);
});

test('game accuracy: white and black from white-POV evals; fewer than two gives null', () => {
    const acc = gameAccuracy([20, 10, -300, -280]); // ply 2 (white) drops 310 cp
    assert.ok(acc.white > 0 && acc.white <= 100 && acc.black > 0 && acc.black <= 100);
    assert.ok(acc.white < acc.black);
    assert.equal(gameAccuracy([20]), null);
});

test('key moments: the player\'s worst moves, in game order, with the best move', () => {
    // plies: 0 w, 1 b, 2 w, 3 b … evals are white POV after each ply; best[i] = engine best before ply i
    const sans = ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'];
    const evals = [30, 25, 10, 20, 15, 600, 10000];
    const best = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'g7g6', 'h5f7'];
    const black = keyMoments(sans, evals, best, 'b', 3);
    assert.deepEqual(black.map((m) => [m.ply, m.grade]), [[5, 'blunder']]);
    assert.equal(black[0].best, 'g7g6');
    assert.deepEqual(keyMoments(sans, evals, best, 'w', 3), []);
});
