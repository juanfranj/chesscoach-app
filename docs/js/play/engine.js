// Stockfish 19 lite (single-threaded wasm, GPLv3, unmodified; source in /engine-source/)
// in a Web Worker, spoken to over UCI. Commands are queued: a setoption sent while a
// search is running is what parks UCI readers (a lesson from the app), so nothing is sent
// until the previous search has answered bestmove.
import { parseInfo } from './uci.js';

const ENGINE_URL = '/js/engine/stockfish-19-lite-single.js';
const START_TIMEOUT = 20_000;

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
        worker.onmessage = (e) => listener && listener(String(e.data));
        const fail = (why) => { worker.terminate(); reject(new EngineUnavailable(why)); };
        worker.onerror = () => fail('worker error');
        const timer = setTimeout(() => fail('timeout'), START_TIMEOUT);

        const send = (cmd) => worker.postMessage(cmd);
        const waitFor = (token) => new Promise((ok) => {
            listener = (line) => { if (line.startsWith(token)) { listener = null; ok(); } };
        });

        let queue = Promise.resolve();
        const enqueue = (job) => { const run = queue.then(job, job); queue = run.catch(() => {}); return run; };

        const engine = {
            setOption(name, value) {
                return enqueue(async () => { send(`setoption name ${name} value ${value}`); send('isready'); await waitFor('readyok'); });
            },
            newGame() {
                return enqueue(async () => { send('ucinewgame'); send('isready'); await waitFor('readyok'); });
            },
            // { lines, bestMove }: lines sorted best first ({ move, scoreCp, scoreMate, pv, depth }, scores
            // from the side to move); bestMove is what the engine chose, which with Skill Level < 20
            // is not always lines[0].move.
            analyse(fen, { depth, movetime, multipv = 1 } = {}) {
                return enqueue(() => new Promise((ok) => {
                    const lines = new Map();
                    listener = (line) => {
                        const info = parseInfo(line);
                        if (info && info.pv.length) lines.set(info.multipv, info);
                        if (line.startsWith('bestmove')) {
                            listener = null;
                            const best = line.split(' ')[1];
                            const sorted = [...lines.values()].sort((a, b) => a.multipv - b.multipv)
                                .map((l) => ({ move: l.pv[0], scoreCp: l.scoreCp, scoreMate: l.scoreMate, pv: l.pv, depth: l.depth }));
                            ok({ lines: sorted, bestMove: best && best !== '(none)' ? best : null });
                        }
                    };
                    send(`setoption name MultiPV value ${multipv}`);
                    send(`position fen ${fen}`);
                    send('go' + (depth ? ` depth ${depth}` : '') + (movetime ? ` movetime ${movetime}` : ''));
                }));
            },
            stop() { send('stop'); },
            terminate() { worker.terminate(); },
        };

        listener = (line) => {
            if (line.startsWith('uciok')) {
                send('setoption name UCI_LimitStrength value false');
                send('isready');
            } else if (line.startsWith('readyok')) {
                clearTimeout(timer);
                listener = null;
                resolve(engine);
            }
        };
        send('uci');
    });
}
