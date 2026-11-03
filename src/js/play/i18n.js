// Words the play page writes from JS, in the page's language (<html lang>).
export const LANG = document.documentElement.lang === 'es' ? 'es' : 'en';

const TEXT = {
    en: {
        levels: { beginner: 'Beginner', casual: 'Casual', club: 'Club', strong: 'Strong', expert: 'Expert' },
        bios: {
            beto: 'Just learned how the pieces move. Attacks everything in sight.',
            ana: 'Plays on Sundays and knows the basic openings.',
            diego: 'Goes to the club on Thursdays. Punishes careless moves.',
            hugo: 'Calculates well and gives nothing away in the endgame.',
            javier: 'Plays tournaments. You will have to work to beat him.',
        },
        lines: {
            beto: 'Hi! I just learned how the knight moves.', ana: 'Fancy a quiet game?', diego: 'Let\'s see how you handle the Italian.',
            hugo: 'We will reach the endgame, you will see.', javier: 'Get ready, I do not forgive.',
        },
        gameTitle: (n) => `Game against ${n}`,
        playAgainst: (n) => `Play ${n}`,
        loadingEngine: 'Loading the engine…',
        engineError: 'The engine could not start in this browser. You can still train with the <a href="/chess-puzzles.html">chess puzzles</a>.',
        you: 'You',
        colors: { w: 'white', b: 'black' },
        yourMove: 'Your move',
        botPlayed: (n, san) => `${n} played ${san}. Your move.`,
        thinking: 'Thinking…',
        resignConfirm: 'Resign this game?',
        yes: 'Resign', no: 'Keep playing',
        results: {
            win: 'You won!', loss: 'You lost', draw: 'Draw',
            byMate: 'by checkmate', byResign: (n) => `${n} resigned`, youResigned: 'you resigned',
            stalemate: 'stalemate', repetition: 'threefold repetition', fifty: '50-move rule', material: 'insufficient material',
        },
        moves: (n) => `${n} moves`,
        reviewing: (p) => `Reviewing your game… ${p}%`,
        accuracy: 'Accuracy',
        noMoments: 'No mistakes worth showing. Clean game!',
        grades: { blunder: 'Blunder', mistake: 'Mistake', inaccuracy: 'Inaccuracy' },
        bestWas: (m) => `Best was ${m}`,
        legendPlayed: 'your move', legendBest: 'the best',
        hintText: (from) => `Hint: move the piece on ${from}. In the app, your coach explains why.`,
        pgnName: 'chess-coach-game.pgn',
        say: {
            start: ['Good luck!', 'Let\'s play.', 'Ready when you are.'],
            check: ['Check!', 'Watch your king.'],
            capture: ['Thanks for that.', 'Mine now.'],
            lost: ['Well played.', 'You got me this time.'],
            won: ['Good game!', 'Better luck next time.'],
            resign: ['I resign. Well played.'],
            draw: ['A draw. Well defended.', 'Shared points this time.'],
        },
    },
    es: {
        levels: { beginner: 'Principiante', casual: 'Casual', club: 'Club', strong: 'Fuerte', expert: 'Experto' },
        bios: {
            beto: 'Acaba de aprender cómo se mueven las piezas. Ataca todo lo que ve.',
            ana: 'Juega los domingos y conoce las aperturas básicas.',
            diego: 'Va al club los jueves. Castiga los descuidos.',
            hugo: 'Calcula bien y no regala nada en el final.',
            javier: 'Juega torneos. Para ganarle vas a tener que sudar.',
        },
        lines: {
            beto: '¡Hola! Acabo de aprender a mover el caballo.', ana: '¿Una partidita tranquila?', diego: 'A ver qué tal se te da la Italiana.',
            hugo: 'Llegaremos al final, ya verás.', javier: 'Prepárate, que no perdono.',
        },
        gameTitle: (n) => `Partida contra ${n}`,
        playAgainst: (n) => `Jugar contra ${n}`,
        loadingEngine: 'Cargando a tu rival…',
        engineError: 'El motor no ha podido arrancar en este navegador. Puedes entrenar con los <a href="/es/puzzles-de-ajedrez.html">puzles de ajedrez</a>.',
        you: 'Tú',
        colors: { w: 'blancas', b: 'negras' },
        yourMove: 'Te toca mover',
        botPlayed: (n, san) => `${n} jugó ${san}. Te toca mover.`,
        thinking: 'Pensando…',
        resignConfirm: '¿Abandonas la partida?',
        yes: 'Abandonar', no: 'Seguir jugando',
        results: {
            win: '¡Has ganado!', loss: 'Has perdido', draw: 'Tablas',
            byMate: 'por jaque mate', byResign: (n) => `${n} abandona`, youResigned: 'has abandonado',
            stalemate: 'por ahogado', repetition: 'por triple repetición', fifty: 'por la regla de las 50 jugadas', material: 'por material insuficiente',
        },
        moves: (n) => `${n} jugadas`,
        reviewing: (p) => `Repasando tu partida… ${p} %`,
        accuracy: 'Precisión',
        noMoments: 'Ningún error que destacar. ¡Partida limpia!',
        grades: { blunder: 'Error grave', mistake: 'Error', inaccuracy: 'Imprecisión' },
        bestWas: (m) => `Lo mejor era ${m}`,
        legendPlayed: 'tu jugada', legendBest: 'la mejor',
        hintText: (from) => `Pista: mueve la pieza de ${from}. En la app, tu coach te explica por qué.`,
        pgnName: 'partida-chess-coach.pgn',
        say: {
            start: ['¡Suerte!', 'Vamos allá.', 'Cuando quieras.'],
            check: ['¡Jaque!', 'Cuidado con tu rey.'],
            capture: ['Gracias por eso.', 'Esta me la quedo.'],
            lost: ['Bien jugado.', 'Esta vez me has ganado.'],
            won: ['¡Buena partida!', 'A la próxima.'],
            resign: ['Abandono. Bien jugado.'],
            draw: ['Tablas. Bien defendido.', 'Esta vez, a medias.'],
        },
    },
};

export const t = TEXT[LANG];

// SAN in the page's language: Spanish uses R D T A C for K Q R B N.
const ES_PIECES = { K: 'R', Q: 'D', R: 'T', B: 'A', N: 'C' };
export function localSan(san) {
    return LANG === 'es' ? san.replace(/[KQRBN]/g, (m) => ES_PIECES[m]) : san;
}

export function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}
