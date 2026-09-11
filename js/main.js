import { Background } from "./background.js";

const body = document.body;
const start = document.getElementById("start");
const groupButtons = [...document.querySelectorAll(".group-btn")];
const optionLists = new Map([...document.querySelectorAll(".options")].map((el) => [el.dataset.group, el]));
const panels = new Map([...document.querySelectorAll(".panel")].map((el) => [el.id, el]));

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const background = new Background(document.getElementById("bg"));

let openGroup = null;
let hasBackgroundMedia = false;
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
// media/background.mp4 or media/background.jpg replaces the animated map when uploaded.

function useBackgroundMedia() {
  hasBackgroundMedia = true;
  body.classList.add("has-media");
  updateBackground();
}

function watchBackgroundMedia() {
  const video = document.getElementById("bg-video");
  const image = document.getElementById("bg-image");

  if (video) {
    if (video.readyState >= 2) useBackgroundMedia();
    else video.addEventListener("loadeddata", useBackgroundMedia, { once: true });
  }
  if (image) {
    if (image.complete && image.naturalWidth > 0) useBackgroundMedia();
    else image.addEventListener("load", useBackgroundMedia, { once: true });
  }
}

function updateBackground() {
  background.setMotion(!reducedMotion.matches);
  // The map only animates while it's actually visible.
  background.setActive(!hasBackgroundMedia && body.dataset.view === "start");
}

reducedMotion.addEventListener?.("change", updateBackground);

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
watchBackgroundMedia();
route();
