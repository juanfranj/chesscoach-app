// The end-of-game review. Port of the app's MoveClassifier.kt (itself the Lichess model:
// scalachess eval.scala, lila Advice.scala and AccuracyPercent.scala), so a game gets the
// same verdicts and accuracy here as in the app. Evals in centipawns; mates as ±10000.

const MULTIPLIER = -0.00368208;
const CP_CEILING = 1000;
const MATE_EVAL = 5000;
const BLUNDER = 0.30, MISTAKE = 0.20, INACCURACY = 0.10;
const INITIAL_CP = 15;
const ACC_A = 103.1668100711649, ACC_B = -0.04354415386753951, ACC_C = -3.166924740191411;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function winningChances(cp) {
    return 2 / (1 + Math.exp(MULTIPLIER * clamp(cp, -CP_CEILING, CP_CEILING))) - 1;
}
// The verdict uses the unclamped curve, like lila's CpAdvice (see MoveClassifier.kt).
function chancesForVerdict(cp) {
    return clamp(2 / (1 + Math.exp(MULTIPLIER * cp)) - 1, -1, 1);
}
const winPercent = (cp) => 50 + 50 * winningChances(cp);

function fromDrop(drop) {
    if (drop >= BLUNDER) return 'blunder';
    if (drop >= MISTAKE) return 'mistake';
    if (drop >= INACCURACY) return 'inaccuracy';
    return 'good';
}

// evalBefore / evalAfter from the POV of the side that moved.
export function classifyMove(evalBefore, evalAfter) {
    const beforeMate = Math.abs(evalBefore) >= MATE_EVAL;
    const afterMate = Math.abs(evalAfter) >= MATE_EVAL;
    if (beforeMate && evalBefore > 0 && !afterMate) {          // a forced mate let go
        return evalAfter < 700 ? 'blunder' : evalAfter < 999 ? 'mistake' : 'inaccuracy';
    }
    if (!beforeMate && afterMate && evalAfter < 0) {            // a mate allowed
        return evalBefore > -700 ? 'blunder' : evalBefore > -999 ? 'mistake' : 'inaccuracy';
    }
    const b = beforeMate ? Math.sign(evalBefore) * CP_CEILING : evalBefore;
    const a = afterMate ? Math.sign(evalAfter) * CP_CEILING : evalAfter;
    const drop = chancesForVerdict(b) - chancesForVerdict(a);
    const verdict = fromDrop(drop);
    // Saturated scale: so lost that even a blunder could not register; "good" would mean nothing.
    if (verdict === 'good' && drop >= 0 && chancesForVerdict(b) + 1 < BLUNDER) return 'undecided';
    return verdict;
}

export function moveAccuracy(before, after) {
    if (after >= before) return 100;
    return clamp(ACC_A * Math.exp(ACC_B * (before - after)) + ACC_C + 1, 0, 100);
}

function stdev(xs) {
    if (xs.length < 2) return null;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
}

// Lichess game accuracy from white-POV evals after each ply (a full game from the start).
export function gameAccuracy(evals) {
    if (evals.length < 2) return null;
    const wp = [winPercent(INITIAL_CP), ...evals.map(winPercent)];
    const size = clamp(Math.floor(evals.length / 10), 2, 8);
    const windows = [];
    for (let i = 0; i < Math.max(0, size - 2); i++) windows.push(wp.slice(0, size));
    for (let i = 0; i + size <= wp.length; i++) windows.push(wp.slice(i, i + size));
    const weights = windows.map((w) => clamp(stdev(w) ?? 0, 0.5, 12));
    const side = { w: [], b: [] };
    for (let i = 0; i < wp.length - 1; i++) {
        const white = i % 2 === 0;
        const acc = white ? moveAccuracy(wp[i], wp[i + 1]) : moveAccuracy(100 - wp[i], 100 - wp[i + 1]);
        side[white ? 'w' : 'b'].push([acc, weights[i] ?? 0.5]);
    }
    const score = (list) => {
        if (!list.length) return null;
        const wm = list.reduce((a, [v, w]) => a + v * w, 0) / list.reduce((a, [, w]) => a + w, 0);
        const pos = list.filter(([v]) => v > 0);
        const hm = pos.length ? pos.length / pos.reduce((a, [v]) => a + 1 / v, 0) : 0;
        return clamp((wm + hm) / 2, 0, 100);
    };
    const white = score(side.w), black = score(side.b);
    return white == null || black == null ? null : { white, black };
}

const RANK = { blunder: 3, mistake: 2, inaccuracy: 1 };

// The player's n worst moves (blunders first, then by drop), returned in game order.
// sans[i] / evals[i] (white POV after ply i) / best[i] (engine best before ply i, UCI).
export function keyMoments(sans, evals, best, color, n = 3) {
    const out = [];
    for (let ply = 0; ply < sans.length; ply++) {
        const white = ply % 2 === 0;
        if ((color === 'w') !== white) continue;
        const before = ply === 0 ? INITIAL_CP : evals[ply - 1];
        const sign = white ? 1 : -1;
        const grade = classifyMove(sign * before, sign * evals[ply]);
        if (!RANK[grade]) continue;
        const drop = chancesForVerdict(sign * before) - chancesForVerdict(sign * evals[ply]);
        out.push({ ply, san: sans[ply], grade, best: best[ply], drop });
    }
    return out.sort((a, b) => RANK[b.grade] - RANK[a.grade] || b.drop - a.drop)
        .slice(0, n).sort((a, b) => a.ply - b.ply);
}
