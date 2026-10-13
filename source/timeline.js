// The timeline figures (Fig 3 and Fig 4) share this: keyframe tracks, the event panel with its links into Fig 1,
// Play, Restart, the scrubber and keys, autoplay the first time a figure is seen (not on touch or with reduced
// motion), a layout that holds its tallest panel, and the language switch. Each figure passes in its own scene.
const SS_TIMELINE = (() => {
  // Motion follows a monotone cubic through its keyframes (no overshoot); switches follow straight lines.
  function cubic(keys) {
    const n = keys.length;
    const xs = keys.map((key) => key[0]);
    const ys = keys.map((key) => key[1]);
    const d = [];
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    const m = [d[0]];
    for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]));
    m.push(d[n - 2]);
    return (x) => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0;
      while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i];
      const t = (x - xs[i]) / h;
      const t2 = t * t;
      const t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }
  function linear(keys) {
    return (x) => {
      if (x <= keys[0][0]) return keys[0][1];
      for (let i = 0; i < keys.length - 1; i++) {
        const [x0, y0] = keys[i];
        const [x1, y1] = keys[i + 1];
        if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
      }
      return keys.at(-1)[1];
    };
  }
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const clockText = (tm) => {
    const s = Math.round(Math.abs(tm));
    const sign = tm < 0 ? "−" : "+";
    const sec = String(s % 60).padStart(2, "0");
    if (s < 3600) return `T${sign}${Math.floor(s / 60)}:${sec}`;
    return `T${sign}${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${sec}`;
  };

  function mount(root, D, makeScene) {
    const stage = root.querySelector(".fl-stage");
    const svg = stage.querySelector("svg");
    const layout = root.querySelector(".ss-layout");
    const readout = root.querySelector("[data-readout]");
    const panel = root.querySelector(".fl-panel");
    const pNum = panel.querySelector("[data-p-num]");
    const pTitle = panel.querySelector("[data-p-title]");
    const pText = panel.querySelector("[data-p-text]");
    const pSpecs = panel.querySelector("[data-p-specs]");
    const linksBox = panel.querySelector("[data-p-links]");
    const linkList = panel.querySelector("[data-p-link-list]");
    const nextLink = panel.querySelector("[data-p-next]");
    const chips = [...panel.querySelectorAll(".fl-event")];
    const playButton = root.querySelector("[data-play]");
    const restartButton = root.querySelector("[data-restart]");
    const scrub = root.querySelector("[data-scrub]");
    const secEls = [...stage.querySelectorAll("[data-sec]")];
    const still = matchMedia("(prefers-reduced-motion: reduce)");
    const touch = matchMedia("(hover: none)");
    const live = document.querySelector("[data-live]");

    let lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
    const T = () => D.t[lang];
    const clockAt = linear(D.tracks.clock);

    let pxPerUnit = (svg.getBoundingClientRect().width || D.W) / D.W;
    const shown = new Map();
    // Slide a whole layer by a shift in drawing units; the browser composites it without repainting.
    const slide = (el, x, y) => {
      const text = `translate3d(${(x * pxPerUnit).toFixed(2)}px, ${(y * pxPerUnit).toFixed(2)}px, 0)`;
      if (shown.get(el) !== text) {
        shown.set(el, text);
        el.style.transform = text;
      }
    };

    let ta = 0;
    let playing = false;
    let touring = false;
    let hold = 0;
    let visible = false;
    let seen = false;
    let frame = 0;
    let last = 0;
    let shownEvent = undefined;
    let wobble = 0;
    let measuring = false;

    const scene = makeScene({
      stage,
      D,
      still,
      slide,
      words: T,
      get playing() {
        return playing;
      },
      get wobble() {
        return wobble;
      },
    });

    function eventAt(time) {
      let found = null;
      for (const event of D.events) if (time >= event.ta - 1e-6) found = event;
      return found;
    }

    function render() {
      const tm = clockAt(ta);
      const text = `${clockText(tm)} · ${scene.render(ta, tm)}`;
      if (readout.textContent !== text) readout.textContent = text;
      if (document.activeElement !== scrub) scrub.value = String(ta);
      stage.setAttribute("aria-valuenow", ta.toFixed(1));
      const event = eventAt(ta);
      if (event !== shownEvent) {
        shownEvent = event;
        fillPanel();
      }
    }

    function sectionName(id) {
      const button = document.querySelector(`.ss [data-part="${id}"]`);
      return button ? `${button.querySelector(".ss-num").textContent} ${button.querySelector(".ss-part-name").textContent}` : id;
    }

    function fillPanel() {
      const words = T();
      const event = shownEvent;
      const data = event ? words.events[event.id] : words.overview;
      pNum.textContent = event ? clockText(event.tm) : "T";
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
      const sections = event ? event.sections : [];
      linksBox.hidden = !sections.length;
      linkList.replaceChildren(
        ...sections.map((id) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "ss-button fl-link";
          button.textContent = `${sectionName(id)} ↑`;
          button.addEventListener("click", () => {
            pause();
            document.dispatchEvent(new CustomEvent("ss-show-section", { detail: id }));
          });
          return button;
        }),
      );
      if (nextLink) {
        nextLink.hidden = !event?.next;
        if (event?.next) nextLink.href = `#${event.next}`;
      }
      if (measuring) return;
      for (const el of secEls) el.toggleAttribute("data-on", sections.includes(el.dataset.sec));
      if (sections.length) stage.setAttribute("data-focus", "");
      else stage.removeAttribute("data-focus");
      chips.forEach((chip) => chip.toggleAttribute("data-on", !!event && chip.dataset.event === event.id));
      const say = event ? `${data.title}, ${clockText(event.tm)}` : words.overview.title;
      if (stage.getAttribute("aria-valuetext") !== say) {
        stage.setAttribute("aria-valuetext", say);
        if (!playing && live) live.textContent = say;
      }
    }

    // Fill the panel with every event once and keep the tallest height, so the page below never moves.
    function holdHeight() {
      measuring = true;
      layout.style.minHeight = "";
      const keep = shownEvent;
      let tallest = 0;
      for (const event of [null, ...D.events]) {
        shownEvent = event;
        fillPanel();
        tallest = Math.max(tallest, layout.offsetHeight);
      }
      shownEvent = keep;
      measuring = false;
      fillPanel();
      layout.style.minHeight = `${Math.ceil(tallest)}px`;
    }

    function tick(now) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      wobble += dt;
      if (playing) {
        if (ta >= D.end) {
          hold += dt;
          if (hold > 2.5) {
            hold = 0;
            ta = 0;
          }
        } else ta = Math.min(D.end, ta + dt);
      }
      render();
      frame = visible && playing ? requestAnimationFrame(tick) : 0;
    }

    function run() {
      if (!frame && visible) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    }

    function setPlaying(on) {
      playing = on;
      playButton.textContent = on ? T().ui.pause : T().ui.play;
      playButton.setAttribute("aria-pressed", String(on));
      if (on && ta >= D.end) ta = 0;
      run();
      if (!on) render();
    }

    function pause() {
      touring = false;
      setPlaying(false);
    }

    function jump(time) {
      pause();
      ta = Math.min(D.end, Math.max(0, time));
      render();
    }

    new IntersectionObserver(
      (entries) => {
        visible = entries[entries.length - 1].isIntersecting;
        if (visible && !seen) {
          seen = true;
          if (!still.matches && !touch.matches) {
            touring = true;
            setPlaying(true);
          }
        }
        if (visible) run();
      },
      { rootMargin: "0px 0px -20% 0px" },
    ).observe(stage);

    playButton.addEventListener("click", () => {
      touring = false;
      setPlaying(!playing);
    });
    restartButton.addEventListener("click", () => {
      touring = false;
      ta = 0;
      hold = 0;
      setPlaying(true);
    });
    scrub.addEventListener("input", () => jump(Number(scrub.value)));
    chips.forEach((chip) =>
      chip.addEventListener("click", () => {
        const event = D.events.find((item) => item.id === chip.dataset.event);
        jump(event.ta);
      }),
    );
    stage.addEventListener("keydown", (event) => {
      const now = eventAt(ta);
      const index = now ? D.events.indexOf(now) : -1;
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        touring = false;
        setPlaying(!playing);
      } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        jump(D.events[Math.min(D.events.length - 1, index + 1)].ta);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        jump(index <= 0 ? 0 : D.events[index - 1].ta);
      } else if (event.key === "Home") {
        event.preventDefault();
        jump(0);
      } else if (event.key === "End") {
        event.preventDefault();
        jump(D.end);
      }
    });
    let holdTimer = 0;
    window.addEventListener("resize", () => {
      pxPerUnit = (svg.getBoundingClientRect().width || D.W) / D.W;
      shown.clear();
      render();
      clearTimeout(holdTimer);
      holdTimer = setTimeout(holdHeight, 150);
    });
    stage.addEventListener("pointerdown", () => {
      if (touring) pause();
    });
    nextLink?.addEventListener("click", () => pause());

    function applyLang() {
      const words = T();
      for (const el of root.querySelectorAll("[data-ft]")) el.textContent = words.ui[el.dataset.ft];
      for (const el of root.querySelectorAll("[data-ft-aria]")) el.setAttribute("aria-label", words.ui[el.dataset.ftAria]);
      svg.setAttribute("aria-label", words.ui.label);
      chips.forEach((chip) => (chip.querySelector(".fl-event-name").textContent = words.events[chip.dataset.event].short));
      playButton.textContent = playing ? words.ui.pause : words.ui.play;
      holdHeight();
      render();
    }
    document.addEventListener("ss-lang", (event) => {
      lang = event.detail;
      applyLang();
    });

    if (lang !== "en") applyLang();
    else holdHeight();
    render();
  }

  return { cubic, linear, smooth, mount };
})();
