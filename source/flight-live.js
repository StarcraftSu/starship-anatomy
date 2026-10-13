SS_TIMELINE.mount(document.getElementById("flight"), __FLIGHT__, (api) => {
  const { stage, D, still, slide } = api;
  const { cubic, linear, smooth } = SS_TIMELINE;
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

  const K = D.tracks;
  const baseAt = cubic(K.base);
  const sepAt = cubic(K.sep);
  const rotAt = cubic(K.rot);
  const armsAt = cubic(K.arms);
  const boosterAt = linear(K.booster);
  const shipAt = linear(K.ship);
  const ventsAt = linear(K.vents);
  const altitudeAt = linear(K.altitude);

  const PX = -D.EZ[1];
  const boosterLayer = boosterEl.ownerSVGElement;
  const shipLayer = shipEl.ownerSVGElement;
  let camY = 0;
  const screen = ([x, y, z]) => [D.O[0] + D.EX[0] * x + D.EY[0] * y + D.EZ[0] * z, D.O[1] + D.EX[1] * x + D.EY[1] * y + D.EZ[1] * z + camY];

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
    const wobble = api.wobble;
    const flicker = api.playing && !still.matches ? 1 + 0.05 * Math.sin(wobble * 31) + 0.03 * Math.sin(wobble * 57) : 1;
    el.setAttribute("transform", `translate(${ax.toFixed(1)} ${ay.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(length * PX * flicker).toFixed(1)} ${(width * PX).toFixed(1)})`);
    if (el.getAttribute("display") === "none") el.setAttribute("display", "inline");
  }

  function render(ta, tm) {
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
    ventsEl.setAttribute("opacity", (vent * (api.playing && !still.matches ? 0.85 + 0.15 * Math.sin(api.wobble * 43) : 1)).toFixed(2));

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

    const words = api.words();
    return altitude < 0.05 ? (tm < 0 ? words.say.pad : `${Math.round(altitude * 1000)} m`) : `≈ ${altitude < 10 ? altitude.toFixed(1) : Math.round(altitude)} ${words.say.km}`;
  }

  return { render };
});
