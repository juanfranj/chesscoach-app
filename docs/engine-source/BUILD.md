# Stockfish.js 19.0.1 (lite, single-threaded) — corresponding source

The play page of chesscoach-app.com runs `js/engine/stockfish-19-lite-single.js` and
`js/engine/stockfish-19-lite-single.wasm`, taken **unmodified** from the npm package
`stockfish@19.0.1` (https://github.com/nmrugg/stockfish.js, GPL-3.0). Stockfish itself is
© the Stockfish developers (https://github.com/official-stockfish/Stockfish).

This folder is the complete corresponding source for those two files, as the GPLv3 (§6) asks:

| File | What it is |
|---|---|
| `stockfish.js-19.0.1-src.tar.gz` | The source of the tag `v19.0.1` of nmrugg/stockfish.js (https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1) |
| `nn-61e7af4bb97d.nnue` | The neural network the lite build embeds (`EvalFileLiteName` in `src/evaluate.h`); the tag does not include it. Also at https://data.stockfishchess.org/nn/nn-61e7af4bb97d.nnue |
| `Copying.txt` | The GNU General Public License v3 |

## How to rebuild the same files

1. Install emscripten **6.0.9** (https://emscripten.org/docs/getting_started/downloads.html).
2. Unpack the tarball and put `nn-61e7af4bb97d.nnue` in its `src/` folder.
3. In the unpacked folder: `npm run build-single-lite` (or `./build.js --help` for every option).
4. The built `stockfish-19-lite-single.js` and `.wasm` are written to `src/`.

The rest of the play page (board, rules, opponents, review) is separate code that talks to the
engine only through UCI messages to a Web Worker; it is not part of Stockfish.
