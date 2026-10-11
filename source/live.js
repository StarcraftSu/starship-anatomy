const D = __DATA__;
const root = document.querySelector(".ss");
const stage = root.querySelector(".ss-stage");
const readout = root.querySelector("[data-readout]");
const hint = root.querySelector("[data-hint]");
const live = document.querySelector("[data-live]");
const partButtons = [...root.querySelectorAll(".ss-part")];
const still = matchMedia("(prefers-reduced-motion: reduce)");

const nodes = [...stage.querySelectorAll(".it")].map((el) => ({ el, piece: el.dataset.piece, m: el.dataset.m.split(",").map(Number), shown: "" }));
const IDS = D.order;
const piece = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));

let clock = 0;
let apart = false;
let selected = null;
let inside = false;
let leaveTimer = 0;
let idleTimer = 0;
let touring = !still.matches;
let tourClock = -1.2;
let visible = false;
let frame = 0;
let last = 0;

function say(text) {
  if (readout.textContent !== text) readout.textContent = text;
}

function describe() {
  const text = selected ? `${D.pieces[selected].name}: ${D.pieces[selected].say}` : apart ? "Apart, six sections" : "Assembled";
  if (stage.getAttribute("aria-valuetext") !== text) {
    stage.setAttribute("aria-valuetext", text);
    if (!touring && live) live.textContent = text;
  }
}

function setApart(on) {
  if (apart === on) return;
  apart = on;
  const goal = on ? 1 : 0;
  let index = 0;
  for (const id of on ? D.stagger : [...D.stagger].reverse()) {
    if (piece[id].target === goal) piece[id].pending = null;
    else piece[id].pending = { value: goal, at: clock + (still.matches ? 0 : index++ * D.spring.stagger) };
  }
  describe();
  run();
}

function select(id) {
  if (selected === id) return;
  selected = id;
  for (const node of nodes) {
    if (id !== null && node.piece === id) node.el.setAttribute("data-on", "");
    else node.el.removeAttribute("data-on");
  }
  if (id) stage.setAttribute("data-focus", "");
  else stage.removeAttribute("data-focus");
  partButtons.forEach((button) => (button.dataset.part === id ? button.setAttribute("data-on", "") : button.removeAttribute("data-on")));
  stage.setAttribute("aria-valuenow", String(id ? IDS.indexOf(id) + 1 : 0));
  describe();
}

function steer(state, dt, calm) {
  if (state.pending && clock >= state.pending.at) {
    state.target = state.pending.value;
    state.pending = null;
  }
  if (calm) {
    state.x = state.target;
    state.v = 0;
    return false;
  }
  const { stiffness, damping, substeps } = D.spring;
  for (let index = 0; index < substeps; index++) {
    const h = dt / substeps;
    state.v += ((state.target - state.x) * stiffness - state.v * damping) * h;
    state.x += state.v * h;
  }
  if (Math.abs(state.target - state.x) < 2e-4 && Math.abs(state.v) < 2e-4) {
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }
  return true;
}

function place() {
  for (const node of nodes) {
    const share = piece[node.piece].x;
    const tx = D.EX[0] * node.m[0] * share;
    const ty = D.EX[1] * node.m[0] * share;
    const text = Math.abs(share) < 1e-4 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
    if (text !== node.shown) {
      node.shown = text;
      if (text) node.el.setAttribute("transform", text);
      else node.el.removeAttribute("transform");
    }
  }
}

const STEP = 2.2;
function tourAt(time) {
  const from = 0.6;
  const list = from + 1.4;
  const end = list + IDS.length * STEP;
  if (time < from) return { apart: false, part: null };
  if (time < list) return { apart: true, part: null };
  if (time < end) return { apart: true, part: IDS[Math.floor((time - list) / STEP)] };
  if (time < end + 4.5) return { apart: false, part: null };
  return null;
}

function idleText() {
  if (selected) return D.pieces[selected].say;
  const moving = IDS.some((id) => Math.abs(piece[id].x - piece[id].target) > 0.002 || piece[id].pending);
  if (moving) return apart ? "taking it apart" : "stacking";
  return apart ? "six sections · booster 1–3 · ship 4–6" : D.idle;
}

function quietTour() {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (inside || partButtons.some((button) => button.matches(":hover, :focus-visible"))) return quietTour();
    touring = !still.matches;
    tourClock = -0.6;
    run();
  }, 5200);
}

function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
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
  for (const id of IDS) if (steer(piece[id], dt, calm)) moving = true;
  place();
  say(idleText());
  frame = visible && (moving || touring) ? requestAnimationFrame(tick) : 0;
}

function run() {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
}

new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  },
  { rootMargin: "120px 0px" },
).observe(stage);

function pieceAt(event) {
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  const item = hit && hit.closest ? hit.closest(".it") : null;
  return item ? item.dataset.piece : null;
}

stage.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch") return;
  inside = true;
  clearTimeout(leaveTimer);
  quietTour();
  setApart(true);
  select(pieceAt(event));
  run();
});

stage.addEventListener("pointerleave", () => {
  inside = false;
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => {
    if (inside) return;
    select(null);
    setApart(false);
  }, 300);
});

stage.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "touch") return;
  quietTour();
  const id = pieceAt(event);
  if (!id) {
    select(null);
    setApart(!apart);
  } else {
    setApart(true);
    select(selected === id ? null : id);
  }
  run();
});

partButtons.forEach((button) => {
  const show = () => {
    clearTimeout(leaveTimer);
    quietTour();
    setApart(true);
    select(button.dataset.part);
    run();
  };
  const hide = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || partButtons.some((other) => other.matches(":hover, :focus-visible"))) return;
      select(null);
      setApart(false);
    }, 300);
  };
  button.addEventListener("pointerenter", show);
  button.addEventListener("focus", show);
  button.addEventListener("pointerleave", hide);
  button.addEventListener("blur", hide);
  button.addEventListener("click", show);
});

stage.addEventListener("keydown", (event) => {
  const index = selected ? IDS.indexOf(selected) : -1;
  let next = null;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(IDS.length - 1, index + 1);
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, index - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = IDS.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    quietTour();
    select(null);
    setApart(false);
    run();
    return;
  } else if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    quietTour();
    setApart(!apart);
    if (!apart) select(null);
    run();
    return;
  }
  if (next === null) return;
  event.preventDefault();
  quietTour();
  setApart(true);
  select(IDS[next]);
  run();
});

const narrow = matchMedia("(hover: none), (max-width: 480px)");
const wording = () => hint && (hint.textContent = narrow.matches ? "Tap to take it apart" : "Hover to take it apart");
wording();
narrow.addEventListener("change", wording);
place();
say(idleText());
