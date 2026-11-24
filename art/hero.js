/* Mounts Mustard Seed behind the hero. Settings come from the canvas's data attributes (chosen in
   art/viewer.html). The desktop view and headline area match the viewer exactly, so the seed you pick
   there is the picture here. The spread runs once and then rests; after that it moves only under a mouse.
   Under reduced motion it shows the finished field and nothing moves. */
(function () {
  'use strict';
  const canvas = document.querySelector('.hero__dots');
  if (!canvas || !window.MustardSeed || !window.SH_LAND) return;
  const hero = canvas.closest('.hero');
  const words = hero.querySelector('.hero__text');
  const ds = canvas.dataset;
  const cfg = {
    seed: parseInt(ds.seed, 10) || 1040,
    speed: parseFloat(ds.speed) || 1,
    count: parseInt(ds.count, 10) || 9000,
    lens: parseInt(ds.lens, 10) || 160,
    colors: { lit: ds.lit || '#ff301a', unlit: ds.unlit || '#8f8f8f', flash: ds.flash || '#ffffff', bg: null },
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const field = new MustardSeed.Field(window.SH_LAND);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, hover = -1, calm = [], progress = reduced ? 1.08 : 0, clock = 0, pointer = null, raf = 0, last = 0, onScreen = true;

  function viewFor(w) {
    if (w >= 1024) return { cx: 2, cy: 22, span: 318, ay: 0.56 };      // the whole map, the 10/40 Window near the middle
    if (w >= 640) return { cx: 50, cy: 24, span: 210, ay: 0.66 };
    return { cx: 62, cy: 22, span: 170, ay: 0.72 };
  }
  function measureCalm() {
    const hr = canvas.getBoundingClientRect(), r = words.getBoundingClientRect(), pad = 24;
    calm = [{ x0: r.left - hr.left - pad, y0: r.top - hr.top - pad, x1: r.right - hr.left + pad, y1: r.bottom - hr.top + pad }];
  }
  function build() {
    const r = canvas.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = W < 640 ? Math.min(cfg.count, 6000) : cfg.count;
    field.build({ seed: cfg.seed, count, width: W, height: H, view: viewFor(W) });
    measureCalm();
  }
  function render() {
    field.draw(ctx, { p: Math.min(progress, 1.08), clock, hover, pointer: reduced ? null : pointer, lens: cfg.lens, colors: cfg.colors, calm, feather: 96 });
  }
  function frame(now) {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now; clock += dt;
    if (progress < 1.08) progress += dt * cfg.speed / 9;
    render();
    raf = (onScreen && (progress < 1.08 || pointer || hover >= 0)) ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  }
  function kick() { if (!raf && onScreen && !reduced) raf = requestAnimationFrame(frame); }

  // hover a country to see its name and unreached share; click it to open it on the 10/40 globe
  const tip = hero.querySelector('.hero__tip');
  const overWords = e => e.target.closest && e.target.closest('.hero__text, .nav, a, button');
  const countryAt = e => { const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    return x < 0 || y < 0 || x > W || y > H || !field.idAt ? -1 : field.idAt(x, y); };
  hero.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    const id = overWords(e) ? -1 : countryAt(e);
    if (id !== hover) { hover = id; render(); }
    hero.classList.toggle('is-over-land', id >= 0);
    if (tip) {
      if (id >= 0) { const c = window.SH_LAND[id]; tip.innerHTML = `<b>${c.n}</b>${c.p != null ? ` ${Math.round(c.p)}% unreached` : ''}<span>Click to explore</span>`; tip.hidden = false;
        const hr = hero.getBoundingClientRect(); tip.style.transform = `translate(${e.clientX - hr.left + 16}px, ${e.clientY - hr.top + 16}px)`; }
      else tip.hidden = true;
    }
    kick();
  });
  hero.addEventListener('pointerleave', () => { pointer = null; hover = -1; if (tip) tip.hidden = true; hero.classList.remove('is-over-land'); if (!raf) render(); });
  hero.addEventListener('click', e => {
    if (overWords(e)) return;
    const id = countryAt(e);
    location.href = 'globe.html' + (id >= 0 ? '#c=' + encodeURIComponent(window.SH_LAND[id].n) : '');
  });
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }, { threshold: 0 }).observe(hero);
  let rt = 0, lastW = 0;
  new ResizeObserver(() => {
    clearTimeout(rt);
    rt = setTimeout(() => { const w = Math.round(hero.getBoundingClientRect().width); if (w !== lastW) { lastW = w; build(); render(); kick(); } else { measureCalm(); render(); } }, 120);
  }).observe(hero);
  const start = () => { lastW = Math.round(hero.getBoundingClientRect().width); build(); render(); kick(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start); else start();
})();
