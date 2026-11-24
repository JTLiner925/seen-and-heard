/* The 10/40 globe page, laid out like a globe explorer (globe.stratus.earth): a glowing, liquid-looking
   particle globe (Meng To's globe-particles recipe) with every country shaded by the share of its people in
   unreached groups and the 10/40 Window framed in red. Drag to turn it, zoom and reset, search by country;
   a click selects a country and the pill under the globe opens its page ("Your focus"): figures, a locator
   map, faith and languages, prayer points, its rank on the scale, and every people group. Nothing is ever
   laid over the globe. Reduced motion: no drift, moves land at once. */
import * as THREE from 'three';

const section = document.querySelector('[data-globe]');
if (section && window.SH_LAND && window.gsap) init();

function init() {
  const canvas = section.querySelector('.globe__canvas');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phone = matchMedia('(max-width: 767px)').matches;
  const names = window.SH_LAND.map(c => c.n);

  // ---- points on the land, from the same map the hero uses (x = (lon+171.2)*2.84, y = (78.1-lat)*2.85)
  const RW = 2000, RH = 940, S = 2;
  const off = document.createElement('canvas'); off.width = RW; off.height = RH;
  const g = off.getContext('2d', { willReadFrequently: true });
  g.setTransform(S, 0, 0, S, 0, 0);
  window.SH_LAND.forEach((c, i) => { g.fillStyle = `rgb(${(i + 1) & 255},${(i + 1) >> 8},9)`; g.fill(new Path2D(c.d)); });
  const img = g.getImageData(0, 0, RW, RH).data;
  const idAt = (lon, lat) => {
    const x = Math.round((lon + 171.2) * 2.84 * S), y = Math.round((78.1 - lat) * 2.85 * S);
    if (x < 0 || y < 0 || x >= RW || y >= RH) return -1;
    // trust a pixel only when it and its right and lower neighbours agree: borders blend two countries' colours
    const j = (y * RW + x) * 4, jr = j + 4, jd = j + RW * 4;
    if (img[j + 3] < 250 || img[j + 2] !== 9) return -1;
    if (img[jr] !== img[j] || img[jr + 1] !== img[j + 1] || img[jd] !== img[j] || img[jd + 1] !== img[j + 1]) return -1;
    return img[j] + (img[j + 1] << 8) - 1;
  };
  const step = phone ? 0.9 : 0.6;
  const pos = [], band = [], country = [], rnd = [];
  let seed = 1040; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let lat = 76; lat > -56; lat -= step) {
    const k = step / Math.max(0.25, Math.cos(lat * Math.PI / 180));   // even spacing on the sphere
    for (let lon = -171; lon < 180; lon += k) {
      const jl = lon + (rand() - 0.5) * k * 0.6, ja = lat + (rand() - 0.5) * step * 0.6;
      const id = idAt(jl, ja); if (id < 0) continue;
      const la = ja * Math.PI / 180, lo = jl * Math.PI / 180;
      pos.push(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
      const inBand = ja >= 10 && ja <= 40 && jl >= -18 && jl <= 146 ? 1 : 0;
      band.push(inBand); country.push(id); rnd.push(rand());
    }
  }

  // ---- renderer, camera
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 4.4);
  const tilt = new THREE.Group(), spin = new THREE.Group();
  scene.add(tilt); tilt.add(spin);

  // ---- the liquid core: a dark sea whose surface flows with layered noise, rim-lit in sky and green
  const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.985, 96, 96), new THREE.ShaderMaterial({
    transparent: true,
    uniforms: { u_time: { value: 0 }, u_deep: { value: new THREE.Color('#071027') }, u_sheen: { value: new THREE.Color('#2f6fd6') }, u_rim: { value: new THREE.Color('#7fd8ff') } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vW;
      void main(){ vN = normalize(normalMatrix * normal); vP = position; vec4 mv = modelViewMatrix * vec4(position,1.0); vW = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float u_time; uniform vec3 u_deep; uniform vec3 u_sheen; uniform vec3 u_rim;
      varying vec3 vN; varying vec3 vP; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 p = vP * 2.6;
        float t = u_time * 0.08;
        vec3 q = vec3(n3(p + t), n3(p + vec3(5.2,1.3,2.8) - t), n3(p + vec3(1.7,9.2,4.1) + t * 0.7));
        float flow = n3(p + 2.2 * q + t);                       // domain-warped: reads as a slow liquid
        float fres = pow(1.0 - max(dot(normalize(vN), normalize(vW)), 0.0), 2.6);
        vec3 col = mix(u_deep, u_sheen, smoothstep(0.35, 0.95, flow) * 0.55);
        col += u_rim * fres * 0.35;
        gl_FragColor = vec4(col, 0.92);
      }`,
  }));
  spin.add(liquid);


  // ---- each country's centre, and which ones sit in the 10/40 Window (southern Europe crosses 40°N but is not counted)
  const NOT_WINDOW = new Set(['Spain', 'Portugal', 'Greece', 'Italy', 'Malta', 'Cyprus', 'Northern Cyprus', 'Gibraltar']);
  const centre = new Map();
  for (let i = 0; i < country.length; i++) {
    const id = country[i], c = centre.get(id) || { x: 0, y: 0, z: 0, n: 0, band: 0 };
    c.x += pos[i * 3]; c.y += pos[i * 3 + 1]; c.z += pos[i * 3 + 2]; c.n++; c.band += band[i]; centre.set(id, c);
  }
  const inWindow = new Set();
  centre.forEach((c, id) => {
    const len = Math.hypot(c.x, c.y, c.z) || 1;
    c.lat = Math.asin(c.y / len) * 180 / Math.PI; c.lon = Math.atan2(-c.z / len, c.x / len) * 180 / Math.PI;
    if (c.band / c.n > 0.35 && !NOT_WINDOW.has(names[id])) inWindow.add(id);
  });

  // ---- land points: every country shaded by its unreached share, blue (few) to amber to red (all)
  const share = new Float32Array(country.length).fill(-1);
  const win = new Float32Array(country.length); country.forEach((id, i) => { win[i] = inWindow.has(id) ? 1 : 0; });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos.map(v => v * 1.002), 3));
  geo.setAttribute('a_share', new THREE.BufferAttribute(share, 1));
  geo.setAttribute('a_win', new THREE.BufferAttribute(win, 1));
  geo.setAttribute('a_country', new THREE.Float32BufferAttribute(country, 1));
  geo.setAttribute('a_rand', new THREE.Float32BufferAttribute(rnd, 1));
  const dpr = 2;   // fixed 200%: two drawing pixels per CSS pixel, whatever the display
  const land = new THREE.Points(geo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {
      u_time: { value: 0 }, u_size: { value: 3.6 * dpr }, u_scale: { value: 1 },
      u_focus: { value: -1 }, u_prev: { value: -1 }, u_mix: { value: 1 }, u_hover: { value: -1 },
      u_none: { value: new THREE.Color('#8a93a6') }, u_low: { value: new THREE.Color('#8fc1ff') }, u_mid: { value: new THREE.Color('#ffc46b') },
      u_red: { value: new THREE.Color('#ff301a') }, u_hot: { value: new THREE.Color('#fff1ea') },
    },
    vertexShader: `attribute float a_share; attribute float a_win; attribute float a_country; attribute float a_rand;
      uniform float u_time, u_size, u_scale, u_focus, u_prev, u_mix, u_hover;
      varying float vShare; varying float vWin; varying float vFocus; varying float vFacing; varying float vHover;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * position);
        vFacing = smoothstep(-0.15, 0.55, n.z);
        float now = abs(a_country - u_focus) < 0.5 ? 1.0 : 0.0;
        float was = abs(a_country - u_prev) < 0.5 ? 1.0 : 0.0;
        vFocus = mix(was, now, u_mix);
        vHover = abs(a_country - u_hover) < 0.5 ? 1.0 : 0.0;
        vShare = a_share; vWin = a_win;
        float pulse = 1.0 + 0.3 * sin(u_time * 2.6 + a_rand * 6.2831) * vFocus;
        float s = u_size * u_scale * (1.0 + 0.25 * a_win) * (1.0 + 0.7 * vFocus + 0.25 * vHover) * pulse;
        gl_PointSize = s * (3.2 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 u_none, u_low, u_mid, u_red, u_hot;
      varying float vShare; varying float vWin; varying float vFocus; varying float vFacing; varying float vHover;
      void main(){
        float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d); a *= a;
        float has = step(0.0, vShare);
        float t = pow(clamp(vShare, 0.0, 1.0), 3.0);             // most of the Window is above 90%: spread the top
        vec3 ramp = t < 0.5 ? mix(u_low, u_mid, t * 2.0) : mix(u_mid, u_red, t * 2.0 - 1.0);
        vec3 col = mix(u_none, ramp, has);
        col = mix(col, u_hot, vFocus * 0.45 + vHover * 0.25);
        float alpha = a * mix(0.08, 1.0, vFacing) * mix(0.4, 1.0, has) * mix(0.8, 1.0, vWin) * (1.0 + vFocus + 0.4 * vHover);
        gl_FragColor = vec4(col, min(alpha, 1.0));
      }`,
  }));
  spin.add(land);
  const U = land.material.uniforms;

  // ---- the 10/40 Window drawn on the globe: a thin red frame from 10° to 40° north, 18° west to 146° east
  const ll = (lon, lat, r = 1.008) => { const la = lat * Math.PI / 180, lo = lon * Math.PI / 180; return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)); };
  const frameVerts = [];
  for (let lon = -18; lon <= 146; lon += 2) frameVerts.push(ll(lon, 40));
  for (let lat = 40; lat >= 10; lat -= 2) frameVerts.push(ll(146, lat));
  for (let lon = 146; lon >= -18; lon -= 2) frameVerts.push(ll(lon, 10));
  for (let lat = 10; lat <= 40; lat += 2) frameVerts.push(ll(-18, lat));
  const windowFrame = new THREE.Line(new THREE.BufferGeometry().setFromPoints(frameVerts),
    new THREE.LineDashedMaterial({ color: 0xff301a, transparent: true, opacity: 0.75, dashSize: 0.02, gapSize: 0.014 }));
  windowFrame.computeLineDistances(); spin.add(windowFrame);

  // ---- the view: a target the globe eases toward; drag, zoom, reset and picks all move the target
  const HOME = { lon: 62, lat: 22 };
  const target = { y: 0, x: 0, z: 3.8 }, view = { y: 0, x: 0, z: 3.8 };
  let baseZ = 3.8;
  const look = (lon, lat) => {
    let y = -Math.PI / 2 - lon * Math.PI / 180;
    y += Math.round((view.y - y) / (Math.PI * 2)) * Math.PI * 2;      // the shortest way round
    target.y = y; target.x = Math.max(-1.1, Math.min(1.1, lat * Math.PI / 180 * 0.85));
  };
  look(HOME.lon, HOME.lat); view.y = target.y; view.x = target.x;
  const focus = id => {
    U.u_prev.value = U.u_focus.value; U.u_focus.value = id; U.u_mix.value = 0;
    gsap.to(U.u_mix, { value: 1, duration: reduced ? 0 : 0.8, ease: 'power2.out' });
  };
  function resize() {
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    // the sphere fills 94% of the stage's shorter side
    const t = Math.tan(16 * Math.PI / 180) * 0.94 * Math.min(1, w / h), nb = 1 / Math.sin(Math.atan(t));
    target.z *= nb / baseZ; view.z *= nb / baseZ; baseZ = nb;
    U.u_scale.value = Math.max(0.7, Math.min(1.6, Math.min(w, h) / 640)) * (baseZ / 4.4);
  }
  resize(); new ResizeObserver(resize).observe(canvas);

  let visible = false, raf = 0, last = 0, clock = 0, idleAt = 0, dragging = false, picked = -1;
  const wake = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
  const frame = now => {
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now; clock += dt;
    if (!reduced && !dragging && picked < 0 && now - idleAt > 2500) target.y -= dt * 0.05;   // left alone, it turns slowly
    const k = reduced ? 1 : Math.min(1, dt * (dragging ? 12 : 2.6));
    view.y += (target.y - view.y) * k; view.x += (target.x - view.x) * k; view.z += (target.z - view.z) * k;
    spin.rotation.y = view.y; tilt.rotation.x = view.x; camera.position.z = view.z;
    liquid.material.uniforms.u_time.value = clock; U.u_time.value = clock;
    renderer.render(scene, camera);
    const settling = Math.abs(target.y - view.y) + Math.abs(target.x - view.x) + Math.abs(target.z - view.z) > 0.0005;
    raf = visible && (!reduced || settling || dragging) ? requestAnimationFrame(frame) : 0;
    if (!raf) last = 0;
  };
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) wake(); }, { rootMargin: '100px' }).observe(canvas);

  // ---- helpers
  const DATA = 'art/peoples/';
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const big = n => n >= 1e9 ? (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + ' billion' : n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + ' million' : Math.round(n).toLocaleString('en-US');
  const pct = v => v == null ? 'Not known' : v < 0.1 ? 'Under 0.1%' : (+v).toFixed(v < 1 ? 2 : 1).replace(/\.?0+$/, '') + '%';
  const sharePct = s => s >= 0.9995 ? '100%' : s >= 0.995 ? (s * 100).toFixed(1) + '%' : s < 0.01 && s > 0 ? 'Under 1%' : Math.round(s * 100) + '%';
  const rampCss = s => { const t = Math.pow(Math.max(0, Math.min(1, s)), 3), A = [143, 193, 255], M = [255, 196, 107], R = [255, 48, 26];
    const [a, b, u] = t < 0.5 ? [A, M, t * 2] : [M, R, t * 2 - 1]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(',')})`; };
  const files = new Map();
  const loadCountry = code => files.has(code) ? Promise.resolve(files.get(code)) : fetch(DATA + code + '.json').then(r => r.ok ? r.json() : []).then(g => (files.set(code, g), g));
  const gx = section.querySelector('.gx'), cx = section.querySelector('.cx'), cxBody = cx.querySelector('.cx__body');
  const hint = section.querySelector('.globe__hint');

  // ---- data: one row per country with a people group file
  const rows = new Map();                  // land id -> {id, name, code, pop, lr, gN, lrN, share, win}
  let byShare = [];                         // every country, highest share first (the rank shown on a country)
  const ready = fetch(DATA + 'rank.json').then(r => r.json()).then(R => {
    names.forEach((n, id) => { if (R[n] && !rows.has(id)) { const [code, pop, lr, gN, lrN] = R[n]; rows.set(id, { id, name: n, code, pop, lr, gN, lrN, share: lr / pop, win: inWindow.has(id) }); } });
    country.forEach((id, i) => { const r = rows.get(id); if (r) share[i] = r.share; });
    geo.attributes.a_share.needsUpdate = true; wake();
    byShare = [...rows.values()].sort((a, b) => b.share - a.share || b.lr - a.lr);
    byShare.forEach((r, i) => { r.shareRank = i + 1; });
    drawRank();
  });

  // ---- the ranking card
  const rankList = section.querySelector('.rank__list'), rankMore = section.querySelector('.rank__more');
  let by = 'share', scope = 'window', limit = 20, ordered = [];
  const drawRank = () => {
    ordered = [...rows.values()].filter(r => scope === 'all' || r.win).sort(by === 'people' ? (a, b) => b.lr - a.lr : (a, b) => b.share - a.share || b.lr - a.lr);
    const top = ordered[0] ? ordered[0].lr : 1;
    rankList.innerHTML = ordered.slice(0, limit).map((r, i) => `<li><button type="button" class="rank__row" data-id="${r.id}"${r.id === picked ? ' aria-current="true"' : ''}>` +
      `<span class="rank__n">${String(i + 1).padStart(2, '0')}</span><span class="rank__name">${esc(r.name)}${scope === 'all' && r.win ? '<em class="rank__tag">10/40</em>' : ''}</span>` +
      `<span class="rank__v">${by === 'people' ? big(r.lr) : sharePct(r.share)}</span>` +
      `<span class="rank__bar"><i style="width:${Math.max(2, (by === 'people' ? r.lr / top : r.share) * 100).toFixed(1)}%;background:${rampCss(r.share)}"></i></span></button></li>`).join('');
    rankMore.hidden = ordered.length <= limit; rankMore.textContent = `Show all ${ordered.length} countries`;
  };
  section.querySelectorAll('[data-by]').forEach(b => b.addEventListener('click', () => { by = b.dataset.by; section.querySelectorAll('[data-by]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawRank(); }));
  section.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { scope = b.dataset.scope; limit = 20; section.querySelectorAll('[data-scope]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); drawRank(); }));
  rankMore.addEventListener('click', () => { limit = Infinity; drawRank(); });
  rankList.addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { select(+b.dataset.id); scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); } });

  // ---- select a country: the globe turns to it and lights it; the pill under the globe offers to open it
  const pill = section.querySelector('.gx__pill'), prompt = section.querySelector('.gx__prompt');
  const select = (id, keepUrl) => {
    const r = rows.get(id); if (!r) return;
    picked = id; const c = centre.get(id); if (c) look(c.lon, c.lat);
    focus(id); wake();
    pill.hidden = false; prompt.hidden = true;
    pill.querySelector('.gx__pill-name').textContent = r.name;
    const rk = pill.querySelector('.gx__pill-rank'); rk.innerHTML = sharePct(r.share) + '<span class="gx__u"> unreached</span>'; rk.style.background = rampCss(r.share);
    rk.title = `${sharePct(r.share)} of people in unreached groups`;
    if (!keepUrl) history.replaceState(null, '', '#c=' + encodeURIComponent(r.name));
    drawRank();
  };
  const unselect = () => { if (picked < 0) return; picked = -1; focus(-1); pill.hidden = true; prompt.hidden = false; idleAt = performance.now(); history.replaceState(null, '', location.pathname); drawRank(); wake(); };
  pill.querySelector('.gx__open').addEventListener('click', () => openCountry(picked));

  // ---- search by country
  const sInput = section.querySelector('.gx__search input'), sList = section.querySelector('.gx__results');
  let hits = [], active = 0;
  const drawHits = () => {
    const q = sInput.value.trim().toLowerCase();
    hits = q ? [...rows.values()].filter(r => r.name.toLowerCase().includes(q)).sort((a, b) => a.name.toLowerCase().indexOf(q) - b.name.toLowerCase().indexOf(q) || a.name.localeCompare(b.name)).slice(0, 7) : [];
    active = 0; sList.hidden = !q; sInput.setAttribute('aria-expanded', String(!!q));
    sList.innerHTML = hits.map((r, i) => `<li role="option" id="gx-hit-${i}" data-id="${r.id}" aria-selected="${i === active}"><span>${esc(r.name)}</span><span class="gx__hit-v" style="color:${rampCss(r.share)}">${sharePct(r.share)}</span></li>`).join('') || '<li class="gx__none">No country matches</li>';
  };
  const choose = id => { sInput.value = ''; drawHits(); sInput.blur(); select(id); };
  sInput.addEventListener('input', drawHits);
  sInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!hits.length) return; active = (active + (e.key === 'ArrowDown' ? 1 : hits.length - 1)) % hits.length;
      sList.querySelectorAll('[role=option]').forEach((li, i) => li.setAttribute('aria-selected', String(i === active))); sInput.setAttribute('aria-activedescendant', 'gx-hit-' + active); }
    else if (e.key === 'Enter' && hits[active]) { e.preventDefault(); choose(hits[active].id); }
    else if (e.key === 'Escape') { sInput.value = ''; drawHits(); }
  });
  sList.addEventListener('mousedown', e => { const li = e.target.closest('[data-id]'); if (li) { e.preventDefault(); choose(+li.dataset.id); } });
  sInput.addEventListener('blur', () => setTimeout(() => { sList.hidden = true; sInput.setAttribute('aria-expanded', 'false'); }, 120));

  // ---- zoom and reset
  section.querySelectorAll('[data-zoom]').forEach(b => b.addEventListener('click', () => {
    const d = +b.dataset.zoom; idleAt = performance.now();
    if (d === 0) { target.z = baseZ; look(HOME.lon, HOME.lat); unselect(); }
    else target.z = Math.max(baseZ * 0.45, Math.min(baseZ * 1.4, target.z * (d > 0 ? 0.8 : 1.25)));
    wake();
  }));

  // ---- the globe under the pointer: drag to turn, click a country to select it
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const countryAt = (px, py) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(liquid, false)[0]; if (!hit) return -1;
    const p = spin.worldToLocal(hit.point.clone()).normalize();
    const id = idAt(Math.atan2(-p.z, p.x) * 180 / Math.PI, Math.asin(p.y) * 180 / Math.PI);
    return rows.has(id) ? id : -1;
  };
  let down = null;
  canvas.addEventListener('pointerdown', e => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; });
  canvas.addEventListener('pointermove', e => {
    if (down && down.id === e.pointerId) {
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) { down.moved = true; dragging = true; canvas.setPointerCapture(e.pointerId); canvas.classList.add('is-dragging'); hint.hidden = true; }
      if (down.moved) {
        const k = 2.6 / Math.max(240, Math.min(canvas.clientWidth, canvas.clientHeight)) * (view.z / baseZ);
        target.y += (e.clientX - (down.lx ?? down.x)) * k;
        if (e.pointerType === 'mouse') target.x = Math.max(-1.1, Math.min(1.1, target.x + (e.clientY - (down.ly ?? down.y)) * k));
        down.lx = e.clientX; down.ly = e.clientY; idleAt = performance.now(); wake();
      }
      return;
    }
    if (e.pointerType !== 'mouse') return;
    const id = countryAt(e.clientX, e.clientY), sr = canvas.parentElement.getBoundingClientRect();
    canvas.style.cursor = id >= 0 ? 'pointer' : 'grab';
    if (U.u_hover.value !== id) { U.u_hover.value = id; wake(); }
    if (id >= 0) { const r = rows.get(id); hint.innerHTML = `<b>${esc(r.name)}</b> ${sharePct(r.share)} unreached`; hint.hidden = false; hint.style.transform = `translate(${e.clientX - sr.left + 14}px, ${e.clientY - sr.top + 14}px)`; }
    else hint.hidden = true;
  });
  const up = e => {
    if (!down || down.id !== e.pointerId) return;
    if (!down.moved && e.type === 'pointerup') { const id = countryAt(e.clientX, e.clientY); if (id >= 0) select(id); }
    down = null; dragging = false; canvas.classList.remove('is-dragging'); idleAt = performance.now();
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', () => { hint.hidden = true; if (U.u_hover.value !== -1) { U.u_hover.value = -1; wake(); } });

  // ---- "prayed this week", kept in this browser only
  const weekStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); })();
  const prayedKey = g => g.id + '-' + g.code;
  const readPrayed = () => { try { return JSON.parse(localStorage.getItem('sh-prayed') || '{}'); } catch (e) { return {}; } };
  const isPrayed = g => (readPrayed()[prayedKey(g)] || 0) >= weekStart;
  const setPrayed = (g, on) => { try { const m = readPrayed(); if (on) m[prayedKey(g)] = Date.now(); else delete m[prayedKey(g)]; localStorage.setItem('sh-prayed', JSON.stringify(m)); } catch (e) { /* private mode: not kept */ } };

  // ---- the country page ("Your focus"): figures, a locator map, faith and languages, prayer points, rank, people groups
  const PHOTOS = {
    Morocco: ['assets/img/photo-f165348522-960.jpg', 'A narrow street in the old medina of Fez, Morocco, with a laden mule and people walking'],
    Iran: ['assets/img/photo-f82830311-500.jpg', 'Naqsh-e Jahan Square in Isfahan, Iran, seen through a tiled arch'],
    India: ['assets/img/photo-f106143621-960.jpg', 'Morning on the ghats beside the Ganges in Varanasi, India'],
    Japan: ['assets/img/photo-f71590239-960.jpg', 'Shijo Street in Kyoto, Japan, at dusk'],
  };
  const religionLine = r => !r ? 'whose main religion is not known' : /non-?religious/i.test(r) ? 'most of whom hold no religion' : /ethnic/i.test(r) ? 'most of whom follow ethnic religions' : /unknown/i.test(r) ? 'whose main religion is not known' : `most of whom follow ${r}`;
  const workers = id => { const l = (window.SH_LAND[id].t || []).find(t => /workers needed/i.test(t)); const m = l && l.match(/[\d,]+/); return m ? m[0] : null; };
  const locator = id => {
    // a small map of the region: every country quiet, this one in its colour (same frame as art/land.js)
    const c = centre.get(id), r = rows.get(id);
    const x = (c.lon + 171.2) * 2.84, y = (78.1 - c.lat) * 2.85, w = 150, h = 100;
    return `<svg class="cx__map" viewBox="${(x - w / 2).toFixed(1)} ${(y - h / 2).toFixed(1)} ${w} ${h}" role="img" aria-label="Map showing where ${esc(r.name)} is">` +
      window.SH_LAND.map((l, i) => i === id ? '' : `<path d="${l.d}"/>`).join('') +
      `<path class="is-on" d="${window.SH_LAND[id].d}" style="fill:${rampCss(r.share)}"/></svg>`;
  };
  let openId = -1, groups = [];
  const openCountry = id => { if (rows.has(id)) location.hash = 'country=' + encodeURIComponent(rows.get(id).name); };
  const renderCountry = id => {
    const r = rows.get(id); openId = id;
    gx.hidden = true; cx.hidden = false; scrollTo(0, 0);
    const photo = PHOTOS[r.name], wk = workers(id);
    const pinAt = (byShare.length > 1 ? (r.shareRank - 1) / (byShare.length - 1) : 0) * 100;
    cxBody.innerHTML =
      `<div class="cx__grid">` +
        `<div class="cx__col"><h2 class="cx__name" tabindex="-1">${esc(r.name)}</h2>` +
          `<dl class="cx__dl"><div><dt>Total population</dt><dd>${r.pop.toLocaleString('en-US')}</dd></div>` +
          `<div><dt>In unreached groups</dt><dd>${r.lr.toLocaleString('en-US')}</dd></div>` +
          `<div><dt>People groups</dt><dd>${r.gN.toLocaleString('en-US')}</dd></div>` +
          `<div><dt>Least reached groups</dt><dd>${r.lrN.toLocaleString('en-US')}</dd></div>` +
          (wk ? `<div><dt>Workers needed</dt><dd>About ${wk}</dd></div>` : '') + `</dl></div>` +
        `<div class="cx__col cx__mid">${locator(id)}<dl class="cx__facts"><div><dt>Main religion</dt><dd class="js-rel">…</dd></div><div><dt>Major languages</dt><dd class="js-lang">…</dd></div>` +
          `<div><dt>Region</dt><dd>${r.win ? 'Inside the 10/40 Window' : 'Outside the 10/40 Window'}</dd></div></dl>` +
          (photo ? `<img class="cx__photo" src="${photo[0]}" alt="${esc(photo[1])}" width="960" height="640" decoding="async">` : '') + `</div>` +
        `<div class="cx__col"><p class="gx__label cx__pray-h"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 3v14M6 7c0 4 4 6 4 10M14 7c0 4-4 6-4 10" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>Prayer points</p><ul class="cx__pray js-pray"><li>…</li></ul></div>` +
      `</div>` +
      `<div class="cx__rank"><div><p class="gx__label">Ranking</p><p class="cx__rank-n">${r.shareRank}</p><p class="cx__rank-of">of ${byShare.length} countries by share of people in unreached groups</p></div>` +
        `<div class="cx__scale"><p class="gx__label">Ranking is shaded by</p><p class="gx__by-name">Share of people in unreached groups</p>` +
        `<div class="cx__track"><i class="cx__pin" style="left:${pinAt.toFixed(1)}%;background:${rampCss(r.share)}">${r.shareRank}</i></div>` +
        `<div class="cx__ends"><span>1 · most unreached</span><span>${byShare.length} · least</span></div></div></div>` +
      `<div class="cx__groups"><div class="cx__ghead"><div><p class="gx__label">People groups</p><h3 class="cx__h3">${r.gN.toLocaleString('en-US')} people groups, ${r.lrN.toLocaleString('en-US')} least reached</h3></div>` +
        (r.gN > 8 ? '<label class="pick__find"><span class="sr-only">Find a people group</span><input type="search" placeholder="Find a people group" autocomplete="off"></label>' : '') +
        `</div><ul class="cx__list"><li class="pick__loading">Loading people groups…</li></ul><button type="button" class="btn btn--secondary pick__more" hidden></button>` +
        `<p class="globe__src">Joshua Project data file, January 2025. Workers needed: Joshua Project, October 2026.</p></div>`;
    cxBody.querySelector('.cx__name').focus({ preventScroll: true });
    if (!reduced) gsap.from(cxBody.querySelectorAll('.cx__col, .cx__rank, .cx__groups'), { y: 24, autoAlpha: 0, duration: 0.5, stagger: 0.08, ease: 'power2.out', clearProps: 'all' });
    loadCountry(r.code).then(gs => {
      if (openId !== id) return;
      groups = gs.map(g => ({ ...g, code: r.code }));
      const tally = key => { const m = new Map(); groups.forEach(g => { if (g[key]) m.set(g[key], (m.get(g[key]) || 0) + g.p); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
      const rel = tally('r'), lang = tally('l');
      cxBody.querySelector('.js-rel').textContent = rel[0] ? rel[0][0] : 'Not known';
      cxBody.querySelector('.js-lang').textContent = lang.slice(0, 3).map(l => l[0]).join(' · ') || 'Not known';
      const lrg = groups.filter(g => g.lr).sort((a, b) => b.p - a.p)[0], une = groups.filter(g => g.en === 'Unengaged').length;
      const pts = [
        `Pray for the ${big(r.lr)} people in ${r.name} who live in ${r.lrN.toLocaleString('en-US')} least-reached people groups.`,
        lrg ? `Pray for the ${lrg.n} people (${big(lrg.p)}), the largest least-reached group, ${religionLine(lrg.r)}.` : `Pray for the believers of ${r.name} to share the gospel with every people group near them.`,
        une ? `${une.toLocaleString('en-US')} ${une === 1 ? 'group has' : 'groups have'} no church-planting team yet. Pray for the first workers to go.` : 'Pray for the teams already at work here to see disciples who make disciples.',
        wk ? `Ask the Lord of the harvest to send about ${wk} more workers (Matthew 9:38).` : 'Ask the Lord of the harvest to send workers (Matthew 9:38).',
      ];
      cxBody.querySelector('.js-pray').innerHTML = pts.map(t => `<li>${esc(t)}</li>`).join('');
      let gLimit = 24, q = '';
      const list = cxBody.querySelector('.cx__list'), more = cxBody.querySelector('.pick__more'), find = cxBody.querySelector('.cx__ghead input');
      const draw = () => {
        const L = q ? groups.filter(g => g.n.toLowerCase().includes(q) || (g.r || '').toLowerCase().includes(q) || (g.l || '').toLowerCase().includes(q)) : groups;
        list.innerHTML = L.slice(0, gLimit).map(g => `<li><button type="button" class="pick__row" data-g="${groups.indexOf(g)}"><span class="pick__name">${esc(g.n)}</span>` +
          `<span class="pick__meta">${big(g.p)} · ${esc(g.r || 'Religion not known')}</span>` +
          (g.en === 'Unengaged' ? '<span class="pick__badge is-red">Unengaged</span>' : g.lr ? '<span class="pick__badge">Least reached</span>' : '<span class="pick__badge is-calm">Reached</span>') + '</button></li>').join('') || '<li class="pick__loading">No group matches.</li>';
        more.hidden = L.length <= gLimit; more.textContent = `Show all ${L.length.toLocaleString('en-US')} groups`;
      };
      draw();
      if (find) find.addEventListener('input', () => { q = find.value.trim().toLowerCase(); gLimit = 24; draw(); });
      more.addEventListener('click', () => { gLimit = Infinity; draw(); });
      list.addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) openGroup(groups[+b.dataset.g], r.name); });
    });
  };
  const showExplorer = () => { openId = -1; closeGroup(); cx.hidden = true; gx.hidden = false; resize(); wake(); };
  cx.querySelector('.cx__exit').addEventListener('click', () => { const r = rows.get(openId); location.hash = r ? 'c=' + encodeURIComponent(r.name) : ''; });

  // ---- one people group, in a drawer over the country page (never over the globe)
  const drawer = section.querySelector('.cx__drawer'), dBody = drawer.querySelector('.pick__body');
  let lastFocus = null;
  const prayers = (g, place) => {
    const p = [`Pray for the ${big(g.p)} ${g.n} people of ${place}, ${religionLine(g.r)}.`];
    if (g.en === 'Unengaged') p.push('No church-planting team is known to be working among them yet. Pray for the first workers to go.');
    else if (g.e == null || g.e < 0.1) p.push('Fewer than 1 in 1,000 follow Jesus. Pray for the first believers to share with their families.');
    else if (g.e < 2) p.push(`About ${pct(g.e)} are evangelical. Pray for these believers to stand firm and share with friends.`);
    else p.push('Pray for the church among them to send workers to nearby unreached groups.');
    p.push(g.l ? `Pray for Bible teaching, recordings and local believers who speak ${g.l}.` : 'Pray for Bible teaching in their heart language.');
    return p;
  };
  const openGroup = (g, place) => {
    const prayed = isPrayed(g);
    dBody.innerHTML = `<p class="pick__eyebrow">People group · ${esc(place)}</p><h3 tabindex="-1">${esc(g.n)}</h3>` +
      `<div class="pick__stats"><div><b>${big(g.p)}</b><span>people</span></div><div><b>${pct(g.e)}</b><span>evangelical</span></div>` +
      `<div><b>${pct(g.c)}</b><span>Christian of any kind</span></div><div><b>${esc(g.r || 'Not known')}</b><span>main religion</span></div></div>` +
      `<dl class="pick__facts"><dt>Language</dt><dd>${esc(g.l || 'Not known')}</dd><dt>Status</dt><dd>${g.lr ? 'Least reached' : 'Not least reached'}${g.en ? ' · ' + esc(g.en) : ''}</dd></dl>` +
      `<h4 class="pick__h4">Pray this week</h4><ol class="pick__pray">${prayers(g, place).map(t => `<li>${esc(t)}</li>`).join('')}</ol>` +
      `<div class="pick__actions"><button type="button" class="btn ${prayed ? 'btn--secondary' : 'btn--primary'} pick__prayed" aria-pressed="${prayed}">${prayed ? 'Prayed this week' : 'Mark as prayed'}</button>` +
      `<a class="link" href="https://joshuaproject.net/people_groups/${encodeURIComponent(g.id)}/${encodeURIComponent(g.code)}" target="_blank" rel="noopener">Full profile on Joshua Project</a></div>` +
      '<p class="pick__src">Joshua Project data file, January 2025</p>';
    lastFocus = document.activeElement; drawer.hidden = false; document.documentElement.classList.add('cx-locked');
    if (!reduced) { gsap.fromTo(drawer.querySelector('.cx__sheet'), { xPercent: matchMedia('(max-width: 767px)').matches ? 0 : 100, yPercent: matchMedia('(max-width: 767px)').matches ? 100 : 0 }, { xPercent: 0, yPercent: 0, duration: 0.45, ease: 'power3.out' }); gsap.fromTo(drawer.querySelector('.cx__scrim'), { opacity: 0 }, { opacity: 1, duration: 0.3 }); }
    if (window.SHCount) dBody.querySelectorAll('.pick__stats b').forEach(b => window.SHCount(b));
    dBody.querySelector('.pick__prayed').addEventListener('click', e => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true'; setPrayed(g, on);
      e.currentTarget.setAttribute('aria-pressed', String(on)); e.currentTarget.textContent = on ? 'Prayed this week' : 'Mark as prayed';
      e.currentTarget.classList.toggle('btn--primary', !on); e.currentTarget.classList.toggle('btn--secondary', on); drawWeek();
    });
    dBody.querySelector('h3').focus();
  };
  const closeGroup = () => { if (drawer.hidden) return; drawer.hidden = true; document.documentElement.classList.remove('cx-locked'); if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true }); };
  drawer.querySelector('.cx__close').addEventListener('click', closeGroup);
  drawer.querySelector('.cx__scrim').addEventListener('click', closeGroup);
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (!drawer.hidden) closeGroup(); else if (!cx.hidden) cx.querySelector('.cx__exit').click(); }
    if (e.key === 'Tab' && !drawer.hidden) {      // keep the keyboard inside the open drawer
      const f = [...drawer.querySelectorAll('button, a[href], [tabindex="-1"]')]; const a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
  });

  // ---- this week: seven people groups, one a day; today is marked, prayed ones are checked
  const weekList = section.querySelector('.week__list'); let week = [];
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], today = (new Date().getDay() + 6) % 7;
  const drawWeek = () => {
    if (!week.length) return;
    weekList.innerHTML = week.map((g, i) => {
      const state = isPrayed(g) ? '<span class="week__st is-done">Prayed</span>' : i === today ? '<span class="week__st is-today">Today</span>' : '';
      return `<li><button type="button" class="week__row${i === today ? ' is-today' : ''}" data-w="${i}"><span class="week__day">${DAYS[i]}</span>` +
        `<span class="week__who"><b>${esc(g.n.replace(/ \(.*\)$/, ''))}</b><span>${esc(g.country)} · ${big(g.p)}</span></span>${state}</button></li>`;
    }).join('');
  };
  Promise.all([ready, fetch(DATA + 'week.json').then(r => r.json())]).then(([, w]) => {
    const byCode = new Map([...rows.values()].map(r => [r.code, r]));
    week = w.map(g => ({ ...g, country: byCode.get(g.code) ? byCode.get(g.code).name : g.code })); drawWeek();
  }).catch(() => { weekList.innerHTML = '<li class="pick__loading">This week\'s list could not load.</li>'; });
  weekList.addEventListener('click', e => {
    const b = e.target.closest('[data-w]'); if (!b) return;
    const g = week[+b.dataset.w], r = [...rows.values()].find(x => x.code === g.code);
    if (r) { select(r.id); renderCountry(r.id); history.pushState(null, '', '#country=' + encodeURIComponent(r.name)); }
    openGroup(g, g.country);
  });

  // ---- the address: #c=Name selects a country on the globe, #country=Name opens its page (the landing map links here)
  const route = () => {
    const h = decodeURIComponent(location.hash.slice(1)), m = h.match(/^(c|country)=(.+)$/);
    const id = m ? names.indexOf(m[2]) : -1;
    if (m && m[1] === 'country' && rows.has(id)) { if (openId !== id) { select(id, true); renderCountry(id); } return; }
    if (!cx.hidden) showExplorer();
    if (m && rows.has(id)) select(id); else if (!m) unselect();
  };
  ready.then(route); addEventListener('hashchange', route);
}
