// One puzzle from the exported bands: [id, fen, moves, rating, themes]. The stored line
// starts with the opponent's move; the player then has to find every other move. Any
// checkmate solves it, even one the database did not list (the app's rule too).
import { Chess } from '../vendor/chess.js';

function parseUci(uci) {
    return { from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] };
}

function play(chess, uci) {
    try {
        return chess.move(parseUci(uci));
    } catch {
        return null; // chess.js throws on an illegal move
    }
}

export function startPuzzle(record) {
    const [id, fen, moves, rating, themes] = record;
    const line = moves.split(' ');
    const chess = new Chess(fen);
    play(chess, line[0]);
    return {
        id, rating, themes: themes ? themes.split(' ') : [],
        chess, opponentMove: line[0], solution: line.slice(1), step: 0, playerColor: chess.turn(),
    };
}

export function tryMove(state, uci) {
    if (!play(state.chess, uci)) return { result: 'wrong', reply: null };
    if (state.chess.isCheckmate()) {
        state.step = state.solution.length;
        return { result: 'solved', reply: null };
    }
    if (uci !== state.solution[state.step]) {
        state.chess.undo();
        return { result: 'wrong', reply: null };
    }
    state.step += 1;
    if (state.step >= state.solution.length) return { result: 'solved', reply: null };
    const reply = state.solution[state.step];
    play(state.chess, reply);
    state.step += 1;
    return { result: 'correct', reply };
}

export function hint(state) {
    const next = state.solution[state.step];
    return next ? { from: next.slice(0, 2), to: next.slice(2, 4) } : null;
}

export function pickNext(band, rating, seenIds) {
    const byDistance = [...band.puzzles].sort((a, b) => Math.abs(a[3] - rating) - Math.abs(b[3] - rating));
    return byDistance.find((p) => !seenIds.has(p[0])) ?? byDistance[0];
}
