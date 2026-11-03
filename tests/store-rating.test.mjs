import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadJSON, saveJSON } from '../src/js/common/store.js';
import { updateRating, bandFor } from '../src/js/puzzles/rating.js';

function withStorage(storage, fn) {
    const had = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => storage });
    try { fn(); } finally {
        if (had) Object.defineProperty(globalThis, 'localStorage', had);
        else delete globalThis.localStorage;
    }
}

test('store: a blocked localStorage gives the fallback and never throws', () => {
    const blocked = {
        getItem() { throw new Error('SecurityError'); },
        setItem() { throw new Error('QuotaExceededError'); },
    };
    withStorage(blocked, () => {
        assert.deepEqual(loadJSON('puzzles', { rating: 1200 }), { rating: 1200 });
        assert.equal(saveJSON('puzzles', { rating: 1300 }), false);
    });
});

test('store: values round-trip under the cc-web- prefix', () => {
    const map = new Map();
    const fake = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
    withStorage(fake, () => {
        assert.equal(saveJSON('puzzles', { rating: 1300 }), true);
        assert.ok(map.has('cc-web-puzzles'));
        assert.deepEqual(loadJSON('puzzles', null), { rating: 1300 });
        map.set('cc-web-broken', '{not json');
        assert.equal(loadJSON('broken', 'fallback'), 'fallback');
    });
});

test('store: no localStorage at all (node) gives the fallback', () => {
    withStorage(undefined, () => {
        assert.equal(loadJSON('x', 7), 7);
        assert.equal(saveJSON('x', 1), false);
    });
});

test('rating: equal ratings move 16 points with k = 32', () => {
    assert.equal(updateRating(1200, 1200, true), 1216);
    assert.equal(updateRating(1200, 1200, false), 1184);
});

test('rating: never drops below 400', () => {
    assert.equal(updateRating(410, 410, false), 400); // 410 − 16 would be 394
});

test('rating: bands of 200 clamped to 400 … 2400', () => {
    assert.equal(bandFor(399), 400);
    assert.equal(bandFor(1250), 1200);
    assert.equal(bandFor(2900), 2400);
});
