// Words the puzzles page writes from JS, in the page's language (<html lang>).
export const LANG = document.documentElement.lang === 'es' ? 'es' : 'en';

const TEXT = {
    en: {
        loading: 'Loading the puzzle…',
        loadError: 'The puzzles could not be loaded. Check your connection and reload the page.',
        toMove: { w: 'White to move', b: 'Black to move' },
        find: 'Find the best move',
        findAgain: 'Keep going: find the next move',
        wrong: 'Not that one.',
        tryAgain: 'Try another move:',
        right: 'Good move!',
        opponentPlayed: (san) => `Your opponent played ${san}.`,
        solved: 'Solved!',
        failedSolved: 'Done. This one counts as missed.',
        shown: 'This was the solution.',
        theme: 'Theme',
        today: (s, f) => `Solved today: <strong>${s}</strong> · Missed: ${f}`,
        dailyTitle: (d) => `Puzzle of the day · ${d}`,
        dailyDone: 'You already did today\'s puzzle. Come back tomorrow for a new one.',
        rating: 'your rating',
        hintFor: { fork: 'there is a move that attacks two pieces at once.', pin: 'one of the pieces cannot move without exposing another.', mate: 'there is a checkmate.', hangingPiece: 'there is a piece you can win.', sacrifice: 'giving material can be worth it.', default: 'look at every check and every capture.' },
    },
    es: {
        loading: 'Cargando el puzle…',
        loadError: 'No se han podido cargar los puzles. Revisa la conexión y recarga la página.',
        toMove: { w: 'Juegan blancas', b: 'Juegan negras' },
        find: 'Encuentra la mejor jugada',
        findAgain: 'Sigue: encuentra la siguiente jugada',
        wrong: 'Esa no es.',
        tryAgain: 'Prueba otra jugada:',
        right: '¡Bien jugado!',
        opponentPlayed: (san) => `El rival jugó ${san}.`,
        solved: '¡Resuelto!',
        failedSolved: 'Hecho. Este cuenta como fallado.',
        shown: 'Esta era la solución.',
        theme: 'Tema',
        today: (s, f) => `Resueltos hoy: <strong>${s}</strong> · Fallados: ${f}`,
        dailyTitle: (d) => `Puzle del día · ${d}`,
        dailyDone: 'Ya has hecho el puzle de hoy. Vuelve mañana a por otro.',
        rating: 'tu rating',
        hintFor: { fork: 'hay una jugada que ataca dos piezas a la vez.', pin: 'una de las piezas no se puede mover sin dejar otra al descubierto.', mate: 'hay un jaque mate.', hangingPiece: 'hay una pieza que puedes ganar.', sacrifice: 'entregar material puede compensar.', default: 'mira todos los jaques y todas las capturas.' },
    },
};

// Lichess puzzle themes worth naming, most specific first. Phase, length and
// evaluation tags (opening, short, crushing…) are left out on purpose.
const THEMES = [
    ['smotheredMate', 'Smothered mate', 'Mate de la coz'], ['backRankMate', 'Back-rank mate', 'Mate del pasillo'],
    ['anastasiaMate', 'Anastasia\'s mate', 'Mate de Anastasia'], ['arabianMate', 'Arabian mate', 'Mate árabe'],
    ['bodenMate', 'Boden\'s mate', 'Mate de Boden'], ['doubleBishopMate', 'Two-bishop mate', 'Mate de los dos alfiles'],
    ['hookMate', 'Hook mate', 'Mate del gancho'], ['dovetailMate', 'Dovetail mate', 'Mate de la cola de golondrina'],
    ['mateIn1', 'Mate in 1', 'Mate en 1'], ['mateIn2', 'Mate in 2', 'Mate en 2'], ['mateIn3', 'Mate in 3', 'Mate en 3'],
    ['mateIn4', 'Mate in 4', 'Mate en 4'], ['mateIn5', 'Mate in 5 or more', 'Mate en 5 o más'],
    ['fork', 'Fork', 'Horquilla'], ['pin', 'Pin', 'Clavada'], ['skewer', 'Skewer', 'Enfilada'],
    ['discoveredAttack', 'Discovered attack', 'Ataque a la descubierta'], ['doubleCheck', 'Double check', 'Jaque doble'],
    ['deflection', 'Deflection', 'Desviación'], ['attraction', 'Attraction', 'Atracción'], ['clearance', 'Clearance', 'Despeje'],
    ['interference', 'Interference', 'Interferencia'], ['intermezzo', 'In-between move', 'Jugada intermedia'],
    ['xRayAttack', 'X-ray attack', 'Ataque de rayos X'], ['zugzwang', 'Zugzwang', 'Zugzwang'],
    ['capturingDefender', 'Remove the defender', 'Eliminar al defensor'], ['trappedPiece', 'Trapped piece', 'Pieza atrapada'],
    ['hangingPiece', 'Hanging piece', 'Pieza colgada'], ['sacrifice', 'Sacrifice', 'Sacrificio'],
    ['underPromotion', 'Underpromotion', 'Subpromoción'], ['promotion', 'Promotion', 'Promoción'],
    ['advancedPawn', 'Advanced pawn', 'Peón avanzado'], ['enPassant', 'En passant', 'Captura al paso'],
    ['quietMove', 'Quiet move', 'Jugada tranquila'], ['defensiveMove', 'Defensive move', 'Jugada defensiva'],
    ['exposedKing', 'Exposed king', 'Rey expuesto'], ['kingsideAttack', 'Kingside attack', 'Ataque en el flanco de rey'],
    ['queensideAttack', 'Queenside attack', 'Ataque en el flanco de dama'], ['mate', 'Checkmate', 'Jaque mate'],
];

export const t = TEXT[LANG];

export function themeNames(themes, max = 2) {
    const col = LANG === 'es' ? 2 : 1;
    return THEMES.filter((row) => themes.includes(row[0])).slice(0, max).map((row) => row[col]);
}

// SAN in the page's language: Spanish uses R D T A C for K Q R B N.
const ES_PIECES = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
export function sanForSpeech(san) {
    return LANG === 'es' ? san.replace(/[KQRBN]/g, (m) => ES_PIECES[m]) : san;
}

export function softHint(themes) {
    const key = ['fork', 'pin', 'hangingPiece', 'sacrifice'].find((k) => themes.includes(k))
        ?? (themes.some((k) => k.startsWith('mate')) ? 'mate' : 'default');
    return t.hintFor[key];
}
