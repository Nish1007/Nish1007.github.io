(() => {
'use strict';

/* =====================================================================
   Config — tweak these
   ===================================================================== */
const DEFAULT_ALBUM = 'channel-orange';   // album shown on the hero (or ?album=slug)
const CURSOR_TRAIL  = true;               // faint ripples that follow the mouse
const TITLE_FIXES   = { 'luv-sic': 'Luv(sic)', 'blonde': 'Blonde' };
const ORDER = ['channel-orange', 'modal-soul', 'blonde', 'who-really-cares', 'luv-sic', 'grace', 'son-of-spergy'];

const ALBUMS   = window.ALBUMS || [];
const PROJECTS = window.PROJECTS || {};
ALBUMS.forEach(a => { if (TITLE_FIXES[a.slug]) a.title = TITLE_FIXES[a.slug]; });

// every album is an item; albums with an entry in projects.js are projects, the rest are B-sides
const ITEMS = [...ORDER.map(s => ALBUMS.find(a => a.slug === s)), ...ALBUMS.filter(a => !ORDER.includes(a.slug))]
  .filter(Boolean)
  .map((album, i) => ({ album, project: PROJECTS[album.slug] || null, i }));

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// respects the OS "reduce motion" setting; add ?motion to the URL to force full motion when testing
// A system "reduce motion" setting gets a calm version (a gentle fade instead of the book), never a blank jump.
// The visitor can switch the full animation on (remembered), or add ?motion to the address.
const sysReduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fullMotionChosen = () => { try { return localStorage.getItem('motion') === 'full'; } catch (e) { return false; } };
let reduceMotion = sysReduce && !fullMotionChosen() && !new URLSearchParams(location.search).has('motion');
document.documentElement.classList.toggle('calm', reduceMotion);
const isNarrow = () => matchMedia('(max-width: 900px)').matches;
const nowSec = () => performance.now() / 1000;
const wait = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

const LANG_COLORS = {
  'Java': '#b07219', 'HCL': '#844fba', 'Dockerfile': '#384d54', 'Assembly': '#a8742a', 'C++': '#f34b7d', 'C': '#6e6e6e',
  'Shell': '#89e051', 'Linker Script': '#8a8a8a', 'Python': '#3572a5', 'TypeScript': '#3178c6', 'HTML': '#e34c26',
  'CSS': '#7c5cc4', 'JavaScript': '#f1e05a', 'Haskell': '#5e5086'
};

/* =====================================================================
   Water: a full-screen shader. Every ripple is an expanding ring packet;
   the surface normal bends the colour field and catches a specular glint.
   ===================================================================== */
const canvas = $('#water');
const gl = canvas.getContext('webgl', { antialias: false, alpha: false }) ||
           canvas.getContext('experimental-webgl');

const MAX_RIPPLES = 12;
const ripples = new Float32Array(MAX_RIPPLES * 4);   // x, y, startTime, amplitude (0 = unused)
let rippleIdx = 0;

function addRipple(px, py, amp = 1) {
  if (!gl) return;
  const i = rippleIdx++ % MAX_RIPPLES;
  ripples[i * 4]     = px / innerHeight;
  ripples[i * 4 + 1] = 1 - py / innerHeight;
  ripples[i * 4 + 2] = nowSec();
  ripples[i * 4 + 3] = amp;
}

const palette = { cur: [[.95, .46, .13], [.9, .77, .69], [.71, .41, .22]], tgt: null };
const uniforms = {};
let renderScale = 1;
let waterBusy = false;                       // true while the album opens/closes: the water drops resolution so the animation gets the whole GPU
function setWaterBusy(v) { if (waterBusy !== v) { waterBusy = v; if (typeof resize === 'function') resize(); } }
let resize = () => {};
const adapt = { ema: 1 / 60, cool: 0 };

if (gl) {
  const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`;
  const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;    // real clock: drives the ripples
uniform float uDrift;   // slow clock: drives the ambient colour drift (frozen for reduced motion)
uniform float uAudio;
uniform vec3  uC0, uC1, uC2;
uniform vec4  uR[${MAX_RIPPLES}];

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + 11.7; a *= .5; }
  return v;
}

// the slow, drifting colour the water is made of (the album's three colours)
vec3 field(vec2 p){
  float t = uDrift * .045;
  vec2 q = p * .85;
  vec2 w = vec2(fbm(q + vec2(t, 0.)), fbm(q + vec2(5.2, 1.3) - t));
  float a = fbm(q + 2.2 * w + t);
  float b = fbm(q * 1.25 - 2.0 * w + 3.1 - t);
  vec3 col = mix(uC0, uC1, smoothstep(.2, .8, a));
  col = mix(col, uC2, smoothstep(.38, .85, b) * .9);
  return col;
}

void main(){
  vec2 p = gl_FragCoord.xy / uRes.y;           // x: 0..aspect, y: 0..1
  vec2 grad = vec2(0.);
  float h = 0.;

  // calm ambient swell so the surface is never perfectly still
  float amb = .0035 * (1. + uAudio * 5.);
  grad += amb * vec2(cos(p.x * 5. + uDrift * .5) + .6 * cos(p.y * 8. - uDrift * .7),
                     sin(p.y * 6. - uDrift * .6) + .6 * sin(p.x * 9. + uDrift * .45)) * 6.;

  for (int i = 0; i < ${MAX_RIPPLES}; i++){
    vec4 r = uR[i];
    if (r.w <= 0.) continue;
    float t = uTime - r.z;
    if (t < 0. || t > 8.) continue;
    vec2 d2 = p - r.xy;
    float d = length(d2) + 1e-4;
    float R = .30 * t;                         // front radius (screen-heights)
    float x = d - R;
    float w = .03 + .045 * t;                  // packet widens as it travels
    float env = exp(-x * x / (w * w));
    float k = 64. / (1. + t * .55);            // wavelength stretches with time
    float decay = exp(-t * .72) / (1. + d * 1.8) * smoothstep(0., .12, t);
    float amp = r.w * decay;
    float s = sin(k * x), c = cos(k * x);
    h += amp * s * env;
    float dh = amp * env * (k * c - 2. * x / (w * w) * s);
    grad += dh * (d2 / d);
  }

  vec2 off = grad * .0072;
  vec3 col = field(p + off);

  // light the surface
  vec3 n = normalize(vec3(-grad * .55, 1.));
  vec3 L = normalize(vec3(-.4, .6, .8));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float spec = pow(max(dot(n, H), 0.), 70.);
  float shade = dot(n.xy, vec2(-.4, .6)) * .55;
  col += shade * .18;
  col += spec * .38;
  col += h * .05;

  // soft vignette + grain (hides gradient banding)
  vec2 uv = gl_FragCoord.xy / uRes;
  col *= 1. - .22 * pow(length(uv - .5) * 1.25, 2.4);
  col += (hash(gl_FragCoord.xy + fract(uTime)) - .5) * .028;
  gl_FragColor = vec4(col, 1.);
}`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  ['uRes', 'uTime', 'uDrift', 'uAudio', 'uC0', 'uC1', 'uC2', 'uR'].forEach(n => uniforms[n] = gl.getUniformLocation(prog, n));

  // Render scale adapts: if frames are slow (weak GPU), the water quietly drops resolution.
  resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * renderScale * (waterBusy ? .6 : 1);
    canvas.width  = Math.max(64, Math.round(innerWidth * dpr));
    canvas.height = Math.max(64, Math.round(innerHeight * dpr));
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  addEventListener('resize', resize);
  resize();
} else {
  canvas.style.display = 'none';   // CSS gradient fallback on <body> is used instead
}

/* =====================================================================
   Pointer: ripples on click / tap, faint trail on mouse move
   ===================================================================== */
const hint = $('#hint');
addEventListener('pointerdown', e => {
  addRipple(e.clientX, e.clientY, 1);
  hint.classList.add('gone');
}, { passive: true });

let lastTrail = { x: -999, y: -999 };
if (CURSOR_TRAIL && !reduceMotion) {
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const dx = e.clientX - lastTrail.x, dy = e.clientY - lastTrail.y;
    if (dx * dx + dy * dy < 120 * 120) return;
    lastTrail = { x: e.clientX, y: e.clientY };
    addRipple(e.clientX, e.clientY, .13);
  }, { passive: true });
}

/* =====================================================================
   Theme from album art
   ===================================================================== */
const root = document.documentElement;

function applyTheme(a) {
  const cols = a.palette.map(hex2rgb);
  palette.tgt = cols;
  const L = lum(cols[0]) * .5 + lum(cols[1]) * .3 + lum(cols[2]) * .2;
  root.dataset.theme = L > .5 ? 'light' : 'dark';
  root.style.setProperty('--c0', a.palette[0]);
  root.style.setProperty('--c1', a.palette[1]);
  root.style.setProperty('--c2', a.palette[2]);
  root.style.setProperty('--accent', a.accent);
  $('#pn-cover').src = a.cover;
  $('#pn-title').textContent = `${a.title} — ${a.artist}`;
  $('meta[name="theme-color"]').content = a.palette[0];
}

/* =====================================================================
   Audio + beat detection
   ===================================================================== */
const el = {
  album: $('#pj-album'), artist: $('#pj-artist'), track: $('#pj-track'),
  bar: $('#pj-bar'), fill: $('#pj-fill'), tcur: $('#pj-tcur'), tdur: $('#pj-tdur'),
  toggle: $('#pj-toggle'), icoPlay: $('#pj-ico-play'), icoPause: $('#pj-ico-pause'),
  led: $('#pj-led'), label: $('#pj-label'), vrot: $('#pj-vrot'), arm: $('#pj-arm'), vwrap: $('#pj-vwrap'),
  platter: $('#pj-platter'), shelf: $('#shelf'),
  hrot: $('#hr-rot'), hlabel: $('#hr-label'),
};

let audio = null, actx = null, analyser = null, fft = null, analyserOK = false;
let playing = false;
let bassAvg = 0, lastBeat = 0, level = 0, playStartedAt = 0, fakeBeatAt = 0, heardSignal = false;
let cur = null;            // item currently loaded in the player
let trackIdx = 0;

function makeAudio(cors) {
  const a = new Audio();
  if (cors) a.crossOrigin = 'anonymous';
  a.preload = 'auto';
  a.addEventListener('ended', () => nextTrack());
  a.addEventListener('error', () => {
    if (cors && audio === a) {                 // CORS-less retry: still plays, just no analyser
      const src = a.src, wasPlaying = playing;
      analyserOK = false;
      audio = makeAudio(false);
      audio.src = src;
      if (wasPlaying) audio.play().catch(() => setPlaying(false));
    }
  });
  return a;
}

function ensureAudio() {
  if (audio) return;
  audio = makeAudio(true);
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    actx = new AC();
    const src = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = .55;
    src.connect(analyser);
    analyser.connect(actx.destination);
    fft = new Uint8Array(analyser.frequencyBinCount);
    analyserOK = true;
  } catch (err) { analyserOK = false; }
}

function analyse(time) {
  if (!playing || !analyserOK || !analyser) { level *= .92; return; }
  analyser.getByteFrequencyData(fft);
  let bass = 0, all = 0;
  for (let i = 1; i <= 5; i++) bass += fft[i];
  bass /= 5 * 255;
  for (let i = 0; i < fft.length; i++) all += fft[i];
  all /= fft.length * 255;
  if (all > .004) heardSignal = true;
  level += (all - level) * .2;

  const onset = bass > bassAvg * 1.16 + .04 && bass > .32;
  if (onset && time - lastBeat > .3) {
    lastBeat = time;
    pulseFromRecord(clamp(.55 + (bass - bassAvg) * 2.2, .5, 1.1));
  }
  bassAvg += (bass - bassAvg) * .04;

  // if the browser gives us silence (no CORS), keep time with a gentle pulse instead
  if (!heardSignal && time - playStartedAt > 1.4 && time - fakeBeatAt > .66) {
    fakeBeatAt = time;
    pulseFromRecord(.6);
  }
}

// pulse from the record on the turntable (the water shows through the left half of the overlay)
function pulseFromRecord(amp) {
  const r = el.platter.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  if (cx > 0 && cx < innerWidth && cy > 0 && cy < innerHeight) addRipple(cx, cy, amp);
  else addRipple(innerWidth * .5, innerHeight * .5, amp * .55);
}

function setPlaying(v) {
  playing = v;
  el.icoPlay.toggleAttribute('hidden', v);       // SVG elements have no .hidden property, so use the attribute
  el.icoPause.toggleAttribute('hidden', !v);
  el.toggle.setAttribute('aria-label', v ? 'Pause' : 'Play');
  el.led.classList.toggle('on', v);
}

function trackFor(item) {
  const p = item.project;
  return p && typeof p.track === 'number' ? p.track : (item.album.default || 0);
}

function loadTrack(i, autoplay) {
  ensureAudio();
  const a = cur.album;
  trackIdx = (i + a.tracks.length) % a.tracks.length;
  const t = a.tracks[trackIdx];
  audio.src = t.u;
  audio.volume = 1;
  el.track.textContent = t.n;
  const snd = $('#pj-sound-track'); if (snd) snd.textContent = t.n;
  $$('.tracks button').forEach((b, k) => b.setAttribute('aria-current', String(k === trackIdx)));
  heardSignal = false;
  playStartedAt = nowSec();
  if (autoplay) {
    if (actx && actx.state === 'suspended') actx.resume();
    const p = audio.play();
    if (p && p.then) p.then(() => setPlaying(true)).catch(() => { setPlaying(false); el.track.textContent = `Tap play — ${t.n}`; });
  }
}

const nextTrack = () => loadTrack(trackIdx + 1, true);
function prevTrack() {
  if (audio && audio.currentTime > 4) { audio.currentTime = 0; return; }
  loadTrack(trackIdx - 1, true);
}
function togglePlay() {
  if (!audio || !audio.src) { loadTrack(trackIdx, true); return; }
  if (playing) { audio.pause(); setPlaying(false); }
  else {
    if (actx && actx.state === 'suspended') actx.resume();
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }
}
function fadeOutPause(ms = 380) {
  setPlaying(false);
  if (!audio) return;
  const a = audio, v0 = a.volume, t0 = performance.now();
  const id = setInterval(() => {
    const k = (performance.now() - t0) / ms;
    if (k >= 1) { clearInterval(id); a.pause(); a.volume = 1; } else a.volume = v0 * (1 - k);
  }, 30);
}

el.toggle.addEventListener('click', togglePlay);
$('#pj-vinyl').addEventListener('click', togglePlay);
$('#pj-prevtrack').addEventListener('click', prevTrack);
$('#pj-nexttrack').addEventListener('click', nextTrack);
function seekTo(clientX) {
  if (!audio || !audio.duration) return;
  const r = el.bar.getBoundingClientRect();
  audio.currentTime = clamp((clientX - r.left) / r.width, 0, 1) * audio.duration;
}
el.bar.addEventListener('click', e => seekTo(e.clientX));
el.bar.addEventListener('keydown', e => {
  if (!audio || !audio.duration) return;
  if (e.key === 'ArrowRight') { e.stopPropagation(); audio.currentTime = Math.min(audio.duration, audio.currentTime + 3); }
  if (e.key === 'ArrowLeft')  { e.stopPropagation(); audio.currentTime = Math.max(0, audio.currentTime - 3); }
});

/* =====================================================================
   Shelf: every album is a tile
   ===================================================================== */
function renderShelf() {
  el.shelf.innerHTML = '';
  ITEMS.forEach(it => {
    const a = it.album, p = it.project;
    const li = document.createElement('li');
    const topLang = p && p.langs && p.langs[0] ? p.langs[0][0] : '';
    const meta = p
      ? `${topLang ? `<span class="pill">${esc(topLang)}</span>` : ''}<span>${esc(p.kind)}</span>${p.private ? '<span class="pill dashed">Private</span>' : ''}`
      : `<span class="pill dashed">B-side</span><span>Just for the music</span>`;
    li.innerHTML = `
      <button class="tile" type="button" data-i="${it.i}" style="--tile-accent:${a.accent}" aria-label="Open ${esc(p ? p.title : a.title)}${p ? '' : ' (B-side)'}">
        <span class="book3d">
          <span class="page" aria-hidden="true"></span>
          <span class="sleeve"><img src="${esc(a.cover)}" alt="${esc(a.title)} by ${esc(a.artist)}" width="480" height="480" loading="lazy"></span>
        </span>
        <span class="tile-open" aria-hidden="true">${p ? 'Open project' : 'Play'} ↗</span>
        <span class="tile-cap">
          <span class="tile-num">${p ? pad(it.i + 1) : 'B-side'}</span>
          <span class="tile-title">${esc(p ? p.title : a.title)}</span>
          <span class="tile-meta">${meta}</span>
        </span>
      </button>`;
    li.firstElementChild.addEventListener('click', e => openItem(it.i, e.currentTarget));
    el.shelf.appendChild(li);
  });
  // an empty slot on the shelf for whatever I build next
  const slot = document.createElement('li');
  slot.innerHTML = `
    <div class="tile slot" aria-hidden="true">
      <span class="book3d"></span>
      <span class="tile-cap"><span class="tile-num">Next record</span><span class="tile-title">In the works</span><span class="tile-meta"><span class="pill dashed">Soon</span></span></span>
    </div>`;
  el.shelf.appendChild(slot);
}
const tileOf = i => $(`.tile[data-i="${i}"]`);

/* =====================================================================
   Project room: the lamps, the glow and the rug drift a little with the pointer
   ===================================================================== */
function initRoom() {
  const room = $('#room');
  let raf = 0, px = 0, py = 0;
  const apply = () => {
    raf = 0;
    const r = room.getBoundingClientRect();
    room.style.setProperty('--mx', ((px - r.left) / r.width * 2 - 1).toFixed(3));
    room.style.setProperty('--my', ((py - r.top) / r.height * 2 - 1).toFixed(3));
    room.style.setProperty('--lx', (px - r.left).toFixed(0) + 'px');
    room.style.setProperty('--ly', (py - r.top).toFixed(0) + 'px');
  };
  room.addEventListener('pointermove', e => {
    if (reduceMotion || e.pointerType !== 'mouse' || openIdx >= 0) return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(apply);
  }, { passive: true });
  room.addEventListener('pointerleave', () => {
    room.style.setProperty('--mx', 0); room.style.setProperty('--my', 0);
  });

  // "reduce motion" visitors get a gentle fade; let them opt in to the full book animation (and back)
  const note = $('#motion-note');
  if (sysReduce && note) {
    const draw = () => {
      note.hidden = false;
      note.innerHTML = reduceMotion
        ? 'Your device asks for reduced motion, so albums fade open. <button type="button">Play the full book animation</button>'
        : 'Playing the full book animation. <button type="button">Back to calm</button>';
      note.querySelector('button').addEventListener('click', () => {
        const full = reduceMotion;               // currently calm -> switch to full
        try { localStorage.setItem('motion', full ? 'full' : 'calm'); } catch (e) {}
        reduceMotion = !full;
        document.documentElement.classList.toggle('calm', reduceMotion);
        draw();
      });
    };
    draw();
  }
}

/* =====================================================================
   Project sheet (right half)
   ===================================================================== */
function sheetHTML(it) {
  const a = it.album, p = it.project, n = ITEMS.length;
  const prev = ITEMS[(it.i - 1 + n) % n], next = ITEMS[(it.i + 1) % n];
  const nm = x => x.project ? x.project.title : x.album.title;
  const nav = `
    <nav class="pj-nav" aria-label="More projects">
      <button type="button" data-go="${prev.i}"><small>← Previous</small><span>${esc(nm(prev))}</span></button>
      <button type="button" class="next" data-go="${next.i}"><small>Next →</small><span>${esc(nm(next))}</span></button>
    </nav>`;
  const sound = `<p class="pj-sound">♪ Soundtrack: <b id="pj-sound-track"></b> — ${esc(a.artist)} · ${esc(a.title)}</p>`;

  if (!p) {
    const tracks = a.tracks.map((t, k) => `<li><button type="button" data-track="${k}"><span class="n">${k + 1}</span><span>${esc(t.n)}</span></button></li>`).join('');
    return `
      <p class="eyebrow">B-side</p>
      <h2 id="pj-title">${esc(a.title)}</h2>
      <p class="pj-tag">No project on this one.</p>
      <p class="pj-desc">${esc(a.artist)} · ${esc(a.year)}. It's just a record I love. Press play, or pick a track.</p>
      <h3>Tracklist <span style="text-transform:none;letter-spacing:0;font-weight:400">(30-second previews)</span></h3>
      <ol class="tracks">${tracks}</ol>
      ${nav}`;
  }

  const facts = p.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const bar = p.langs.map(([n, v]) => `<i style="width:${v}%;background:${LANG_COLORS[n] || '#999'}" title="${esc(n)} ${v}%"></i>`).join('');
  const legend = p.langs.map(([n, v]) => `<li><i style="background:${LANG_COLORS[n] || '#999'}"></i>${esc(n)} <b>${v}%</b></li>`).join('');
  const highlights = p.highlights.map(h => `<li>${esc(h)}</li>`).join('');
  const tags = p.stack.map(s => `<li>${esc(s)}</li>`).join('');
  const cta = p.github
    ? `<a class="btn primary" href="${esc(p.github)}" target="_blank" rel="noopener">View on GitHub ↗</a>`
    : `<span class="btn" aria-disabled="true">Private repository</span>`;
  return `
    <p class="eyebrow">Project ${pad(it.i + 1)} · ${esc(p.kind)}</p>
    <h2 id="pj-title">${esc(p.title)}</h2>
    <p class="pj-tag">${esc(p.tagline)}</p>
    <p class="pj-desc">${esc(p.description)}</p>
    <dl class="pj-facts">${facts}</dl>
    <div class="pj-langs">
      <div class="lang-bar" role="img" aria-label="Languages">${bar}</div>
      <ul class="legend">${legend}</ul>
    </div>
    <h3>Highlights</h3>
    <ul class="pj-list">${highlights}</ul>
    <h3>Built with</h3>
    <ul class="tags">${tags}</ul>
    <div class="cta">${cta}</div>
    ${p.private ? '<p class="pj-sound">The source is private, but I\'m happy to talk through how it works.</p>' : ''}
    ${sound}
    ${nav}`;
}

/* =====================================================================
   Overlay: the album splits into two halves
   ===================================================================== */
const pj = {
  root: $('#pj'), scrim: $('#pj-scrim'),
  book: $('#pj-book'), cover: $('#bk-cover'), front: $('#bk-front'), page: $('#bk-right'),
  fshade: $('#bk-fshade'), bshade: $('#bk-bshade'), cast: $('#bk-cast'), print: $('#bk-print'),
  bkEyebrow: $('#bk-eyebrow'), bkTitle: $('#bk-title'), bkTag: $('#bk-tag'), bkAlbum: $('#bk-album'), bkArtist: $('#bk-artist'),
  intro: $('#pj-intro'), inEyebrow: $('#in-eyebrow'), inTitle: $('#in-title'),
  left: $('#pj-left'), right: $('#pj-right'), artL: $('#pj-art-l'), artR: $('#pj-art-r'),
  lcontent: $('.pj-lcontent'), sheet: $('#pj-sheet'), close: $('#pj-close'),
};
let openIdx = -1, startIdx = -1, busy = false, srcEl = null, lastFocus = null;
const EASE_IO = 'cubic-bezier(.7,0,.2,1)', EASE_OUT = 'cubic-bezier(.2,.8,.2,1)', EASE_BOOK = 'cubic-bezier(.45,.05,.15,1)';

// run a Web Animation, then bake the end state into inline style so it sticks
const SLOW = Math.max(1, +new URLSearchParams(location.search).get('slow') || 1);   // ?slow=6 plays the open/close animation 6x slower
function anim(node, kf, opt = {}) {
  const { calm, ...rest } = opt;                  // calm: true = a gentle fade that is still played under "reduce motion"
  opt = { duration: 600, delay: 0, ...rest };
  opt = (reduceMotion && !calm) ? { ...opt, duration: 1, delay: 0 } : { ...opt, duration: opt.duration * SLOW, delay: opt.delay * SLOW };
  const a = node.animate(kf, { easing: EASE_IO, fill: 'both', ...opt });
  return a.finished.then(() => { try { a.commitStyles(); } catch (e) {} a.cancel(); }, () => {});
}

// S = side of the closed album; once open, the spread is 2S wide and its two pages sit either side of the screen centre
function geom() {
  const W = innerWidth, H = innerHeight;
  return { W, H, S: Math.round(Math.min(H * .56, W * .4, 540)) };
}

// where the two pages of the open book are, as clip-paths on the left and right halves of the screen
function pageRects(g) {
  const v = (g.H - g.S) / 2, h = g.W / 2 - g.S;
  return { L: `inset(${v}px 0px ${v}px ${h}px)`, R: `inset(${v}px ${h}px ${v}px 0px)` };
}

// put the (closed) book in the middle of the screen and write its pages
function placeBook(g, it) {
  const a = it.album, p = it.project;
  Object.assign(pj.book.style, { display: 'block', width: g.S + 'px', height: g.S + 'px', left: (g.W - g.S) / 2 + 'px', top: (g.H - g.S) / 2 + 'px' });
  pj.root.style.setProperty('--S', g.S + 'px');
  pj.book.style.setProperty('--S', g.S + 'px');
  pj.front.style.backgroundImage = pj.print.style.backgroundImage = `url("${a.cover}")`;
  const eyebrow = p ? `Project ${pad(it.i + 1)} · ${p.kind}` : 'B-side';
  pj.bkEyebrow.textContent = pj.inEyebrow.textContent = eyebrow;
  pj.bkTitle.textContent = pj.inTitle.textContent = p ? p.title : a.title;
  pj.bkTag.textContent = p ? p.tagline : `${a.artist} · ${a.year}`;
  pj.bkAlbum.textContent = a.title;
  pj.bkArtist.textContent = `${a.artist}${a.year ? ' · ' + a.year : ''}`;
}
// decode the cover before an animation starts, so the first frame never waits on it
const decodeImg = src => { const i = new Image(); i.src = src; return (i.decode ? i.decode() : Promise.resolve()).catch(() => {}); };

const sheetKids = () => $$('.pj-sheet > *');
const originRect = node => (node.querySelector('.book3d') || node).getBoundingClientRect();
const liftSource = (node, on) => {
  if (!node) return;
  if (node.classList.contains('tile')) node.classList.toggle('lifted', on);
  else node.style.visibility = on ? 'hidden' : '';
};
function setInert(v) { ['#top', '#nav', '#foot'].forEach(s => { const n = $(s); if (n) n.inert = v; }); }

function fillOverlay(it) {
  const a = it.album;
  el.label.style.backgroundImage = `url("${a.cover}")`;
  el.album.textContent = a.title;
  el.artist.textContent = `${a.artist}${a.year ? ' · ' + a.year : ''}`;
  pj.sheet.innerHTML = sheetHTML(it);
  pj.sheet.scrollTop = 0;
}

function clearInline() {
  [pj.left, pj.right, pj.artL, pj.artR, pj.lcontent, pj.sheet, pj.close, pj.scrim, pj.root, pj.book, pj.cover, pj.front, pj.page, pj.fshade, pj.bshade, pj.cast, pj.intro, pj.inEyebrow, pj.inTitle].forEach(n => {
    ['clip-path', 'visibility', 'opacity', 'transform', 'border-radius'].forEach(p => n.style.removeProperty(p));
  });
  pj.book.style.display = 'none';
  sheetKids().forEach(k => { k.style.removeProperty('opacity'); k.style.removeProperty('transform'); });
}

async function openItem(i, source) {
  if (busy || openIdx >= 0) return;
  busy = true; openIdx = startIdx = i; srcEl = source; lastFocus = document.activeElement;
  const it = ITEMS[i]; cur = it;
  applyTheme(it.album);
  fillOverlay(it);
  loadTrack(trackFor(it), true);               // start the song inside the click gesture
  setInert(true);
  clearInline();
  pj.root.hidden = false;

  if (isNarrow() || reduceMotion) {
    // simple version for phones / reduced motion: the stacked page slides up
    pj.left.style.visibility = 'visible'; pj.right.style.visibility = 'visible';
    pj.scrim.style.opacity = 1; pj.close.style.opacity = 1;
    document.body.classList.add('pj-open');
    await anim(pj.root, [{ opacity: 0, transform: isNarrow() && !reduceMotion ? 'translateY(48px)' : 'none' }, { opacity: 1, transform: 'none' }], { duration: reduceMotion ? 460 : 520, easing: EASE_OUT, calm: true });
    pj.root.scrollTop = 0;
    busy = false; pj.close.focus({ preventScroll: true });
    if (closeQueued) closeOverlay();
    return;
  }

  const g = geom(), S = g.S, rects = pageRects(g);
  const from = originRect(source);
  const s = from.width / S;
  const dx = from.left + from.width / 2 - g.W / 2, dy = from.top + from.height / 2 - g.H / 2;
  const round = source.id === 'hero-record';

  // everything that appears later starts hidden
  pj.lcontent.style.opacity = 0; pj.sheet.style.opacity = 0; sheetKids().forEach(k => k.style.opacity = 0);
  placeBook(g, it);
  pj.page.style.opacity = 0; pj.bshade.style.opacity = 1; pj.intro.style.opacity = 1;
  liftSource(source, true);
  await decodeImg(it.album.cover);

  // One timeline (ms), every step scheduled up front so nothing waits on anything else:
  //   0     intro title card + the album flies to the middle
  //   t1    the cover swings open on its spine (the book slides over so the spread ends up centred)
  //   tx    the two pages grow into the two halves of the screen, a little before the cover has landed
  const FL = 440, HOLD = 150, OD = 760, D = 720;
  const t1 = FL + HOLD, tx = t1 + OD - 220;
  setWaterBusy(true);                              // the water drops resolution while this plays
  pj.root.classList.add('pj-moving');              // and the big live blur is switched off
  document.body.classList.add('pj-open');          // the shelf fades away behind, so the book opens over clean water

  const F = { fill: 'forwards' };                  // later steps mustn't touch a node before their turn
  const early = [
    anim(pj.scrim, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, easing: 'ease' }),
    anim(pj.book, [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: 'none' }], { duration: FL, easing: EASE_OUT }),
    anim(pj.front, [{ borderRadius: round ? '50%' : `${6 / s}px` }, { borderRadius: '3px 6px 6px 3px' }], { duration: FL, easing: EASE_OUT }),
    anim(pj.page, [{ opacity: 0 }, { opacity: 1 }], { duration: 60, delay: t1, ...F }),
    // intro: eyebrow, then title, rise in while the album lands, and leave as the cover lifts
    anim(pj.inEyebrow, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: EASE_OUT }),
    anim(pj.inTitle, [{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 200, easing: EASE_OUT }),
    anim(pj.inEyebrow, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-10px)' }], { duration: 240, delay: t1 + 40, easing: 'ease-in', ...F }),
    anim(pj.inTitle, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-16px)' }], { duration: 280, delay: t1 + 40, easing: 'ease-in', ...F })
  ];

  // the cover swing: the slide and the swing share one easing curve, so the spine never drifts against the cover
  const swing = [
    anim(pj.book,  [{ transform: 'none' }, { transform: `translateX(${S / 2}px)` }], { duration: OD, delay: t1, easing: EASE_BOOK, ...F }),
    anim(pj.cover, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: OD, delay: t1, easing: EASE_BOOK, ...F }),
    anim(pj.fshade, [{ opacity: 0 }, { opacity: 1 }], { duration: OD * .45, delay: t1, easing: 'ease-in', ...F }),                  // the outside darkens as it turns away
    anim(pj.bshade, [{ opacity: 1 }, { opacity: 0 }], { duration: OD * .45, delay: t1 + OD * .5, easing: 'ease-out', ...F }),      // the inside catches the light as it lands
    anim(pj.cast, [{ opacity: 0 }, { opacity: .8, offset: .5 }, { opacity: 0 }], { duration: OD, delay: t1, ...F })                  // the cover's shadow sweeps across the page
  ];

  // the open spread becomes the project page
  const expand = wait(tx * SLOW).then(() => {
    addRipple(g.W / 2, g.H / 2, 1.1);
    pj.left.style.visibility = 'visible'; pj.right.style.visibility = 'visible';
    pj.left.style.clipPath = rects.L; pj.right.style.clipPath = rects.R;
    return Promise.all([
      anim(pj.book,  [{ opacity: 1 }, { opacity: 0 }], { duration: 360, delay: 140, easing: 'ease', ...F }),
      anim(pj.left,  [{ clipPath: rects.L }, { clipPath: 'inset(0px 0px 0px 0px)' }], { duration: D, easing: EASE_BOOK }),
      anim(pj.right, [{ clipPath: rects.R }, { clipPath: 'inset(0px 0px 0px 0px)' }], { duration: D, easing: EASE_BOOK }),
      anim(pj.artL,  [{ opacity: 1 }, { opacity: 0 }], { duration: D * .55, delay: D * .3, easing: 'ease' }),          // the paper turns to glass as it grows
      anim(pj.artR,  [{ opacity: 1 }, { opacity: 0 }], { duration: D * .55, delay: D * .3, easing: 'ease' }),
      anim(pj.sheet, [{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 200, easing: 'ease' }),
      anim(pj.lcontent, [{ opacity: 0, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 300, easing: EASE_OUT }),
      ...sheetKids().map((k, n) => anim(k, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 380 + Math.min(n, 9) * 40, easing: EASE_OUT })),
      anim(pj.close, [{ opacity: 0 }, { opacity: 1 }], { duration: 320, delay: 480, easing: 'ease' })
    ]);
  });
  await Promise.all([...early, ...swing, expand]);
  pj.root.classList.remove('pj-moving');
  setWaterBusy(false);
  pj.book.style.display = 'none';
  busy = false;
  pj.close.focus({ preventScroll: true });
  if (closeQueued) closeOverlay();
}

let closeQueued = false;
async function closeOverlay() {
  if (openIdx < 0) return;
  if (busy) { closeQueued = true; return; }   // asked to close mid-animation: do it as soon as that one ends
  busy = true; closeQueued = false;
  fadeOutPause();
  // go back to where it opened from (the hero record), unless you've flipped to another album since
  const target = (srcEl && srcEl.id === 'hero-record' && openIdx === startIdx) ? srcEl : (tileOf(openIdx) || $('#hero-record'));
  const small = isNarrow() || reduceMotion;

  if (small) {
    await anim(pj.root, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: isNarrow() && !reduceMotion ? 'translateY(48px)' : 'none' }], { duration: 380, easing: 'ease', calm: true });
    document.body.classList.remove('pj-open');
    return finishClose(target);
  }

  const g = geom(), S = g.S, rects = pageRects(g), it = ITEMS[openIdx];
  placeBook(g, it);                                      // writes the pages again, ready to be revealed
  pj.book.style.transform = `translateX(${S / 2}px)`; pj.book.style.opacity = 0;
  pj.cover.style.transform = 'rotateY(-180deg)'; pj.page.style.opacity = 1;
  [pj.fshade, pj.bshade, pj.cast].forEach(n => n.style.opacity = 0);
  pj.root.classList.add('pj-moving');
  setWaterBusy(true);
  document.body.classList.remove('pj-open');             // the shelf fades back in behind

  if (target.classList.contains('tile')) {
    const r = target.getBoundingClientRect();
    if (r.bottom < 40 || r.top > innerHeight - 40) target.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  const to = originRect(target);
  const s = to.width / S;
  const dx = to.left + to.width / 2 - g.W / 2, dy = to.top + to.height / 2 - g.H / 2;
  const round = target.id === 'hero-record';

  // One timeline (ms), the open sequence in reverse: content out, the halves shrink back to two pages,
  // the cover swings shut, then the album flies home.
  const F = { fill: 'forwards' };
  const ts = 100, D = 620;                               // the pages start to shrink
  const tc = ts + D - 180, CD = 720;                     // the cover starts to close just before they finish
  const tf = tc + CD, FL = 420;                          // and flies back to the shelf
  const hideHalves = wait((ts + D) * SLOW).then(() => { pj.left.style.visibility = pj.right.style.visibility = 'hidden'; });
  await Promise.all([
    hideHalves,
    anim(pj.lcontent, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease' }),
    anim(pj.close, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease' }),
    ...sheetKids().map(k => anim(k, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: 'ease' })),
    anim(pj.sheet, [{ opacity: 1 }, { opacity: 0 }], { duration: 240, delay: 60, easing: 'ease' }),
    anim(pj.left,  [{ clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: rects.L }], { duration: D, delay: ts, easing: EASE_BOOK }),
    anim(pj.right, [{ clipPath: 'inset(0px 0px 0px 0px)' }, { clipPath: rects.R }], { duration: D, delay: ts, easing: EASE_BOOK }),
    anim(pj.artL,  [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: ts }),
    anim(pj.artR,  [{ opacity: 0 }, { opacity: 1 }], { duration: 380, delay: ts }),
    anim(pj.book,  [{ opacity: 0 }, { opacity: 1 }], { duration: 260, delay: ts + D - 260, easing: 'ease', ...F }),
    // the cover swings shut and the book slides back to the middle (one shared easing, as when opening)
    anim(pj.book,  [{ transform: `translateX(${S / 2}px)` }, { transform: 'none' }], { duration: CD, delay: tc, easing: EASE_BOOK, ...F }),
    anim(pj.cover, [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], { duration: CD, delay: tc, easing: EASE_BOOK, ...F }),
    anim(pj.bshade, [{ opacity: 0 }, { opacity: 1 }], { duration: CD * .45, delay: tc, easing: 'ease-in', ...F }),
    anim(pj.fshade, [{ opacity: 1 }, { opacity: 0 }], { duration: CD * .45, delay: tc + CD * .5, easing: 'ease-out', ...F }),
    anim(pj.cast, [{ opacity: 0 }, { opacity: .8, offset: .5 }, { opacity: 0 }], { duration: CD, delay: tc, ...F }),
    // ...and the album flies back to its place on the shelf
    anim(pj.page,  [{ opacity: 1 }, { opacity: 0 }], { duration: 1, delay: tf, ...F }),
    anim(pj.book,  [{ transform: 'none' }, { transform: `translate(${dx}px, ${dy}px) scale(${s})` }], { duration: FL, delay: tf, easing: EASE_IO, ...F }),
    anim(pj.front, [{ borderRadius: '3px 6px 6px 3px' }, { borderRadius: round ? '50%' : `${6 / s}px` }], { duration: FL, delay: tf, easing: EASE_IO, ...F }),
    anim(pj.scrim, [{ opacity: 1 }, { opacity: 0 }], { duration: FL, delay: tf, easing: 'ease', ...F })
  ]);
  setWaterBusy(false);
  finishClose(target);
}

function finishClose(target) {
  liftSource(target, false);
  if (srcEl && srcEl !== target) liftSource(srcEl, false);   // whatever the album was lifted from comes back too
  clearInline();
  pj.root.classList.remove('pj-moving');
  pj.root.hidden = true;
  setInert(false);
  document.body.classList.remove('pj-open');
  openIdx = -1; busy = false;
  (lastFocus && lastFocus.focus ? lastFocus : target).focus({ preventScroll: true });
}

async function switchTo(j) {
  if (busy || openIdx < 0 || j === openIdx) return;
  busy = true;
  const it = ITEMS[j];
  await Promise.all([
    ...sheetKids().map(k => anim(k, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: 'ease' })),
    anim(el.vwrap, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease' })
  ]);
  openIdx = j; cur = it;
  applyTheme(it.album);
  fillOverlay(it);
  loadTrack(trackFor(it), true);
  const kids = sheetKids(); kids.forEach(k => k.style.opacity = 0);
  el.vwrap.classList.add('swap'); el.vwrap.style.removeProperty('opacity');
  await wait(30);
  el.vwrap.classList.remove('swap');
  await Promise.all(kids.map((k, n) => anim(k, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: Math.min(n, 8) * 45, easing: EASE_OUT })));
  busy = false;
  if (closeQueued) closeOverlay();
}

pj.close.addEventListener('click', closeOverlay);
pj.sheet.addEventListener('click', e => {
  const go = e.target.closest('[data-go]');
  if (go) { switchTo(+go.dataset.go); return; }
  const tr = e.target.closest('[data-track]');
  if (tr) loadTrack(+tr.dataset.track, true);
});
addEventListener('keydown', e => {
  if (openIdx < 0) return;
  if (e.key === 'Escape') { e.preventDefault(); closeOverlay(); }
  else if (e.key === 'ArrowRight') switchTo((openIdx + 1) % ITEMS.length);
  else if (e.key === 'ArrowLeft') switchTo((openIdx - 1 + ITEMS.length) % ITEMS.length);
  else if (e.code === 'Space' && !/^(BUTTON|A|INPUT|TEXTAREA)$/.test(document.activeElement.tagName) && document.activeElement.getAttribute('role') !== 'slider') { e.preventDefault(); togglePlay(); }
});

/* =====================================================================
   Turntable physics: the record spins up / down, the arm eases on and
   creeps inward as the track plays
   ===================================================================== */
const heroRecEl = $('#hero-record');
let angle = 0, omega = 0, armAngle = 0, heroAngle = 0, heroOmega = 0;
const ARM_REST = 0, ARM_OUT = 23.4, ARM_IN = 46.4;    // degrees about the pivot (see SVG geometry)
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const setText = (node, s) => { if (node.textContent !== s) node.textContent = s; };

function updateDeck(dt) {
  if (openIdx >= 0) {
    const target = playing ? 210 : 0;                  // ~33⅓ rpm
    omega += (target - omega) * (1 - Math.exp(-dt * (playing ? 1.5 : .8)));
    angle = (angle + omega * dt) % 360;
    el.vrot.style.transform = `rotate(${angle.toFixed(2)}deg)`;

    const prog = audio && audio.duration ? audio.currentTime / audio.duration : 0;
    const armTarget = playing ? ARM_OUT + (ARM_IN - ARM_OUT) * prog : ARM_REST;
    armAngle += (armTarget - armAngle) * (1 - Math.exp(-dt * 3.2));
    el.arm.setAttribute('transform', `rotate(${armAngle.toFixed(2)} 980 150)`);

    el.fill.style.width = (prog * 100).toFixed(2) + '%';
    setText(el.tcur, fmt(audio ? audio.currentTime || 0 : 0));
    setText(el.tdur, fmt(audio && audio.duration ? audio.duration : 30));
  }
  // hero record: lazy idle spin
  heroOmega += ((reduceMotion ? 0 : 14) - heroOmega) * (1 - Math.exp(-dt * 1.2));
  heroAngle = (heroAngle + heroOmega * dt) % 360;
  el.hrot.style.transform = `rotate(${heroAngle.toFixed(2)}deg)`;
}

/* =====================================================================
   Main loop
   ===================================================================== */
let last = nowSec();
let drift = 20;                                  // starting offset so the first frame has nice colour variation
function frame() {
  const t = nowSec();
  const rawDt = t - last;
  const dt = Math.min(.05, rawDt); last = t;

  if (gl && rawDt < .25 && !document.hidden) {   // ignore tab-switch gaps / throttled tabs
    adapt.ema += (rawDt - adapt.ema) * .08;
    if (adapt.cool > 0) adapt.cool -= rawDt;
    else if (adapt.ema > .034 && renderScale > .3) {
      renderScale = Math.max(.3, renderScale * .8);
      adapt.cool = 1.2;
      resize();
    }
  }

  // ease palette toward the chosen album
  if (palette.tgt) {
    const k = 1 - Math.exp(-dt * 2.2);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) palette.cur[i][j] += (palette.tgt[i][j] - palette.cur[i][j]) * k;
  }

  analyse(t);
  updateDeck(dt);

  if (gl) {
    gl.uniform2f(uniforms.uRes, canvas.width, canvas.height);
    drift += reduceMotion ? 0 : dt;
    gl.uniform1f(uniforms.uTime, t);
    gl.uniform1f(uniforms.uDrift, drift);
    gl.uniform1f(uniforms.uAudio, level);
    gl.uniform3fv(uniforms.uC0, palette.cur[0]);
    gl.uniform3fv(uniforms.uC1, palette.cur[1]);
    gl.uniform3fv(uniforms.uC2, palette.cur[2]);
    gl.uniform4fv(uniforms.uR, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  requestAnimationFrame(frame);
}

/* =====================================================================
   Page polish: scroll reveals, active nav link
   ===================================================================== */
function initPolish() {
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: .1, rootMargin: '0px 0px -5% 0px' });
    revealEls.forEach(n => io.observe(n));

    const links = $$('.links a');
    const nav = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        links.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id)));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['hero', 'projects', 'contact'].forEach(id => nav.observe(document.getElementById(id)));
  } else {
    revealEls.forEach(n => n.classList.add('in'));
  }
}

/* =====================================================================
   Boot
   ===================================================================== */
function boot() {
  initPolish();
  if (!ITEMS.length) return;
  renderShelf();
  initRoom();

  const want = new URLSearchParams(location.search).get('album') || DEFAULT_ALBUM;
  const heroItem = ITEMS.find(it => it.album.slug === want) || ITEMS[0];
  applyTheme(heroItem.album);
  palette.cur = palette.tgt.map(c => c.slice());       // no fade on first paint
  cur = heroItem;
  el.hlabel.style.backgroundImage = `url("${heroItem.album.cover}")`;
  heroRecEl.setAttribute('aria-label', `Open ${heroItem.project ? heroItem.project.title : heroItem.album.title}`);
  heroRecEl.addEventListener('click', e => openItem(heroItem.i, e.currentTarget));
  setPlaying(false);

  // a few welcome ripples so the page feels alive on arrival
  if (!reduceMotion) {
    setTimeout(() => addRipple(innerWidth * .68, innerHeight * .45, .9), 500);
    setTimeout(() => addRipple(innerWidth * .32, innerHeight * .62, .7), 1200);
  }
  requestAnimationFrame(frame);
}
boot();

})();
