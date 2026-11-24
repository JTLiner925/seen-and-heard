/* "See all" in place: long lists show their first few items and open the rest without leaving the page.
   Two forms:
     <div data-more="4" data-more-noun="tools">…</div>  a list filled by script: children after the 4th wait
     <div class="more__rest" id="x" hidden>…</div> + <button data-more-for="x">  a block written in the page
   Nothing is removed: the rest is in the page, opened by one button, and the button says what it opens. */
(function () {
  'use strict';
  function button(label) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn btn--secondary more__btn'; b.textContent = label;
    b.setAttribute('aria-expanded', 'false');
    return b;
  }
  function refresh() { if (window.ScrollTrigger) requestAnimationFrame(() => ScrollTrigger.refresh()); }
  function reveal(nodes) {
    if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) { nodes.forEach(n => n.style.removeProperty('opacity')); return; }
    gsap.fromTo(nodes, { y: 32, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, ease: 'power3.out', stagger: 0.04, overwrite: true });
  }
  function wire(btn, rest, open, closed, focusTarget) {
    btn.addEventListener('click', () => {
      const opening = btn.getAttribute('aria-expanded') !== 'true';
      rest.forEach(n => (n.hidden = !opening));
      btn.setAttribute('aria-expanded', String(opening));
      btn.textContent = opening ? closed : open;
      if (opening) reveal(rest.flatMap(n => [...n.querySelectorAll('.h-card, .vz-panel, .vz-grid > *')].concat(n.matches('.h-card, .vz-panel, h4, .h-grid') ? [n] : [])));
      else focusTarget.scrollIntoView({ block: 'start' });
      refresh();
    });
  }
  function start() {
    document.querySelectorAll('[data-more]').forEach(list => {
      const n = parseInt(list.dataset.more, 10) || 4, kids = [...list.children];
      if (kids.length <= n && !list.dataset.moreCards) return;
      const rest = kids.slice(n);
      // data-more-cards: also cap the cards inside the groups that stay open
      const cap = parseInt(list.dataset.moreCards, 10);
      if (cap) [...list.querySelectorAll('.h-card')].filter(c => !rest.some(r => r.contains(c))).slice(cap).forEach(c => rest.push(c));
      rest.forEach(k => (k.hidden = true));
      const count = list.querySelectorAll('.h-card').length, noun = list.dataset.moreNoun || 'items';
      const open = `See all ${count} ${noun}`, closed = `Show fewer ${noun}`;
      const btn = button(open);
      const id = list.id || ('more-' + Math.random().toString(36).slice(2, 8)); list.id = id;
      btn.setAttribute('aria-controls', id);
      list.after(btn);
      wire(btn, rest, open, closed, list);
    });
    document.querySelectorAll('[data-more-for]').forEach(btn => {
      const rest = document.getElementById(btn.dataset.moreFor); if (!rest) return;
      btn.setAttribute('aria-controls', rest.id); btn.setAttribute('aria-expanded', 'false');
      wire(btn, [rest], btn.textContent, btn.dataset.moreClose || 'Show fewer', btn.previousElementSibling || rest);
    });
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
