import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInfo } from '../src/js/play/uci.js';

test('uci: a centipawn line with multipv', () => {
    assert.deepEqual(parseInfo('info depth 12 seldepth 18 multipv 2 score cp 34 nodes 1000 nps 9 time 5 pv e2e4 e7e5'),
        { depth: 12, multipv: 2, scoreCp: 34, scoreMate: null, bound: null, pv: ['e2e4', 'e7e5'] });
});

test('uci: a mate score, multipv defaults to 1', () => {
    const r = parseInfo('info depth 9 score mate -3 pv h7h8q');
    assert.equal(r.scoreMate, -3);
    assert.equal(r.scoreCp, null);
    assert.equal(r.multipv, 1);
});

test('uci: bounds are kept but marked', () => {
    assert.equal(parseInfo('info depth 5 multipv 1 score cp 50 upperbound pv a2a3').bound, 'upper');
    assert.equal(parseInfo('info depth 5 multipv 1 score cp 50 lowerbound pv a2a3').bound, 'lower');
});

test('uci: lines without a score or that are not info give null', () => {
    assert.equal(parseInfo('bestmove e2e4 ponder e7e5'), null);
    assert.equal(parseInfo('info string NNUE evaluation using nn-61e7af4bb97d.nnue'), null);
    assert.equal(parseInfo('info depth 1 currmove e2e4 currmovenumber 1'), null);
});
