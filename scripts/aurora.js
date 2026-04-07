/**
 * aurora.js — palette picker (colour-theme switcher)
 *
 * Reads/writes localStorage key "p0-aurora".
 * Syncs html[data-aurora] attribute + trigger swatch + active state in panel.
 */
(function () {
  'use strict';

  const KEY      = 'p0-aurora';
  const picker   = document.getElementById('aurora-picker');
  const backdrop = document.getElementById('aurora-backdrop');
  const trigger  = document.getElementById('aurora-trigger');
  const panel    = document.getElementById('aurora-panel');
  const options  = document.querySelectorAll('.aurora-option');

  if (!picker || !trigger || !panel) return;

  /* ── State sync ── */
  function syncFromTheme() {
    const cur = document.documentElement.getAttribute('data-aurora') || 'violet';
    trigger.setAttribute('data-aurora', cur);
    options.forEach((btn) => {
      const active = btn.dataset.aurora === cur;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  /* ── Open / close ── */
  function openPicker() {
    picker.classList.add('is-open');
    backdrop.classList.add('is-open');
    backdrop.setAttribute('aria-hidden', 'false');
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closePicker() {
    picker.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    backdrop.setAttribute('aria-hidden', 'true');
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  /* ── Apply theme ── */
  function applyTheme(value) {
    if (!value) return;
    document.documentElement.setAttribute('data-aurora', value);
    try { localStorage.setItem(KEY, value); } catch (_) {}
    syncFromTheme();
  }

  /* ── Event listeners ── */
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    picker.classList.contains('is-open') ? closePicker() : openPicker();
  });

  backdrop.addEventListener('click', closePicker);

  options.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTheme(btn.dataset.aurora);
      closePicker();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePicker();
  });

  syncFromTheme();
})();
