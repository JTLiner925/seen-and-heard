/* Scroll transitions for every section (GSAP ScrollTrigger). Each section hands off to the next: its
   heading rises in word by word, its blocks lift in with a short stagger, and the hero eases back as the
   globe arrives. Content is visible without the script and under reduced motion; nothing is hidden
   until GSAP is running. */
(function () {
  'use strict';
  function start() {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
    document.documentElement.classList.add('sx-on');

    // the hero eases back and dims as the globe takes over
    const hero = document.querySelector('.hero');
    if (hero) {
      gsap.to(hero.querySelector('.hero__text'), { y: -80, autoAlpha: 0.15, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to(hero.querySelector('.hero__dots'), { scale: 1.08, autoAlpha: 0.35, ease: 'none',
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    }

    // split a heading into words so it can rise in one word at a time
    const words = el => {
      if (el.dataset.sxSplit) return el.querySelectorAll('.sx-w');
      el.dataset.sxSplit = '1';
      const walk = node => [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            const w = document.createElement('span'); w.className = 'sx-w'; w.style.display = 'inline-block'; w.textContent = part; frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1) walk(n);
      });
      walk(el);
      return el.querySelectorAll('.sx-w');
    };

    const sections = [...document.querySelectorAll('main > section:not(.hero):not(.globe):not([data-moment])')];
    sections.forEach(sec => {
      const h2 = sec.querySelector('h2');
      const lead = sec.querySelectorAll(':scope .wrap > .grid > p, :scope .section-head > p, :scope .stack-5 > p');
      const blocks = sec.querySelectorAll(':scope .card, :scope .app, :scope .wrap > .grid > .panel, :scope .vz-panel, :scope .vz-hero > div, :scope .h-card, :scope .uotd');
      if (h2) {
        gsap.from(words(h2), { yPercent: 40, autoAlpha: 0, duration: 0.6, ease: 'power2.out', stagger: 0.03,
          scrollTrigger: { trigger: h2, start: 'top 88%', once: true } });
      }
      if (lead.length) gsap.from(lead, { y: 24, autoAlpha: 0, duration: 0.7, ease: 'power2.out', stagger: 0.08,
        scrollTrigger: { trigger: lead[0], start: 'top 90%', once: true } });
      ScrollTrigger.batch(blocks, {
        start: 'top 98%', once: true,
        onEnter: batch => gsap.fromTo(batch, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power2.out', stagger: 0.05, overwrite: true, clearProps: 'transform' }),
      });
      gsap.set(blocks, { autoAlpha: 0 });
    });

    // anything already on screen at load shows at once
    ScrollTrigger.refresh();
    addEventListener('load', () => ScrollTrigger.refresh());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
