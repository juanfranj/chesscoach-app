// The visitor's puzzle rating: plain Elo against the puzzle's own rating, kept in the browser.
const FLOOR = 400;
const LOWEST_BAND = 400;
const HIGHEST_BAND = 2400;

export function updateRating(rating, puzzleRating, solved, k = 32) {
    const expected = 1 / (1 + 10 ** ((puzzleRating - rating) / 400));
    return Math.max(FLOOR, Math.round(rating + k * ((solved ? 1 : 0) - expected)));
}

export function bandFor(rating) {
    return Math.min(HIGHEST_BAND, Math.max(LOWEST_BAND, Math.floor(rating / 200) * 200));
}
