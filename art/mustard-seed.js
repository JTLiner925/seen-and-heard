/* Mustard Seed: the gospel as dots spreading through the 10/40 Window.
   One seeded, deterministic core shared by the hero embed and the viewer: the same seed, count and view
   always give the same field. No dependencies. Land shapes and each country's unreached share come from
   the Missions Hub map (Joshua Project data), in an equirectangular frame: x = (lon + 171.2) * 2.84,
   y = (78.1 - lat) * 2.85. */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash2(ix, iy, seed) {
    let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function vnoise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy, seed), b = hash2(ix + 1, iy, seed), c = hash2(ix, iy + 1, seed), d = hash2(ix + 1, iy + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const lonX = lon => (lon + 171.2) * 2.84;
  const latY = lat => (78.1 - lat) * 2.85;
  const xLon = x => x / 2.84 - 171.2;
  const yLat = y => 78.1 - y / 2.85;
  const hexRgb = h => { h = String(h).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const ORIGIN = { lon: 35.2, lat: 31.8 }; // Jerusalem (Acts 1:8)

  function geoDist(a, b) {
    const k = Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180);
    const dx = (a.lon - b.lon) * k, dy = a.lat - b.lat;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* land: [{p: unreached share 0-100, d: SVG path}] */
  function Field(land) {
    this.land = land.map(c => ({ p: c.p || 0, path: new Path2D(c.d) }));
    this.dots = [];
  }

  /* o: { seed, count, width, height, view: { cx, cy, span, ay } }
     view: the centre longitude and latitude, the degrees of longitude across the width, and where (0-1 of
     the height) the centre latitude sits. */
  Field.prototype.build = function (o) {
    const W = Math.max(1, o.width | 0), H = Math.max(1, o.height | 0);
    const view = Object.assign({ cx: 20, cy: 25, span: 300, ay: 0.5 }, o.view || {});
    const k = W / (view.span * 2.84);                       // canvas px per map unit
    const mx0 = lonX(view.cx) - W / 2 / k, my0 = latY(view.cy) - H * view.ay / k;
    this.k = k; this.mx0 = mx0; this.my0 = my0; this.W = W; this.H = H;

    // rasterise the countries once, each in its own colour, so a pixel tells which country it is
    const rs = Math.min(1, 1000 / W);
    const rw = Math.max(1, Math.round(W * rs)), rh = Math.max(1, Math.round(H * rs));
    const off = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(rw, rh) : Object.assign(document.createElement('canvas'), { width: rw, height: rh });
    const g = off.getContext('2d', { willReadFrequently: true });
    g.setTransform(k * rs, 0, 0, k * rs, -mx0 * k * rs, -my0 * k * rs);
    this.land.forEach((c, i) => { g.fillStyle = `rgb(${(i + 1) & 255},${((i + 1) >> 8) & 255},7)`; g.fill(c.path); });
    const img = g.getImageData(0, 0, rw, rh).data;
    const idAt = (x, y) => {
      const px = Math.min(rw - 1, Math.max(0, Math.floor(x * rs))), py = Math.min(rh - 1, Math.max(0, Math.floor(y * rs)));
      const j = (py * rw + px) * 4;
      return img[j + 3] > 128 ? img[j] + (img[j + 1] << 8) - 1 : -1;
    };
    let landPx = 0;
    for (let j = 3; j < img.length; j += 4) if (img[j] > 128) landPx++;
    const area = landPx / (rs * rs);

    // blue-noise sampling on land: one point a grid cell at most, from one seeded stream
    const rand = mulberry32(o.seed >>> 0);
    const count = Math.max(100, o.count | 0);
    const cell = Math.max(1.2, Math.sqrt(area / count) * 0.72);
    const gw = Math.ceil(W / cell), grid = new Uint8Array(gw * Math.ceil(H / cell));
    const dots = [];
    const sizeScale = Math.min(1.35, Math.max(0.8, Math.sqrt(W * H) / 1100));
    for (let tries = 0; tries < count * 14 && dots.length < count; tries++) {
      const x = rand() * W, y = rand() * H;
      const id = idAt(x, y);
      if (id < 0) continue;
      const gi = Math.floor(y / cell) * gw + Math.floor(x / cell);
      if (grid[gi]) continue;
      grid[gi] = 1;
      const lon = xLon(mx0 + x / k), lat = yLat(my0 + y / k);
      const band = smooth(4, 11, lat) * (1 - smooth(39, 46, lat)) * smooth(-28, -16, lon) * (1 - smooth(142, 152, lon));
      const rr = rand();
      dots.push({ x, y, lon, lat, id, share: (this.land[id] ? this.land[id].p : 0) / 100, band,
                  r: (band > 0.5 ? 0.38 + rr * 0.45 : 0.55 + rr * 0.4) * (1 + 0.4 * band) * sizeScale, T: 0, j: rand() });
    }

    // the sent: a few early sources, weighted toward the band and the least reached places
    const sources = [{ lon: ORIGIN.lon, lat: ORIGIN.lat, t: 0 }];
    const cands = dots.filter(d => d.band > 0.6);
    const nHubs = 4 + Math.floor(rand() * 4);
    for (let h = 0; h < nHubs && cands.length; h++) {
      let pick = cands[Math.floor(rand() * cands.length)];
      for (let tries = 0; tries < 3; tries++) { const alt = cands[Math.floor(rand() * cands.length)]; if (alt.share > pick.share) pick = alt; }
      sources.push({ lon: pick.lon, lat: pick.lat, t: geoDist(ORIGIN, pick) * (0.5 + rand() * 0.35) });
    }
    const ns = (o.seed >>> 0) % 9973;
    let maxT = 0;
    for (const d of dots) {
      let t = Infinity;
      for (const s of sources) t = Math.min(t, s.t + geoDist(s, d));
      t = t * (1 + 0.7 * d.share) + 16 * vnoise(d.lon / 9, d.lat / 9, ns);
      d.T = t; if (t > maxT) maxT = t;
    }
    for (const d of dots) d.T /= maxT || 1;
    this.dots = dots;
    this.idAt = idAt;        // which country is under a canvas point (-1 for sea)
    return this;
  };

  /* Draws the field at progress p (0 = nothing lit, 1 = all lit).
     o: { p, clock (s), pointer: {x, y} | null, lens (px), colors: {lit, unlit, flash, bg}, calm: [{x0,y0,x1,y1}], feather } */
  Field.prototype.draw = function (ctx, o) {
    const W = this.W, H = this.H, p = o.p, clock = o.clock || 0;
    const lit = hexRgb(o.colors.lit), unlit = hexRgb(o.colors.unlit), flash = hexRgb(o.colors.flash || '#ffffff');
    if (o.colors.bg) { ctx.fillStyle = o.colors.bg; ctx.fillRect(0, 0, W, H); } else ctx.clearRect(0, 0, W, H);
    const calm = o.calm || [], fe = o.feather || 96;
    const calmK = (x, y) => {
      let m = 1;
      for (const r of calm) {
        const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1);
        m = Math.min(m, 0.06 + 0.94 * smooth(0, fe, Math.sqrt(dx * dx + dy * dy)));
      }
      return m;
    };
    const P = o.pointer, R = o.lens || 160, FL = 0.05;
    const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
    const cLit = rgb(lit), cUnlit = rgb(unlit);
    for (const d of this.dots) {
      const dt = p - d.T;
      let a, s, col;
      if (dt < 0) { col = cUnlit; a = 0.55 + 0.1 * d.band; s = d.r; }
      else if (dt < FL) {
        const f = 1 - dt / FL;
        const to = d.band > 0.5 ? lit : unlit;
        col = rgb(to.map((v, i) => Math.round(v + (flash[i] - v) * f)));
        a = 0.5 + 0.5 * Math.max(f, d.band); s = d.r * (1.1 + 0.7 * f);
      } else if (d.band > 0.5) { col = cLit; a = 0.55 + 0.45 * d.band; s = d.r * (1.1 + 0.25 * d.band); }
      else { col = cUnlit; a = 0.8 + 0.12 * d.band; s = d.r; }
      if (o.hover >= 0 && d.id === o.hover) { a = Math.min(1, a + 0.4); s *= 1.5; col = d.band > 0.5 ? rgb(flash.map((v, i) => Math.round(lit[i] + (v - lit[i]) * 0.35))) : rgb(flash); }
      if (P) {
        const dx = d.x - P.x, dy = d.y - P.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < R) { const g = (1 - dist / R) ** 2; s *= 1 + 2.4 * g * (0.7 + 0.3 * Math.sin(clock * 3.2 - dist * 0.05)); a = Math.min(1, a + 0.35 * g); }
      }
      if (calm.length) a *= calmK(d.x, d.y);
      if (a < 0.02) continue;
      ctx.globalAlpha = a; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(d.x, d.y, s, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  root.MustardSeed = { Field, mulberry32, vnoise, ORIGIN };
})(typeof window !== 'undefined' ? window : globalThis);
