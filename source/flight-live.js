{
  const D = __FLIGHT__;
  const root = document.querySelector(".fl");
  const stage = root.querySelector(".fl-stage");
  const svg = stage.querySelector("svg");
  const readout = root.querySelector("[data-readout]");
  const panel = root.querySelector(".fl-panel");
  const pNum = panel.querySelector("[data-p-num]");
  const pTitle = panel.querySelector("[data-p-title]");
  const pText = panel.querySelector("[data-p-text]");
  const pSpecs = panel.querySelector("[data-p-specs]");
  const linksBox = panel.querySelector("[data-p-links]");
  const linkList = panel.querySelector("[data-p-link-list]");
  const chips = [...panel.querySelectorAll(".fl-event")];
  const playButton = root.querySelector("[data-play]");
  const restartButton = root.querySelector("[data-restart]");
  const scrub = root.querySelector("[data-scrub]");
  const camLayers = [...stage.querySelectorAll("[data-cam]")];
  const space = stage.querySelector("[data-space]");
  const starsEl = stage.querySelector("[data-stars]");
  const boosterEl = stage.querySelector("[data-booster]");
  const rotEls = [...boosterEl.querySelectorAll("[data-rot]")];
  const ventsEl = boosterEl.querySelector("[data-vents]");
  const shipEl = stage.querySelector("[data-ship]");
  const plumeB = stage.querySelector('[data-plume="booster"]');
  const plumeS = stage.querySelector('[data-plume="ship"]');
  const armBack = [...stage.querySelectorAll('.fl-arm[data-side="back"] [data-arm]')];
  const armFront = [...stage.querySelectorAll('.fl-arm[data-side="front"] [data-arm]')];
  const steamEls = [...stage.querySelectorAll("[data-steam]")];
  const secEls = [...stage.querySelectorAll("[data-sec]")];
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const touch = matchMedia("(hover: none)");
  const live = document.querySelector("[data-live]");

  let lang = document.documentElement.lang.startsWith("zh") ? "zh" : "en";
  const T = () => D.t[lang];

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
  const K = D.tracks;
  const clockAt = linear(K.clock);
  const baseAt = cubic(K.base);
  const sepAt = cubic(K.sep);
  const rotAt = cubic(K.rot);
  const armsAt = cubic(K.arms);
  const boosterAt = linear(K.booster);
  const shipAt = linear(K.ship);
  const ventsAt = linear(K.vents);
  const altitudeAt = linear(K.altitude);
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  const PX = -D.EZ[1];
  const boosterLayer = boosterEl.ownerSVGElement;
  const shipLayer = shipEl.ownerSVGElement;
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
  let camY = 0;
  const screen = ([x, y, z]) => [D.O[0] + D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.O[1] + D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z + camY];

  let ta = 0;
  let playing = false;
  let touring = false;
  let hold = 0;
  let visible = false;
  let seen = false;
  let frame = 0;
  let last = 0;
  let shownEvent = undefined;
  let rotShown = 0;
  let armShown = [0, 0];
  let wobble = 0;

  const clockText = (tm) => {
    const s = Math.round(Math.abs(tm));
    return `T${tm < 0 ? "−" : "+"}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  function eventAt(time) {
    let found = null;
    for (const event of D.events) if (time >= event.ta - 1e-6) found = event;
    return found;
  }

  function show(list, index, which) {
    if (which[0] === index) return;
    list[which[0]]?.setAttribute("display", "none");
    list[index].setAttribute("display", "inline");
    which[0] = index;
  }
  const rotState = [0];
  const backState = [0];
  const frontState = [0];

  function placePlume(el, anchor, dir, length, width) {
    if (length <= 0.5) {
      if (el.getAttribute("display") !== "none") el.setAttribute("display", "none");
      return;
    }
    const [ax, ay] = screen(anchor);
    const angle = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
    const flicker = playing && !still.matches ? 1 + 0.05 * Math.sin(wobble * 31) + 0.03 * Math.sin(wobble * 57) : 1;
    el.setAttribute("transform", `translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(length * PX * flicker).toFixed(1)} ${(width * PX).toFixed(1)})`);
    if (el.getAttribute("display") === "none") el.setAttribute("display", "inline");
  }

  function render() {
    const tm = clockAt(ta);
    const base = baseAt(ta);
    const theta = (rotAt(ta) * Math.PI) / 180;
    const sep = sepAt(ta);
    const altitude = altitudeAt(tm);
    const high = smooth(0, 60, altitude);

    const cam = Math.max(0, base - 35);
    camY = cam * PX;
    for (const el of camLayers) slide(el, 0, camY);
    slide(boosterLayer, D.EZ[0] * base, D.EZ[1] * base + camY);
    show(rotEls, Math.round((theta / Math.PI) * (D.rotFrames - 1)), rotState);
    const shipBase = base + D.booster + sep;
    slide(shipLayer, 0, D.EZ[1] * shipBase + camY);

    // Booster flame from the centre of its engine plane, along its axis.
    const throttle = boosterAt(ta);
    const axis = [Math.sin(theta), 0, Math.cos(theta)];
    const engine = [-D.pivot * Math.sin(theta), 0, base + D.pivot - D.pivot * Math.cos(theta)];
    const dirScreen = [D.EX[0] * -axis[0] + D.EZ[0] * -axis[2], D.EX[1] * -axis[0] + D.EZ[1] * -axis[2]];
    placePlume(plumeB, engine, dirScreen, throttle ? (34 + 80 * high) * (0.35 + 0.65 * throttle) : 0, (9 + 24 * high) * (0.4 + 0.6 * throttle));
    const shipThrottle = shipAt(ta);
    const shipLength = sep < 6 ? 12 + sep * 2 : 40 + 40 * high;
    placePlume(plumeS, [0, 0, shipBase], [D.EZ[0] * -1, D.EZ[1] * -1], shipThrottle ? shipLength * shipThrottle : 0, (sep < 6 ? 7 : 10 + 14 * high) * shipThrottle);
    const vent = ventsAt(ta);
    ventsEl.setAttribute("opacity", (vent * (playing && !still.matches ? 0.85 + 0.15 * Math.sin(wobble * 43) : 1)).toFixed(2));

    const open = armsAt(ta);
    show(armBack, Math.round((1 - open) * (D.armFrames - 1)), backState);
    show(armFront, Math.round((1 - open) * (D.armFrames - 1)), frontState);

    steamEls.forEach((el, index) => {
      const puff = D.steam[index];
      const life = (ta - puff.t0) / 7;
      if (life <= 0 || life >= 1) {
        if (el.getAttribute("r") !== "0") el.setAttribute("r", "0");
        return;
      }
      const grow = 1 - (1 - life) * (1 - life);
      const [x, y] = screen([puff.p[0] * (1 + 0.5 * grow), puff.p[1] * (1 + 0.5 * grow), puff.p[2] + 6 * grow]);
      el.setAttribute("cx", x.toFixed(1));
      el.setAttribute("cy", y.toFixed(1));
      el.setAttribute("r", ((puff.r0 + (puff.r1 - puff.r0) * grow) * PX).toFixed(1));
      el.setAttribute("opacity", (0.9 * Math.pow(Math.sin(Math.PI * life), 0.7)).toFixed(2));
    });

    space.setAttribute("opacity", (0.94 * smooth(3, 45, altitude)).toFixed(3));
    starsEl.setAttribute("opacity", smooth(18, 50, altitude).toFixed(3));

    const words = T();
    const where = altitude < 0.05 ? (tm < 0 ? words.say.pad : `${Math.round(altitude * 1000)} m`) : `≈ ${altitude < 10 ? altitude.toFixed(1) : Math.round(altitude)} ${words.say.km}`;
    const text = `${clockText(tm)} · ${where}`;
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
  window.addEventListener("resize", () => {
    pxPerUnit = (svg.getBoundingClientRect().width || D.W) / D.W;
    shown.clear();
    render();
  });
  stage.addEventListener("pointerdown", () => {
    if (touring) pause();
  });

  function applyLang() {
    const words = T();
    for (const el of root.querySelectorAll("[data-ft]")) el.textContent = words.ui[el.dataset.ft];
    for (const el of root.querySelectorAll("[data-ft-aria]")) el.setAttribute("aria-label", words.ui[el.dataset.ftAria]);
    svg.setAttribute("aria-label", words.ui.label);
    chips.forEach((chip) => (chip.querySelector(".fl-event-name").textContent = words.events[chip.dataset.event].short));
    playButton.textContent = playing ? words.ui.pause : words.ui.play;
    fillPanel();
    render();
  }
  document.addEventListener("ss-lang", (event) => {
    lang = event.detail;
    applyLang();
  });

  if (lang !== "en") applyLang();
  render();
}
