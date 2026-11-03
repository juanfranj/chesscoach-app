// Square maths shared by the board and its tests. Index 0 is the top-left square on screen.
const FILES = 'abcdefgh';

export function squareAt(index, orientation) {
    const row = Math.floor(index / 8);
    const col = index % 8;
    return orientation === 'w' ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1);
}

export function indexOf(square, orientation) {
    const col = FILES.indexOf(square[0]);
    const rank = Number(square[1]);
    return orientation === 'w' ? (8 - rank) * 8 + col : (rank - 1) * 8 + (7 - col);
}

export function isPromotion(piece, to) {
    return !!piece && piece.type === 'p' && to[1] === (piece.color === 'w' ? '8' : '1');
}
