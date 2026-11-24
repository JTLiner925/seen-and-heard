/* Scroll-scrubbed word reveal (Meng To): the line under "Every person, seen and heard" brightens word by
   word as the section scrolls through. Real text stays in the DOM, inline markup is kept, wrapping stays
   free, and the final state is ordinary type. Reduced motion or no script: the words simply stand. */
(function () {
  'use strict';
  function split(el) {
    const words = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest('script,style,[data-no-split]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement('span'); w.className = 'wr-w'; w.textContent = part; frag.appendChild(w); words.push(w);
      });
      node.replaceWith(frag);
    });
    return words;
  }
  function start() {
    if (!window.gsap || !window.ScrollTrigger) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    gsap.registerPlugin(ScrollTrigger);
    document.querySelectorAll('[data-reveal]').forEach(el => {
      const words = split(el), n = words.length;
      el.classList.add('wr-on');
      const paint = p => words.forEach((w, i) => w.style.setProperty('--wp', Math.min(1, Math.max(0, p * n * 1.2 - i))));
      paint(0);
      ScrollTrigger.create({
        trigger: el.closest('section') || el, start: 'top 75%', end: 'bottom 85%', scrub: true,
        onUpdate: self => paint(self.progress),
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
