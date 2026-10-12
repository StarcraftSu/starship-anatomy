{
  const D = __RAPTOR__;
  const root = document.querySelector(".rp");
  const stage = root.querySelector(".rp-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const panel = root.querySelector(".rp-panel");
  const pNum = panel.querySelector("[data-p-num]");
  const pTitle = panel.querySelector("[data-p-title]");
  const pText = panel.querySelector("[data-p-text]");
  const pSpecs = panel.querySelector("[data-p-specs]");
  const stepButtons = [...panel.querySelectorAll(".rp-step")];
  const apartButton = root.querySelector("[data-apart]");
  const playButton = root.querySelector("[data-play]");
  const langButton = panel.querySelector("[data-lang]");
  const flowsEl = stage.querySelector("[data-flows]");
  const flowEls = [...stage.querySelectorAll(".rp-flow")];
  const orgEls = [...stage.querySelectorAll("[data-org]")];
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const live = document.querySelector("[data-live]");

  const nodes = [...stage.querySelectorAll(".rp-it")].map((el) => ({ el, id: el.dataset.piece, m: el.dataset.m.split(",").map(Number), shown: "" }));
  const IDS = nodes.map((node) => node.id);
  const MOVING = IDS.filter((id) => D.stagger.includes(id));
  const spring = Object.fromEntries(IDS.map((id) => [id, { x: 0, v: 0, target: 0, pending: null }]));

  let lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
  const T = () => D.t[lang];
  let clock = 0;
  let apart = false;
  let locked = false;
  let step = 0;
  let playing = false;
  let playClock = 0;
  let inside = false;
  let leaveTimer = 0;
  let idleTimer = 0;
  let touring = !still.matches;
  let tourClock = -1.4;
  let visible = false;
  let frame = 0;
  let last = 0;
  let flowShown = -1;

  const PLAY_STEP = 4.2;

  function say(text) {
    if (readout.textContent !== text) readout.textContent = text;
  }

  function describe() {
    const words = T();
    const text = step ? `${words.steps[step].title}: ${words.steps[step].say}` : apart ? words.ui.apartSay : words.ui.assembled;
    if (stage.getAttribute("aria-valuetext") !== text) {
      stage.setAttribute("aria-valuetext", text);
      if (!touring && !playing && live) live.textContent = text;
    }
  }

  function setApart(on) {
    if (apart === on) return;
    apart = on;
    const order = on ? D.stagger : [...D.stagger].reverse();
    order.forEach((id, index) => {
      const state = spring[id];
      if (!state) return;
      state.pending = { value: on ? 1 : 0, at: clock + (still.matches ? 0 : index * D.spring.stagger) };
    });
    if (!on && step) setStep(0);
    apartButton.textContent = on ? T().ui.together : T().ui.apart;
    apartButton.setAttribute("aria-pressed", String(on));
    describe();
    run();
  }

  function fillPanel() {
    const words = T();
    const data = step ? words.steps[step] : words.overview;
    pNum.textContent = step ? String(step) : "R3";
    pTitle.textContent = data.title;
    pText.textContent = data.text;
    pSpecs.replaceChildren(
      ...data.specs.flatMap(([key, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = key;
        const dd = document.createElement("dd");
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }

  function setStep(n) {
    if (step === n) return;
    step = n;
    if (n) stage.dataset.step = String(n);
    else delete stage.dataset.step;
    for (const el of flowEls) el.toggleAttribute("data-on", !n || Number(el.dataset.step) === n);
    const names = D.orgs[n] || [];
    for (const el of orgEls) el.toggleAttribute("data-on", names.some((name) => el.dataset.org.split(" ").includes(name)));
    stepButtons.forEach((button) => button.toggleAttribute("data-on", Number(button.dataset.step) === n));
    stage.setAttribute("aria-valuenow", String(n));
    fillPanel();
    describe();
    run();
  }

  function steer(state, dt, calm) {
    if (state.pending && clock >= state.pending.at) {
      state.target = state.pending.value;
      state.pending = null;
    }
    if (calm) {
      state.x = state.target;
      state.v = 0;
      return state.pending !== null;
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
      const share = spring[node.id].x;
      const [mx, my, mz] = node.m;
      const tx = (D.EX[0] * mx + D.EY[0] * my + D.EZ[0] * mz) * share;
      const ty = (D.EX[1] * mx + D.EY[1] * my + D.EZ[1] * mz) * share;
      const text = Math.abs(share) < 1e-4 ? "" : `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`;
      if (text !== node.shown) {
        node.shown = text;
        if (text) node.el.setAttribute("transform", text);
        else node.el.removeAttribute("transform");
      }
    }
    // The paths only make sense with the parts where they were drawn: fade them in over the last stretch.
    const least = Math.min(...MOVING.map((id) => spring[id].x));
    const shown = Math.round(Math.min(1, Math.max(0, (least - 0.82) / 0.16)) * 100) / 100;
    if (shown !== flowShown) {
      flowShown = shown;
      flowsEl.style.opacity = String(shown);
      flowsEl.style.visibility = shown > 0 ? "visible" : "hidden";
    }
  }

  function moving() {
    return MOVING.some((id) => Math.abs(spring[id].x - spring[id].target) > 0.002 || spring[id].pending);
  }

  function readoutText() {
    const words = T();
    if (moving()) return apart ? words.ui.taking : words.ui.closing;
    if (step) return words.steps[step].say;
    return apart ? words.ui.apartIdle : words.idle;
  }

  function tourAt(time) {
    const open = 0.8;
    const all = open + 2.4;
    const end = all + D.steps.length * 3.4;
    if (time < open) return { apart: false, step: 0 };
    if (time < all) return { apart: true, step: 0 };
    if (time < end) return { apart: true, step: D.steps[Math.floor((time - all) / 3.4)] };
    if (time < end + 2.2) return { apart: true, step: 0 };
    if (time < end + 6) return { apart: false, step: 0 };
    return null;
  }

  function quiet() {
    touring = false;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (inside || locked || playing || panel.matches(":hover")) return quiet();
      touring = !still.matches;
      tourClock = -0.6;
      run();
    }, 9000);
  }

  function setPlaying(on) {
    playing = on;
    playButton.textContent = on ? T().ui.pause : T().ui.play;
    playButton.setAttribute("aria-pressed", String(on));
    if (on) {
      locked = true;
      setApart(true);
      playClock = 0;
      setStep(step && step < D.steps.length ? step : D.steps[0]);
    }
    run();
  }

  function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    clock += dt;
    const calm = still.matches;
    if (touring) {
      tourClock += dt;
      let at = tourAt(tourClock);
      if (!at) {
        tourClock = 0;
        at = tourAt(0);
      }
      setApart(at.apart);
      if (at.apart) setStep(at.step);
    } else if (playing && !moving()) {
      playClock += dt;
      if (playClock >= PLAY_STEP) {
        playClock = 0;
        const index = D.steps.indexOf(step);
        setStep(D.steps[(index + 1) % D.steps.length]);
      }
    }
    let busy = false;
    for (const id of IDS) if (steer(spring[id], dt, calm)) busy = true;
    place();
    say(readoutText());
    frame = visible && (busy || touring || playing) ? requestAnimationFrame(tick) : 0;
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
    { rootMargin: "160px 0px" },
  ).observe(root);

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse") return;
    inside = true;
    clearTimeout(leaveTimer);
    quiet();
    if (!locked) setApart(true);
  });

  stage.addEventListener("pointerleave", (event) => {
    if (event.pointerType !== "mouse") return;
    inside = false;
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (inside || locked || playing) return;
      setApart(false);
    }, 600);
  });

  stage.addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse") return;
    quiet();
    setPlaying(false);
    locked = !apart;
    setApart(!apart);
  });

  apartButton.addEventListener("click", () => {
    quiet();
    setPlaying(false);
    locked = !apart;
    setApart(!apart);
  });

  playButton.addEventListener("click", () => {
    quiet();
    setPlaying(!playing);
  });

  stepButtons.forEach((button) =>
    button.addEventListener("click", () => {
      quiet();
      setPlaying(false);
      locked = true;
      setApart(true);
      setStep(Number(button.dataset.step));
    }),
  );

  stage.addEventListener("keydown", (event) => {
    const index = D.steps.indexOf(step);
    let next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = D.steps[Math.min(D.steps.length - 1, index + 1)];
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index <= 0 ? 0 : D.steps[index - 1];
    else if (event.key === "Home") next = D.steps[0];
    else if (event.key === "End") next = D.steps.at(-1);
    else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      quiet();
      setPlaying(false);
      locked = !apart;
      setApart(!apart);
      return;
    } else if (event.key === "Escape") {
      event.preventDefault();
      quiet();
      setPlaying(false);
      locked = false;
      setApart(false);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    quiet();
    setPlaying(false);
    locked = true;
    setApart(true);
    setStep(next);
  });

  function applyLang() {
    const words = T();
    root.dataset.lang = lang;
    for (const el of root.querySelectorAll("[data-rt]")) el.textContent = words.ui[el.dataset.rt];
    for (const el of root.querySelectorAll("[data-rt-aria]")) el.setAttribute("aria-label", words.ui[el.dataset.rtAria]);
    svg.setAttribute("aria-label", words.ui.label);
    stepButtons.forEach((button) => (button.querySelector(".rp-step-name").textContent = words.steps[button.dataset.step].title));
    apartButton.textContent = apart ? words.ui.together : words.ui.apart;
    playButton.textContent = playing ? words.ui.pause : words.ui.play;
    langButton.textContent = words.ui.langSwitch;
    langButton.lang = lang === "zh" ? "en" : "zh-Hans";
    fillPanel();
    say(readoutText());
    stage.setAttribute("aria-valuetext", "");
    describe();
  }

  langButton.addEventListener("click", () => document.dispatchEvent(new CustomEvent("ss-lang-pick", { detail: lang === "zh" ? "en" : "zh" })));
  document.addEventListener("ss-lang", (event) => {
    lang = event.detail;
    applyLang();
  });

  for (const el of flowEls) el.setAttribute("data-on", "");
  if (still.matches) touring = false;
  if (lang !== "en") applyLang();
  place();
  say(readoutText());
}
