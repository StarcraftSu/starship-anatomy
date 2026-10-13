const D = __DATA__;
const root = document.querySelector(".ss");
const stage = root.querySelector(".ss-stage");
const svg = stage.querySelector("svg");
const readout = root.querySelector("[data-readout]");
const panel = root.querySelector(".ss-panel");
const lensBox = panel.querySelector("[data-p-lens]");
const lens = lensBox.querySelector("svg");
const pNum = panel.querySelector("[data-p-num]");
const pTitle = panel.querySelector("[data-p-title]");
const pText = panel.querySelector("[data-p-text]");
const pSpecs = panel.querySelector("[data-p-specs]");
const zoomHere = panel.querySelector("[data-zoom-here]");
const toRaptor = panel.querySelector("[data-p-link]");
const partButtons = [...panel.querySelectorAll(".ss-part")];
const zoomLevel = root.querySelector("[data-zoom-level]");
const apartButton = root.querySelector("[data-apart]");
const { still, touch } = SS;

const IDS = D.order;
const SUBS = Object.keys(D.subs);
const SHOWS = Object.keys(D.shows);
const SUB_OF = Object.fromEntries([...SUBS, ...SHOWS].map((sub) => [D.subs[sub] || D.shows[sub], sub]));
const ALL = [...IDS, ...SUBS, ...SHOWS];
const spring = Object.fromEntries(ALL.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));
const doors = [...stage.querySelectorAll("[data-door]")];
const payButtons = [...panel.querySelectorAll("[data-pay-set]")];
const paySwitch = panel.querySelector("[data-p-pay]");
let payload = "starlink";
const langButton = document.querySelector(".ss-page-head [data-lang]");
let lang = SS.lang;
const T = () => D.t[lang];
const sayOf = (id) => {
  const line = T().say[id];
  return typeof line === "string" ? line : line[payload];
};
const sceneLayers = [...stage.querySelectorAll(".ss-layer")];
const nodes = [...stage.querySelectorAll(".it, .it-sub")].map((el) => ({
  el,
  layer: el.hasAttribute("data-layer") ? el.ownerSVGElement : null,
  ride: el.dataset.ride || el.dataset.piece,
  m: el.dataset.m.split(",").map(Number),
  shown: "",
  css: "",
}));
const lensUses = [...lens.querySelectorAll("use[data-ride]")].map((el) => ({ el, ride: el.dataset.ride, shown: "" }));
let stageWidth = svg.getBoundingClientRect().width || D.W;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

let clock = 0;
let apart = false;
let locked = false;
let selected = null;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
// On touch screens nothing plays by itself: every animated frame repaints the whole drawing, which phones feel.
let touring = !still.matches && !touch.matches;
let tourClock = -1.5;

const view = { z: 1, cx: D.W / 2, cy: D.H / 2 };
const goal = { z: 1, cx: D.W / 2, cy: D.H / 2, on: false };
const lensView = { x: 0, y: 0, w: D.W, h: D.H, ready: false };

const say = (text) => SS.write(readout, text);

function describe() {
  SS.announce(stage, selected ? `${T().sections[selected].title}: ${sayOf(selected)}` : apart ? T().ui.apartSay : T().ui.assembled, !touring);
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const value = on ? 1 : 0;
  const order = on ? [...D.stagger, ...SUBS] : [...SUBS, ...[...D.stagger].reverse()];
  let index = 0;
  for (const id of order) {
    const state = spring[id];
    if (state.target === value) {
      state.pending = null;
      continue;
    }
    const wait = on && D.subs[id] ? 0.35 : 0;
    state.pending = { value, at: clock + (still.matches ? 0 : index++ * D.spring.stagger + wait) };
  }
  apartButton.textContent = on ? T().ui.together : T().ui.apart;
  apartButton.setAttribute("aria-pressed", String(on));
  describe();
  run();
}

function fillPanel(id) {
  const words = id ? T().sections[id] : T().overview;
  const data = words.pay ? { ...words, ...words.pay[payload] } : words;
  pNum.textContent = id ? D.sections[id].num : "V3";
  pTitle.textContent = data.title;
  pText.textContent = data.text;
  paySwitch.hidden = !words.pay;
  SS.fillSpecs(pSpecs, data.specs);
  lensBox.hidden = !id;
  zoomHere.hidden = !id;
  toRaptor.hidden = !(id && D.sections[id].raptor);
  if (id) lensView.ready = false;
}

const layout = root.querySelector(".ss-layout");
let holdTimer = 0;
function holdHeight() {
  const keep = payload;
  const states = ["starlink", "crew"].flatMap((name) => [null, ...IDS].map((id) => [name, id]));
  SS.holdTallest(layout, states, ([name, id]) => {
    payload = name;
    fillPanel(id);
  });
  payload = keep;
  fillPanel(selected);
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const node of stage.querySelectorAll(".it")) {
    if (id !== null && node.dataset.piece === id) node.setAttribute("data-on", "");
    else node.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? IDS.indexOf(id) + 1 : 0));
  fillPanel(id);
  wantShows();
  describe();
  run();
}

const shift = (id, m) => {
  const share = spring[id].x;
  if (Math.abs(share) < 1e-4) return null;
  const [mx, my, mz] = m;
  return [(D.EX[0] * mx + D.EY[0] * my + D.EZ[0] * mz) * share, (D.EX[1] * mx + D.EY[1] * my + D.EZ[1] * mz) * share];
};
const write = (el, text) => (text ? el.setAttribute("transform", text) : el.removeAttribute("transform"));

function place() {
  // Unzoomed, a section's layers slide as whole <svg> elements (composited, no repaint). Zoomed in, parts of a
  // layer sit outside its viewport and were never drawn, so the shift goes back inside the drawing.
  const zoomed = view.z > 1.01;
  const k = stageWidth / (D.W / view.z);
  for (const node of nodes) {
    const d = shift(node.ride, node.m);
    const inner = d && (zoomed || !node.layer) ? `translate(${d[0].toFixed(2)} ${d[1].toFixed(2)})` : "";
    if (inner !== node.shown) write(node.el, (node.shown = inner));
    if (node.layer) {
      const css = d && !zoomed ? `translate3d(${(d[0] * k).toFixed(2)}px, ${(d[1] * k).toFixed(2)}px, 0)` : "";
      if (css !== node.css) node.layer.style.transform = node.css = css;
    }
  }
  if (lens.style.visibility !== "hidden") {
    for (const use of lensUses) {
      const d = shift(use.ride, nodes.find((node) => node.layer && node.ride === use.ride).m);
      const text = d ? `translate(${d[0].toFixed(2)} ${d[1].toFixed(2)})` : "";
      if (text !== use.shown) write(use.el, (use.shown = text));
    }
  }
  const open = spring["nose-sat"].x > 0.01;
  for (const door of doors) if ((door.getAttribute("display") === "none") !== open) door.setAttribute("display", open ? "none" : "inline");
}

function wantShows() {
  for (const id of SHOWS) {
    const on = selected === D.shows[id] && payload === "starlink";
    const state = spring[id];
    const value = on ? 1 : 0;
    if (state.target === value && !state.pending) continue;
    if (state.pending && state.pending.value === value) continue;
    state.pending = { value, at: clock + (on && !still.matches ? 0.7 : 0) };
  }
}

function setPayload(name) {
  if (payload === name) return;
  payload = name;
  root.dataset.payload = name;
  for (const el of stage.querySelectorAll("[data-pay]")) el.setAttribute("display", el.dataset.pay === name ? "inline" : "none");
  payButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.paySet === name)));
  if (name !== "starlink") for (const id of SHOWS) Object.assign(spring[id], { x: 0, v: 0, target: 0, pending: null });
  if (selected) fillPanel(selected);
  wantShows();
  describe();
  run();
}

function boxNow(id) {
  const box = D.boxes[id];
  const sub = SUB_OF[id] ? spring[SUB_OF[id]].x : 0;
  const mixed = box.rest.map((value, index) => value + (box.pulled[index] - value) * clamp(sub, 0, 1));
  const share = spring[id].x;
  const dx = D.EX[0] * D.moves[id] * share;
  const dy = D.EX[1] * D.moves[id] * share;
  return [mixed[0] + dx, mixed[1] + dy, mixed[2] + dx, mixed[3] + dy];
}

function fitBox([x0, y0, x1, y1], aspect, pad) {
  let w = (x1 - x0) * pad;
  let h = (y1 - y0) * pad;
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

function stepLens(dt, calm, busy) {
  if (!selected || lensBox.hidden) return false;
  // The lens draws the whole scene a second time; on phones it waits for the parts to stop, then jumps.
  if (touch.matches) {
    if (lens.style.visibility !== (busy ? "hidden" : "")) {
      lens.style.visibility = busy ? "hidden" : "";
      if (!busy) place();
    }
    if (busy) {
      lensView.ready = false;
      return false;
    }
    calm = true;
  }
  const aspect = lensBox.clientWidth / Math.max(1, lensBox.clientHeight);
  const target = fitBox(boxNow(selected), aspect || 1.6, 1.1);
  const k = !lensView.ready || calm ? 1 : 1 - Math.exp(-dt * 9);
  let moving = false;
  for (const key of ["x", "y", "w", "h"]) {
    const next = lensView[key] + (target[key] - lensView[key]) * k;
    if (Math.abs(next - target[key]) > 0.05) moving = true;
    lensView[key] = next;
  }
  lensView.ready = true;
  lens.setAttribute("viewBox", `${lensView.x.toFixed(2)} ${lensView.y.toFixed(2)} ${lensView.w.toFixed(2)} ${lensView.h.toFixed(2)}`);
  return moving;
}

function clampView(state) {
  state.z = clamp(state.z, 1, 8);
  const w = D.W / state.z;
  const h = D.H / state.z;
  state.cx = clamp(state.cx, w / 2, D.W - w / 2);
  state.cy = clamp(state.cy, h / 2, D.H - h / 2);
}

function applyView() {
  clampView(view);
  const w = D.W / view.z;
  const h = D.H / view.z;
  const box = `${(view.cx - w / 2).toFixed(2)} ${(view.cy - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
  for (const layer of sceneLayers) layer.setAttribute("viewBox", box);
  const zoomed = view.z > 1.01;
  if (zoomed) stage.setAttribute("data-zoomed", "");
  else stage.removeAttribute("data-zoomed");
  zoomLevel.textContent = `${Math.round(view.z * 100)}%`;
  place();
}

function stepView(dt, calm) {
  if (!goal.on) return false;
  const k = calm ? 1 : 1 - Math.exp(-dt * 8);
  view.z += (goal.z - view.z) * k;
  view.cx += (goal.cx - view.cx) * k;
  view.cy += (goal.cy - view.cy) * k;
  const done = Math.abs(view.z - goal.z) < 0.002 && Math.abs(view.cx - goal.cx) < 0.05 && Math.abs(view.cy - goal.cy) < 0.05;
  if (done) {
    view.z = goal.z;
    view.cx = goal.cx;
    view.cy = goal.cy;
    goal.on = false;
  }
  applyView();
  return !done;
}

function glideTo(z, cx, cy) {
  const state = { z, cx, cy };
  clampView(state);
  Object.assign(goal, state, { on: true });
  run();
}

function pointIn(clientX, clientY) {
  const rect = svg.getBoundingClientRect();
  const px = (clientX - rect.left) / rect.width;
  const py = (clientY - rect.top) / rect.height;
  const w = D.W / view.z;
  const h = D.H / view.z;
  return { px, py, x: view.cx - w / 2 + px * w, y: view.cy - h / 2 + py * h };
}

function zoomAt(clientX, clientY, z) {
  const point = pointIn(clientX, clientY);
  const next = clamp(z, 1, 8);
  goal.on = false;
  view.z = next;
  view.cx = point.x - (point.px - 0.5) * (D.W / next);
  view.cy = point.y - (point.py - 0.5) * (D.H / next);
  applyView();
  if (next > 1.01) setApart(locked || apart);
}

const STEP = 2.6;
function tourAt(time) {
  const from = 0.6;
  const list = from + 1.6;
  const end = list + IDS.length * STEP;
  if (time < from) return { apart: false, part: null };
  if (time < list) return { apart: true, part: null };
  if (time < end) return { apart: true, part: IDS[Math.floor((time - list) / STEP)] };
  if (time < end + 5) return { apart: false, part: null };
  return null;
}

function readoutText() {
  if (selected) return sayOf(selected);
  const moving = [...IDS, ...SUBS].some((id) => Math.abs(spring[id].x - spring[id].target) > 0.002 || spring[id].pending);
  if (moving) return apart ? T().ui.taking : T().ui.stacking;
  return apart ? T().ui.apartIdle : T().idle;
}

function quiet() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || locked || view.z > 1.01 || partButtons.some((button) => button.matches(":hover, :focus-visible")) || panel.matches(":hover")) return quiet();
    touring = !still.matches && !touch.matches;
    tourClock = -0.6;
    run();
  }, 9000);
}

function step(dt) {
  clock += dt;
  const calm = still.matches;
  if (touring) {
    tourClock += dt;
    let step = tourAt(tourClock);
    if (!step) {
      tourClock = 0;
      step = tourAt(0);
    }
    setApart(step.apart);
    select(step.part);
  }
  let moving = false;
  for (const id of ALL) if (SS.steer(spring[id], dt, calm, clock, D.spring)) moving = true;
  place();
  if (stepView(dt, calm)) moving = true;
  if (stepLens(dt, calm, moving)) moving = true;
  say(readoutText());
  return moving || touring;
}
const { run } = SS.loop(root, step);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item && stage.contains(item) ? item.dataset.piece : null;
}

const pointers = new Map();
let drag = null;
let pinch = null;

stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.pointerType === "mouse") return;
  quiet();
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z };
    drag = null;
  } else {
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: view.cx, cy: view.cy, moved: false, type: event.pointerType };
  }
  try {
    stage.setPointerCapture(event.pointerId);
  } catch {}
});

stage.addEventListener("pointermove", (event) => {
  if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, (pinch.z * d) / Math.max(1, pinch.d));
    return;
  }
  if (drag && drag.id === event.pointerId) {
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved && view.z > 1.01) {
      const rect = svg.getBoundingClientRect();
      goal.on = false;
      view.cx = drag.cx - (dx / rect.width) * (D.W / view.z);
      view.cy = drag.cy - (dy / rect.height) * (D.H / view.z);
      applyView();
      stage.setAttribute("data-dragging", "");
    }
    return;
  }
  if (event.pointerType !== "mouse") return;
  inside = true;
  clearTimeout(leaveTimer);
  quiet();
  const id = pieceAt(event);
  if (id) select(id);
  if (view.z <= 1.01 && !locked) setApart(true);
  run();
});

function release(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinch = null;
  if (drag && drag.id === event.pointerId) {
    if (!drag.moved) {
      const id = pieceAt(event);
      if (drag.type !== "mouse") {
        if (id) {
          select(id);
          setApart(true);
        } else {
          select(null);
          if (!locked) setApart(!apart);
        }
      } else if (!id) select(null);
    }
    drag = null;
    stage.removeAttribute("data-dragging");
  }
}
stage.addEventListener("pointerup", release);
stage.addEventListener("pointercancel", release);

stage.addEventListener("pointerleave", (event) => {
  if (event.pointerType !== "mouse") return;
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside || locked || view.z > 1.01) return;
    setApart(false);
  }, 500);
});

stage.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    quiet();
    const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.012 : 0.0022));
    zoomAt(event.clientX, event.clientY, view.z * factor);
    run();
  },
  { passive: false },
);

stage.addEventListener("dblclick", (event) => {
  quiet();
  const point = pointIn(event.clientX, event.clientY);
  const z = view.z * 2 > 8 ? 1 : view.z * 2;
  glideTo(z, point.x, point.y);
});

root.querySelectorAll("[data-zoom]").forEach((button) =>
  button.addEventListener("click", () => {
    quiet();
    const kind = button.dataset.zoom;
    if (kind === "reset") {
      glideTo(1, D.W / 2, D.H / 2);
      return;
    }
    glideTo(view.z * (kind === "in" ? 1.6 : 1 / 1.6), view.cx, view.cy);
  }),
);

apartButton.addEventListener("click", () => {
  quiet();
  locked = !apart;
  setApart(!apart);
});

function boxApart(id) {
  const box = D.boxes[id].pulled;
  const dx = D.EX[0] * D.moves[id];
  const dy = D.EX[1] * D.moves[id];
  return [box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy];
}

zoomHere.addEventListener("click", () => {
  if (!selected) return;
  quiet();
  locked = true;
  setApart(true);
  const rect = svg.getBoundingClientRect();
  const box = fitBox(boxApart(selected), rect.width / rect.height, 1.12);
  glideTo(D.W / box.w, box.x + box.w / 2, box.y + box.h / 2);
});

partButtons.forEach((button) => {
  const show = () => {
    clearTimeout(leaveTimer);
    quiet();
    select(button.dataset.part);
    if (view.z <= 1.01) setApart(true);
    run();
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("click", show);
  button.addEventListener("pointerleave", () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || locked || view.z > 1.01 || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      setApart(false);
    }, 600);
  });
});

stage.addEventListener("keydown", (event) => {
  const index = selected ? IDS.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(IDS.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = IDS.length - 1;
  else if (event.key === "+" || event.key === "=") {
    event.preventDefault();
    quiet();
    glideTo(view.z * 1.6, view.cx, view.cy);
    return;
  } else if (event.key === "-" || event.key === "_") {
    event.preventDefault();
    quiet();
    glideTo(view.z / 1.6, view.cx, view.cy);
    return;
  } else if (event.key === "0") {
    quiet();
    glideTo(1, D.W / 2, D.H / 2);
    return;
  } else if (event.key === "Escape") {
    event.preventDefault();
    quiet();
    locked = false;
    select(null);
    setApart(false);
    glideTo(1, D.W / 2, D.H / 2);
    return;
  } else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    quiet();
    locked = !apart;
    setApart(!apart);
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quiet();
  select(IDS[next]);
  if (view.z <= 1.01) setApart(true);
});

window.addEventListener("resize", () => {
  lensView.ready = false;
  stageWidth = svg.getBoundingClientRect().width || D.W;
  place();
  clearTimeout(holdTimer);
  holdTimer = setTimeout(holdHeight, 150);
  run();
});

function applyLang() {
  const words = T();
  document.title = words.pageTitle;
  root.dataset.lang = lang;
  SS.swapWords(document, "t", words.ui);
  svg.setAttribute("aria-label", words.ui.label);
  partButtons.forEach((button) => (button.querySelector(".ss-part-name").textContent = words.sections[button.dataset.part].short));
  apartButton.textContent = apart ? words.ui.together : words.ui.apart;
  langButton.textContent = words.ui.langSwitch;
  langButton.lang = lang === "zh" ? "en" : "zh-Hans";
  holdHeight();
  say(readoutText());
  stage.setAttribute("aria-valuetext", "");
  describe();
}

SS.onLang((next) => {
  lang = next;
  applyLang();
});
langButton.addEventListener("click", () => document.dispatchEvent(new CustomEvent("ss-lang-pick", { detail: lang === "zh" ? "en" : "zh" })));

// Other figures ask Fig 1 to show a section: pick it, take the stack apart and scroll up to it.
document.addEventListener("ss-show-section", (event) => {
  quiet();
  locked = true;
  glideTo(1, D.W / 2, D.H / 2);
  select(event.detail);
  setApart(true);
  root.scrollIntoView({ behavior: still.matches ? "auto" : "smooth", block: "start" });
});

payButtons.forEach((button) =>
  button.addEventListener("click", () => {
    quiet();
    setPayload(button.dataset.paySet);
  }),
);

if (still.matches) touring = false;
root.dataset.payload = payload;
if (lang !== "en") applyLang();
else holdHeight();
document.fonts?.ready.then(holdHeight);
applyView();
place();
say(readoutText());
