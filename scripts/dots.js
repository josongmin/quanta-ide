/**
 * dots.js — interactive dot-grid canvas background
 *
 * Behaviour:
 *  - Dense dot grid fills the viewport (fixed canvas).
 *  - Mouse proximity creates a gravity-well ripple: dots are pushed outward.
 *  - When the mouse is idle / leaves the window, the grid transitions to a
 *    slow ambient wave animation (ring + diagonal plane waves).
 *  - Vignette fades dots toward the edges for depth.
 *
 * Tuning constants are grouped at the top for easy tweaking.
 */
(function () {
  'use strict';

  const canvas = document.getElementById('dot-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  /* ── Tuning ── */
  const SPACING        = 14;    // grid cell size (px)
  const RADIUS         = 1200;  // mouse influence radius (px)
  const STRENGTH       = 70;    // max mouse-push displacement (px)
  const DOT_R          = 0.9;   // dot radius (px)
  const BASE_ALPHA     = 0.38;  // base dot opacity
  const BOOST          = 0.7;   // extra brightness near mouse
  const IDLE_MS        = 1600;  // ms before idle wave kicks in
  const IDLE_SMOOTH    = 0.032; // lerp speed toward idle mode

  /* ── State ── */
  let cols, rows, dots;
  let mouse       = { x: 0, y: 0 };
  let targetMouse = { x: 0, y: 0 };
  let lastClient  = { x: 0, y: 0 };
  let lastMoveTime  = performance.now();
  let waveTime      = 0;
  let idleBlend     = 0;
  let pointerInside = true;

  /* ── Grid build ── */
  function buildGrid() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.ceil(canvas.width  / SPACING) + 1;
    rows = Math.ceil(canvas.height / SPACING) + 1;
    dots = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({ bx: c * SPACING, by: r * SPACING });
      }
    }
  }
  buildGrid();

  /* Centre the virtual pointer on load so dots don't snap on first move */
  (function initPointer() {
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    lastClient.x = cx;
    lastClient.y = cy;
    mouse.x = mouse.y = cx;
    targetMouse.x = targetMouse.y = cx;
  })();

  /* ── Listeners ── */
  window.addEventListener('resize', buildGrid);

  window.addEventListener('mousemove', (e) => {
    targetMouse.x = e.clientX;
    targetMouse.y = e.clientY;
    lastClient.x  = e.clientX;
    lastClient.y  = e.clientY;
    lastMoveTime  = performance.now();
  });
  window.addEventListener('mouseleave', () => { pointerInside = false; });
  window.addEventListener('mouseenter', () => {
    pointerInside = true;
    lastMoveTime  = performance.now();
  });

  /* ── Draw loop ── */
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* idle blend */
    const stale    = performance.now() - lastMoveTime >= IDLE_MS;
    const useIdle  = !pointerInside || stale;
    idleBlend     += ((useIdle ? 1 : 0) - idleBlend) * IDLE_SMOOTH;
    waveTime      += 0.012;

    /* effective mouse target (drifts gently when idle) */
    const drift  = Math.min(canvas.width, canvas.height) * 0.045;
    const idleEx = lastClient.x + Math.sin(waveTime * 0.36) * drift * 0.45;
    const idleEy = lastClient.y + Math.cos(waveTime * 0.29) * drift * 0.40;
    const ex     = targetMouse.x + (idleEx - targetMouse.x) * idleBlend;
    const ey     = targetMouse.y + (idleEy - targetMouse.y) * idleBlend;
    mouse.x     += (ex - mouse.x) * 0.08;
    mouse.y     += (ey - mouse.y) * 0.08;

    const cx = canvas.width  * 0.5;
    const cy = canvas.height * 0.5;
    const wavBoost = 0.38 + idleBlend * 0.62;
    const wt = waveTime;

    for (const d of dots) {
      /* mouse gravity push */
      const dx   = d.bx - mouse.x;
      const dy   = d.by - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const infl = Math.max(0, 1 - dist / RADIUS);
      const angle = Math.atan2(dy, dx);
      const push  = infl * infl * STRENGTH;
      let px = d.bx + Math.cos(angle) * push;
      let py = d.by + Math.sin(angle) * push;

      /* ambient ring + plane waves */
      const rdx = d.bx - cx;
      const rdy = d.by - cy;
      const rd  = Math.sqrt(rdx * rdx + rdy * rdy) + 0.001;
      const ux  = rdx / rd;
      const uy  = rdy / rd;
      const ring1  = Math.sin(wt * 0.90 - rd * 0.01150) * 8.5;
      const ring2  = Math.sin(wt * 0.52 - rd * 0.02100) * 3.5;
      const ring   = (ring1 + ring2) * wavBoost;
      const gx     = d.bx * 0.033;
      const gy     = d.by * 0.028;
      const plX    = Math.sin(wt * 0.86 + gx + gy * 0.62) * 6.5;
      const plY    = Math.cos(wt * 0.79 - gx * 0.68 + gy) * 6.0;
      const plX2   = Math.sin(wt * 0.58 + gy * 1.05 - gx * 0.42) * 4.5;
      const diag   = Math.sin(wt * 0.66 + (d.bx + d.by) * 0.024) * 4.5;
      px += (ux * ring + plX + plX2 * 0.45 + diag * 0.85) * wavBoost;
      py += (uy * ring + plY + plX2 * 0.38 + diag * 0.85) * wavBoost;

      /* vignette + brightness */
      const vigDx = (d.bx - cx) / (canvas.width  * 0.72);
      const vigDy = (d.by - cy) / (canvas.height * 0.72);
      const vig   = Math.max(0, 1 - (vigDx * vigDx + vigDy * vigDy));
      const alpha = Math.min(1, BASE_ALPHA * vig + infl * BOOST * vig);
      if (alpha < 0.01) continue;

      ctx.beginPath();
      ctx.arc(px, py, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(210, 190, 255, ${alpha})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
})();
