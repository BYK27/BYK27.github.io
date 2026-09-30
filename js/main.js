// Vuk Aleksijević · portfolio
// Start menu (beams out of a CRT), pages, transitions, sound effects.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const body = document.body;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const portrait = matchMedia("(max-width: 760px), (max-aspect-ratio: 4/5)");

// ---------- small helpers ----------

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
};

// =========================================================
// Sound effects (synthesised with Web Audio, no files)
// =========================================================

const sfx = (() => {
  let ctx = null, master = null, noise = null;
  let enabled = store.get("sfx") !== "off";
  const btn = $("#sfx");

  function syncButton() { btn.setAttribute("aria-pressed", String(enabled)); }
  syncButton();

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  ["pointerdown", "keydown", "touchstart"].forEach((type) =>
    addEventListener(type, init, { passive: true, capture: true }));

  function env(gain, t, peak, attack, release) {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  }
  function tone(type, f0, f1, dur, peak, delay = 0) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, peak, 0.005, dur);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function hiss(filterType, f0, f1, dur, peak, delay = 0, q = 1) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, peak, dur * 0.35, dur * 0.65);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  const sounds = {
    move() { tone("square", 1250, 760, 0.06, 0.05); hiss("bandpass", 4000, 3000, 0.03, 0.05, 0, 3); },
    confirm() {
      tone("sawtooth", 240, 980, 0.13, 0.05);
      tone("square", 1480, 1480, 0.09, 0.035, 0.06);
      hiss("highpass", 1800, 6000, 0.16, 0.07);
    },
    back() { tone("triangle", 820, 240, 0.14, 0.09); hiss("bandpass", 2400, 600, 0.1, 0.04, 0, 2); },
    whoosh() { hiss("bandpass", 260, 3200, 0.42, 0.16, 0, 1.4); tone("sine", 90, 50, 0.3, 0.12, 0.05); },
    static() { hiss("highpass", 2600, 2600, 0.09, 0.03); },
    shutter() { hiss("bandpass", 1600, 5000, 0.08, 0.1, 0, 2); tone("square", 600, 1800, 0.05, 0.03); },
  };

  btn.addEventListener("click", () => {
    enabled = !enabled;
    store.set("sfx", enabled ? "on" : "off");
    syncButton();
    if (enabled) { init(); play("confirm"); }
  });

  function play(name) {
    if (!enabled || !ctx || ctx.state !== "running") return;
    try { sounds[name](); } catch { /* ignore audio errors */ }
  }
  return { play };
})();

// =========================================================
// Torn "beam" shapes
// =========================================================

function beamPath(rand) {
  const T = (x) => { const t = Math.min(1, x / 270); return 10 + 58 * (1 - (1 - t) * (1 - t)); };
  const end = 740 + rand() * 70;
  const top = [], bot = [];
  for (let x = 0; x <= end; x += 16) {
    let jt = (rand() - 0.5) * 7, jb = (rand() - 0.5) * 7;
    if (x > 120 && rand() < 0.14) jt -= 8 + rand() * 16;
    if (x > 120 && rand() < 0.14) jb += 8 + rand() * 16;
    top.push([x, 100 - T(x) + jt]);
    bot.push([x, 100 + T(x) + jb]);
  }
  const yT = top[top.length - 1][1], yB = bot[bot.length - 1][1];
  const k = 10, span = yB - yT, fray = [];
  for (let i = 0; i < k; i++) {
    const y0 = yT + (span * i) / k, y1 = yT + (span * (i + 1)) / k;
    fray.push([end + 40 + rand() * 210, y0 + (y1 - y0) * (0.25 + rand() * 0.4)]);
    fray.push([end - 20 + rand() * 50, y1]);
  }
  const pts = [[0, 100], ...top, ...fray, ...bot.reverse()];
  let d = "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
  // stray bristle streaks
  for (let i = 0; i < 6; i++) {
    const y = yT + rand() * span, x = end - 60 + rand() * 120, len = 70 + rand() * 200, th = 2 + rand() * 5;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}L${(x + len).toFixed(1)} ${(y + th / 2).toFixed(1)}L${x.toFixed(1)} ${(y + th).toFixed(1)}Z`;
  }
  // flecks along the edges
  for (let i = 0; i < 5; i++) {
    const x = 180 + rand() * (end - 240), up = rand() < 0.5, y = up ? yT - 6 - rand() * 12 : yB + 6 + rand() * 12;
    const w = 20 + rand() * 60;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}L${(x + w).toFixed(1)} ${(y + (up ? 3 : -3)).toFixed(1)}L${(x + w * 0.3).toFixed(1)} ${(y + (up ? 5 : -5)).toFixed(1)}Z`;
  }
  return d;
}

function buildBeam(li, index) {
  const a = $("a", li);
  const label = $(".beam-label", a).textContent.trim();
  const d = beamPath(rng(hashString(label + index)));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "beam-shape");
  svg.setAttribute("viewBox", "0 0 1000 200");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<path class="b-back" d="${d}"/><path class="b-red" d="${d}"/><path class="b-main" d="${d}"/>`;
  a.prepend(svg);
  li.style.setProperty("--len", label.length);
}

// =========================================================
// CRT screen
// =========================================================

const screen = (() => {
  const el = $("#screen");
  const img = $("#screen-img");
  const text = $("#screen-text");
  const ch = $("#screen-ch");
  const canvas = $("#screen-noise");
  const g = canvas.getContext("2d");
  const reelImages = [
    "media/topdown-1.jpg", "media/jam-fauxtelja-play.png", "media/topdown-2.jpg",
    "media/jam-hoverbald-play.png", "media/pupilprism-1.png", "media/jam-mosquito-1.jpg",
    "media/tenthousand-1.png", "media/topdown-3.jpg",
  ];
  let reelTimer = 0, reelIndex = 0, switchTimer = 0, current = "", running = true;

  // preload so channel switches are instant
  reelImages.forEach((src) => { const i = new Image(); i.src = src; });

  const frame = g.createImageData(canvas.width, canvas.height);
  let last = 0;
  function drawNoise(now) {
    if (running && now - last > 50) {
      last = now;
      const d = frame.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = Math.random() * 255;
        d[i] = v; d[i + 1] = v * 0.8; d[i + 2] = v * 0.8; d[i + 3] = 255;
      }
      g.putImageData(frame, 0, 0);
    }
    requestAnimationFrame(drawNoise);
  }
  requestAnimationFrame(drawNoise);

  function flicker() {
    el.classList.remove("is-switching");
    void el.offsetWidth;
    el.classList.add("is-switching");
    clearTimeout(switchTimer);
    switchTimer = setTimeout(() => el.classList.remove("is-switching"), 230);
  }

  function showImage(src) {
    img.classList.remove("kenburns");
    img.src = src;
    void img.offsetWidth;
    if (!reducedMotion.matches) img.classList.add("kenburns");
    el.classList.add("has-img");
    el.classList.remove("has-text");
  }
  function showText(a, b) {
    text.innerHTML = "";
    const big = document.createElement("b"); big.textContent = a;
    const small = document.createElement("small"); small.textContent = b || "";
    text.append(big, small);
    el.classList.add("has-text");
    el.classList.remove("has-img");
  }
  function stopReel() { clearInterval(reelTimer); reelTimer = 0; }
  function startReel() {
    stopReel();
    const step = () => { flicker(); showImage(reelImages[reelIndex++ % reelImages.length]); };
    step();
    reelTimer = setInterval(step, 2600);
  }

  function set(spec, channel) {
    if (channel) ch.textContent = "CH " + channel;
    if (spec === current) return;
    current = spec;
    flicker();
    sfx.play("static");
    if (spec === "reel") return startReel();
    stopReel();
    const [kind, value = ""] = spec.split(/:(.*)/s);
    if (kind === "img") showImage(value);
    else { const [a, b] = value.split("|"); showText(a, b); }
  }

  function pause(p) {
    running = !p;
    if (p) stopReel();
    else if (current === "reel") { current = ""; set("reel"); }
  }
  return { set, pause };
})();

// =========================================================
// Start menu
// =========================================================

const fan = $("#fan");
const menus = new Map($$(".menu", fan).map((ul) => [ul.dataset.menu, ul]));
let currentMenu = "root";
let activeIndex = 0;
let menuBusy = false;

const FAN = { // angle ranges (deg) for the fan, by item count
  4: [-16, 22], 5: [-20, 28], 6: [-18, 36],
};
const PORTRAIT_TILT = [-2.2, 1.6, -1.2, 2.2, -1.6, 1.2];

function layoutMenu(ul) {
  const items = $$(".beam", ul);
  const n = items.length;
  const [a0, a1] = FAN[n] || [-15, 25];
  items.forEach((li, i) => {
    const r = rng(hashString(ul.dataset.menu + i))();
    const angle = n > 1 ? a0 + ((a1 - a0) * i) / (n - 1) : 0;
    const len = +li.style.getPropertyValue("--len") || 6;
    const isBack = li.classList.contains("beam-back");
    let w = isBack ? 560 : 330 + len * 36 + r * 40;
    w = Math.min(w, angle > 0 ? 740 - angle * 7 : 740 + angle * 6);
    li.style.setProperty("--i", i);
    li.style.setProperty("--a", angle + "deg");
    li.style.setProperty("--w", Math.round(w) + "px");
    li.style.setProperty("--lx", Math.round(isBack ? 44 : 38 + r * 4) + "%");
    li.style.setProperty("--am", PORTRAIT_TILT[i % PORTRAIT_TILT.length] + "deg");
  });
}

menus.forEach((ul) => {
  $$(".beam", ul).forEach(buildBeam);
  layoutMenu(ul);
});

function itemsOf(name = currentMenu) { return $$(".beam", menus.get(name)); }

function activate(index, { silent = false, focus = false } = {}) {
  const items = itemsOf();
  if (!items.length) return;
  index = (index + items.length) % items.length;
  const changed = index !== activeIndex || !items[index].classList.contains("is-active");
  items.forEach((li, i) => li.classList.toggle("is-active", i === index));
  activeIndex = index;
  const a = $("a", items[index]);
  if (focus && document.activeElement !== a) a.focus({ preventScroll: true });
  if (changed && !silent) sfx.play("move");
  screen.set(a.dataset.screen || "reel", a.dataset.ch);
}

function showMenu(name, index = 0, { animate = true, delay = 0 } = {}) {
  const from = menus.get(currentMenu), to = menus.get(name);
  if (!to) return;
  const enter = () => {
    menus.forEach((ul) => { ul.hidden = ul !== to; ul.classList.remove("is-leaving"); });
    currentMenu = name;
    activeIndex = -1;
    if (animate && !reducedMotion.matches) {
      to.style.setProperty("--d0", delay + "ms");
      to.classList.add("is-entering");
      const n = itemsOf(name).length;
      setTimeout(() => to.classList.remove("is-entering"), 520 + n * 55 + delay);
    }
    activate(index, { silent: true });
    menuBusy = false;
  };
  if (animate && from && from !== to && !from.hidden && !reducedMotion.matches) {
    menuBusy = true;
    from.classList.add("is-leaving");
    setTimeout(enter, 230);
  } else enter();
}

function indexOfHref(name, href) {
  return Math.max(0, itemsOf(name).findIndex((li) => $("a", li).getAttribute("href") === href));
}

// pointer + focus
fan.addEventListener("pointerover", (e) => {
  const label = e.target.closest(".beam-label");
  if (!label || menuBusy) return;
  const li = label.closest(".beam");
  const i = itemsOf().indexOf(li);
  if (i >= 0) activate(i);
});
fan.addEventListener("focusin", (e) => {
  const li = e.target.closest(".beam");
  const i = itemsOf().indexOf(li);
  if (i >= 0 && i !== activeIndex) activate(i);
});

// clicks
fan.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  if (menuBusy) { e.preventDefault(); return; }
  if (a.hasAttribute("data-back")) {
    e.preventDefault();
    sfx.play("back");
    const parent = currentMenu;
    showMenu("root", indexOfHref("root", "#" + parent));
    return;
  }
  if (a.dataset.open) {
    e.preventDefault();
    sfx.play("confirm");
    showMenu(a.dataset.open, 0);
    return;
  }
  if (a.dataset.copy) copyText(a.dataset.copy);
  if (!a.getAttribute("href").startsWith("#")) sfx.play("confirm");
  // #page links fall through to the router
});

// keyboard
addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  if (!lightbox.hidden) return lightboxKeys(e);
  if (openPanel) {
    if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); closePage(); }
    return;
  }
  if (menuBusy) return;
  const key = e.key;
  if (key === "ArrowDown" || key === "s" || key === "S") { e.preventDefault(); activate(activeIndex + 1, { focus: true }); }
  else if (key === "ArrowUp" || key === "w" || key === "W") { e.preventDefault(); activate(activeIndex - 1, { focus: true }); }
  else if (key === "Enter" || key === " ") {
    const a = $("a", itemsOf()[activeIndex]);
    if (document.activeElement !== a) { e.preventDefault(); a.click(); }
    else if (key === " ") { e.preventDefault(); a.click(); }
  } else if ((key === "Escape" || key === "Backspace") && currentMenu !== "root") {
    e.preventDefault();
    sfx.play("back");
    const parent = currentMenu;
    showMenu("root", indexOfHref("root", "#" + parent));
  }
});

// =========================================================
// Scene scaling (desktop keeps a fixed composition, scaled to fit)
// =========================================================

const scene = $("#scene");
function fitScene() {
  if (portrait.matches) { scene.style.removeProperty("--scale"); return; }
  const s = Math.min(innerWidth / 1200, innerHeight / 840, 1.45);
  scene.style.setProperty("--scale", s.toFixed(4));
}
addEventListener("resize", fitScene);
portrait.addEventListener?.("change", fitScene);
fitScene();

// =========================================================
// Ransom-note headings
// =========================================================

const RANSOM_STYLES = [
  { bg: "#f5f1e8", fg: "#0a0a0a" },
  { bg: "#0a0a0a", fg: "#fff", sh: "0 0 0 .05em #fff" },
  { bg: "#e5001c", fg: "#fff" },
  { bg: "transparent", fg: "#fff" },
  { bg: "#fff", fg: "#e5001c" },
  { bg: "#0a0a0a", fg: "#ff1f3a", sh: "0 0 0 .05em #fff" },
];
const RANSOM_FONTS = ['"Anton"', '"Archivo Black"', '"Rubik Mono One"', '"Bowlby One"', '"Permanent Marker"'];
const ASCII_ONLY = new Set(['"Bowlby One"', '"Permanent Marker"']);

$$(".ransom").forEach((h) => {
  const text = h.textContent.trim();
  const rand = rng(hashString(text));
  h.textContent = "";
  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = text;
  const wrap = document.createElement("span");
  wrap.setAttribute("aria-hidden", "true");
  wrap.style.display = "contents";
  let n = 0, prevStyle = -1;
  text.split(/\s+/).forEach((word) => {
    const w = document.createElement("span");
    w.className = "rw";
    for (const ch of word) {
      const l = document.createElement("span");
      l.className = "rl";
      l.textContent = ch.toUpperCase();
      let si;
      do { si = Math.floor(rand() * RANSOM_STYLES.length); } while (si === prevStyle);
      prevStyle = si;
      let style = RANSOM_STYLES[si];
      let font = RANSOM_FONTS[Math.floor(rand() * RANSOM_FONTS.length)];
      if (ch.charCodeAt(0) > 127 && ASCII_ONLY.has(font)) font = '"Anton"';
      let k = 0.82 + rand() * 0.3;
      if (n === 0) { style = RANSOM_STYLES[2]; k = 1.18; font = '"Anton"'; }
      l.style.cssText =
        `--bgc:${style.bg};--fgc:${style.fg};--sh:${style.sh || "none"};--ff:${font};` +
        `--k:${k.toFixed(2)};--r:${((rand() - 0.5) * 14).toFixed(1)}deg;--y:${((rand() - 0.5) * 0.12).toFixed(2)}em;--n:${n}`;
      w.append(l);
      n++;
    }
    wrap.append(w);
  });
  h.append(sr, wrap);
});

// stagger page content
$$(".page").forEach((page) => [...page.children].forEach((c, i) => c.style.setProperty("--d", i)));

// =========================================================
// Pages + router
// =========================================================

const start = $("#start");
const panels = new Map($$(".panel").map((p) => [p.id, p]));
const wipe = $("#wipe");
let openPanel = null;
let cameFromMenu = false;
let wipeTimers = [];

function runWipe(mid) {
  wipeTimers.forEach(clearTimeout);
  if (reducedMotion.matches) { mid(); return; }
  sfx.play("whoosh");
  wipe.classList.remove("run");
  void wipe.offsetWidth;
  wipe.classList.add("run");
  wipeTimers = [setTimeout(mid, 360), setTimeout(() => wipe.classList.remove("run"), 900)];
}

function showPanel(panel) {
  panels.forEach((p) => { const on = p === panel; p.classList.toggle("is-open", on); p.inert = !on; });
  openPanel = panel;
  start.inert = !!panel;
  screen.pause(!!panel);
  if (panel) {
    const group = panel.dataset.group;
    const href = "#" + panel.id;
    if (currentMenu !== group) showMenu(group, indexOfHref(group, href), { animate: false });
    else activate(indexOfHref(group, href), { silent: true });
    const scroller = $(".panel-scroll", panel);
    scroller.scrollTop = 0;
    scroller.focus({ preventScroll: true });
    document.title = panel.querySelector("h2 .sr-only").textContent + " · Vuk Aleksijević";
  } else {
    document.title = "Vuk Aleksijević · Game Programmer";
    const a = $("a", itemsOf()[activeIndex] || itemsOf()[0]);
    a?.focus({ preventScroll: true });
    // replay beams shooting out
    const ul = menus.get(currentMenu);
    if (!reducedMotion.matches) {
      ul.style.setProperty("--d0", "80ms");
      ul.classList.add("is-entering");
      setTimeout(() => ul.classList.remove("is-entering"), 900);
    }
  }
}

function route({ animate = true } = {}) {
  const id = decodeURIComponent(location.hash.slice(1));
  const panel = panels.get(id) || null;
  if (!panel && menus.has(id) && id !== "root") {
    if (openPanel) showPanel(null);
    showMenu(id, 0, { animate });
    return;
  }
  if (panel === openPanel) return;
  if (animate) runWipe(() => showPanel(panel));
  else showPanel(panel);
}

addEventListener("hashchange", () => {
  const id = location.hash.slice(1);
  if (panels.has(id) && !openPanel) { cameFromMenu = true; sfx.play("confirm"); }
  route();
});

function closePage() {
  if (!openPanel) return;
  sfx.play("back");
  if (cameFromMenu) { cameFromMenu = false; history.back(); }
  else { history.pushState(null, "", location.pathname + location.search); route(); }
}
$$("[data-close]").forEach((b) => b.addEventListener("click", closePage));

// =========================================================
// Lightbox
// =========================================================

const lightbox = $("#lightbox");
const lbImg = $(".lb-figure img", lightbox);
const lbCap = $(".lb-figure figcaption", lightbox);
let lbSet = [], lbIndex = 0, lbReturn = null;

function lbShow(i) {
  lbIndex = (i + lbSet.length) % lbSet.length;
  const src = lbSet[lbIndex];
  lbImg.src = src.currentSrc || src.src;
  lbImg.alt = src.alt;
  lbCap.textContent = src.alt;
  const fig = $(".lb-figure", lightbox);
  fig.style.animation = "none"; void fig.offsetWidth; fig.style.animation = "";
}
function lbOpen(img) {
  lbReturn = img;
  lbSet = $$("img[data-zoom]", img.closest(".page"));
  lightbox.classList.toggle("single", lbSet.length < 2);
  lightbox.hidden = false;
  lbShow(lbSet.indexOf(img));
  sfx.play("shutter");
  $(".lb-close", lightbox).focus();
}
function lbClose() { lightbox.hidden = true; sfx.play("back"); lbReturn?.focus?.(); }
function lightboxKeys(e) {
  if (e.key === "Escape") { e.preventDefault(); lbClose(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); lbShow(lbIndex + 1); sfx.play("move"); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); lbShow(lbIndex - 1); sfx.play("move"); }
}
document.addEventListener("click", (e) => {
  const img = e.target.closest("img[data-zoom]");
  if (img) lbOpen(img);
});
lightbox.addEventListener("click", (e) => {
  if (e.target.closest(".lb-prev")) { lbShow(lbIndex - 1); sfx.play("move"); }
  else if (e.target.closest(".lb-next")) { lbShow(lbIndex + 1); sfx.play("move"); }
  else if (!e.target.closest(".lb-figure img")) lbClose();
});

// =========================================================
// Toast + copy
// =========================================================

const toast = $("#toast");
let toastTimer = 0;
function showToast(html) {
  toast.innerHTML = html;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}
function copyText(text) {
  navigator.clipboard?.writeText(text)
    .then(() => showToast(`Email copied · <b>${text}</b>`))
    .catch(() => {});
}

// small sounds on other buttons/links
document.addEventListener("pointerover", (e) => {
  const t = e.target.closest(".tag, .btn, .back, .sfx-btn, .lb-nav, .lb-close");
  if (t && !t.contains(e.relatedTarget)) sfx.play("move");
});

// pause when the tab is hidden
document.addEventListener("visibilitychange", () => screen.pause(document.hidden || !!openPanel));

// =========================================================
// Boot
// =========================================================

const initialHash = location.hash.slice(1);
if (!initialHash) {
  body.classList.add("intro");
  showMenu("root", 0, { animate: true, delay: 520 });
  screen.set("reel", "00");
  setTimeout(() => body.classList.remove("intro"), 1800);
} else {
  showMenu("root", 0, { animate: false });
  route({ animate: false });
}
