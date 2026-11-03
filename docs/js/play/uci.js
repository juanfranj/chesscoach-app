// Reads one UCI "info" line. Lines without a score and a pv (currmove, strings…) give null.
export function parseInfo(line) {
    if (!line.startsWith('info ')) return null;
    const t = line.split(' ');
    const at = (key) => t.indexOf(key);
    const sc = at('score');
    const pv = at('pv');
    if (sc < 0 || pv < 0) return null;
    const kind = t[sc + 1];
    const value = Number(t[sc + 2]);
    const bound = t.includes('upperbound') ? 'upper' : t.includes('lowerbound') ? 'lower' : null;
    return {
        depth: Number(t[at('depth') + 1]) || 0,
        multipv: at('multipv') >= 0 ? Number(t[at('multipv') + 1]) : 1,
        scoreCp: kind === 'cp' ? value : null,
        scoreMate: kind === 'mate' ? value : null,
        bound,
        pv: t.slice(pv + 1),
    };
}
