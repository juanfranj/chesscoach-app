/* CheesCoach landing — navbar state and the mobile menu.

   Only index.html loads this file; every other page carries its own inline
   copy of the same two behaviours plus a scroll reveal. The landing's hero
   entrance is pure CSS, so it survives a slow or blocked script, and nothing
   else on the page animates on scroll. */
(function () {
    'use strict';

    // --- Navbar background once the hero is behind you ---
    var navbar = document.querySelector('.navbar');
    if (navbar) {
        var onScroll = function () {
            navbar.classList.toggle('scrolled', window.scrollY > 24);
        };
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
            // Without this the page scrolls behind the open menu.
            document.body.style.overflow = open ? 'hidden' : '';
        };
        hamburger.addEventListener('click', function () {
            setMenu(!navLinks.classList.contains('open'));
        });
        navLinks.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () { setMenu(false); });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && navLinks.classList.contains('open')) {
                setMenu(false);
                hamburger.focus();
            }
        });
    }
})();
