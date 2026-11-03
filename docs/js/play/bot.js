// The five web rivals. Port of the app / bot-server recipe
// (backend/hu-chess/bot-server/src/stockfish/{lichess-strength,effective-sf-elo,human-error}.ts
// and engine.ts getBestMoveForBot): Skill Level + depth + movetime by EFFECTIVE Elo, an error
// chosen among the engine's own candidates when the dice fires, never with a mate in hand.
// UCI_LimitStrength is never used (engine.js sends it as false).

export const RIVALS = [
    { id: 'beto', name: 'Beto', level: 'beginner', strengthElo: 600 },
    { id: 'ana', name: 'Ana', level: 'casual', strengthElo: 950 },
    { id: 'diego', name: 'Diego', level: 'club', strengthElo: 1350 },
    { id: 'hugo', name: 'Hugo', level: 'strong', strengthElo: 1550 },
    { id: 'javier', name: 'Javier', level: 'expert', strengthElo: 1950 },
];

// bucket -> [skill, depth, movetime ms, blunderProb] (lichess-strength.ts, 600-2000 is all we use)
const TABLE = {
    600: [0, 4, 30, 0.65], 700: [0, 4, 50, 0.5], 800: [0, 5, 70, 0.35], 900: [0, 5, 100, 0.25],
    1000: [0, 5, 130, 0.15], 1100: [0, 5, 170, 0.08], 1200: [0, 5, 220, 0.08], 1300: [1, 5, 250, 0.075],
    1400: [3, 5, 300, 0.06], 1500: [6, 6, 350, 0.045], 1600: [8, 7, 400, 0.0375], 1700: [11, 8, 450, 0.03],
    1800: [13, 10, 500, 0.0225], 1900: [14, 12, 600, 0.015], 2000: [15, 14, 700, 0.015],
};
const MATE_SCORE_CP = 100_000;

function effectiveSfElo(declared) {
    return declared < 1250 || declared > 2550 ? declared : declared - 150;
}

function errorBudget(elo) {
    if (elo < 700) return [12, 900];
    if (elo < 800) return [11, 700];
    if (elo < 1000) return [10, 700];
    if (elo < 1200) return [8, 500];
    if (elo < 1400) return [6, 300];
    if (elo < 1600) return [5, 200];
    if (elo < 1800) return [4, 120];
    if (elo < 2100) return [4, 80];
    return [3, 50];
}

export function recipeFor(strengthElo) {
    const elo = effectiveSfElo(strengthElo);
    const bucket = Math.floor(Math.max(600, Math.min(2000, elo)) / 100) * 100;
    const [skill, depth, movetime, blunderProb] = TABLE[bucket];
    const [poolSize, maxCpLoss] = errorBudget(elo);
    return { skill, depth, movetime, blunderProb, poolSize, maxCpLoss };
}

// Same weighted draw as human-error.ts: worse candidates are less likely, none beyond maxCpLoss.
export function pickErrorMove(candidates, budget, rng = Math.random) {
    if (candidates.length < 2) return null;
    const best = candidates[0];
    const eligible = candidates.slice(1, budget.poolSize).filter((c) => best.scoreCp - c.scoreCp <= budget.maxCpLoss);
    if (!eligible.length) return null;
    const weights = eligible.map((c) => budget.maxCpLoss - Math.max(0, best.scoreCp - c.scoreCp) + 1);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.min(Math.floor(rng() * total), total - 1);
    for (let i = 0; i < eligible.length; i++) {
        roll -= weights[i];
        if (roll < 0) return eligible[i].uci;
    }
    return eligible[eligible.length - 1].uci;
}

// { move, eval: { cp, mate } } — eval from the bot's side, for shouldResign().
export async function botMove(engine, fen, recipe, rng = Math.random) {
    await engine.setOption('Skill Level', recipe.skill);
    const { lines, bestMove } = await engine.analyse(fen, { depth: recipe.depth, movetime: recipe.movetime, multipv: 1 });
    const top = lines[0] || {};
    const evaluation = { cp: top.scoreCp ?? null, mate: top.scoreMate ?? null };
    // A mate in hand: play the engine's own PV. Skill Level's pick_best would otherwise
    // draw among mates of different length and can let the mate slip (app 2026-08-19).
    if (top.scoreMate > 0 && top.move) return { move: top.move, eval: evaluation };
    const played = bestMove || top.move;
    if (recipe.blunderProb <= 0 || rng() >= recipe.blunderProb) return { move: played, eval: evaluation };

    const multi = await engine.analyse(fen, { depth: recipe.depth, movetime: recipe.movetime, multipv: recipe.poolSize });
    const candidates = multi.lines.map((l) => ({
        uci: l.move,
        scoreCp: l.scoreMate != null ? (l.scoreMate > 0 ? MATE_SCORE_CP : -MATE_SCORE_CP) : l.scoreCp,
    }));
    if (candidates.length && candidates[0].scoreCp === MATE_SCORE_CP) return { move: played, eval: evaluation };
    const error = pickErrorMove(candidates, recipe, rng);
    return { move: error || played, eval: evaluation };
}

const RESIGN_CP = -600;
const RESIGN_MOVES = 3;

export function shouldResign(evals) {
    const last = evals[evals.length - 1];
    if (last && last.mate != null && last.mate < 0) return true;
    if (evals.length < RESIGN_MOVES) return false;
    return evals.slice(-RESIGN_MOVES).every((e) => e.cp != null && e.cp <= RESIGN_CP);
}
