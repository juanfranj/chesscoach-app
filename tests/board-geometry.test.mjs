import { test } from 'node:test';
import assert from 'node:assert/strict';
import { squareAt, indexOf, isPromotion } from '../src/js/board/geometry.js';

test('geometry: index 0 is the top-left square for each side', () => {
    assert.equal(squareAt(0, 'w'), 'a8');
    assert.equal(squareAt(63, 'w'), 'h1');
    assert.equal(squareAt(0, 'b'), 'h1');
    assert.equal(squareAt(63, 'b'), 'a8');
});

test('geometry: indexOf is the inverse of squareAt', () => {
    assert.equal(indexOf('e4', 'w'), 36);
    assert.equal(indexOf('e4', 'b'), 27);
    for (const o of ['w', 'b']) for (let i = 0; i < 64; i++) assert.equal(indexOf(squareAt(i, o), o), i);
});

test('geometry: a pawn reaching the last rank is a promotion', () => {
    assert.equal(isPromotion({ color: 'w', type: 'p' }, 'e8'), true);
    assert.equal(isPromotion({ color: 'b', type: 'p' }, 'a1'), true);
    assert.equal(isPromotion({ color: 'w', type: 'p' }, 'e7'), false);
    assert.equal(isPromotion({ color: 'w', type: 'q' }, 'e8'), false);
});
