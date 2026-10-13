// What every figure's live script shares: the page's language and the words swapped in for it, the readout and the
// spec list, a layout held at its tallest panel, a frame loop that runs only while its figure is near the screen,
// and the spring that moves parts apart and back.
const SS = (() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const touch = matchMedia("(hover: none)");
  const live = document.querySelector("[data-live]");

  // The language is chosen once for the page (?lang=, then the reader's last choice, then the browser) and kept on
  // <html>, so a figure drawn later starts in it. Any button asks for a change with an ss-lang-pick event.
  const LANGS = ["en", "zh"];
  const pick = () => {
    const asked = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(asked)) return asked;
    try {
      const kept = localStorage.getItem("ss-lang");
      if (LANGS.includes(kept)) return kept;
    } catch {}
    return (navigator.languages || [navigator.language]).some((code) => /^zh\b/i.test(code || "")) ? "zh" : "en";
  };
  let lang = pick();
  const mark = () => (document.documentElement.lang = lang === "zh" ? "zh-Hans" : "en");
  mark();
  const listeners = [];
  document.addEventListener("ss-lang-pick", (event) => {
    lang = event.detail;
    try {
      localStorage.setItem("ss-lang", lang);
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set("lang", lang);
    history.replaceState(null, "", url);
    mark();
    for (const listen of listeners) listen(lang);
  });

  // Every [data-<key>] in scope takes its text from words, and every [data-<key>-aria] its label.
  function swapWords(scope, key, words) {
    for (const el of scope.querySelectorAll(`[data-${key}]`)) el.textContent = words[el.dataset[key]];
    for (const el of scope.querySelectorAll(`[data-${key}-aria]`)) el.setAttribute("aria-label", words[el.dataset[`${key}Aria`]]);
  }

  const write = (el, text) => {
    if (el.textContent !== text) el.textContent = text;
  };

  // The stage's spoken value; read aloud through the page's live region only when the reader caused the change.
  function announce(stage, text, speak) {
    if (stage.getAttribute("aria-valuetext") === text) return;
    stage.setAttribute("aria-valuetext", text);
    if (speak && live) live.textContent = text;
  }

  function fillSpecs(list, specs) {
    list.replaceChildren(
      ...specs.flatMap(([key, value]) => {
        const dt = document.createElement("dt");
        dt.textContent = key;
        const dd = document.createElement("dd");
        dd.textContent = value;
        return [dt, dd];
      }),
    );
  }

  // Put every state in the panel once and hold the layout at the tallest, so nothing under the figure moves when
  // the panel changes. The caller puts its current state back afterwards.
  function holdTallest(layout, states, show) {
    layout.style.minHeight = "";
    let tallest = 0;
    for (const state of states) {
      show(state);
      tallest = Math.max(tallest, layout.offsetHeight);
    }
    layout.style.minHeight = `${Math.ceil(tallest)}px`;
  }

  // A frame loop that runs only while `target` is near the screen: step(dt) moves things and returns true while
  // there is more to do, and run() wakes the loop after something changes. `seen` hears when it comes and goes.
  function loop(target, step, { margin = "160px 0px", seen } = {}) {
    let frame = 0;
    let last = 0;
    let visible = false;
    const tick = (now) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      frame = step(dt) && visible ? requestAnimationFrame(tick) : 0;
    };
    const run = () => {
      if (frame || !visible) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        seen?.(visible);
        if (visible) run();
      },
      { rootMargin: margin },
    ).observe(target);
    return {
      run,
      get visible() {
        return visible;
      },
    };
  }

  // A spring toward its target, which may be set to change at a later clock time (pending). Calm (reduced motion)
  // jumps straight there. Returns true while it is still moving or waiting.
  function steer(state, dt, calm, clock, { stiffness, damping, substeps }) {
    if (state.pending && clock >= state.pending.at) {
      state.target = state.pending.value;
      state.pending = null;
    }
    if (!calm) {
      for (let index = 0; index < substeps; index++) {
        const h = dt / substeps;
        state.v += ((state.target - state.x) * stiffness - state.v * damping) * h;
        state.x += state.v * h;
      }
      if (Math.abs(state.target - state.x) >= 2e-4 || Math.abs(state.v) >= 2e-4) return true;
    }
    state.x = state.target;
    state.v = 0;
    return state.pending !== null;
  }

  return {
    still,
    touch,
    LANGS,
    get lang() {
      return lang;
    },
    onLang: (listen) => listeners.push(listen),
    swapWords,
    write,
    announce,
    fillSpecs,
    holdTallest,
    loop,
    steer,
  };
})();
