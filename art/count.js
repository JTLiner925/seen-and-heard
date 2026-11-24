/* Figures count up once as they arrive: the big numbers in Stats and every figure on the globe.
   The text in the HTML is always the final figure; the count only animates toward it, keeping its
   format (commas, decimals, %, "billion", "of 2,263"). Reduced motion: the figure simply stands. */
(function () {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NUM = /\d[\d,]*(?:\.\d+)?/;

  function countUp(el) {
    if (reduced || !el) return;
    const text = el.dataset.countText || el.textContent;
    el.dataset.countText = text;
    const m = text.match(NUM); if (!m) return;
    const raw = m[0], target = parseFloat(raw.replace(/,/g, ''));
    if (!isFinite(target) || target === 0) return;
    const decimals = (raw.split('.')[1] || '').length, commas = raw.includes(',');
    const before = text.slice(0, m.index), after = text.slice(m.index + raw.length);
    const fmt = v => {
      let s = v.toFixed(decimals);
      if (commas) { const [i, d] = s.split('.'); s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (d ? '.' + d : ''); }
      return before + s + after;
    };
    // keep the box steady while the digits change
    if (getComputedStyle(el).display === 'inline') { el.style.display = 'inline-block'; el.style.minWidth = el.offsetWidth + 'px'; }
    const state = { v: 0 };
    if (el._countTween) el._countTween.kill();
    el._countTween = (window.gsap ? gsap.to(state, {
      v: target, duration: target > 100 ? 1.4 : 1.1, ease: 'power3.out',
      onUpdate: () => { el.textContent = fmt(state.v); },
      onComplete: () => { el.textContent = text; },
    }) : null);
  }
  window.SHCount = countUp;

  function start() {
    if (reduced || !window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll('.vz-hero b').forEach(b => {
      ScrollTrigger.create({ trigger: b, start: 'top 88%', once: true, onEnter: () => countUp(b) });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
