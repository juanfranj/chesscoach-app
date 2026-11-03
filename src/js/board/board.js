// The website's chess board: a grid of real buttons (tab, arrows and Enter work), Staunty
// pieces from one sprite, click-click or drag to move, and an SVG layer for arrows. It
// knows nothing about the rules: the page passes legalDests() and gets onMove() back.
import { squareAt, indexOf, isPromotion } from './geometry.js';

const SPRITE = '/images/pieces/staunty.svg';
const NAMES = { en: { w: 'white', b: 'black', p: 'pawn', n: 'knight', b_: 'bishop', r: 'rook', q: 'queen', k: 'king', empty: 'empty', dest: 'can move here', sel: 'selected', cancel: 'Cancel' },
                es: { w: 'blanco', b: 'negro', p: 'peón', n: 'caballo', b_: 'alfil', r: 'torre', q: 'dama', k: 'rey', empty: 'vacía', dest: 'se puede mover aquí', sel: 'seleccionada', cancel: 'Cancelar' } };
const SVG_NS = 'http://www.w3.org/2000/svg';

function parseFen(fen) {
    const pieces = {};
    fen.split(' ')[0].split('/').forEach((row, r) => {
        let f = 0;
        for (const ch of row) {
            if (/\d/.test(ch)) { f += Number(ch); continue; }
            const color = ch === ch.toUpperCase() ? 'w' : 'b';
            pieces['abcdefgh'[f] + (8 - r)] = { color, type: ch.toLowerCase() };
            f += 1;
        }
    });
    return pieces;
}

function pieceSvg(piece) {
    return `<svg viewBox="0 0 50 50" aria-hidden="true"><use href="${SPRITE}#p-${piece.color}${piece.type}"></use></svg>`;
}

export function createBoard(el, options = {}) {
    const lang = document.documentElement.lang === 'es' ? 'es' : 'en';
    const words = NAMES[lang];
    let orientation = options.orientation || 'w';
    let interactive = options.interactive !== false;
    let pieces = {};
    let lastMove = null;
    let selected = null;
    let focusIndex = 0;
    const marks = new Map(); // square -> Set(kind)
    const hidden = new Set(); // squares whose piece is still sliding in
    let ghosts = [];
    let slideTimers = [];
    let drag = null;
    let dropped = null;       // the move the user just dragged: it is already where it lands
    const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const SLIDE_MS = 180;

    el.classList.add('cb-board');
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', lang === 'es' ? 'Tablero' : 'Board');
    const cells = [];
    for (let i = 0; i < 64; i++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cb-sq';
        b.tabIndex = i === 0 ? 0 : -1;
        b.dataset.index = String(i);
        el.appendChild(b);
        cells.push(b);
    }
    const overlay = document.createElementNS(SVG_NS, 'svg');
    overlay.setAttribute('viewBox', '0 0 8 8');
    overlay.setAttribute('class', 'cb-arrows');
    overlay.setAttribute('aria-hidden', 'true');
    el.appendChild(overlay);

    function describe(square, piece) {
        if (!piece) return `${square}, ${words.empty}`;
        const type = piece.type === 'b' ? words.b_ : words[piece.type];
        const feminine = piece.type === 'q' || piece.type === 'r'; // dama, torre
        return lang === 'es' ? `${square}, ${type} ${piece.color === 'w' ? (feminine ? 'blanca' : 'blanco') : (feminine ? 'negra' : 'negro')}`
                             : `${square}, ${words[piece.color]} ${type}`;
    }

    // Which pieces moved between two positions: each new piece is matched with a vanished piece
    // of the same colour and type (castling moves two), or a pawn of its colour (promotion).
    function slides(before, after) {
        const gone = Object.keys(before).filter((sq) => !after[sq] || after[sq].color !== before[sq].color || after[sq].type !== before[sq].type);
        const came = Object.keys(after).filter((sq) => !before[sq] || before[sq].color !== after[sq].color || before[sq].type !== after[sq].type);
        const used = new Set();
        const pairs = [];
        const dist = (a, b) => Math.abs(a.charCodeAt(0) - b.charCodeAt(0)) + Math.abs(a[1] - b[1]);
        for (const to of came) {
            const p = after[to];
            const pickFrom = (ok) => gone.filter((g) => !used.has(g) && ok(before[g])).sort((a, b) => dist(a, to) - dist(b, to))[0];
            const from = pickFrom((q) => q.color === p.color && q.type === p.type) ?? pickFrom((q) => q.color === p.color && q.type === 'p');
            if (from) { used.add(from); pairs.push({ from, to, piece: before[from] }); }
        }
        return pairs;
    }

    function stopSlides() {
        slideTimers.forEach(clearTimeout);
        slideTimers = [];
        ghosts.forEach((g) => g.remove());
        ghosts = [];
        hidden.clear();
    }

    function slide({ from, to, piece }) {
        const a = indexOf(from, orientation), b = indexOf(to, orientation);
        const ghost = document.createElement('div');
        ghost.className = 'cb-slide';
        ghost.style.left = (a % 8) * 12.5 + '%';
        ghost.style.top = Math.floor(a / 8) * 12.5 + '%';
        ghost.innerHTML = pieceSvg(piece);
        el.appendChild(ghost);
        ghosts.push(ghost);
        const dx = (b % 8) - (a % 8), dy = Math.floor(b / 8) - Math.floor(a / 8);
        requestAnimationFrame(() => requestAnimationFrame(() => { ghost.style.transform = `translate(${dx * 100}%, ${dy * 100}%)`; }));
        slideTimers.push(setTimeout(() => {
            ghost.remove();
            ghosts = ghosts.filter((g) => g !== ghost);
            if (hidden.delete(to)) render();
        }, SLIDE_MS + 30));
    }

    function render() {
        const dests = selected && options.legalDests ? options.legalDests(selected) : [];
        cells.forEach((cell, i) => {
            const sq = squareAt(i, orientation);
            const piece = pieces[sq];
            const kinds = marks.get(sq) || new Set();
            const fileIdx = 'abcdefgh'.indexOf(sq[0]);
            cell.className = 'cb-sq' + ((fileIdx + Number(sq[1])) % 2 === 1 ? ' d' : '')
                + (drag && drag.moved && drag.from === sq ? ' lifted' : '')
                + (lastMove && lastMove.includes(sq) ? ' last' : '')
                + (sq === selected ? ' selected' : '')
                + [...kinds].map((k) => ' ' + k).join('')
                + (dests.includes(sq) ? (piece ? ' dest capture' : ' dest') : '');
            const bottom = i >= 56;
            const left = i % 8 === 0;
            cell.innerHTML = (piece && !hidden.has(sq) ? pieceSvg(piece) : '')
                + (left ? `<span class="cb-coord r" aria-hidden="true">${sq[1]}</span>` : '')
                + (bottom ? `<span class="cb-coord f" aria-hidden="true">${sq[0]}</span>` : '');
            const isDest = dests.includes(sq);
            cell.setAttribute('aria-label', describe(sq, piece) + (isDest ? `, ${words.dest}` : ''));
            cell.setAttribute('aria-pressed', String(sq === selected));
            cell.dataset.square = sq;
        });
    }

    async function attempt(from, to) {
        const piece = pieces[from];
        selected = null;
        let promotion;
        if (isPromotion(piece, to)) {
            promotion = await askPromotion(piece.color, to);
            // cancelled, or the position changed while the picker was open
            if (!promotion || pieces[from] !== piece) { dropped = null; render(); return; }
        }
        render();
        options.onMove && options.onMove(from, to, promotion);
    }

    function click(sq) {
        if (!interactive) return;
        const dests = selected && options.legalDests ? options.legalDests(selected) : [];
        if (selected && dests.includes(sq)) { attempt(selected, sq); return; }
        const own = pieces[sq] && options.legalDests && options.legalDests(sq).length > 0;
        selected = own && sq !== selected ? sq : null;
        render();
    }

    // Click, keyboard and drag all end in click() or attempt().
    el.addEventListener('click', (e) => {
        const cell = e.target.closest('.cb-sq');
        if (cell && !el.classList.contains('cb-dragging')) click(cell.dataset.square);
    });
    el.addEventListener('keydown', (e) => {
        const cell = e.target.closest('.cb-sq');
        if (!cell) return;
        const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -8, ArrowDown: 8 }[e.key];
        if (step === undefined) return;
        const next = Number(cell.dataset.index) + step;
        if (next < 0 || next > 63 || (Math.abs(step) === 1 && Math.floor(next / 8) !== Math.floor(Number(cell.dataset.index) / 8))) return;
        e.preventDefault();
        cells[focusIndex].tabIndex = -1;
        focusIndex = next;
        cells[next].tabIndex = 0;
        cells[next].focus();
    });

    el.addEventListener('pointerdown', (e) => {
        const cell = e.target.closest('.cb-sq');
        if (!interactive || !cell || e.button !== 0) return;
        const sq = cell.dataset.square;
        if (!pieces[sq] || !options.legalDests || options.legalDests(sq).length === 0) return;
        const rect = el.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = 'cb-ghost';
        ghost.style.width = ghost.style.height = rect.width / 8 + 'px';
        ghost.innerHTML = pieceSvg(pieces[sq]);
        drag = { from: sq, ghost, startX: e.clientX, startY: e.clientY, moved: false, pointerId: e.pointerId };
    });
    el.addEventListener('pointermove', (e) => {
        if (!drag) return;
        if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 6) return;
        if (!drag.moved) {
            drag.moved = true;
            el.setPointerCapture(drag.pointerId); // only now: capturing earlier would steal the plain click
            selected = drag.from;
            render();
            el.classList.add('cb-dragging');
            el.appendChild(drag.ghost);
            cells[indexOf(drag.from, orientation)].classList.add('lifted');
        }
        const rect = el.getBoundingClientRect();
        const size = rect.width / 8;
        drag.ghost.style.transform = `translate(${e.clientX - rect.left - size / 2}px, ${e.clientY - rect.top - size / 2}px)`;
    });
    el.addEventListener('pointerup', (e) => {
        if (!drag) return;
        const d = drag;
        drag = null;
        if (!d.moved) return; // a plain click: the click handler does the rest
        d.ghost.remove();
        const rect = el.getBoundingClientRect();
        const col = Math.floor((e.clientX - rect.left) / (rect.width / 8));
        const row = Math.floor((e.clientY - rect.top) / (rect.height / 8));
        const target = col >= 0 && col < 8 && row >= 0 && row < 8 ? squareAt(row * 8 + col, orientation) : null;
        const ok = target && options.legalDests(d.from).includes(target);
        setTimeout(() => el.classList.remove('cb-dragging'), 0);
        if (ok) { dropped = d.from + target; attempt(d.from, target); }
        else { selected = null; render(); }
    });
    el.addEventListener('pointercancel', () => {
        if (drag) { drag.ghost.remove(); drag = null; el.classList.remove('cb-dragging'); selected = null; render(); }
    });

    // A modal layer over the board: pick a piece, or tap outside / Escape / Cancel to back out.
    let closePromotion = null;
    function askPromotion(color, to) {
        if (closePromotion) closePromotion(null);
        return new Promise((resolve) => {
            const layer = document.createElement('div');
            layer.className = 'cb-promo-layer';
            const box = document.createElement('div');
            box.className = 'cb-promo';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            box.setAttribute('aria-label', lang === 'es' ? 'Elige la pieza de la promoción' : 'Choose the promotion piece');
            const done = (type) => {
                closePromotion = null;
                document.removeEventListener('keydown', onKey);
                layer.remove();
                if (to) { const c = cells[indexOf(to, orientation)]; cells[focusIndex].tabIndex = -1; focusIndex = indexOf(to, orientation); c.tabIndex = 0; c.focus(); }
                resolve(type);
            };
            const onKey = (e) => { if (e.key === 'Escape') done(null); };
            for (const type of ['q', 'r', 'b', 'n']) {
                const b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('aria-label', type === 'b' ? words.b_ : words[type]);
                b.innerHTML = pieceSvg({ color, type });
                b.addEventListener('click', (e) => { e.stopPropagation(); done(type); });
                box.appendChild(b);
            }
            const cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'cb-promo-cancel';
            cancel.textContent = words.cancel;
            cancel.addEventListener('click', (e) => { e.stopPropagation(); done(null); });
            box.appendChild(cancel);
            layer.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === layer) done(null); });
            layer.addEventListener('pointerdown', (e) => e.stopPropagation());
            document.addEventListener('keydown', onKey);
            layer.appendChild(box);
            el.appendChild(layer);
            closePromotion = done;
            box.querySelector('button').focus();
        });
    }

    function drawArrows() {
        overlay.innerHTML = '';
        for (const a of arrows) {
            const [fx, fy] = center(a.from);
            const [tx, ty] = center(a.to);
            const len = Math.hypot(tx - fx, ty - fy);
            const ux = (tx - fx) / len, uy = (ty - fy) / len;
            const bx = tx - ux * 0.38, by = ty - uy * 0.38; // the head's base
            const head = [[tx - ux * 0.08, ty - uy * 0.08], [bx - uy * 0.22, by + ux * 0.22], [bx + uy * 0.22, by - ux * 0.22]];
            overlay.insertAdjacentHTML('beforeend',
                `<line class="cb-arrow ${a.kind}" x1="${fx}" y1="${fy}" x2="${bx}" y2="${by}"/>`
                + `<polygon class="cb-arrow-head ${a.kind}" points="${head.map((p) => p.join(',')).join(' ')}"/>`);
        }
    }
    function center(sq) {
        const i = indexOf(sq, orientation);
        return [(i % 8) + 0.5, Math.floor(i / 8) + 0.5];
    }
    let arrows = [];

    render();
    return {
        setPosition(fen, move, { animate = true } = {}) {
            if (closePromotion) closePromotion(null);
            stopSlides();
            const next = parseFen(fen);
            const skip = dropped;
            dropped = null;
            const moving = animate && !reduceMotion ? slides(pieces, next).filter((m) => m.from + m.to !== skip) : [];
            pieces = next;
            lastMove = move || null;
            selected = null;
            moving.forEach((m) => hidden.add(m.to));
            render();
            moving.forEach(slide);
        },
        setOrientation(o) { stopSlides(); orientation = o; render(); drawArrows(); },
        get orientation() { return orientation; },
        setInteractive(on) { interactive = on; if (!on) { selected = null; if (closePromotion) closePromotion(null); } render(); },
        mark(squares, kind) { for (const s of squares) { if (!marks.has(s)) marks.set(s, new Set()); marks.get(s).add(kind); } render(); },
        clearMarks() { marks.clear(); arrows = []; drawArrows(); render(); },
        unmark(kind) { for (const set of marks.values()) set.delete(kind); render(); },
        arrow(from, to, kind) { arrows.push({ from, to, kind }); drawArrows(); },
        askPromotion,
        focus() { cells[focusIndex].focus(); },
    };
}
