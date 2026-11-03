import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from '../src/js/vendor/chess.js';

test('chess.js: the starting position has 20 moves', () => {
    assert.equal(new Chess().moves().length, 20);
});

test('chess.js: a back-rank mate is detected', () => {
    const chess = new Chess('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    chess.move('Ra8');
    assert.equal(chess.isCheckmate(), true);
});
