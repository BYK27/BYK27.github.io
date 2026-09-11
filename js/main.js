import { Input } from "./input.js";
import { Sfx } from "./sfx.js";
import { Background } from "./background.js";

const SETTINGS_KEY = "vuk-portfolio-settings";
const DEFAULT_SETTINGS = { sound: false, motion: true, classic: false };

// ---------- Settings ----------

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing can block storage; settings then last for this visit only.
  }
}

const settings = loadSettings();

// ---------- Elements ----------

const root = document.documentElement;
const body = document.body;
const titleScreen = document.getElementById("title");
const menuScreen = document.getElementById("menu");
const menuItems = [...menuScreen.querySelectorAll(".menu-item")];
const panels = new Map([...document.querySelectorAll(".panel")].map((p) => [p.id, p]));
const previewImg = menuScreen.querySelector(".preview-img");
const previewTitle = menuScreen.querySelector(".preview-title");
const previewText = menuScreen.querySelector(".preview-text");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const sfx = new Sfx(settings.sound);
const background = new Background(document.getElementById("bg"));
const input = new Input();

let selected = 0;
let openPanelId = null;
let menuEnteredAt = 0;

// ---------- Navigation ----------
// The URL hash is the single source of truth: "" title, "#menu" menu, "#career" etc. panels.
// That keeps the browser back button working and makes every panel linkable.

function go(hash) {
  if (hash) {
    location.hash = hash;
  } else {
    history.pushState(null, "", location.pathname + location.search);
    route();
  }
}

function route() {
  const id = decodeURIComponent(location.hash.slice(1));

  if (root.classList.contains("classic")) {
    applyClassic();
    return;
  }

  if (panels.has(id)) {
    const index = menuItems.findIndex((item) => item.dataset.target === id);
    if (index >= 0) selected = index;
    showPanel(id);
  } else if (id === "menu") {
    showMenu();
  } else {
    showTitle();
  }
}

function setScreen(name) {
  body.dataset.screen = name;
  titleScreen.inert = name !== "title";
  menuScreen.inert = name !== "menu";
  background.setActive(name !== "panel");
}

function showTitle() {
  closePanels();
  setScreen("title");
  titleScreen.focus({ preventScroll: true });
}

function showMenu() {
  closePanels();
  setScreen("menu");
  menuEnteredAt = performance.now();
  select(selected, { sound: false });
}

function showPanel(id) {
  closePanels();
  setScreen("panel");
  const panel = panels.get(id);
  panel.classList.add("is-open");
  panel.inert = false;
  openPanelId = id;

  const scroller = panel.querySelector(".panel-scroll");
  scroller.scrollTop = 0;
  const firstOption = panel.hasAttribute("data-list") ? panel.querySelector("[data-nav]") : null;
  (firstOption || scroller).focus({ preventScroll: true });
}

function closePanels() {
  for (const panel of panels.values()) {
    panel.classList.remove("is-open");
    panel.inert = true;
  }
  openPanelId = null;
}

function start() {
  sfx.play("start");
  go("menu");
}

function openSelected() {
  sfx.play("confirm");
  go(menuItems[selected].dataset.target);
}

function back() {
  sfx.play("back");
  if (body.dataset.screen === "panel") go("menu");
  else go("");
}

// ---------- Menu ----------

function select(index, { sound = true } = {}) {
  const count = menuItems.length;
  const next = (index + count) % count;
  if (sound && next !== selected) sfx.play("move");
  selected = next;

  menuItems.forEach((item, i) => item.classList.toggle("is-selected", i === next));
  menuItems[next].focus({ preventScroll: true });
  updatePreview(menuItems[next]);
}

function updatePreview(item) {
  previewTitle.textContent = item.dataset.title || item.textContent.trim();
  previewText.textContent = item.dataset.desc || "";

  const src = item.dataset.img;
  if (src) {
    previewImg.onerror = () => { previewImg.hidden = true; };
    previewImg.onload = () => { previewImg.hidden = false; };
    if (previewImg.getAttribute("src") !== src) previewImg.src = src;
    else previewImg.hidden = !(previewImg.complete && previewImg.naturalWidth > 0);
  } else {
    previewImg.hidden = true;
  }
}

menuItems.forEach((item, i) => {
  item.addEventListener("mouseenter", () => {
    if (body.dataset.screen === "menu" && i !== selected) select(i);
  });
  item.addEventListener("click", () => {
    // Ignore the click that can arrive from the same key press that started the game.
    if (performance.now() - menuEnteredAt < 250) return;
    selected = i;
    openSelected();
  });
});

// ---------- Panels ----------

function moveFocusIn(panel, direction) {
  const items = [...panel.querySelectorAll("[data-nav]")];
  if (items.length === 0) return;
  const current = items.indexOf(document.activeElement);
  const next = current < 0 ? 0 : (current + direction + items.length) % items.length;
  items[next].focus();
  sfx.play("move");
}

function scrollPanel(panel, direction) {
  panel.querySelector(".panel-scroll").scrollBy({ top: direction * 200, behavior: "smooth" });
}

document.querySelectorAll("[data-back]").forEach((button) => button.addEventListener("click", back));

// ---------- Input ----------

function isActivatable(element) {
  return Boolean(element && element.matches && element.matches("a[href], button"));
}

input.on((action, { source, event }) => {
  body.dataset.input = source;
  if (root.classList.contains("classic")) return;

  const screen = body.dataset.screen;
  const focusedControl = source === "keyboard" && isActivatable(event.target);

  if (screen === "title") {
    if (action === "tab" || (event && event.repeat)) return;
    // Enter on a focused link or button (Classic view, CV) should do that, not start.
    if (focusedControl && action === "confirm") return;
    event?.preventDefault();
    start();
    return;
  }

  if (screen === "menu") {
    if (action === "up") { event?.preventDefault(); select(selected - 1); }
    else if (action === "down") { event?.preventDefault(); select(selected + 1); }
    else if (action === "back") { event?.preventDefault(); back(); }
    else if (action === "confirm" && !focusedControl) { event?.preventDefault(); openSelected(); }
    // A focused menu button handles Enter itself through its click event.
    return;
  }

  if (screen === "panel") {
    const panel = panels.get(openPanelId);
    if (!panel) return;

    if (action === "back") {
      event?.preventDefault();
      back();
    } else if (action === "up" || action === "down") {
      const direction = action === "up" ? -1 : 1;
      if (panel.hasAttribute("data-list")) {
        event?.preventDefault();
        moveFocusIn(panel, direction);
      } else if (source === "gamepad") {
        scrollPanel(panel, direction);
      }
      // Keyboard arrows in content panels scroll natively.
    } else if (action === "confirm" && source === "gamepad" && isActivatable(document.activeElement)) {
      document.activeElement.click();
    }
  }
});

titleScreen.addEventListener("click", (event) => {
  if (event.target.closest("a, button")) return;
  body.dataset.input = "pointer";
  start();
});

// ---------- Options ----------

function renderOptions() {
  document.querySelectorAll('[data-option="sound"]').forEach((button) => {
    button.setAttribute("aria-pressed", String(settings.sound));
    button.querySelector("[data-value]").textContent = settings.sound ? "On" : "Off";
  });
  document.querySelectorAll('[data-option="motion"]').forEach((button) => {
    button.setAttribute("aria-pressed", String(settings.motion));
    button.querySelector("[data-value]").textContent = settings.motion ? "On" : "Off";
  });
}

function applyMotion() {
  background.setMotion(settings.motion && !reducedMotion.matches);
}

function toggleOption(name) {
  if (name === "sound") {
    settings.sound = !settings.sound;
    sfx.setEnabled(settings.sound);
    sfx.play("confirm");
  } else if (name === "motion") {
    settings.motion = !settings.motion;
    applyMotion();
    sfx.play("confirm");
  } else if (name === "classic") {
    settings.classic = true;
    saveSettings();
    enterClassic();
    return;
  }
  saveSettings();
  renderOptions();
}

document.addEventListener("click", (event) => {
  const option = event.target.closest("[data-option]");
  if (option) toggleOption(option.dataset.option);
});

reducedMotion.addEventListener?.("change", applyMotion);

// ---------- Classic view ----------

function applyClassic() {
  titleScreen.inert = false;
  menuScreen.inert = false;
  for (const panel of panels.values()) {
    panel.inert = false;
    panel.classList.remove("is-open");
  }
  body.dataset.screen = "classic";
  background.setActive(false);
}

function enterClassic() {
  root.classList.add("classic");
  history.pushState(null, "", location.pathname + location.search);
  applyClassic();
  window.scrollTo(0, 0);
}

function exitClassic() {
  settings.classic = false;
  saveSettings();
  root.classList.remove("classic");
  go("");
}

document.getElementById("exit-classic").addEventListener("click", exitClassic);

// ---------- Boot ----------

function showBuildDate() {
  const modified = new Date(document.lastModified);
  if (Number.isNaN(modified.getTime())) return;
  const pad = (n) => String(n).padStart(2, "0");
  document.getElementById("build").textContent =
    `Build ${modified.getFullYear()}.${pad(modified.getMonth() + 1)}.${pad(modified.getDate())}`;
}

titleScreen.tabIndex = -1;
showBuildDate();
renderOptions();
applyMotion();
window.addEventListener("hashchange", route);
window.addEventListener("popstate", route);
route();
