const KEY_ACTIONS = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Enter: "confirm",
  NumpadEnter: "confirm",
  Space: "confirm",
  Escape: "back",
  Backspace: "back",
  Tab: "tab",
};

// Standard gamepad mapping: https://w3c.github.io/gamepad/#remapping
const PAD = { A: 0, B: 1, START: 9, UP: 12, DOWN: 13 };
const STICK_THRESHOLD = 0.55;
const REPEAT_DELAY = 380;
const REPEAT_RATE = 110;

/**
 * Turns keyboard and gamepad input into menu actions:
 * up, down, left, right, confirm, back, tab, other.
 * Listeners receive (action, { source, event }).
 */
export class Input {
  constructor() {
    this.listeners = [];
    this.padState = new Map();
    this.polling = false;

    window.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("gamepadconnected", () => this.startPolling());
  }

  on(listener) {
    this.listeners.push(listener);
  }

  emit(action, detail) {
    for (const listener of this.listeners) listener(action, detail);
  }

  onKey(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const action = KEY_ACTIONS[event.code] ?? "other";
    this.emit(action, { source: "keyboard", event });
  }

  startPolling() {
    if (this.polling) return;
    this.polling = true;
    const loop = (now) => {
      const active = this.pollGamepads(now);
      if (active) requestAnimationFrame(loop);
      else this.polling = false;
    };
    requestAnimationFrame(loop);
  }

  pollGamepads(now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let any = false;

    for (const pad of pads) {
      if (!pad) continue;
      any = true;

      const pressed = (i) => Boolean(pad.buttons[i]?.pressed);
      const stickY = pad.axes[1] ?? 0;
      const current = {
        up: pressed(PAD.UP) || stickY < -STICK_THRESHOLD,
        down: pressed(PAD.DOWN) || stickY > STICK_THRESHOLD,
        confirm: pressed(PAD.A) || pressed(PAD.START),
        back: pressed(PAD.B),
      };

      const prev = this.padState.get(pad.index) ?? { held: {}, next: {} };
      for (const [action, isDown] of Object.entries(current)) {
        const wasDown = prev.held[action];
        if (isDown && !wasDown) {
          this.emit(action, { source: "gamepad", event: null });
          prev.next[action] = now + REPEAT_DELAY;
        } else if (isDown && (action === "up" || action === "down") && now >= prev.next[action]) {
          // Held direction repeats, like scrolling through a menu with the stick held.
          this.emit(action, { source: "gamepad", event: null });
          prev.next[action] = now + REPEAT_RATE;
        }
        prev.held[action] = isDown;
      }
      this.padState.set(pad.index, prev);
    }
    return any;
  }
}
