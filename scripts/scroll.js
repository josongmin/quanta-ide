/**
 * scroll.js — scroll-driven animations
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ARCHITECTURE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Two layers work together:
 *
 * 1. PASSIVE REVEAL  (IntersectionObserver, always active)
 *    Sections WITHOUT [data-gsap-pin] use CSS transitions defined in
 *    components.css.  When a section enters the viewport, this observer
 *    adds `.is-in-view` and the CSS transition fires.
 *
 * 2. GSAP PIN + SCRUB  (requires GSAP + ScrollTrigger CDN in index.html)
 *    Sections WITH [data-gsap-pin] are pinned while the user scrolls.
 *    The scrub value ties animation progress directly to scroll position —
 *    exactly the Apple "슉샥샥" feel.
 *
 *    To add a new pinned animation:
 *      a. Add data-gsap-pin to the <section> in index.html.
 *      b. Add a block inside initGSAP() below.
 *      c. Use gsap.timeline({ scrollTrigger: { … } }) for sequenced steps.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FALLBACK
 * ─────────────────────────────────────────────────────────────────────────────
 * If GSAP is not loaded (e.g. offline / CDN blocked), the script falls back
 * gracefully to the passive IntersectionObserver reveal for all sections.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  /* Respect user preference */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 1. Passive reveal (IntersectionObserver) ── */
  function initPassiveReveal() {
    const panels = document.querySelectorAll('[data-scroll-panel]:not([data-gsap-pin])');
    if (!panels.length) return;

    if (reducedMotion) {
      panels.forEach((el) => el.classList.add('is-in-view'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('is-in-view');
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.08 }
    );
    panels.forEach((el) => io.observe(el));
  }

  /* ── 2. Hero fade on scroll ── */
  function initHeroFade() {
    const hero = document.querySelector('.hero');
    if (!hero || reducedMotion) return;

    function tick() {
      const t = Math.min(1, (window.scrollY || 0) / 520);
      hero.style.opacity = String(1 - t * 0.28);
    }
    window.addEventListener('scroll', () => requestAnimationFrame(tick), { passive: true });
    tick();
  }

  /* ── 3. GSAP pin + scrub ── */
  function initGSAP() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      /* Fallback: treat pinned panels like regular reveal panels */
      const pinned = document.querySelectorAll('[data-gsap-pin]');
      pinned.forEach((el) => el.classList.add('is-in-view'));
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    /*
     * ── HOW TO ADD A PINNED SCROLL ANIMATION ──────────────────────────────
     *
     * Example — a section that fades/scales its headline while pinned:
     *
     *   const section = document.querySelector('#my-section');
     *   const tl = gsap.timeline({
     *     scrollTrigger: {
     *       trigger: section,
     *       start:   'top top',   // when section top hits viewport top
     *       end:     '+=100%',    // pin for 100vh of scroll distance
     *       pin:     true,        // lock section in place
     *       scrub:   1,           // 1 = smooth 1s lag behind scroll
     *       anticipatePin: 1,
     *     },
     *   });
     *   tl.fromTo(section.querySelector('.scroll-headline'),
     *     { opacity: 0, y: 60 },
     *     { opacity: 1, y: 0, ease: 'none' }
     *   );
     *
     * ──────────────────────────────────────────────────────────────────────
     *
     * Current pinned sections: none yet.
     * Add [data-gsap-pin] to a <section> in index.html, then add a block here.
     */

    const pinnedSections = document.querySelectorAll('[data-gsap-pin]');
    pinnedSections.forEach((section) => {
      /* Default: reveal inner content while pinned — replace with custom tl */
      const inner = section.querySelector('.scroll-panel-inner');
      if (!inner) return;

      gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=80%',
          pin: true,
          scrub: 1,
          anticipatePin: 1,
        },
      })
        .fromTo(inner,
          { opacity: 0, y: 60, filter: 'blur(12px)' },
          { opacity: 1, y: 0,  filter: 'blur(0px)',  ease: 'none' }
        );
    });
  }

  /* ── 4. Prompt card tab toggle + textarea auto-resize ── */
  function initCard() {
    const tabApp  = document.getElementById('tab-app');
    const tabWeb  = document.getElementById('tab-web');
    const textarea = document.querySelector('textarea');
    if (!tabApp || !tabWeb || !textarea) return;

    tabApp.addEventListener('click', () => {
      tabApp.className = 'tab-btn active';
      tabWeb.className = 'tab-btn inactive';
      textarea.placeholder = 'What native mobile app shall we design?';
    });
    tabWeb.addEventListener('click', () => {
      tabWeb.className = 'tab-btn active';
      tabApp.className = 'tab-btn inactive';
      textarea.placeholder = 'What web application shall we design?';
    });

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
  }

  /* ── Boot ── */
  initPassiveReveal();
  initHeroFade();
  initGSAP();
  initCard();
})();
