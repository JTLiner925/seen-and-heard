/* A slim progress line along the foot of the nav (Meng To scroll-progress-timeline, as a horizontal rail):
   a quiet base line, a fill that follows the scroll, and one point per section that lights as you pass
   it. The nav's own words stay the way to jump; the points are only a reading aid, so they are hidden
   from assistive tech and the keyboard. Reduced motion: the fill still tracks, without easing. */
(function () {
  'use strict';
  const LABELS = { window: '10/40', statement: 'Seen and heard', how: 'Steps', stats: 'The need', tools: 'Tools', resources: 'Resources' };
  // the sections of this page; a page of one section gets the line without points
  const all = [...document.querySelectorAll('main > section[id]')].filter(s => !s.classList.contains('hero'));
  const SECTIONS = all.length > 1 ? all.map(s => [s.id, LABELS[s.id] || s.id]) : [];
  function start() {
    const nav = document.querySelector('header.nav'); if (!nav) return;
    const rail = document.createElement('div'); rail.className = 'nav-rail'; rail.setAttribute('aria-hidden', 'true');
    rail.innerHTML = '<i class="nav-rail__fill"></i>' + SECTIONS.map(([id, label]) => `<b class="nav-rail__dot" data-for="${id}"><span>${label}</span></b>`).join('');
    nav.appendChild(rail);
    const fill = rail.querySelector('.nav-rail__fill'), dots = [...rail.querySelectorAll('.nav-rail__dot')];
    let marks = [];
    const measure = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      marks = dots.map(d => { const s = document.getElementById(d.dataset.for); const at = s ? Math.min(1, (s.getBoundingClientRect().top + scrollY) / max) : 0; d.style.left = (at * 100) + '%'; return at; });
      update();
    };
    let ticking = false;
    const update = () => {
      ticking = false;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight), p = Math.min(1, Math.max(0, scrollY / max));
      fill.style.transform = `scaleX(${p})`;
      dots.forEach((d, i) => d.classList.toggle('is-past', p >= marks[i] - 0.002));
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener('resize', measure);
    if (window.ScrollTrigger) ScrollTrigger.addEventListener('refresh', measure);
    addEventListener('load', measure);
    new ResizeObserver(measure).observe(document.body);
    measure();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
