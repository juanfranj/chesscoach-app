// Stockfish 19 lite (single-threaded wasm, GPLv3, unmodified; source in /engine-source/)
// in a Web Worker, spoken to over UCI. Commands are queued: a setoption sent while a
// search is running is what parks UCI readers (a lesson from the app), so nothing is sent
// until the previous search has answered bestmove. If the Worker dies or a command never
// answers, the job in flight and every queued one reject, and the engine reports itself dead
// so the page can start a new one.
import { parseInfo } from './uci.js';

const ENGINE_URL = '/js/engine/stockfish-19-lite-single.js';
const START_TIMEOUT = 20_000;
const ANSWER_GRACE = 8_000; // on top of a search's own movetime

export class EngineUnavailable extends Error {}

export function createEngine() {
    return new Promise((resolve, reject) => {
        let worker;
        try {
            worker = new Worker(ENGINE_URL);
        } catch (e) {
            reject(new EngineUnavailable(String(e)));
            return;
        }
        let listener = null;
        let started = false;
        let dead = false;
        let failCurrent = null; // rejects the job in flight
        worker.onmessage = (e) => listener && listener(String(e.data));

        const die = (why) => {
            if (dead) return;
            dead = true;
            worker.terminate();
            if (!started) reject(new EngineUnavailable(why));
            if (failCurrent) failCurrent(new EngineUnavailable(why));
        };
        worker.onerror = () => die('worker error');
        const startTimer = setTimeout(() => die('timeout'), START_TIMEOUT);

        const send = (cmd) => worker.postMessage(cmd);

        // One job at a time; each one waits for its answer line, with a time limit.
        let queue = Promise.resolve();
        const job = (commands, done, limitMs) => {
            const run = queue.then(() => new Promise((ok, fail) => {
                if (dead) { fail(new EngineUnavailable('dead')); return; }
                const timer = setTimeout(() => die('no answer'), limitMs);
                failCurrent = (err) => { clearTimeout(timer); listener = null; failCurrent = null; fail(err); };
                listener = (line) => {
                    const result = done(line);
                    if (result !== undefined) { clearTimeout(timer); listener = null; failCurrent = null; ok(result); }
                };
                commands.forEach(send);
            }));
            queue = run.catch(() => {});
            return run;
        };
        const ready = (line) => (line.startsWith('readyok') ? true : undefined);

        const engine = {
            get dead() { return dead; },
            setOption(name, value) {
                return job([`setoption name ${name} value ${value}`, 'isready'], ready, ANSWER_GRACE);
            },
            newGame() {
                return job(['ucinewgame', 'isready'], ready, ANSWER_GRACE);
            },
            // { lines, bestMove }: lines sorted best first ({ move, scoreCp, scoreMate, pv, depth }, scores
            // from the side to move); bestMove is what the engine chose, which with Skill Level < 20
            // is not always lines[0].move.
            analyse(fen, { depth, movetime, multipv = 1 } = {}) {
                const lines = new Map();
                return job([
                    `setoption name MultiPV value ${multipv}`,
                    `position fen ${fen}`,
                    'go' + (depth ? ` depth ${depth}` : '') + (movetime ? ` movetime ${movetime}` : ''),
                ], (line) => {
                    const info = parseInfo(line);
                    if (info && info.pv.length) lines.set(info.multipv, info);
                    if (!line.startsWith('bestmove')) return undefined;
                    const best = line.split(' ')[1];
                    const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv)
                        .map((l) => ({ move: l.pv[0], scoreCp: l.scoreCp, scoreMate: l.scoreMate, pv: l.pv, depth: l.depth }));
                    return { lines: sorted, bestMove: best && best !== '(none)' ? best : null };
                }, (movetime || 0) + ANSWER_GRACE);
            },
            terminate() { dead = true; worker.terminate(); },
        };

        listener = (line) => {
            if (line.startsWith('uciok')) {
                send('setoption name UCI_LimitStrength value false');
                send('isready');
            } else if (line.startsWith('readyok')) {
                clearTimeout(startTimer);
                listener = null;
                started = true;
                resolve(engine);
            }
        };
        send('uci');
    });
}
