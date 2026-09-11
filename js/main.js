import { Background } from "./background.js";

const body = document.body;
const start = document.getElementById("start");
const groupButtons = [...document.querySelectorAll(".group-btn")];
const optionLists = new Map([...document.querySelectorAll(".options")].map((el) => [el.dataset.group, el]));
const panels = new Map([...document.querySelectorAll(".panel")].map((el) => [el.id, el]));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const background = new Background(document.getElementById("bg"));

let openGroup = null;
let lastOption = null;

// ---------- Menu groups ----------

function setGroup(name) {
  openGroup = name;
  for (const button of groupButtons) {
    button.setAttribute("aria-expanded", String(button.dataset.group === name));
  }
  for (const [group, list] of optionLists) {
    const isOpen = group === name;
    list.classList.toggle("is-open", isOpen);
    list.inert = !isOpen;
  }
  body.classList.toggle("menu-open", Boolean(name));
}

for (const button of groupButtons) {
  button.addEventListener("click", () => {
    setGroup(openGroup === button.dataset.group ? null : button.dataset.group);
  });
}

// Clicking empty background closes the open group.
start.addEventListener("click", (event) => {
  if (!event.target.closest(".menu, .topbar")) setGroup(null);
});

// Remember which option opened a page so focus can return to it.
for (const option of document.querySelectorAll('.option[href^="#"]')) {
  option.addEventListener("click", () => { lastOption = option; });
}

// ---------- Pages ----------
// The URL hash decides which page is open (#experience, #jams, ...), so the browser
// back button closes pages and every page can be linked directly.

function route() {
  const id = decodeURIComponent(location.hash.slice(1));
  const panel = panels.get(id) || null;

  for (const [panelId, el] of panels) {
    const isOpen = el === panel;
    el.classList.toggle("is-open", isOpen);
    el.inert = !isOpen;
  }

  if (panel) {
    setGroup(panel.dataset.group || null);
    start.inert = true;
    body.dataset.view = "page";
    const scroller = panel.querySelector(".panel-scroll");
    scroller.scrollTop = 0;
    scroller.focus({ preventScroll: true });
  } else {
    start.inert = false;
    body.dataset.view = "start";
    lastOption?.focus({ preventScroll: true });
  }
  updateBackground();
  syncJamAutoplay();
}

function closePage() {
  history.pushState(null, "", location.pathname + location.search);
  route();
}

for (const button of document.querySelectorAll("[data-close]")) {
  button.addEventListener("click", closePage);
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (body.dataset.view === "page") closePage();
  else setGroup(null);
});

window.addEventListener("hashchange", route);

// ---------- Background ----------

function updateBackground() {
  background.setMotion(!reducedMotion.matches);
  // The terrain only animates while the start screen is actually visible.
  background.setActive(body.dataset.view === "start");
}

reducedMotion.addEventListener?.("change", updateBackground);

// ---------- Game jam previews ----------
// Each card cycles through its own screenshots while hovered or focused.
// Touch devices get no hover event, so there the cards cycle on their own.

const SHOT_MS = 1800;
const noHover = window.matchMedia("(hover: none)");
const jamCards = [];

for (const card of document.querySelectorAll("[data-shots]")) {
  const shots = [...card.querySelectorAll(".jam-media img")];
  const dots = [...card.querySelectorAll(".jam-dots span")];
  if (shots.length === 0) continue;

  const entry = { card, shots, dots, index: 0, timer: 0 };
  jamCards.push(entry);

  const show = (i) => {
    entry.index = i % entry.shots.length;
    entry.shots.forEach((img, n) => img.classList.toggle("is-active", n === entry.index));
    entry.dots.forEach((dot, n) => dot.classList.toggle("is-on", n === entry.index));
  };
  entry.show = show;
  show(0);

  const start = () => {
    if (entry.timer) return;
    card.classList.add("is-showing");
    entry.timer = setInterval(() => show(entry.index + 1), SHOT_MS);
  };
  const stop = () => {
    clearInterval(entry.timer);
    entry.timer = 0;
    card.classList.remove("is-showing");
    show(0);
  };
  entry.start = start;
  entry.stop = stop;

  card.addEventListener("pointerenter", (e) => { if (e.pointerType !== "touch") start(); });
  card.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") stop(); });
  card.addEventListener("focus", start);
  card.addEventListener("blur", stop);
}

function syncJamAutoplay() {
  const onJams = noHover.matches && location.hash === "#jams";
  for (const entry of jamCards) {
    if (onJams) entry.start();
    else if (!entry.card.matches(":hover, :focus-visible")) entry.stop();
  }
}

noHover.addEventListener?.("change", syncJamAutoplay);

// ---------- Optional hero clips ----------
// A page hero shows its still image until a video file is actually there.

for (const hero of document.querySelectorAll("[data-hero]")) {
  const video = hero.querySelector("video");
  if (!video) continue;
  const useClip = () => hero.classList.add("has-clip");
  if (video.readyState >= 2) useClip();
  else video.addEventListener("loadeddata", useClip, { once: true });
}

// ---------- Boot ----------

function showBuildDate() {
  const modified = new Date(document.lastModified);
  if (Number.isNaN(modified.getTime())) return;
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("build").textContent =
    `Build ${modified.getFullYear()}.${pad(modified.getMonth() + 1)}.${pad(modified.getDate())}`;
}

showBuildDate();
setGroup(null);
route();
