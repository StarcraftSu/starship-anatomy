SS_TIMELINE.mount(document.getElementById("home"), __HOME__, (api) => {
  const { stage, D, still, slide } = api;
  const { cubic, linear, smooth } = SS_TIMELINE;
  // A track can be one list of keyframes or one per ending.
  const along = (keys, make = cubic) => {
    if (Array.isArray(keys)) return make(keys);
    const byVariant = Object.fromEntries(Object.entries(keys).map(([name, list]) => [name, make(list)]));
    return (ta) => byVariant[api.variant](ta);
  };
  const K = D.tracks;
  const pitchAt = along(K.pitch);
  const pivotAt = along(K.pivot);
  const thrustAt = along(K.thrust, linear);
  const armsAt = along(K.arms);
  const plasmaAt = along(K.plasma);
  const hotAt = along(K.hot);
  const spaceAt = along(K.space, linear);
  const starsAt = along(K.stars, linear);
  const cloudsAt = along(K.clouds, linear);
  const blastAt = along(K.blast, linear);
  const kmAt = along(K.km, linear);

  const camLayers = [...stage.querySelectorAll("[data-cam]")];
  const cloudLayers = [...stage.querySelectorAll("[data-clouds]")];
  const riders = [...stage.querySelectorAll("[data-rides]")];
  const glow = stage.querySelector("[data-glow]");
  const hot = stage.querySelector("[data-hot]");
  const blast = stage.querySelector("[data-blast]");
  const space = stage.querySelector("[data-space]");
  const starsEl = stage.querySelector("[data-stars]");
  const plume = stage.querySelector("[data-plume]");
  const frames = [...stage.querySelectorAll("[data-pitch]")];
  const armBack = [...stage.querySelectorAll('[data-side="back"] [data-arm]')];
  const armFront = [...stage.querySelectorAll('[data-side="front"] [data-arm]')];
  const puffEls = [...stage.querySelectorAll("[data-puff]")];
  const PX = -D.EZ[1];

  const showing = new Map();
  function show(list, index) {
    const was = showing.get(list) ?? 0;
    if (was === index) return;
    list[was].setAttribute("display", "none");
    list[index].setAttribute("display", "inline");
    showing.set(list, index);
  }
  const styled = new Map();
  const setStyle = (el, key, value) => {
    if (styled.get(el)?.[key] === value) return;
    styled.set(el, { ...styled.get(el), [key]: value });
    el.style[key] = value;
  };

  function render(ta) {
    const variant = api.variant;
    const theta = (pitchAt(ta) * Math.PI) / 180;
    const a = [Math.cos(theta), Math.sin(theta)];
    // Where the ship's base is (m, in the x-z plane): in the air it turns about its pivot; down on the water,
    // about its base.
    const base = variant === "splash" && ta >= D.tip ? [0, 0] : [-D.pivot * a[0], pivotAt(ta) - D.pivot * a[1]];
    const camZ = Math.max(0, base[1] + D.pivot * a[1] - D.follow);
    const shift = (x, z) => [D.EX[0] * x + D.EZ[0] * (z - camZ), D.EX[1] * x + D.EZ[1] * (z - camZ)];

    for (const el of camLayers) slide(el, ...shift(0, 0));
    const ship = shift(base[0], base[1]);
    for (const el of riders) slide(el, ...ship);
    slide(glow, ...ship);
    show(frames, Math.round((theta / (Math.PI / 2)) * (D.pitchFrames - 1)));
    const open = armsAt(ta);
    show(armBack, Math.round((1 - open) * (D.armFrames - 1)));
    show(armFront, Math.round((1 - open) * (D.armFrames - 1)));

    // Landing flame from the middle of the engine end, along the axis.
    const thrust = thrustAt(ta);
    if (thrust < 0.02) {
      if (plume.getAttribute("display") !== "none") plume.setAttribute("display", "none");
    } else {
      const dir = [-(D.EX[0] * a[0] + D.EZ[0] * a[1]), -(D.EX[1] * a[0] + D.EZ[1] * a[1])];
      const angle = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
      const flicker = api.playing && !still.matches ? 1 + 0.05 * Math.sin(api.wobble * 31) + 0.03 * Math.sin(api.wobble * 57) : 1;
      const x = D.O[0] + ship[0];
      const y = D.O[1] + ship[1];
      plume.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(30 * thrust * Math.hypot(...dir) * flicker).toFixed(1)} ${(6 * (0.5 + 0.5 * thrust) * PX).toFixed(1)})`);
      if (plume.getAttribute("display") === "none") plume.setAttribute("display", "inline");
    }

    setStyle(glow, "opacity", plasmaAt(ta).toFixed(3));
    setStyle(hot, "opacity", hotAt(ta).toFixed(3));
    space.setAttribute("opacity", (0.94 * spaceAt(ta)).toFixed(3));
    starsEl.setAttribute("opacity", starsAt(ta).toFixed(3));
    cloudLayers.forEach((el, index) => slide(el, 0, cloudsAt(ta) * (index ? 1.35 : 1)));

    const flash = blastAt(ta);
    setStyle(blast, "opacity", flash.toFixed(3));
    setStyle(blast, "transform", `scale(${(0.35 + 0.9 * smooth(33.05, 35, ta)).toFixed(3)})`);
    puffEls.forEach((el, index) => {
      const puff = D.puffs[index];
      const life = (ta - puff.t0) / puff.life;
      if (variant !== "splash" || life <= 0 || life >= 1) {
        if (el.getAttribute("r") !== "0") el.setAttribute("r", "0");
        return;
      }
      const grow = 1 - (1 - life) * (1 - life);
      const [dx, dy] = shift(puff.p[0] * (1 + 0.4 * grow), puff.p[2] + 4 * grow);
      el.setAttribute("cx", (D.O[0] + dx + D.EY[0] * puff.p[1]).toFixed(1));
      el.setAttribute("cy", (D.O[1] + dy + D.EY[1] * puff.p[1]).toFixed(1));
      el.setAttribute("r", ((puff.r0 + (puff.r1 - puff.r0) * grow) * PX).toFixed(1));
      el.setAttribute("opacity", (0.85 * Math.pow(Math.sin(Math.PI * life), 0.7)).toFixed(2));
    });

    const words = api.words();
    if (ta < 23.6) {
      const km = kmAt(ta);
      return `≈ ${km < 10 ? km.toFixed(1) : Math.round(km)} ${words.say.km}`;
    }
    if (variant === "splash" && ta >= D.touch) return words.say.water;
    if (variant === "catch" && ta >= 30.8) return words.say.arms;
    return `${Math.round(Math.max(0, base[1]))} m`;
  }

  // The catch is a plan with no date yet, so from the flip on its readout says whose plan it is instead of a time.
  const clock = (ta) => (api.variant === "catch" && ta >= 24 ? api.words().ui.planned : null);
  return { render, clock };
});
