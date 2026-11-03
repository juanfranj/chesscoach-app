import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RIVALS, recipeFor, pickErrorMove, botMove, shouldResign } from '../src/js/play/bot.js';

test('rivals: five, in the order of the mockup, with Diego as Club', () => {
    assert.deepEqual(RIVALS.map((r) => r.id), ['beto', 'ana', 'diego', 'hugo', 'javier']);
    assert.deepEqual(RIVALS.map((r) => r.strengthElo), [600, 950, 1350, 1550, 1950]);
});

test('recipes are the app/bot-server ones, indexed by the effective Elo', () => {
    assert.deepEqual(recipeFor(1350), { skill: 0, depth: 5, movetime: 220, blunderProb: 0.08, poolSize: 6, maxCpLoss: 300 });
    assert.deepEqual(recipeFor(1950), { skill: 13, depth: 10, movetime: 500, blunderProb: 0.0225, poolSize: 4, maxCpLoss: 80 });
    assert.deepEqual(recipeFor(600), { skill: 0, depth: 4, movetime: 30, blunderProb: 0.65, poolSize: 12, maxCpLoss: 900 });
});

test('pickErrorMove: same draw as human-error.ts', () => {
    const cands = [{ uci: 'a', scoreCp: 100 }, { uci: 'b', scoreCp: 90 }, { uci: 'c', scoreCp: -500 }];
    const budget = { poolSize: 6, maxCpLoss: 300 };
    assert.equal(pickErrorMove(cands, budget, () => 0), 'b');      // c is outside the budget
    assert.equal(pickErrorMove([cands[0]], budget, () => 0), null); // no alternative
});

function fakeEngine(script) {
    const calls = [];
    return {
        calls,
        async setOption(name, value) { calls.push(['set', name, value]); },
        async analyse(fen, opts) { calls.push(['go', opts.multipv]); return script.shift(); },
    };
}

test('botMove: with a mate for the bot it plays the PV and never errs', async () => {
    const e = fakeEngine([{ lines: [{ move: 'h5f7', scoreCp: null, scoreMate: 1, pv: ['h5f7'] }], bestMove: 'g1f3' }]);
    const r = await botMove(e, 'fen', recipeFor(1350), () => 0); // rng 0 would fire the dice
    assert.equal(r.move, 'h5f7');
    assert.equal(e.calls.filter((c) => c[0] === 'go').length, 1);
});

test('botMove: the dice fires a second MultiPV search and plays a bounded error', async () => {
    const e = fakeEngine([
        { lines: [{ move: 'e2e4', scoreCp: 30, scoreMate: null, pv: ['e2e4'] }], bestMove: 'e2e4' },
        { lines: [{ move: 'e2e4', scoreCp: 30, scoreMate: null }, { move: 'd2d4', scoreCp: 25, scoreMate: null }], bestMove: 'e2e4' },
    ]);
    const r = await botMove(e, 'fen', recipeFor(1350), () => 0);
    assert.equal(r.move, 'd2d4');
    assert.deepEqual(e.calls.filter((c) => c[0] === 'go').map((c) => c[1]), [1, 6]);
});

test('botMove: without the dice it plays the engine bestmove (Skill Level choice) and reports its eval', async () => {
    const e = fakeEngine([{ lines: [{ move: 'e2e4', scoreCp: -40, scoreMate: null, pv: ['e2e4'] }], bestMove: 'g1f3' }]);
    const r = await botMove(e, 'fen', recipeFor(1350), () => 0.99);
    assert.deepEqual(r, { move: 'g1f3', eval: { cp: -40, mate: null } });
});

test('shouldResign: three bot evals at -600 or worse, or a mate against', () => {
    assert.equal(shouldResign([{ cp: -650 }, { cp: -700 }, { cp: -610 }]), true);
    assert.equal(shouldResign([{ cp: -650 }, { cp: -500 }, { cp: -700 }]), false);
    assert.equal(shouldResign([{ cp: -900 }, { cp: -900 }]), false);
    assert.equal(shouldResign([{ cp: null, mate: -2 }]), true);
    assert.equal(shouldResign([{ cp: null, mate: 3 }]), false);
});
