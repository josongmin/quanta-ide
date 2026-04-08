/**
 * scenes.js — GSAP pin+scrub scroll scenes
 * Simple, bulletproof flex-column layout — no CSS grid conflicts.
 */
(function () {
  'use strict';

  // DISABLED — scroll scenes temporarily off
  return;

  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
    console.warn('scenes.js: GSAP/ScrollTrigger not loaded — showing everything.');
    document.querySelectorAll(
      '.conn-line,.conn-pulse,' +
      '.net-eyebrow,.net-headline,.net-body,' +
      '.code-window,.code-line,' +
      '.insight-chip,.insight-copy-h,.insight-copy-p,' +
      '.diff-eyebrow,.diff-headline,.diff-sub,.diff-window,' +
      '.diff-row,.diff-hunk'
    ).forEach(function (el) {
      el.style.opacity = '1';
      el.style.transform = 'none';
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ═══════════════════════════════════════════════════════════════════════════
     SCENE 1 — FILE NETWORK
     Nodes fly in → edges draw → text rises
     ═══════════════════════════════════════════════════════════════════════════ */
  (function initScene1() {
    var scene = document.getElementById('scene-network');
    if (!scene) return;

    var nodes    = Array.from(scene.querySelectorAll('.file-node'));
    var lines    = Array.from(scene.querySelectorAll('.conn-line'));
    var pulses   = Array.from(scene.querySelectorAll('.conn-pulse'));
    var eyebrow  = scene.querySelector('.net-eyebrow');
    var headline = scene.querySelector('.net-headline');
    var body     = scene.querySelector('.net-body');

    if (reduced) {
      nodes.forEach(function (n) { gsap.set(n, { opacity: 1, x: 0, y: 0 }); });
      lines.forEach(function (l) {
        gsap.set(l, { opacity: 1, strokeDashoffset: 0 });
        l.classList.add('is-lit');
      });
      pulses.forEach(function (p) { gsap.set(p, { opacity: 1 }); });
      [eyebrow, headline, body].forEach(function (el) {
        if (el) gsap.set(el, { opacity: 1, y: 0 });
      });
      return;
    }

    /* set initial states */
    var scatter = [
      { x: -200, y: -140, r: -12 },
      { x:  180, y: -110, r:  10 },
      { x: -220, y:   55, r:  -8 },
      { x:  190, y:   95, r:  11 },
      { x:   15, y:  180, r:  -5 },
      { x:  -80, y: -190, r:  15 },
    ];
    nodes.forEach(function (n, i) {
      var d = scatter[i % scatter.length];
      gsap.set(n, { opacity: 0, x: d.x, y: d.y, rotation: d.r });
    });
    gsap.set(lines,  { opacity: 0, strokeDashoffset: 600 });
    gsap.set(pulses, { opacity: 0 });
    if (eyebrow)  gsap.set(eyebrow,  { opacity: 0 });
    if (headline) gsap.set(headline, { opacity: 0, y: 16 });
    if (body)     gsap.set(body,     { opacity: 0, y: 10 });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: scene,
        start: 'top top',
        end: '+=280%',
        pin: true,
        scrub: 1.5,
        anticipatePin: 1,
      },
    });

    /* 0.00–0.24 : nodes converge */
    tl.to(nodes, {
      opacity: 1, x: 0, y: 0, rotation: 0,
      duration: 0.24, stagger: 0.025, ease: 'power3.out',
    }, 0);

    /* 0.26–0.44 : edges draw in */
    tl.to(lines, {
      opacity: 1, strokeDashoffset: 0,
      duration: 0.16, stagger: 0.03, ease: 'none',
    }, 0.26);

    /* 0.42 : edges light up */
    tl.add(function () {
      lines.forEach(function (l) { l.classList.add('is-lit'); });
    }, 0.42);

    /* 0.44–0.58 : pulses appear */
    tl.to(pulses, { opacity: 1, duration: 0.04, stagger: 0.05 }, 0.44);

    /* 0.58–0.75 : text block rises */
    if (eyebrow)  tl.to(eyebrow,  { opacity: 1, duration: 0.10, ease: 'power2.out' }, 0.58);
    if (headline) tl.to(headline, { opacity: 1, y: 0, duration: 0.13, ease: 'power2.out' }, 0.64);
    if (body)     tl.to(body,     { opacity: 1, y: 0, duration: 0.11, ease: 'power2.out' }, 0.72);
  })();


  /* ═══════════════════════════════════════════════════════════════════════════
     SCENE 2 — CODE + INSIGHT
     Window fades in → lines reveal → scan sweeps → chips pop → copy rises
     ═══════════════════════════════════════════════════════════════════════════ */
  (function initScene2() {
    var scene   = document.getElementById('scene-code');
    if (!scene) return;

    var win     = scene.querySelector('.code-window');
    var lines   = Array.from(scene.querySelectorAll('.code-line'));
    var scanBar = scene.querySelector('.code-scan-bar');
    var chips   = Array.from(scene.querySelectorAll('.insight-chip'));
    var copyH   = scene.querySelector('.insight-copy-h');
    var copyP   = scene.querySelector('.insight-copy-p');

    if (reduced) {
      if (win) gsap.set(win, { opacity: 1, y: 0, scale: 1 });
      lines.forEach(function (l) { gsap.set(l, { opacity: 1 }); });
      chips.forEach(function (c) { gsap.set(c, { opacity: 1, y: 0 }); });
      if (copyH) gsap.set(copyH, { opacity: 1, y: 0 });
      if (copyP) gsap.set(copyP, { opacity: 1, y: 0 });
      return;
    }

    /* initial states already set via CSS; reinforce them here for safety */
    if (win) gsap.set(win, { opacity: 0, y: 24, scale: 0.97 });
    lines.forEach(function (l) { gsap.set(l, { opacity: 0 }); });
    if (scanBar) gsap.set(scanBar, { opacity: 0, top: 0 });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: scene,
        start: 'top top',
        end: '+=280%',
        pin: true,
        scrub: 1.4,
        anticipatePin: 1,
      },
    });

    /* 0.00–0.12 : window appears */
    if (win) tl.to(win, { opacity: 1, y: 0, scale: 1, duration: 0.12, ease: 'power2.out' }, 0);

    /* 0.10–0.46 : lines reveal one by one */
    tl.to(lines, { opacity: 1, duration: 0.025, stagger: 0.024, ease: 'none' }, 0.10);

    /* 0.47–0.49 : scan bar fades in */
    if (scanBar) tl.to(scanBar, { opacity: 1, duration: 0.02 }, 0.47);

    /* 0.49–0.78 : scan bar sweeps top to bottom */
    if (scanBar && lines.length) {
      tl.to({}, {
        duration: 0.29,
        ease: 'none',
        onUpdate: function () {
          var prog = this.progress();
          var bodyEl = scene.querySelector('.code-body');
          if (!bodyEl || !lines[0]) return;
          var lineH = lines[0].getBoundingClientRect().height;
          var idx   = Math.min(Math.floor(prog * lines.length), lines.length - 1);
          gsap.set(scanBar, { top: idx * lineH });
          lines.forEach(function (l, i) {
            l.style.opacity = i === idx ? '1' : i < idx ? '0.55' : '0.18';
          });
        },
      }, 0.49);
    }

    /* 0.79 : scan bar off, restore lines */
    if (scanBar) tl.to(scanBar, { opacity: 0, duration: 0.02 }, 0.79);
    tl.to(lines, { opacity: 1, duration: 0.04 }, 0.81);

    /* 0.78–0.90 : chips pop in */
    tl.to(chips, {
      opacity: 1, y: 0,
      duration: 0.035, stagger: 0.045, ease: 'back.out(1.4)',
    }, 0.78);

    /* 0.87–0.97 : copy text */
    if (copyH) tl.to(copyH, { opacity: 1, y: 0, duration: 0.10, ease: 'power2.out' }, 0.87);
    if (copyP) tl.to(copyP, { opacity: 1, y: 0, duration: 0.10, ease: 'power2.out' }, 0.91);
  })();


  /* ═══════════════════════════════════════════════════════════════════════════
     SCENE 3 — DIFF VIEW
     Text fades → diff window rises → rows cascade in → add-rows glow
     ═══════════════════════════════════════════════════════════════════════════ */
  (function initScene3() {
    var scene   = document.getElementById('scene-compare');
    if (!scene) return;

    var eyebrow = scene.querySelector('.diff-eyebrow');
    var hl      = scene.querySelector('.diff-headline');
    var sub     = scene.querySelector('.diff-sub');
    var win     = scene.querySelector('.diff-window');
    var allRows = Array.from(scene.querySelectorAll('.diff-hunk, .diff-row'));

    if (reduced) {
      [eyebrow, hl, sub, win].forEach(function (el) {
        if (el) gsap.set(el, { opacity: 1, y: 0 });
      });
      allRows.forEach(function (r) { gsap.set(r, { opacity: 1 }); });
      return;
    }

    /* initial states (CSS already sets these; belt-and-suspenders) */
    if (eyebrow) gsap.set(eyebrow, { opacity: 0, y: 12 });
    if (hl)      gsap.set(hl,      { opacity: 0, y: 14 });
    if (sub)     gsap.set(sub,     { opacity: 0, y: 8  });
    if (win)     gsap.set(win,     { opacity: 0, y: 20 });
    allRows.forEach(function (r) { gsap.set(r, { opacity: 0 }); });

    var tl = gsap.timeline({
      scrollTrigger: {
        trigger: scene,
        start: 'top top',
        end: '+=260%',
        pin: true,
        scrub: 1.4,
        anticipatePin: 1,
      },
    });

    /* copy text fades up */
    if (eyebrow) tl.to(eyebrow, { opacity: 1, y: 0, duration: 0.10 }, 0.00);
    if (hl)      tl.to(hl,      { opacity: 1, y: 0, duration: 0.13 }, 0.07);
    if (sub)     tl.to(sub,     { opacity: 1, y: 0, duration: 0.11 }, 0.15);

    /* diff window rises */
    if (win) tl.to(win, { opacity: 1, y: 0, duration: 0.14, ease: 'power3.out' }, 0.22);

    /* rows cascade in */
    tl.to(allRows, { opacity: 1, duration: 0.022, stagger: 0.016, ease: 'none' }, 0.32);

    /* add-rows glow brighter at the end */
    var addRows = Array.from(scene.querySelectorAll('.diff-row.is-add'));
    tl.to(addRows, {
      backgroundColor: 'rgba(134,239,172,0.13)',
      duration: 0.10, stagger: 0.025,
    }, 0.66);
  })();

})();
