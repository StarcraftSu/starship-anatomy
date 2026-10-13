SS_TIMELINE.mount(document.getElementById("orbit"), __ORBIT__, (api) => {
  const { stage, D, still, slide } = api;
  const { cubic, linear, smooth } = SS_TIMELINE;
  const K = D.tracks;
  const thrustAt = linear(K.thrust);
  const doorAt = linear(K.door);
  const sinkAt = cubic(K.sink);
  const altitudeAt = linear(K.altitude);
  const driftAt = linear(K.drift);

  // Ground slid by so far: the drift speed summed over playback time once, so any moment can be shown directly.
  const STEP = 0.02;
  const ground = [0];
  for (let t = STEP; t <= D.end + STEP; t += STEP) ground.push(ground.at(-1) + driftAt(t - STEP / 2) * STEP);
  const groundAt = (ta) => {
    const x = Math.max(0, ta) / STEP;
    const i = Math.min(ground.length - 2, Math.floor(x));
    return ground[i] + (ground[i + 1] - ground[i]) * (x - i);
  };

  const earth = [...stage.querySelectorAll("[data-earth]")];
  const flame = stage.querySelector("[data-flame]");
  const door = stage.querySelector("[data-door]");
  const sats = [...stage.querySelectorAll("[data-sat]")];
  const P = D.deploy;
  const startOf = (i) => P.first + i * P.every;

  // How far the stack has moved down (m): after each satellite clears it, by one place.
  function dropAt(ta) {
    let drop = 0;
    for (let i = 0; i < sats.length - 1; i++) {
      const t0 = startOf(i) + P.lower[0];
      if (ta <= t0) break;
      drop += (i === 0 ? D.sat.rest[1] - D.sat.base : D.sat.rest[i + 1] - D.sat.rest[i]) * smooth(t0, startOf(i) + P.lower[1], ta);
    }
    return drop;
  }
  // Distance slid out (m): speeding up over the first moment, then a steady glide.
  const outOf = (tau) => (tau < P.ramp ? (P.speed * tau * tau) / (2 * P.ramp) : P.speed * (tau - P.ramp / 2));

  const shownStyle = new Map();
  const setStyle = (el, key, value) => {
    const id = key + (el.dataset.styleId ??= String(shownStyle.size));
    if (shownStyle.get(id) === value) return;
    shownStyle.set(id, value);
    el.style[key] = value;
  };

  function render(ta, tm) {
    const sink = sinkAt(ta) * D.sinkPx;
    const g = groundAt(ta);
    for (const el of earth) {
      const speed = Number(el.dataset.clouds || 0);
      slide(el, speed ? -((((g * speed) % D.W) + D.W) % D.W) : 0, -sink);
    }

    const thrust = thrustAt(ta);
    const flicker = api.playing && !still.matches ? 1 + 0.035 * Math.sin(api.wobble * 29) + 0.02 * Math.sin(api.wobble * 53) : 1;
    setStyle(flame, "opacity", thrust > 0.01 ? Math.min(1, thrust * 1.6).toFixed(3) : "0");
    setStyle(flame, "transform", `scale(${((0.45 + 0.55 * thrust) * flicker).toFixed(3)})`);
    setStyle(door, "opacity", (1 - doorAt(ta)).toFixed(3));

    const drop = dropAt(ta);
    let out = 0;
    sats.forEach((el, i) => {
      const start = startOf(i);
      let along;
      let away = 0;
      if (ta < start) along = -Math.min(drop, D.sat.rest[i] - D.sat.base);
      else {
        const tau = ta - start;
        away = outOf(tau);
        along = -(D.sat.rest[i] - D.sat.base) - P.back * Math.max(0, tau - 0.4) ** 2 * 0.5;
        if (away > D.sat.clear) out++;
      }
      slide(el, D.AX[0] * along + D.OUT[0] * away, D.AX[1] * along + D.OUT[1] * away);
    });

    const words = api.words();
    let text = `≈ ${Math.round(altitudeAt(tm))} ${words.say.km}`;
    if (ta >= P.first - 1e-6) text += ` · ${words.say.outBefore}${out}/${sats.length}${words.say.outAfter}`;
    return text;
  }

  return { render };
});
