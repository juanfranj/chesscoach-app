// The website's chess board: a grid of real buttons (tab, arrows and Enter work), Staunty
// pieces from one sprite, click-click or drag to move, and an SVG layer for arrows. It
// knows nothing about the rules: the page passes legalDests() and gets onMove() back.
import { squareAt, indexOf, isPromotion } from './geometry.js';

const SPRITE = '/images/pieces/staunty.svg';
const NAMES = { en: { w: 'white', b: 'black', p: 'pawn', n: 'knight', b_: 'bishop', r: 'rook', q: 'queen', k: 'king', empty: 'empty' },
                es: { w: 'blanco', b: 'negro', p: 'peón', n: 'caballo', b_: 'alfil', r: 'torre', q: 'dama', k: 'rey', empty: 'vacía' } };
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

    el.classList.add('cb-board');
    el.setAttribute('role', 'grid');
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
        return lang === 'es' ? `${square}, ${type} ${piece.color === 'w' ? 'blanco' : 'negro'}`
                             : `${square}, ${words[piece.color]} ${type}`;
    }

    function render() {
        const dests = selected && options.legalDests ? options.legalDests(selected) : [];
        cells.forEach((cell, i) => {
            const sq = squareAt(i, orientation);
            const piece = pieces[sq];
            const kinds = marks.get(sq) || new Set();
            const fileIdx = 'abcdefgh'.indexOf(sq[0]);
            cell.className = 'cb-sq' + ((fileIdx + Number(sq[1])) % 2 === 1 ? ' d' : '')
                + (lastMove && lastMove.includes(sq) ? ' last' : '')
                + (sq === selected ? ' selected' : '')
                + [...kinds].map((k) => ' ' + k).join('')
                + (dests.includes(sq) ? (piece ? ' dest capture' : ' dest') : '');
            const bottom = i >= 56;
            const left = i % 8 === 0;
            cell.innerHTML = (piece ? pieceSvg(piece) : '')
                + (left ? `<span class="cb-coord r" aria-hidden="true">${sq[1]}</span>` : '')
                + (bottom ? `<span class="cb-coord f" aria-hidden="true">${sq[0]}</span>` : '');
            cell.setAttribute('aria-label', describe(sq, piece));
            cell.dataset.square = sq;
        });
    }

    async function attempt(from, to) {
        const piece = pieces[from];
        selected = null;
        let promotion;
        if (isPromotion(piece, to)) {
            promotion = await askPromotion(piece.color);
            if (!promotion) { render(); return; }
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

    let drag = null;
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
        if (ok) attempt(d.from, target);
        else { selected = null; render(); }
    });
    el.addEventListener('pointercancel', () => {
        if (drag) { drag.ghost.remove(); drag = null; el.classList.remove('cb-dragging'); selected = null; render(); }
    });

    function askPromotion(color) {
        return new Promise((resolve) => {
            const box = document.createElement('div');
            box.className = 'cb-promo';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-label', lang === 'es' ? 'Elige la pieza de la promoción' : 'Choose the promotion piece');
            for (const type of ['q', 'r', 'b', 'n']) {
                const b = document.createElement('button');
                b.type = 'button';
                b.setAttribute('aria-label', type === 'b' ? words.b_ : words[type]);
                b.innerHTML = pieceSvg({ color, type });
                b.addEventListener('click', (e) => { e.stopPropagation(); box.remove(); resolve(type); });
                box.appendChild(b);
            }
            const cancel = (e) => { if (e.key === 'Escape') { box.remove(); document.removeEventListener('keydown', cancel); resolve(null); } };
            document.addEventListener('keydown', cancel);
            el.appendChild(box);
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
        setPosition(fen, move) { pieces = parseFen(fen); lastMove = move || null; selected = null; render(); },
        setOrientation(o) { orientation = o; render(); drawArrows(); },
        get orientation() { return orientation; },
        setInteractive(on) { interactive = on; if (!on) selected = null; render(); },
        mark(squares, kind) { for (const s of squares) { if (!marks.has(s)) marks.set(s, new Set()); marks.get(s).add(kind); } render(); },
        clearMarks() { marks.clear(); arrows = []; drawArrows(); render(); },
        arrow(from, to, kind) { arrows.push({ from, to, kind }); drawArrows(); },
        askPromotion,
    };
}
