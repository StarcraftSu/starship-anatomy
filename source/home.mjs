// Fig 5: coming home. After the deorbit burn the ship falls back belly first through a sheath of plasma, drops flat
// through the clouds, flips upright and brakes on its engines, then either splashes down (Flight 14) or is caught by
// the tower's arms (Flight 15's plan). The ship is drawn once per pitch angle; the page picks a frame and slides it.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";
import { esc, screenOf, stripOf, timelineHtml } from "./parts.mjs";
import { launchSite } from "./site.mjs";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const U = 2;
const W = 980;
const H = 700;
const AZIMUTH = 64;
const ELEVATION = 14;

const R = 4.5;
const SHIP = 52.1;
const NOSE_BASE = 38.5;
const NOSE_L = SHIP - NOSE_BASE;
const RING = 1.83;
// Flat and belly down (0°) to upright (90°), 5° apart.
const PITCH_FRAMES = 19;
// It turns about a point 18 m up its axis, near its centre of mass with the tanks almost empty.
const PIVOT = 18;
// Catch pins: SpaceX has not shown where they are, so they are drawn below the forward flaps, where the arms reach.
const PIN = { s: 39.4, out: 1.3, r: 0.32 };
const ARM = { z: 62.4, hingeX: -24, y: 5.9, length: 31, half: 0.8, depth: 1.1, open: 85 };
const ARM_FRAMES = 13;
// Resting on the arms, the pins sit on the pads on top of them.
const CAUGHT = ARM.z + ARM.depth + 0.5 + PIN.r - PIN.s + PIVOT;
// While the camera follows the ship, its pivot sits this high above the drawing's ground.
const FOLLOW = 50;

// Mission time (s) of each event and the playback time (s) where it sits; times after the flip are near real time.
const EVENTS = [
  { id: "plasma", tm: 9600, ta: 1.5, sections: [] },
  { id: "entry", tm: 10020, ta: 4, sections: ["slox", "nose"] },
  { id: "bellyflop", tm: 11160, ta: 16, sections: ["slox", "nose"] },
  { id: "flip", tm: 11291, ta: 24, sections: ["slox"] },
  { id: "end", tm: { splash: 11310, catch: null }, ta: 30.4, sections: { splash: [], catch: ["nose"] } },
];
const VARIANTS = ["splash", "catch"];

const FLIP = [[24, 0], [24.4, 4], [25.4, 55], [26.2, 88], [26.6, 90]];
const DOWN = [[0, 400], [23, 400], [24, 280], [25, 200], [26.2, 130], [28, 72]];
const TRACKS = {
  clock: [[0, 9300], [1.5, 9600], [4, 10020], [12, 10680], [16, 11160], [23, 11285], [24, 11291], [27.5, 11300], [29, 11306], [30.4, 11310], [33.1, 11316], [38, 11325]],
  // Altitude in km against playback time, approximate; below it the readout counts metres.
  km: [[0, 140], [1.5, 110], [4, 80], [8, 62], [12, 50], [16, 14], [20, 4], [23, 1.2], [23.6, 0.35]],
  pitch: { splash: [[0, 0], ...FLIP, [30.6, 90], [31, 88], [31.8, 70], [32.6, 30], [33.1, 6], [38, 6]], catch: [[0, 0], ...FLIP, [38, 90]] },
  // Height of the pivot above the ground (m); from touchdown the splashdown ship turns about its base instead.
  pivot: { splash: [...DOWN, [29.5, 32], [30.4, PIVOT], [38, PIVOT]], catch: [...DOWN, [29.2, CAUGHT + 1.6], [30.2, CAUGHT + 0.8], [30.8, CAUGHT], [38, CAUGHT]] },
  thrust: { splash: [[0, 0], [24, 0], [24.15, 1], [27.5, 1], [27.6, 0.7], [29, 0.7], [29.1, 0.45], [30.4, 0.45], [30.5, 0], [38, 0]], catch: [[0, 0], [24, 0], [24.15, 1], [27.5, 1], [27.6, 0.7], [29, 0.7], [29.1, 0.45], [30.5, 0.45], [30.7, 0], [38, 0]] },
  arms: [[0, 1], [29, 1], [30.1, 0], [38, 0]],
  plasma: [[0, 0], [1.5, 0.08], [4, 0.6], [7, 1], [10, 0.9], [13, 0.4], [16, 0], [38, 0]],
  hot: [[0, 0], [3, 0], [7, 0.75], [11, 0.85], [15, 0.25], [18, 0], [38, 0]],
  space: [[0, 1], [9, 1], [16, 0], [38, 0]],
  stars: [[0, 1], [6, 1], [11, 0], [38, 0]],
  // The decks start well below the card and end well above it (they spread 1,150 units either side of its middle).
  clouds: [[0, 1900], [13.5, 1900], [23, -1900], [38, -1900]],
  blast: [[0, 0], [33.05, 0], [33.25, 1], [34.6, 0.7], [36.5, 0], [38, 0]],
};
const TOUCH = 30.4;
const TIP = 30.6;
const END = 38;

const noseR = (s) => {
  if (s <= NOSE_BASE) return R;
  const x = Math.min(1, (s - NOSE_BASE) / NOSE_L);
  return R * Math.pow(Math.max(0, 1 - Math.pow(x, 1.8)), 0.6);
};
const noseSlope = (s) => {
  if (s <= NOSE_BASE) return 0;
  const x = Math.min(0.9995, (s - NOSE_BASE) / NOSE_L);
  return (R * 0.6 * Math.pow(1 - Math.pow(x, 1.8), -0.4) * -1.8 * Math.pow(x, 0.8)) / NOSE_L;
};

export function buildHome() {
  const fitPoints = [];
  for (const [x, y, z] of [[-40, -8, 0], [-40, 8, 0], [56, -8, 0], [56, 8, 0], [-30, 0, 96], [6, 0, 96], [34, 6, FOLLOW + 6], [-18, -6, FOLLOW - 6]]) fitPoints.push([x * U, y * U, z * U]);
  const P = k.fitProjection(fitPoints, W, H, { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION });
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const steel = { tone: "hi", className: "ss-steel" };
  const tile = { tone: "hi", className: "ss-tile" };

  // ---- The ship at one pitch angle, its base at the origin. ----
  function shipFrame(theta) {
    const F = G.frameOf([0, 0, 0], [Math.cos(theta), 0, Math.sin(theta)], [-Math.sin(theta), 0, Math.cos(theta)], [0, 1, 0]);
    const on = (s, r, deg) => G.pointOf(F, s * U, r * U, deg * DEG);
    const radial = (deg) => G.radialOf(F, deg * DEG);
    const tangent = (deg) => G.tangentOf(F, deg * DEG);
    const rows = (s0, s1, n) => Array.from({ length: n + 1 }, (_, i) => {
      const s = s0 + ((s1 - s0) * i) / n;
      return [s * U, (noseR(s) + 0.04) * U];
    });
    const tiles = (s0, s1, n) => S(stripOf(F, rows(s0, s1, n), 90 * DEG, 270 * DEG, 30, P), { ...tile, tone: "lo", crease: "none" });
    const lines = (s0, s1) => {
      const list = [];
      for (let s = Math.ceil(s0 / RING + 0.3) * RING; s < Math.min(s1, NOSE_BASE) - 0.4; s += RING) list.push(G.arcOf(F, s * U, R * U, P, { from: -90 * DEG, to: 90 * DEG }));
      for (let s = s0 + 2; s < s1 - 0.6; s += 2) list.push(G.arcOf(F, s * U, (noseR(s) + 0.04) * U, P, { from: 90 * DEG, to: 270 * DEG, slope: noseSlope(s) }));
      return Ln(list.join(""), { tone: "faint" });
    };
    const band = (id, s0, s1) => `<g data-sec="${id}">${S(G.lathe([[s0 * U, R * U], [s1 * U, R * U]], F, P, { rims: "all", steps: 48, smooth: false }), { ...steel, inner: tiles(s0, s1, 1) + lines(s0, s1) })}</g>`;
    const meridian = [[33 * U, R * U], [NOSE_BASE * U, R * U, 1]];
    for (let i = 1; i < 18; i++) {
      const s = NOSE_BASE + (NOSE_L * i) / 18;
      meridian.push([s * U, noseR(s) * U, 1]);
    }
    meridian.push([SHIP * U, 0]);
    const nose = `<g data-sec="nose">${S(G.lathe(meridian, F, P, { rims: "first", steps: 48, smooth: { slope: (s) => noseSlope(s / U), radius: (s) => noseR(s / U) * U } }), { ...steel, inner: tiles(33, SHIP - 0.6, 12) + lines(33, SHIP - 0.6) })}</g>`;
    // Flaps hinge along the edge of the tiles, on the side toward the camera (90°) and the far side (270°).
    const flap = (deg, s0, s1, out0, out1, sec) => {
      const r = radial(deg);
      const t = tangent(deg);
      const FF = G.frameOf(G.mul3(t, -0.25 * U), t, F.a, r);
      const poly = [[s0 * U, (noseR(s0) + 0.35) * U], [s1 * U, (noseR(s1) + 0.35) * U], [(s1 - 1.5) * U, (noseR(s1) + out1) * U], [s0 * U, (noseR(s0) + out0) * U]];
      const HF = G.frameOf(G.mul3(t, -0.55 * U), t, F.a, r);
      const hinge = G.prismOf(HF, [[(s0 + 0.2) * U, (noseR(s0) - 0.1) * U], [(s1 - 0.2) * U, (noseR(s1) - 0.1) * U], [(s1 - 0.4) * U, (noseR(s1) + 0.45) * U], [(s0 + 0.4) * U, (noseR(s0) + 0.45) * U]], 0, 1.1 * U, P);
      return `<g data-sec="${sec}">${S(hinge, tile)}${S(G.prismOf(FF, poly, 0, 0.5 * U, P), tile)}</g>`;
    };
    const pin = (deg) => S(G.disc((R - 0.2) * U, (R + PIN.out) * U, PIN.r * U, G.frameAlong(on(PIN.s, 0, deg), radial(deg)), P, { steps: 16 }), { tone: "hi", className: "ss-gunmetal" });
    const side = (deg) => flap(deg, 0.6, 9.6, 3.6, 3.6, "slox") + flap(deg, 40.6, 46.4, 2.6, 2.4, "nose") + pin(deg);
    return side(270) + band("slox", 0, 20) + band("sch4", 20, 33) + nose + side(90);
  }
  const frames = Array.from({ length: PITCH_FRAMES }, (_, i) => `<g data-pitch="${i}"${i ? ` display="none"` : ""}>${shipFrame((i / (PITCH_FRAMES - 1)) * (Math.PI / 2))}</g>`).join("");

  // ---- Entry: the plasma glow round the belly and its wake, and the tiles heating up (the flat frame only). ----
  const F0 = G.frameOf([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]);
  const on0 = (s, r, deg) => G.pointOf(F0, s * U, r * U, deg * DEG);
  const glowRing = [];
  for (let i = 0; i <= 30; i++) {
    const s = SHIP + 2 - ((SHIP + 2) * i) / 30;
    glowRing.push(at(on0(s, Math.max(noseR(s), 1.2) + 1.6, 180)));
  }
  for (let i = 0; i <= 30; i++) {
    const s = ((SHIP + 1) * i) / 30;
    glowRing.push(at(on0(s, Math.max(noseR(s), 1) + 0.6, 105)));
  }
  const wake = [on0(2, R + 1, 160), on0(-14, R + 3, 200), on0(-46, R + 8, 230), on0(-60, R + 2, 330), on0(-40, R, 20), on0(-6, R, 40), on0(1, R, 80)].map(at);
  const plasma = `<filter id="hm-soft" x="-0.3" y="-0.5" width="1.6" height="2"><feGaussianBlur stdDeviation="9"/></filter><filter id="hm-soft-wide" x="-0.3" y="-0.6" width="1.6" height="2.2"><feGaussianBlur stdDeviation="18"/></filter><path class="hm-wake" filter="url(#hm-soft-wide)" d="${k.pathOf(wake, true)}"/><path class="hm-sheath" filter="url(#hm-soft)" d="${k.pathOf(glowRing, true)}"/>`;
  const hotRows = Array.from({ length: 31 }, (_, i) => {
    const s = (SHIP - 0.6) * (i / 30);
    return [s * U, (noseR(s) + 0.05) * U];
  });
  const hot = `<path class="hm-hot" fill="url(#hm-hot)" d="${stripOf(F0, hotRows, 90 * DEG, 270 * DEG, 30, P).fill}"/>`;

  // ---- The ground: the ocean for the splashdown, the launch site for the catch. ----
  const site = launchSite(P, { U, arm: ARM, frames: ARM_FRAMES });
  const SEA = { x: -1400 * U, y: -1400 * U, w: 2800 * U, d: 2800 * U, r: 0 };
  let seed = 23;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const waves = [];
  for (let i = 0; i < 140; i++) {
    const x = -90 + rand() * 170;
    const y = -80 + rand() * 150;
    const length = 2 + rand() * 6;
    waves.push(k.lineOnTop([x * U, y * U], [(x + length) * U, (y - length * 0.2) * U], 0, P));
  }
  const sea = `<g class="hm-sea">${S(k.slabOf(SEA, -1 * U, 1 * U, P, 4, 0), { tone: "mid", flat: true })}${Ln(waves.join(""), { tone: "faint", free: true })}</g>`;

  // Spray and steam where the flame meets the water, then smoke; and the fireball when the leftover propellant goes.
  const puffs = [];
  for (let i = 0; i < 14; i++) {
    const a = rand() * TAU;
    const r = 3 + rand() * 9;
    puffs.push({ p: [r * Math.cos(a), r * Math.sin(a), 0.5 + rand() * 3], r0: 2 + rand() * 2, r1: 7 + rand() * 7, t0: 29.4 + rand() * 1.4, life: 5 });
  }
  const blastAt = [12 * Math.cos(6 * DEG), 0, 12 * Math.sin(6 * DEG) + 2];
  for (let i = 0; i < 8; i++) {
    const a = rand() * TAU;
    puffs.push({ p: [blastAt[0] + 6 * Math.cos(a) * rand(), 4 * Math.sin(a) * rand(), blastAt[2] + 2], r0: 3 + rand() * 3, r1: 12 + rand() * 10, t0: 33.3 + rand() * 1.2, life: 6, smoke: true });
  }
  const puffSvg = puffs.map((puff, i) => `<circle class="${puff.smoke ? "hm-smoke" : "fl-steam"}" data-puff="${i}" r="0" cx="0" cy="0"/>`).join("");
  const blastPoint = at(blastAt.map((v) => v * U));
  const blastR = 15 * P.scale * U;
  const blast = `<circle class="hm-blast" cx="${blastPoint[0].toFixed(1)}" cy="${blastPoint[1].toFixed(1)}" r="${blastR.toFixed(1)}"/>`;

  // ---- The sky: daylight, the dark of space over it, stars, and two decks of cloud the ship falls through. ----
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push(`<circle cx="${(rand() * W).toFixed(1)}" cy="${(rand() * H).toFixed(1)}" r="${(0.5 + rand() * 0.9).toFixed(2)}"/>`);
  const cloud = (x, y, size) => {
    const puffs = [[0, 0, 1, 0.42], [-0.55, 0.08, 0.7, 0.33], [0.6, 0.06, 0.75, 0.36], [0.15, -0.16, 0.6, 0.3]];
    return `<g class="fl-cloud">${puffs.map(([dx, dy, rx, ry]) => `<ellipse cx="${(x + dx * size).toFixed(1)}" cy="${(y + dy * size).toFixed(1)}" rx="${(rx * size).toFixed(1)}" ry="${(ry * size).toFixed(1)}"/>`).join("")}</g>`;
  };
  const decks = [[], []];
  // Spread over a band much taller than the card, so they keep streaming past for the whole fall.
  for (let i = 0; i < 30; i++) decks[i % 2].push(cloud(rand() * W, H / 2 + (rand() - 0.5) * 2300, 45 + rand() * 80));

  const defs = `<defs><linearGradient id="hm-sheath" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="var(--hm-plasma-0)"/><stop offset="0.35" stop-color="var(--hm-plasma-1)" stop-opacity="0.9"/><stop offset="1" stop-color="var(--hm-plasma-2)" stop-opacity="0.55"/></linearGradient><linearGradient id="hm-wake" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="var(--hm-plasma-1)" stop-opacity="0.8"/><stop offset="1" stop-color="var(--hm-plasma-2)" stop-opacity="0"/></linearGradient><linearGradient id="hm-hot" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="var(--hm-hot)" stop-opacity="0.95"/><stop offset="0.5" stop-color="var(--hm-hot)" stop-opacity="0.6"/><stop offset="1" stop-color="var(--hm-hot)" stop-opacity="0.3"/></linearGradient><radialGradient id="hm-blast"><stop offset="0" stop-color="#fff6d8"/><stop offset="0.35" stop-color="#ffb347" stop-opacity="0.95"/><stop offset="0.75" stop-color="#ff6a1f" stop-opacity="0.5"/><stop offset="1" stop-color="#ff6a1f" stop-opacity="0"/></radialGradient><linearGradient id="hm-grad-out" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--fl-flame-0)"/><stop offset="0.3" stop-color="var(--fl-flame-1)" stop-opacity="0.95"/><stop offset="0.75" stop-color="var(--fl-flame-2)" stop-opacity="0.45"/><stop offset="1" stop-color="var(--fl-flame-2)" stop-opacity="0"/></linearGradient><linearGradient id="hm-grad-core" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="var(--fl-flame-0)" stop-opacity="0.9"/><stop offset="1" stop-color="var(--fl-flame-1)" stop-opacity="0"/></linearGradient></defs>`;
  const plumeShape = "M0 -0.16C0.14 -0.4 0.42 -0.5 0.68 -0.36C0.85 -0.26 0.96 -0.1 1 0C0.96 0.1 0.85 0.26 0.68 0.36C0.42 0.5 0.14 0.4 0 0.16Z";
  const plume = `<g class="hm-plume" data-plume display="none"><path class="hm-plume-out" d="${plumeShape}"/><path class="hm-plume-core" d="${plumeShape}" transform="scale(0.5 0.55)"/></g>`;

  // Painter's order, one <svg> per thing that moves on its own. data-cam layers ride the camera (the ground), data-ship
  // layers ride the ship, data-only layers belong to one ending.
  const layer = (body, { attrs = "", moves = false, over = false, first = false } = {}) =>
    `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg ss-layer${moves ? " ss-moves" : ""}${over ? " fl-over" : ""}"${attrs} viewBox="0 0 ${W} ${H}"${first ? ` role="img" aria-label="${esc(TEXT.en.ui.label)}"` : ` aria-hidden="true"`}>${body}</svg>`;
  const svg = [
    layer(`${defs}<rect class="fl-sky" x="0" y="0" width="${W}" height="${H}"/><rect class="fl-space" data-space x="0" y="0" width="${W}" height="${H}"/><g class="fl-stars" data-stars>${stars.join("")}</g>`, { first: true }),
    layer(`<g class="fl-clouds">${decks[0].join("")}</g>`, { moves: true, over: true, attrs: " data-clouds" }),
    layer(sea, { moves: true, attrs: ` data-cam data-only="splash"` }),
    layer(`<g class="fl-site">${site.back}${site.olmBack}</g>`, { moves: true, attrs: ` data-cam data-only="catch"` }),
    layer(site.armBack, { moves: true, attrs: ` data-cam data-only="catch"` }),
    layer(plasma, { moves: true, over: true, attrs: ` data-glow style="opacity:0"` }),
    layer(plume),
    layer(`<g data-ship>${frames}</g>`, { moves: true, attrs: " data-rides" }),
    layer(hot, { moves: true, attrs: ` data-rides data-hot style="opacity:0"` }),
    layer(`<g class="fl-site">${site.olmFront}</g>`, { moves: true, attrs: ` data-cam data-only="catch"` }),
    layer(site.armFront, { moves: true, attrs: ` data-cam data-only="catch"` }),
    layer(`<g class="fl-steam-group">${puffSvg}</g>`, { attrs: ` data-only="splash"` }),
    layer(blast, { moves: true, attrs: ` data-only="splash" data-blast style="opacity:0;transform-origin:${((blastPoint[0] / W) * 100).toFixed(2)}% ${((blastPoint[1] / H) * 100).toFixed(2)}%"` }),
    layer(`<g class="fl-clouds">${decks[1].join("")}</g>`, { moves: true, over: true, attrs: " data-clouds" }),
  ].join("");

  const data = {
    W,
    H,
    O: at([0, 0, 0]),
    EX: screenOf(P)([U, 0, 0]),
    EY: screenOf(P)([0, U, 0]),
    EZ: screenOf(P)([0, 0, U]),
    end: END,
    tracks: TRACKS,
    events: EVENTS,
    variants: VARIANTS,
    pitchFrames: PITCH_FRAMES,
    armFrames: ARM_FRAMES,
    pivot: PIVOT,
    follow: FOLLOW,
    touch: TOUCH,
    tip: TIP,
    puffs,
    t: TEXT,
  };
  const html = timelineHtml({ id: "home", cls: "fl hm", W, H, end: END, start: TRACKS.clock[0][1], events: EVENTS, en: TEXT.en, head: "fig5Head", intro: "fig5Intro", variants: VARIANTS });
  return { html, art: svg, data };
}

const TEXT = {
  en: {
    ui: {
      fig: "Fig 5",
      figTitle: "Coming home · entry to landing",
      fig5Head: "Coming home: entry, belly flop, flip and landing",
      fig5Intro: "After the deorbit burn the ship falls back into the air belly first, glowing behind its heat shield, then drops flat like a skydiver, flips upright at the last moment and lands on its engines. Flight 14 came down in the Pacific; Flight 15 will try to land it back at the tower, caught by the arms that catch the booster. Switch between the two endings in the panel.",
      play: "Play",
      pause: "Pause",
      restart: "Restart",
      scrub: "Mission time",
      panel: "Coming home",
      stage: "Starship's upper stage on its way home. Space plays or pauses, the arrow keys step between events.",
      linked: "In Fig 1:",
      variantLabel: "Ending",
      "variant-splash": "Flight 14: splashdown",
      "variant-catch": "Flight 15: tower catch",
      planned: "Flight 15",
      notes: "Times follow Flight 14 on 28 September 2026: plasma from about T+2:40 and entry proper from about T+2:47 (NASASpaceFlight), the landing burn stepping down from three engines to two at T+3:08:20 and to one at T+3:08:26, and splashdown at T+3:08:30 (Wikipedia). Wikipedia's table puts entry, the flip and the start of the landing burn 18 minutes earlier, which cannot fit the rest of the table; this figure takes them 18 minutes later. The belly-flop time and all altitudes are approximate. The tower catch is Flight 15's plan (Elon Musk, October 2026): SpaceX has not shown where the ship's catch pins are, so they are drawn below the forward flaps, where the arms reach them. The plasma, the flame, the clouds and the ocean are drawn for clarity, not to scale.",
      label: "Starship's upper stage coming home: belly first through a glowing sheath of plasma, falling flat through the clouds, flipping upright with its engines lit, and then either splashing down in the ocean, tipping over and exploding (Flight 14), or being caught by the launch tower's arms (Flight 15's plan).",
    },
    overview: {
      title: "Coming home",
      text: "From the top of the atmosphere to the surface takes about half an hour. Pick an event to jump to it, or switch the ending.",
      specs: [["Entry", "≈ T+2:47"], ["Heat shield", "≈ 18,000 tiles"], ["Flight 15", "tower catch planned"]],
    },
    events: {
      plasma: { short: "Plasma", title: "Into the air", text: "Half an hour after the deorbit burn the ship meets the top of the atmosphere at more than 7 km/s, belly first. The air in front of the heat shield is squeezed and heated until it glows, a sheath of plasma that streams back past the hull.", specs: [["Time", "≈ T+2:40"], ["Speed", "> 7 km/s"]] },
      entry: { short: "Entry", title: "Belly first through the hottest part", text: "The black tiles on the belly take the heat; they are rated to about 1,400 °C, while the steel on the sheltered side stays much cooler. The four flaps hold the ship at a steep angle and steer it, like a skydiver's arms and legs. The plasma blocks radio, but Starlink antennas on the sheltered side keep the video coming.", specs: [["Time", "≈ T+2:47"], ["Tiles", "≈ 18,000, rated to 1,400 °C"]] },
      bellyflop: { short: "Belly flop", title: "Falling flat", text: "Slower than sound now, the ship falls flat on its belly at a few hundred km/h, still steering with its flaps: lying flat, it meets far more air than it would nose first. It falls this way through the clouds for the last minutes.", specs: [["Time", "≈ T+3:06"], ["Engines", "off"]] },
      flip: { short: "Flip", title: "Flip and landing burn", text: "Seconds above the surface it lights its three sea-level Raptors and swings upright, then brakes on them, stepping down to two engines at T+3:08:20 and to one at T+3:08:26.", specs: [["Time", "≈ T+3:08:11"], ["Engines", "3 → 2 → 1"]] },
      end: {
        splash: { short: "Splashdown", title: "Splashdown, and the end of Ship 41", text: "At T+3:08:30 it sets down upright in the Pacific north of Hawaii. Nothing holds it there: it tips onto its side, and about six seconds after touchdown the propellant left in it ignites. SpaceX never planned to recover it; every test ship so far has ended in the ocean.", specs: [["Splashdown", "T+3:08:30"], ["Where", "Pacific, north of Hawaii"], ["Ship", "not recovered"]] },
        catch: { short: "Tower catch", title: "The plan: caught by the tower", text: "Flight 15 is to fly the ship back to Starbase instead. It comes down beside the launch tower on its engines, the two arms close under pins on its sides, and it settles onto them, ready to be looked over and flown again. In September the tower at Pad 2 practised by lifting Ship 42 into catch position, and Elon Musk puts the first try's odds at \"at least 50 or 60 percent\".", specs: [["Flight", "15, with Ship 42"], ["When", "planned for November 2026"], ["Held by", "pins on its sides"]] },
      },
    },
    say: { km: "km", water: "on the water", arms: "in the arms" },
  },
  zh: {
    ui: {
      fig: "图 5",
      figTitle: "返回 · 从再入到着陆",
      fig5Head: "返回：再入、平着下坠、翻身、着陆",
      fig5Intro: "离轨点火之后，飞船腹部朝前落回大气层，隔热瓦后面一片火光；然后像跳伞的人一样平着往下掉，最后一刻翻身竖起来，靠发动机落下。第 14 次飞行落在了太平洋上；第 15 次飞行要试着让它飞回发射塔，用接助推器的那对机械臂把它接住。在面板里可以切换这两种结局。",
      play: "播放",
      pause: "暂停",
      restart: "重新开始",
      scrub: "任务时间",
      panel: "返回",
      stage: "正在返回的星舰飞船。空格键播放或暂停，方向键在事件之间跳转。",
      linked: "在图 1 中：",
      variantLabel: "结局",
      "variant-splash": "第 14 次：溅落",
      "variant-catch": "第 15 次：塔接",
      planned: "第 15 次",
      notes: "时间采用 2026 年 9 月 28 日第 14 次飞行的数据：约 T+2:40 开始出现等离子体，约 T+2:47 正式再入（NASASpaceFlight）；着陆点火在 T+3:08:20 从三台减为两台、T+3:08:26 减为一台，T+3:08:30 溅落（维基百科）。维基百科的表格把再入、翻身和着陆点火开始都写早了 18 分钟，和表里其余的时间对不上；这张图按晚 18 分钟来画。平着下坠的时刻和所有高度都是近似值。塔接是第 15 次飞行的计划（埃隆·马斯克，2026 年 10 月）：SpaceX 没有公布飞船上的接箭销在哪里，这里画在前襟翼下方、机械臂够得着的位置。等离子体、尾焰、云和海面是为了看清楚而画的，不按比例。",
      label: "正在返回的星舰飞船：腹部朝前穿过发光的等离子体，平着穿过云层下坠，点燃发动机翻身竖起，然后要么溅落在海面、翻倒并爆炸（第 14 次飞行），要么被发射塔的机械臂接住（第 15 次飞行的计划）。",
    },
    overview: {
      title: "返回",
      text: "从大气层顶部到落地大约半个小时。选一个事件即可跳过去，也可以切换结局。",
      specs: [["再入", "约 T+2:47"], ["隔热瓦", "约 18,000 块"], ["第 15 次", "计划塔接"]],
    },
    events: {
      plasma: { short: "等离子体", title: "冲进大气层", text: "离轨点火半小时后，飞船以每秒 7 公里以上的速度、腹部朝前撞上大气层顶部。隔热瓦前方的空气被压缩、加热到发光，形成一层等离子体，顺着箭体向后流去。", specs: [["时间", "约 T+2:40"], ["速度", "> 7 公里/秒"]] },
      entry: { short: "再入", title: "腹部朝前穿过最热的一段", text: "腹部的黑色隔热瓦承受热量，它们的耐受温度约 1,400 °C，背风一侧的不锈钢则凉得多。四片襟翼让飞船保持很大的倾角并控制方向，就像跳伞的人用手脚调整姿态。等离子体会挡住无线电，但背风面的 Starlink 天线让视频一直传了回来。", specs: [["时间", "约 T+2:47"], ["隔热瓦", "约 18,000 块，耐受约 1,400 °C"]] },
      bellyflop: { short: "平着下坠", title: "平着往下掉", text: "速度降到音速以下后，飞船腹部朝下、平着以每小时几百公里的速度下坠，仍靠襟翼控制方向：平躺着迎风的面积比头朝下大得多，减速也快得多。最后几分钟它就这样穿过云层落下来。", specs: [["时间", "约 T+3:06"], ["发动机", "关闭"]] },
      flip: { short: "翻身", title: "翻身与着陆点火", text: "离海面只剩几秒时，它点燃三台海平面版猛禽、一下子翻身竖起，然后靠它们刹车：T+3:08:20 减为两台，T+3:08:26 减为一台。", specs: [["时间", "约 T+3:08:11"], ["发动机", "3 → 2 → 1"]] },
      end: {
        splash: { short: "溅落", title: "溅落，Ship 41 的结局", text: "T+3:08:30 它竖着落在夏威夷以北的太平洋上。没有东西扶住它：它向一侧翻倒，落水约六秒后，箭体里剩下的推进剂被点燃。SpaceX 本来就没打算回收它；到目前为止，每一艘试飞的飞船都是落在海里结束的。", specs: [["溅落", "T+3:08:30"], ["地点", "夏威夷以北的太平洋"], ["飞船", "不回收"]] },
        catch: { short: "塔接", title: "计划：被发射塔接住", text: "第 15 次飞行计划让飞船飞回星舰基地。它靠发动机降落到发射塔旁边，两条机械臂在它两侧的接箭销下方合拢，飞船落在机械臂上，检查之后就能再次飞行。9 月，2 号发射台的塔已经演练过把 Ship 42 吊到接住的位置；埃隆·马斯克估计第一次尝试成功的概率「至少 50% 或 60%」。", specs: [["航次", "第 15 次，Ship 42"], ["时间", "计划 2026 年 11 月"], ["托住", "两侧的接箭销"]] },
      },
    },
    say: { km: "公里", water: "在水面上", arms: "在机械臂上" },
  },
};
