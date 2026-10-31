/* Chess Coach — home page behaviour (2026-11 redesign).

   Everything here is an enhancement: without JavaScript the page is complete
   (the hero board is simply empty and the clips show their posters). */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // --- Navbar background once the hero is behind you ---
    var navbar = document.querySelector('.navbar');
    if (navbar) {
        var onScroll = function () { navbar.classList.toggle('scrolled', window.scrollY > 24); };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // --- Mobile menu ---
    var hamburger = document.getElementById('hamburger');
    var navLinks = document.getElementById('nav-links');
    if (hamburger && navLinks) {
        var setMenu = function (open) {
            navLinks.classList.toggle('open', open);
            hamburger.classList.toggle('open', open);
            hamburger.setAttribute('aria-expanded', String(open));
            document.body.style.overflow = open ? 'hidden' : '';
        };
        hamburger.addEventListener('click', function () { setMenu(!navLinks.classList.contains('open')); });
        navLinks.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && navLinks.classList.contains('open')) { setMenu(false); hamburger.focus(); }
        });
    }

    var hasIO = 'IntersectionObserver' in window;

    // --- Reveal on scroll ---
    var reveals = document.querySelectorAll('.h-reveal');
    if (hasIO && !reduceMotion) {
        var revealIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        reveals.forEach(function (el) { revealIO.observe(el); });
    } else {
        reveals.forEach(function (el) { el.classList.add('in'); });
    }

    // --- Looping app clips: play only while on screen ---
    var loops = document.querySelectorAll('video.h-loop');
    if (hasIO && !reduceMotion) {
        var loopIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                var v = en.target;
                if (en.isIntersecting) {
                    var p = v.play();
                    if (p && p.catch) p.catch(function () {});
                } else {
                    v.pause();
                }
            });
        }, { threshold: 0.35 });
        loops.forEach(function (v) { loopIO.observe(v); });
    }

    // --- Rivals mosaic: one face picked at a time ---
    var mosaic = document.getElementById('mosaic');
    if (mosaic && !reduceMotion) {
        var faces = mosaic.querySelectorAll('figure');
        var order = [11, 2, 17, 6, 14, 0, 9, 19, 4, 12, 7, 16, 1, 10, 18, 5, 13, 3, 15, 8];
        var k = 0;
        setInterval(function () {
            if (document.hidden) return;
            faces.forEach(function (f) { f.classList.remove('pick'); });
            var f = faces[order[k % order.length] % faces.length];
            if (f) f.classList.add('pick');
            k++;
        }, 1700);
    }

    // --- Tour video dialog ---
    var dialog = document.getElementById('tour');
    var openBtn = document.getElementById('tour-open');
    var closeBtn = document.getElementById('tour-close');
    if (dialog && openBtn) {
        var tourVideo = dialog.querySelector('video');
        var closeTour = function () {
            if (tourVideo) tourVideo.pause();
            if (dialog.open) { if (dialog.close) dialog.close(); else dialog.removeAttribute('open'); }
        };
        openBtn.addEventListener('click', function () {
            if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
            if (tourVideo) { var p = tourVideo.play(); if (p && p.catch) p.catch(function () {}); }
        });
        if (closeBtn) closeBtn.addEventListener('click', closeTour);
        dialog.addEventListener('click', function (e) { if (e.target === dialog) closeTour(); });
        dialog.addEventListener('close', function () { if (tourVideo) tourVideo.pause(); });
    }

    // ============================================================
    // Hero: a short game replays, the blunder is marked and the
    // coach types the explanation. Then it starts over.
    // ============================================================
    var boardEl = document.getElementById('hero-board');
    var card = document.getElementById('hero-card');
    if (!boardEl || !card) return;

    var FILES = 'abcdefgh';
    var START = {
        a1: 'wr', b1: 'wn', c1: 'wb', d1: 'wq', e1: 'wk', f1: 'wb', g1: 'wn', h1: 'wr',
        a2: 'wp', b2: 'wp', c2: 'wp', d2: 'wp', e2: 'wp', f2: 'wp', g2: 'wp', h2: 'wp',
        a7: 'bp', b7: 'bp', c7: 'bp', d7: 'bp', e7: 'bp', f7: 'bp', g7: 'bp', h7: 'bp',
        a8: 'br', b8: 'bn', c8: 'bb', d8: 'bq', e8: 'bk', f8: 'bb', g8: 'bn', h8: 'br'
    };
    // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5??
    var MOVES = [['e2', 'e4'], ['e7', 'e5'], ['g1', 'f3'], ['b8', 'c6'], ['f1', 'c4'], ['g8', 'f6'],
                 ['f3', 'g5'], ['d7', 'd5'], ['e4', 'd5'], ['f6', 'd5']];
    var BEST = ['c6', 'a5'];

    var squares = {};
    for (var r = 8; r >= 1; r--) {
        for (var f = 0; f < 8; f++) {
            var name = FILES[f] + r;
            var sq = document.createElement('div');
            sq.className = 'sq' + ((f + r) % 2 === 0 ? ' d' : '');
            if (r === 1) { var cf = document.createElement('span'); cf.className = 'coord f'; cf.textContent = FILES[f]; sq.appendChild(cf); }
            if (f === 0) { var cr = document.createElement('span'); cr.className = 'coord r'; cr.textContent = r; sq.appendChild(cr); }
            boardEl.appendChild(sq);
            squares[name] = sq;
        }
    }
    var layer = document.createElement('div');
    layer.className = 'h-pieces';
    boardEl.appendChild(layer);

    var badge = document.createElement('div');
    badge.className = 'h-badge';
    badge.innerHTML = '<i>??</i>';
    layer.appendChild(badge);

    var NS = 'http://www.w3.org/2000/svg';
    var arrow = document.createElementNS(NS, 'svg');
    arrow.setAttribute('viewBox', '0 0 8 8');
    arrow.setAttribute('class', 'h-arrow');
    arrow.innerHTML = '<defs><marker id="h-ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">' +
        '<path d="M0,0 L10,5 L0,10 z" fill="rgba(127,199,133,.95)"/></marker></defs>' +
        '<line x1="2.5" y1="2.5" x2="0.78" y2="3.36" stroke="rgba(127,199,133,.95)" stroke-width=".22" stroke-linecap="round" marker-end="url(#h-ah)"/>';
    layer.appendChild(arrow);

    function xy(name) { return [FILES.indexOf(name[0]), 8 - parseInt(name[1], 10)]; }
    function place(el, name) { var p = xy(name); el.style.transform = 'translate(' + (p[0] * 100) + '%,' + (p[1] * 100) + '%)'; }

    var pieces = {};
    function setup() {
        layer.querySelectorAll('.h-piece').forEach(function (p) { p.remove(); });
        pieces = {};
        Object.keys(START).forEach(function (s) {
            var el = document.createElement('div');
            el.className = 'h-piece';
            el.innerHTML = '<svg viewBox="0 0 50 50"><use href="#p-' + START[s] + '"></use></svg>';
            place(el, s);
            layer.insertBefore(el, badge);
            pieces[s] = el;
        });
        Object.keys(squares).forEach(function (s) { squares[s].classList.remove('hl', 'bad'); });
        badge.classList.remove('on');
        arrow.classList.remove('on');
        card.classList.remove('is-blunder');
        moveLabel.innerHTML = '&nbsp;';
        sayEl.textContent = '';
        fixEl.textContent = '';
    }

    function move(from, to) {
        var el = pieces[from];
        if (!el) return;
        var victim = pieces[to];
        if (victim) { victim.classList.add('gone'); setTimeout(function () { victim.remove(); }, 300); }
        place(el, to);
        delete pieces[from];
        pieces[to] = el;
        Object.keys(squares).forEach(function (s) { squares[s].classList.remove('hl'); });
        squares[from].classList.add('hl');
        squares[to].classList.add('hl');
    }

    var moveLabel = document.getElementById('hero-move');
    var sayEl = document.getElementById('hero-say');
    var fixEl = document.getElementById('hero-fix');
    var txt = function (id) { var e = document.getElementById(id); return e ? e.textContent.trim() : ''; };
    var SAY = txt('script-say'), FIX = txt('script-fix'), MOVE = txt('script-move');

    function showBlunder() {
        squares.d5.classList.remove('hl');
        squares.d5.classList.add('bad');
        place(badge, 'd5');
        badge.classList.add('on');
        card.classList.add('is-blunder');
        moveLabel.innerHTML = '';
        moveLabel.appendChild(document.createTextNode(MOVE + ' '));
        var q = document.createElement('span'); q.className = 'q'; q.textContent = '??';
        moveLabel.appendChild(q);
    }

    function finalState() {
        setup();
        MOVES.forEach(function (m) { move(m[0], m[1]); });
        showBlunder();
        arrow.classList.add('on');
        sayEl.textContent = SAY;
        fixEl.textContent = FIX;
    }

    setup();
    if (reduceMotion) { finalState(); return; }

    // A small scheduler that can be paused while the hero is off screen.
    var timers = [];
    var running = false;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    function stop() { timers.forEach(clearTimeout); timers = []; running = false; }

    function type(el, text, speed, done) {
        var caret = document.createElement('span'); caret.className = 'h-caret';
        var i = 0;
        el.textContent = '';
        el.appendChild(caret);
        (function step() {
            if (i >= text.length) { caret.remove(); if (done) done(); return; }
            // Type a word fragment at a time so long sentences don't drag.
            var n = Math.min(text.length - i, text.charAt(i) === ' ' ? 1 : 2);
            caret.insertAdjacentText('beforebegin', text.substr(i, n));
            i += n;
            later(step, speed);
        })();
    }

    function cycle() {
        running = true;
        setup();
        var t = 700;
        MOVES.forEach(function (m) {
            later(function () { move(m[0], m[1]); }, t);
            t += 620;
        });
        later(showBlunder, t + 150);
        later(function () {
            type(sayEl, SAY, 34, function () {
                later(function () {
                    arrow.classList.add('on');
                    type(fixEl, FIX, 34, function () { later(cycle, 6500); });
                }, 450);
            });
        }, t + 900);
    }

    if (hasIO) {
        new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting && !running) cycle();
                else if (!en.isIntersecting && running) { stop(); finalState(); }
            });
        }, { threshold: 0.25 }).observe(card);
    } else {
        cycle();
    }
})();
