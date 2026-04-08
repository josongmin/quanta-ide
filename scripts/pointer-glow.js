/**
 * Soft circular gradient that follows the pointer (no custom cursor).
 */
(function () {
  'use strict';

  const el = document.getElementById('pointer-glow');
  if (!el) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (reduceMotion || coarse) {
    el.remove();
    return;
  }

  let aimX = window.innerWidth * 0.5;
  let aimY = window.innerHeight * 0.5;
  let x = aimX;
  let y = aimY;

  function onMove(e) {
    aimX = e.clientX;
    aimY = e.clientY;
  }

  function tick() {
    const k = 0.14;
    x += (aimX - x) * k;
    y += (aimY - y) * k;
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%)';
    requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  requestAnimationFrame(tick);
})();
