// Fig 4: the ship carries on alone. It burns to orbit, opens the slot door in its payload bay and deals out 26
// Starlink V3 satellites one at a time, then turns round and burns again to come home. The ship is drawn once with
// its side cut open; the page slides the satellites, the clouds far below and the flame, all on the GPU.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const DEG = Math.PI / 180;
const U = 2;
const W = 980;
const H = 700;
const AZIMUTH = 61;
const ELEVATION = 20;

const R = 4.5;
const SHIP = 52.1;
const NOSE_BASE = 38.5;
const NOSE_L = SHIP - NOSE_BASE;
const RING = 1.83;
// Angles run round the axis from straight up (0°) toward the camera (90°); the tiles cover the belly half.
const TILE_FROM = 90;
const TILE_TO = 270;
const TILE_LIFT = 0.04;
const SLOT_DEG = 3;
const SLOT = { s0: 35.45, s1: 36.3, a0: SLOT_DEG - 23, a1: SLOT_DEG + 23 };
// The cutaway is an L: long on the steel side, deeper into the tiles only aft of the forward flaps.
const WINDOW = { s0: 35.2, s1: 43.6, low: 40.3, a0: 34, a1: 80, a2: 150 };
// The dispenser as in Fig 1: satellites lie flat across the axis, the bottom one on the base rails by the door.
const SAT = { half: 3.5, side: 1.75, bus: 0.1, array: 0.13, pitch: 0.28, count: 26, base: 35.6, stack: 36.1 };
// Playback seconds: first push, one satellite every 0.8 s, each slides out at 16 m/s; the stack moves down once
// the one leaving is clear of it.
const DEPLOY = { first: 16.6, every: 0.8, speed: 16, ramp: 0.15, lower: [0.5, 0.74], back: 3 };

// Mission time (s) of each event (Flight 14) and the playback time (s) where it sits on the compressed timeline.
const EVENTS = [
  { id: "climb", tm: 142, ta: 0.6, sections: ["slox"] },
  { id: "seco", tm: 491, ta: 8, sections: ["slox"] },
  { id: "insert", tm: 1528, ta: 12, sections: ["slox"] },
  { id: "door", tm: 2058, ta: 16.6, sections: ["nose"] },
  { id: "last", tm: 3890, ta: 36.6, sections: ["nose"] },
  { id: "deorbit", tm: 7920, ta: 42.4, sections: ["slox"] },
];

const TRACKS = {
  clock: [[0, 135], [0.6, 142], [3, 260], [6.5, 440], [8, 491], [9, 560], [10.5, 1100], [11.5, 1480], [12, 1528], [13.6, 1547], [14.5, 1640], [15.8, 2000], [16.6, 2058], [36.6, 3890], [37.6, 3990], [39.5, 5600], [41.8, 7700], [42.4, 7920], [43.4, 7931], [45, 8050], [48, 8300]],
  thrust: [[0, 1], [7.9, 1], [8.15, 0], [12, 0], [12.15, 0.55], [13.45, 0.55], [13.6, 0], [42.4, 0], [42.55, 0.55], [43.25, 0.55], [43.4, 0], [48, 0]],
  door: [[0, 0], [15.8, 0], [16.4, 1], [37.4, 1], [38, 0], [48, 0]],
  // How fast the ground slides by, and which way: the ship flies nose first, then turns round for the deorbit burn.
  drift: [[0, 0.35], [8, 1], [40.2, 1], [41, 0], [41.8, -1], [48, -1]],
  sink: [[0, 0], [43.4, 0], [48, 1]],
  // Altitude in km against mission seconds, approximate between the published points.
  altitude: [[135, 66], [142, 70], [260, 112], [380, 152], [491, 185], [800, 228], [1200, 260], [1528, 275], [1547, 275], [2058, 268], [3890, 266], [7920, 265], [8050, 262], [8300, 245]],
};
const END = 48;

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
const norm = (deg) => ((deg % 360) + 360) % 360;
const within = (deg, a0, a1) => norm(deg - a0) <= a1 - a0;
const inSlot = (s, deg) => s > SLOT.s0 && s < SLOT.s1 && within(deg, SLOT.a0, SLOT.a1);

export function buildOrbit({ esc }) {
  const SF = G.frameOf([0, 0, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0]);
  const on = (s, r, deg) => G.pointOf(SF, s * U, r * U, deg * DEG);
  const radial = (deg) => G.radialOf(SF, deg * DEG);
  const tangent = (deg) => G.tangentOf(SF, deg * DEG);
  const PAY_E = radial(SLOT_DEG);
  const PAY_T = tangent(SLOT_DEG);
  const PAYF = G.frameOf(on(0, 0, 0), SF.a, PAY_E, PAY_T);
  const payAt = (e, t, s) => G.add3(G.add3(on(s, 0, 0), G.mul3(PAY_E, e * U)), G.mul3(PAY_T, t * U));

  const fitPoints = [];
  for (let s = 0; s <= SHIP; s += 2) for (let deg = 0; deg < 360; deg += 30) fitPoints.push(on(s, noseR(s), deg));
  fitPoints.push(on(0.6, R + 3.6, 90), on(9.6, R + 3.6, 90));
  // Room above the door for the satellites on their way out, and behind for the flame.
  fitPoints.push(payAt(R + SAT.half + 9, 0, SAT.base), on(-14, 0, 0));
  const P = k.fitProjection(fitPoints, W, H, { pad: 40, azimuth: AZIMUTH, elevation: ELEVATION });
  P.origin = [P.origin[0], P.origin[1] + 30];
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const item = (point, svg) => ({ depth: G.dot3(point, V), svg });
  const sorted = (list) => [...list].sort((a, b) => a.depth - b.depth).map((part) => part.svg).join("");
  const steel = { tone: "hi", className: "ss-steel" };
  const metal = { tone: "hi", className: "ss-gunmetal" };

  // Quads of a surface of revolution round the whole axis, those that face the camera, minus any that `keep` drops.
  // Angle steps fall on every edge of the window, the door and the tiles, so the holes have clean sides.
  const ANGLES = [...new Set([...Array.from({ length: 72 }, (_, i) => i * 5), ...[SLOT.a0, SLOT.a1, TILE_FROM, TILE_TO].map(norm)])].sort((a, b) => a - b);
  function skin(rows, { inward = false, keep = () => true } = {}) {
    const buckets = [[], [], [], [], []];
    const fill = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const [s0, r0] = rows[i];
      const [s1, r1] = rows[i + 1];
      for (let j = 0; j < ANGLES.length; j++) {
        const d0 = ANGLES[j];
        const d1 = j + 1 < ANGLES.length ? ANGLES[j + 1] : ANGLES[0] + 360;
        if (!keep((s0 + s1) / 2, (d0 + d1) / 2)) continue;
        let n = G.unit3(G.sub3(G.mul3(radial((d0 + d1) / 2), s1 - s0), G.mul3(SF.a, r1 - r0)));
        if (inward) n = G.mul3(n, -1);
        if (G.dot3(n, V) <= 1e-6) continue;
        const d = k.pathOf([on(s0, r0, d0), on(s0, r0, d1), on(s1, r1, d1), on(s1, r1, d0)].map(at), true);
        fill.push(d);
        buckets[G.toneOf(n, P)].push(d);
      }
    }
    return { fill: fill.join(""), outline: "", crease: "", top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")), seamless: true };
  }
  const rowsOf = (from, to, marks, lift = 0) => {
    const list = new Set([from, to, ...marks.filter((s) => s > from && s < to)]);
    for (let s = Math.max(from, NOSE_BASE); s < to; s += 0.5) list.add(Math.round(s * 1000) / 1000);
    return [...list].sort((a, b) => a - b).map((s) => [s, s >= SHIP - 1e-6 ? 0 : noseR(s) + lift]);
  };
  // A closed outline on the hull through corners given as [s, angle]; each side runs along the axis or round it.
  const loopOn = (corners, r = (s) => noseR(s)) => {
    const ring = [];
    corners.forEach(([s0, a0], i) => {
      const [s1, a1] = corners[(i + 1) % corners.length];
      for (let j = 0; j < 24; j++) {
        const s = s0 + ((s1 - s0) * j) / 24;
        ring.push(on(s, r(s), a0 + ((a1 - a0) * j) / 24));
      }
    });
    return k.pathOf(ring.map(at), true);
  };
  const box = (s0, s1, a0, a1) => [[s0, a0], [s0, a1], [s1, a1], [s1, a0]];

  // Heat-shield tiles: a dark skin over the belly half, rows a metre apart, joints staggered row to row.
  function tileLines(s0, s1) {
    const radius = (s) => noseR(s) + TILE_LIFT;
    const lines = [];
    const ticks = [];
    const pitch = 1.0;
    const across = 1.15 / R / DEG;
    for (let s = s0 + pitch; s < s1 - 0.2; s += pitch) lines.push(G.arcOf(SF, s * U, radius(s) * U, P, { from: TILE_FROM * DEG, to: TILE_TO * DEG, slope: noseSlope(s) }));
    let row = 0;
    for (let s = s0; s < s1 - 0.2; s += pitch, row++) {
      const e = Math.min(s + pitch, s1 - 0.2);
      if (e - s < 0.3) continue;
      const slope = noseSlope((s + e) / 2);
      for (let deg = TILE_FROM + (row % 2 ? across / 2 : 0); deg < TILE_TO - 0.5; deg += across) {
        const n = G.unit3(G.sub3(radial(deg), G.mul3(SF.a, slope)));
        const f = G.dot3(n, V);
        if (f < 0.03) continue;
        ticks.push([k.pathOf([at(on(s, radius(s), deg)), at(on(e, radius(e), deg))]), G.fadeOf(f, [0.03, 0.3])]);
      }
    }
    const edge = [];
    for (let i = 0; i <= 40; i++) edge.push(at(on(s0 + ((s1 - s0) * i) / 40, radius(s0 + ((s1 - s0) * i) / 40), TILE_FROM)));
    return Ln(lines.join(""), { tone: "faint" }) + k.fadedSvg(ticks, { tone: "faint" }) + Ln(k.pathOf(edge), { tone: "lo" });
  }
  const tileShell = (s0, s1, marks = []) => S(skin(rowsOf(s0, s1, marks, TILE_LIFT), { keep: (s, deg) => within(deg, TILE_FROM, TILE_TO) }), { tone: "lo", crease: "none", className: "ss-tile" });

  // Steel ring seams every 1.83 m, on the steel half only.
  function seams(s0, s1) {
    const lines = [];
    for (let s = Math.ceil(s0 / RING + 0.3) * RING; s < Math.min(s1, NOSE_BASE) - 0.4; s += RING) lines.push(G.arcOf(SF, s * U, R * U, P, { from: -90 * DEG, to: TILE_FROM * DEG }));
    return Ln(lines.join(""), { tone: "faint" });
  }

  // ---- The aft body: oxygen tank with the six engines inside its skirt, then the methane tank. ----
  const body = (id, s0, s1) => {
    const paths = G.lathe([[s0 * U, R * U], [s1 * U, R * U]], SF, P, { rims: "all", steps: 96, smooth: false });
    return `<g data-sec="${id}">${S(paths, { ...steel, inner: tileShell(s0, s1) + seams(s0, s1) + tileLines(s0, s1) })}</g>`;
  };

  // ---- The payload bay and nose, smooth-shaded, with the window and the door clipped out of the skin. ----
  const marks = [WINDOW.s0, WINDOW.s1, WINDOW.low, SLOT.s0, SLOT.s1, NOSE_BASE];
  const noseMeridian = [[33 * U, R * U], [NOSE_BASE * U, R * U, 1]];
  for (let i = 1; i < 28; i++) {
    const s = NOSE_BASE + (NOSE_L * i) / 28;
    noseMeridian.push([s * U, noseR(s) * U, 1]);
  }
  noseMeridian.push([SHIP * U, 0]);
  const noseSkin = G.lathe(noseMeridian, SF, P, { rims: "first", smooth: { slope: (s) => noseSlope(s / U), radius: (s) => noseR(s / U) * U } });
  const { s0: w0, s1: w1, low, a0, a1, a2 } = WINDOW;
  const windowD = loopOn([[w0, a0], [w0, a2], [low, a2], [low, a1], [w1, a1], [w1, a0]]);
  // The cut edge's inner lip, a few centimetres in from the outline all round.
  const windowLip = loopOn([[w0 + 0.08, a0 + 1], [w0 + 0.08, a2 - 1], [low - 0.08, a2 - 1], [low - 0.08, a1 - 1], [w1 - 0.08, a1 - 1], [w1 - 0.08, a0 + 1]], (s) => noseR(s) - 0.06);
  const slotD = loopOn(box(SLOT.s0, SLOT.s1, SLOT.a0, SLOT.a1));
  const cut = `<clipPath id="ob-cut"><path clip-rule="evenodd" d="M-60 -60H${W + 60}V${H + 60}H-60Z${windowD}${slotD}"/></clipPath>`;
  const nose = `${cut}<g data-sec="nose" clip-path="url(#ob-cut)">${S(noseSkin, { ...steel, inner: tileShell(33, SHIP - 0.6, marks) + seams(33, SHIP) + tileLines(33, SHIP - 0.6) })}</g>`;

  // Flaps hinge along the edge of the tiles; the pair on the far side is hidden behind the hull from here.
  const flap = (s0, s1, out0, out1) => {
    const r = radial(TILE_FROM);
    const t = tangent(TILE_FROM);
    const FF = G.frameOf(G.mul3(t, -0.25 * U), t, SF.a, r);
    const poly = [[s0 * U, (noseR(s0) + 0.35) * U], [s1 * U, (noseR(s1) + 0.35) * U], [(s1 - 1.5) * U, (noseR(s1) + out1) * U], [s0 * U, (noseR(s0) + out0) * U]];
    const plate = G.prismOf(FF, poly, 0, 0.5 * U, P);
    const HF = G.frameOf(G.mul3(t, -0.55 * U), t, SF.a, r);
    const hinge = G.prismOf(HF, [[(s0 + 0.2) * U, (noseR(s0) - 0.1) * U], [(s1 - 0.2) * U, (noseR(s1) - 0.1) * U], [(s1 - 0.4) * U, (noseR(s1) + 0.45) * U], [(s0 + 0.4) * U, (noseR(s0) + 0.45) * U]], 0, 1.1 * U, P);
    const ribs = [];
    for (let i = 1; i < 4; i++) {
      const s = s0 + ((s1 - 1.5 - s0) * i) / 4;
      ribs.push(k.pathOf([at(G.add3(G.add3(on(s, 0, 0), G.mul3(r, (noseR(s) + 0.6) * U)), G.mul3(t, 0.25 * U))), at(G.add3(G.add3(on(s, 0, 0), G.mul3(r, (noseR(s) + Math.min(out0, out1) - 0.3) * U)), G.mul3(t, 0.25 * U)))]));
    }
    return S(hinge, { tone: "hi", className: "ss-tile" }) + S(plate, { tone: "hi", className: "ss-tile", inner: Ln(ribs.join(""), { tone: "faint" }) });
  };

  // ---- Inside the bay: the far wall, the methane tank's dome, and the dispenser (as in Fig 1). ----
  const payBox = (e0, e1, t0, t1, s0, s1, style) => S(G.prismOf(PAYF, [[e0 * U, t0 * U], [e1 * U, t0 * U], [e1 * U, t1 * U], [e0 * U, t1 * U]], s0 * U, s1 * U, P), style);
  const near = G.dot3(PAY_T, V) < 0 ? -1 : 1;
  const cavity = S(skin(rowsOf(33, 44, marks), { inward: true }), { tone: "faint", crease: "none", className: "ss-cav" });
  const innerLines = [];
  for (let s = Math.ceil(33 / RING) * RING; s < NOSE_BASE; s += RING) innerLines.push(G.arcOf(SF, s * U, R * U, P, { inward: true, least: -0.02 }));
  for (let deg = 150; deg < 360; deg += 15) {
    const n = G.mul3(radial(deg), -1);
    if (G.dot3(n, V) < 0.05) continue;
    innerLines.push(k.pathOf([at(on(33.2, R, deg)), at(on(NOSE_BASE, R, deg))]));
  }
  // The methane tank's forward dome, bulging up into the bay under the dispenser.
  const domeRows = Array.from({ length: 11 }, (_, i) => {
    const u = (i / 10) * (Math.PI / 2);
    return [33.0 + 1.6 * Math.sin(u), R * Math.cos(u) - (i === 10 ? 0 : 0.02)];
  });
  const dome = S(skin(domeRows), { tone: "faint", crease: "none", className: "ss-cav" });

  const yoke = [];
  for (const t of [-1.98, 1.98]) yoke.push(item(payAt(0, t, 43.4), payBox(-2.42, 2.42, t - 0.12, t + 0.12, 43.3, 43.48, metal)));
  for (const e of [-2.3, 2.3]) yoke.push(item(payAt(e, 0, 43.4), payBox(e - 0.12, e + 0.12, -1.86, 1.86, 43.3, 43.48, metal)));
  for (const e of [-1.2, 1.2]) yoke.push(item(payAt(e, 0, 43.2), payBox(e - 0.25, e + 0.25, -0.6, 0.6, 43.04, 43.3, metal)));
  const column = (e, t) => {
    const teeth = [];
    for (let s = SAT.stack; s < 43.1; s += SAT.pitch) teeth.push(k.pathOf([at(payAt(e - 0.12, t + near * 0.12, s)), at(payAt(e + 0.12, t + near * 0.12, s))]));
    return item(payAt(e, t, 39), payBox(e - 0.12, e + 0.12, t - 0.12, t + 0.12, 35.42, 43.3, { ...metal, inner: Ln(teeth.join(""), { tone: "faint" }) }));
  };
  const columns = (side) => [-2.3, 2.3].map((e) => column(e, side * 1.98));
  const rails = [-1.15, 1.15].map((t) => item(payAt(0, t, 35.5), payBox(-3.6, 4.0, t - 0.1, t + 0.1, 35.42, 35.6, metal)));
  const frame = [];
  for (const t of [-1.98, 1.98]) frame.push(item(payAt(0, t, 35.3), payBox(-3.8, 3.75, t - 0.12, t + 0.12, 35.2, 35.42, metal)));
  for (const e of [-3.65, -1.2, 1.2, 3.6]) frame.push(item(payAt(e, 0, 35.3), payBox(e - 0.14, e + 0.14, -1.86, 1.86, 35.2, 35.42, metal)));
  const reach = Math.sqrt(4.45 ** 2 - 1.75 ** 2);
  const beams = [-1.6, 1.6].map((t) => item(payAt(0, t, 35), payBox(-reach, reach, t - 0.15, t + 0.15, 34.6, 35.2, metal)));

  // ---- The satellites: one small <svg> each, drawn where it sits in the stack; the page moves them. ----
  function satSvg(s) {
    const top = s + SAT.bus + SAT.array;
    const folds = [];
    for (const e of [-2.3, -1.15, 0, 1.15, 2.3]) folds.push(k.pathOf([at(payAt(e, -SAT.side + 0.05, top)), at(payAt(e, SAT.side - 0.05, top))]));
    const spine = k.pathOf([at(payAt(-SAT.half + 0.04, 0, top)), at(payAt(SAT.half - 0.04, 0, top))]);
    const bus = payBox(-SAT.half, SAT.half, -SAT.side, SAT.side, s, s + SAT.bus, { tone: "hi", className: "ss-sat-bus" });
    const array = payBox(-SAT.half + 0.04, SAT.half - 0.04, -SAT.side + 0.05, SAT.side - 0.05, s + SAT.bus, top, { tone: "hi", className: "ss-sat-array", inner: Ln(folds.join(""), { tone: "lo" }) + Ln(spine, { tone: "faint" }) });
    const corners = [];
    for (const e of [-SAT.half, SAT.half]) for (const t of [-SAT.side, SAT.side]) for (const z of [s, top]) corners.push(at(payAt(e, t, z)));
    const xs = corners.map(([x]) => x);
    const ys = corners.map(([, y]) => y);
    const box = [Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) + 3, Math.max(...ys) + 3].map((v) => Math.round(v * 10) / 10);
    const [x0, y0, x1, y1] = box;
    const pct = (v, of) => `${((v / of) * 100).toFixed(3)}%`;
    return `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg ob-sat ss-moves" data-sat viewBox="${x0} ${y0} ${(x1 - x0).toFixed(1)} ${(y1 - y0).toFixed(1)}" style="left:${pct(x0, W)};top:${pct(y0, H)};width:${pct(x1 - x0, W)};height:${pct(y1 - y0, H)}" aria-hidden="true"><g class="ob-sat-body">${bus}${array}</g></svg>`;
  }
  const satRest = Array.from({ length: SAT.count }, (_, i) => (i === 0 ? SAT.base : SAT.stack + (i - 1) * SAT.pitch));
  const satsHtml = satRest.map(satSvg).join("");

  // ---- The door: a panel of skin over the slot; it fades as it opens inward. ----
  const doorSkin = { ...skin(rowsOf(SLOT.s0, SLOT.s1, []), { keep: (s, deg) => inSlot(s, deg) }), outline: slotD };
  const latches = [];
  for (const deg of [SLOT.a0 + 4, SLOT.a1 - 4]) for (const s of [SLOT.s0 + 0.22, SLOT.s1 - 0.22]) latches.push(at(on(s, R, deg)));
  const doorInset = loopOn(box(SLOT.s0 + 0.12, SLOT.s1 - 0.12, SLOT.a0 + 1.4, SLOT.a1 - 1.4));
  const doorSvg = S(doorSkin, { ...steel, inner: Ln(doorInset, { tone: "faint" }) + Dots(latches, { size: 0.55, tone: "mid" }) });

  // ---- Space, the Earth's limb and its clouds, drawn flat behind the ship (not to the drawing's scale). ----
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const RE = 2400;
  const LIMB = 250;
  const EC = [W * 0.42, LIMB + RE];
  const stars = [];
  for (let i = 0; i < 90; i++) {
    const x = rand() * W;
    const y = rand() * (LIMB + 40);
    if (Math.hypot(x - EC[0], y - EC[1]) < RE + 8) continue;
    stars.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.45 + rand() * 0.8).toFixed(2)}"/>`);
  }
  const limbY = (x) => EC[1] - Math.sqrt(RE * RE - (x - EC[0]) ** 2);
  const lowest = Math.max(limbY(0), limbY(W));
  // Two bands of cloud, far ones flat near the limb and slow, near ones rounder and faster; each layer is two
  // card widths wide and repeats after one, so sliding it by a card width is seamless.
  const band = (y0, y1, count, size, squash) => {
    const list = [];
    for (let i = 0; i < count; i++) {
      const x = rand() * W;
      const y = y0 + (y1 - y0) * Math.pow(rand(), 0.8);
      const depth = (y - y0) / (y1 - y0);
      const rx = size * (0.5 + rand()) * (0.6 + 0.8 * depth);
      const ry = rx * squash * (0.7 + 0.6 * depth);
      const puffs = [[0, 0, 1, 1], [-0.55, 0.15, 0.6, 0.8], [0.6, 0.1, 0.65, 0.85]];
      for (const copy of [0, W]) list.push(`<g>${puffs.map(([dx, dy, sx, sy]) => `<ellipse cx="${(x + copy + dx * rx).toFixed(1)}" cy="${(y + dy * ry).toFixed(1)}" rx="${(rx * sx).toFixed(1)}" ry="${(ry * sy).toFixed(1)}"/>`).join("")}</g>`);
    }
    return list.join("");
  };
  const farClouds = band(lowest + 10, lowest + 130, 60, 30, 0.08);
  const nearClouds = band(lowest + 130, H + 30, 44, 70, 0.12);
  const air = (offset, opacity) => `<stop offset="${(offset / (RE + 36)).toFixed(5)}" stop-color="var(--ob-air)" stop-opacity="${opacity}"/>`;
  const defs = `<defs><radialGradient id="ob-air" gradientUnits="userSpaceOnUse" cx="${EC[0]}" cy="${EC[1]}" r="${RE + 36}">${air(0, 0)}${air(RE - 110, 0)}${air(RE - 14, 0.45)}${air(RE - 1, 0.9)}${air(RE + 6, 0.35)}${air(RE + 36, 0)}</radialGradient><radialGradient id="ob-flame" cx="0" cy="0.5" r="1"><stop offset="0" stop-color="var(--ob-flame-0)" stop-opacity="0.9"/><stop offset="0.12" stop-color="var(--ob-flame-1)" stop-opacity="0.55"/><stop offset="0.45" stop-color="var(--ob-flame-2)" stop-opacity="0.22"/><stop offset="0.8" stop-color="var(--ob-flame-2)" stop-opacity="0.06"/><stop offset="1" stop-color="var(--ob-flame-2)" stop-opacity="0"/></radialGradient><linearGradient id="ob-flame-core" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.35" stop-color="var(--ob-flame-0)" stop-opacity="0.5"/><stop offset="1" stop-color="var(--ob-flame-1)" stop-opacity="0"/></linearGradient></defs>`;

  // The flame: in vacuum nothing presses on the exhaust, so it fans out wide and faint behind the nozzles.
  const aft = at(on(0, 0, 0));
  const back = at(on(-1, 0, 0));
  const dir = [back[0] - aft[0], back[1] - aft[1]];
  const perMetre = Math.hypot(...dir);
  const angle = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
  const across = P.scale * U;
  // Soft edges come from a blur; the layer is rasterised once and only scaled while it plays.
  const fan = "M0 -0.12C0.2 -0.3 0.5 -0.46 0.78 -0.44C0.95 -0.42 1.02 -0.2 1.02 0C1.02 0.2 0.95 0.42 0.78 0.44C0.5 0.46 0.2 0.3 0 0.12Z";
  const core = "M0 -0.1C0.18 -0.13 0.38 -0.1 0.52 -0.04C0.56 -0.02 0.56 0.02 0.52 0.04C0.38 0.1 0.18 0.13 0 0.1Z";
  // Scale a unit path's coordinate pairs to drawing units, so the blur radius is in drawing units too.
  const sized = (d, sx, sy) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${(x * sx).toFixed(1)} ${(y * sy).toFixed(1)}`);
  const flame = `<filter id="ob-soft" x="-0.3" y="-0.3" width="1.6" height="1.6"><feGaussianBlur stdDeviation="10"/></filter><filter id="ob-soft-core" x="-0.2" y="-0.4" width="1.4" height="1.8"><feGaussianBlur stdDeviation="3"/></filter><g data-plume transform="translate(${aft[0].toFixed(1)} ${aft[1].toFixed(1)}) rotate(${angle.toFixed(2)})"><path class="ob-flame" filter="url(#ob-soft)" d="${sized(fan, 44 * perMetre, 40 * across)}"/><path class="ob-flame-core" filter="url(#ob-soft-core)" d="${sized(core, 26 * perMetre, 9 * across)}"/></g>`;

  // Painter's order: sky and Earth, flame, then the aft tanks and everything behind the bay's open side (their flat
  // end at s = 33 is under the dome), the satellites, then the bay's near side with its cut, and the door.
  const layer = (inner, { moves = false, wide = false, fade = false, over = false, first = false, attrs = "" } = {}) =>
    `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg ss-layer${moves ? " ss-moves" : ""}${wide ? " ob-wide" : ""}${fade ? " ob-fade" : ""}${over ? " fl-over" : ""}"${attrs} viewBox="0 0 ${wide ? W * 2 : W} ${H}"${first ? ` role="img" aria-label="${esc(TEXT.en.ui.label)}"` : ` aria-hidden="true"`}>${inner}</svg>`;
  const svg = [
    layer(`${defs}<rect class="ob-space" x="0" y="0" width="${W}" height="${H}"/><g class="ob-stars">${stars.join("")}</g>`, { first: true }),
    layer(`<circle class="ob-earth" cx="${EC[0]}" cy="${EC[1]}" r="${RE}"/>`, { moves: true, attrs: " data-earth" }),
    layer(`<g class="ob-cloud">${farClouds}</g>`, { moves: true, wide: true, attrs: ` data-earth data-clouds="14"` }),
    layer(`<g class="ob-cloud">${nearClouds}</g>`, { moves: true, wide: true, attrs: ` data-earth data-clouds="34"` }),
    layer(`<circle fill="url(#ob-air)" cx="${EC[0]}" cy="${EC[1]}" r="${RE + 36}"/>`, { moves: true, attrs: " data-earth" }),
    layer(flame, { moves: true, fade: true, over: true, attrs: ` data-flame style="transform-origin:${((aft[0] / W) * 100).toFixed(2)}% ${((aft[1] / H) * 100).toFixed(2)}%;opacity:0"` }),
    layer(`<g class="ob-ship">${body("slox", 0, 20)}${body("sch4", 20, 33)}${cavity}${Ln(innerLines.join(""), { tone: "lo", className: "ss-in" })}${dome}${sorted([...beams, ...frame])}${sorted(rails)}${sorted(columns(-near))}</g>`),
    `<div class="ss-layer ob-sats">${satsHtml}</div>`,
    layer(`<g class="ob-ship">${sorted([...columns(near), ...yoke])}${nose}<g data-sec="slox">${flap(0.6, 9.6, 3.6, 3.6)}</g><g data-sec="nose">${flap(40.6, 46.4, 2.6, 2.4)}</g>${Ln(windowD, { tone: "mid" })}${Ln(windowLip, { tone: "faint" })}${Ln(slotD, { tone: "mid" })}</g>`),
    layer(`<g class="ob-ship">${doorSvg}</g>`, { fade: true, attrs: " data-door" }),
  ].join("");

  const unit = (vector) => {
    const o = at([0, 0, 0]);
    const p = at(vector);
    return [p[0] - o[0], p[1] - o[1]];
  };
  const data = {
    W,
    H,
    end: END,
    tracks: TRACKS,
    events: EVENTS,
    deploy: DEPLOY,
    sat: { base: SAT.base, rest: satRest, half: SAT.half, clear: R + SAT.half },
    AX: unit(G.mul3(SF.a, U)),
    OUT: unit(G.mul3(PAY_E, U)),
    sinkPx: 34,
    t: TEXT,
  };

  const en = TEXT.en;
  const tx = (key) => `data-ft="${key}">${esc(en.ui[key])}`;
  const fmtT = (tm) => {
    const s = Math.round(Math.abs(tm));
    const sec = String(s % 60).padStart(2, "0");
    return s < 3600 ? `T+${Math.floor(s / 60)}:${sec}` : `T+${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${sec}`;
  };
  const chips = EVENTS.map((event) => `<button type="button" class="ss-part fl-event" data-event="${event.id}"><span class="ss-num">${fmtT(event.tm)}</span><span class="fl-event-name">${esc(en.events[event.id].short)}</span></button>`).join("");
  const specsHtml = (list) => list.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("");
  const cornersHtml = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig" ${tx("fig")}</span><span class="iso-plate-corner" data-corner="title" ${tx("figTitle")}</span><span class="iso-plate-corner" data-corner="readout" data-readout>${fmtT(TRACKS.clock[0][1])}</span></div>`;
  const stage = `<div class="ss-stage fl-stage ob-stage" tabindex="0" role="slider" data-ft-aria="stage" aria-label="${esc(en.ui.stage)}" aria-valuemin="0" aria-valuemax="${END}" aria-valuenow="0" aria-valuetext="${esc(en.overview.title)}">${svg}</div>`;
  const controls = `<div class="ss-controls fl-controls"><button type="button" class="ss-button" data-play aria-pressed="false">${esc(en.ui.play)}</button><button type="button" class="ss-button" data-restart ${tx("restart")}</button><input class="fl-scrub" type="range" min="0" max="${END}" step="0.05" value="0" data-scrub data-ft-aria="scrub" aria-label="${esc(en.ui.scrub)}"></div>`;
  const panel = `<aside class="iso-plate ss-panel fl-panel" data-ft-aria="panel" aria-label="${esc(en.ui.panel)}"><div class="ss-parts ss-chips2">${chips}</div><h3 class="ss-panel-head"><span class="ss-panel-num" data-p-num>T</span><span class="ss-panel-title" data-p-title>${esc(en.overview.title)}</span></h3><p class="ss-text" data-p-text>${esc(en.overview.text)}</p><dl class="ss-specs" data-p-specs>${specsHtml(en.overview.specs)}</dl><div class="fl-links" data-p-links hidden><span class="fl-links-label" ${tx("linked")}</span><div class="fl-link-list" data-p-link-list></div></div></aside>`;
  const html = `<figure class="iso-figure ss fl ob" id="orbit"><header class="ss-fig-head"><h2 ${tx("fig4Head")}</h2><p ${tx("fig4Intro")}</p></header><div class="ss-layout"><div class="iso-plate ss-card">${cornersHtml}${stage}${controls}</div>${panel}</div><figcaption class="iso-legend"><span class="iso-caption" ${tx("notes")}</span></figcaption></figure>`;
  return { html, data };
}

const TEXT = {
  en: {
    ui: {
      fig: "Fig 4",
      figTitle: "To orbit · 26 satellites out",
      fig4Head: "The ship goes on to orbit and lets the satellites go",
      fig4Intro: "After staging, the ship carries on alone. Its six engines push it almost to orbital speed; it coasts, burns once more to stay in orbit, then opens a slot in its side and pushes out 26 Starlink V3 satellites one at a time. Drag the timeline or press Play: the cut-open side shows the stack getting shorter.",
      play: "Play",
      pause: "Pause",
      restart: "Restart",
      scrub: "Mission time",
      panel: "Events in orbit",
      stage: "Starship's upper stage above the Earth with its payload bay cut open. Space plays or pauses, the arrow keys step between events.",
      linked: "In Fig 1:",
      notes: "Times follow Flight 14 on 28 September 2026, the first time Starship reached orbit, as listed on Wikipedia: engine cutoff at T+8:11, a 19-second orbit insertion burn from T+25:28 into a 262 × 275 km orbit, the 26 satellites released between T+34:18 and T+1:04:50, and an 11-second deorbit burn at T+2:12:00. Altitudes between those points are approximate, the satellites are spaced evenly between the first and the last, and the timeline speeds up and slows down so it plays in under a minute. The dispenser is drawn as in Fig 1; SpaceX has not published how it moves the stack. How fast the satellites drift away, the flame and the Earth below are drawn for clarity, not to scale.",
      label: "Starship's upper stage seen from the side above the curve of the Earth, its payload bay cut open to show 26 Starlink satellites stacked flat on a dispenser rack. A timeline plays: the six engines burning with a wide, faint flame, engine cutoff, a short orbit insertion burn, a slot-shaped door opening at the top of the bay, the satellites pushed out one at a time and drifting away while the stack moves down a place each time, the door closing, the ship turning round and a short deorbit burn.",
    },
    overview: {
      title: "To orbit and back",
      text: "The ship reaches orbit about 25 minutes after liftoff and spends half an hour letting the satellites go. Pick an event to jump to it.",
      specs: [["Orbit", "262 × 275 km"], ["Payload", "26 Starlink V3"], ["Splashdown", "T+3:08:30"]],
    },
    events: {
      climb: { short: "Six engines", title: "Six engines to orbit", text: "With the booster gone, the ship burns its three sea-level and three vacuum Raptors for almost six minutes. There is no air outside to hold the exhaust together, so it fans out into a wide, faint plume, and the big vacuum nozzles get more push out of every kilogram of propellant.", specs: [["Engines", "3 sea-level + 3 vacuum"], ["Burn", "T+2:22 to T+8:11"]] },
      seco: { short: "Cutoff", title: "Engine cutoff", text: "The engines shut down close to orbital speed, but not quite at it: left alone, the ship's path would still dip back into the atmosphere, which is how every earlier Starship flight ended. On Flight 14 a second burn turned it into an orbit.", specs: [["Time", "T+8:11"], ["Engines", "6 → 0"]] },
      insert: { short: "Orbit burn", title: "Orbit insertion burn", text: "Seventeen minutes later, near the top of its path, the ship lights up again for 19 seconds. That lifts the low point of its path out of the atmosphere: now it stays up, circling the Earth about once every 90 minutes at about 7.7 km/s.", specs: [["Burn", "T+25:28, 19 s"], ["Orbit", "262 × 275 km, 30.5°"]] },
      door: { short: "Door opens", title: "The door opens", text: "A slot-shaped door in the side of the payload bay opens, and at T+34:18 the dispenser pushes the bottom satellite out through it along its rails. The satellite drifts up and away; the stack moves down one place to put the next one on the rails.", specs: [["First out", "T+34:18"], ["Each satellite", "≈ 2 t"]] },
      last: { short: "Last one out", title: "The 26th satellite", text: "A satellite leaves about every 70 seconds, and the last one is out at T+1:04:50, half an hour after the first: about 50 tonnes in all. Then the door closes. Each satellite unfolds its solar arrays and climbs to its working orbit on its own thrusters.", specs: [["Released", "26 in 30 min"], ["Last out", "T+1:04:50"], ["Mass", "≈ 50 t in all"]] },
      deorbit: { short: "Deorbit burn", title: "Turning round to come home", text: "To come down, the ship has to slow down. It turns round so its engines face forward, and at T+2:12:00 it burns for 11 seconds against its direction of travel. That drops the low point of its path into the atmosphere: it enters belly first on its heat-shield tiles at T+2:28:52 and splashes down in the Pacific at T+3:08:30.", specs: [["Burn", "T+2:12:00, 11 s"], ["Entry", "T+2:28:52"], ["Splashdown", "T+3:08:30"]] },
    },
    say: { km: "km", outBefore: "", outAfter: " out" },
  },
  zh: {
    ui: {
      fig: "图 4",
      figTitle: "入轨 · 放出 26 颗卫星",
      fig4Head: "飞船继续入轨，把卫星放出去",
      fig4Intro: "分离之后，飞船独自继续飞。六台发动机把它推到接近轨道速度；滑行一段后再点火一次留在轨道上，然后打开侧面的缝隙舱门，把 26 颗 Starlink V3 卫星一颗一颗推出去。拖动时间轴或按「播放」：剖开的舷侧能看到那摞卫星越来越矮。",
      play: "播放",
      pause: "暂停",
      restart: "重新开始",
      scrub: "任务时间",
      panel: "轨道上的事件",
      stage: "地球上空的星舰飞船，载荷舱剖开。空格键播放或暂停，方向键在事件之间跳转。",
      linked: "在图 1 中：",
      notes: "时间采用 2026 年 9 月 28 日第 14 次飞行的数据（星舰第一次入轨），取自维基百科：T+8:11 发动机关机，T+25:28 起入轨点火 19 秒、进入 262 × 275 公里的轨道，T+34:18 到 T+1:04:50 之间放出 26 颗卫星，T+2:12:00 离轨点火 11 秒。这些时间点之间的高度是近似值，卫星按第一颗到最后一颗之间平均间隔来画，时间轴也有快有慢，好让整段在一分钟内播完。分配器按图 1 的画法；SpaceX 没有公布它是怎么让整摞卫星下移的。卫星飘走的速度、尾焰和下面的地球是为了看清楚而画的，不按比例。",
      label: "从侧面看地球弧线上方的星舰飞船，载荷舱剖开，里面是平躺着叠在分配器架子上的 26 颗 Starlink 卫星。时间轴播放：六台发动机点火、尾焰又宽又淡，发动机关机，短暂的入轨点火，载荷舱顶部的缝隙舱门打开，卫星一颗一颗被推出去飘走、整摞每次下移一格，舱门关上，飞船调头，短暂的离轨点火。",
    },
    overview: {
      title: "入轨再返回",
      text: "飞船在起飞约 25 分钟后入轨，再用半个小时把卫星一颗颗放出去。选一个事件即可跳过去。",
      specs: [["轨道", "262 × 275 公里"], ["载荷", "26 颗 Starlink V3"], ["溅落", "T+3:08:30"]],
    },
    events: {
      climb: { short: "六台发动机", title: "六台发动机推向轨道", text: "助推器离开后，飞船的三台海平面版和三台真空版猛禽连续工作将近六分钟。外面没有空气把尾焰「拢住」，它就散成又宽又淡的一大片；真空版的大喷管能从每公斤推进剂里多榨出一些推力。", specs: [["发动机", "3 台海平面 + 3 台真空"], ["工作", "T+2:22 到 T+8:11"]] },
      seco: { short: "关机", title: "发动机关机", text: "发动机关机。这时的速度已经接近轨道速度，但还差一点：放着不管，飞船的轨迹会重新落进大气层，此前每一次星舰飞行都是这样结束的。第 14 次飞行靠第二次点火把它变成了真正的轨道。", specs: [["时间", "T+8:11"], ["发动机", "6 → 0"]] },
      insert: { short: "入轨点火", title: "入轨点火", text: "十七分钟后，在轨迹最高点附近，飞船再点火 19 秒。这把轨迹的最低点抬出了大气层：从此它留在轨道上，以约 7.7 公里/秒的速度大约每 90 分钟绕地球一圈。", specs: [["点火", "T+25:28，19 秒"], ["轨道", "262 × 275 公里，倾角 30.5°"]] },
      door: { short: "舱门打开", title: "舱门打开", text: "载荷舱侧面的缝隙舱门打开，T+34:18 分配器沿导轨把最下面一颗卫星推出去。卫星向上慢慢飘走；整摞卫星下移一格，把下一颗放到导轨上。", specs: [["第一颗", "T+34:18"], ["每颗卫星", "约 2 吨"]] },
      last: { short: "最后一颗", title: "第 26 颗卫星", text: "大约每 70 秒放出一颗，最后一颗在 T+1:04:50 离开，距第一颗半个小时，总共约 50 吨。随后舱门关上。每颗卫星会展开自己的太阳能板，再用自带的推进器爬升到工作轨道。", specs: [["放出", "30 分钟内 26 颗"], ["最后一颗", "T+1:04:50"], ["总质量", "约 50 吨"]] },
      deorbit: { short: "离轨点火", title: "调头回家", text: "要下来，飞船得先减速。它把自己调个头，让发动机朝前，T+2:12:00 逆着飞行方向点火 11 秒。这把轨迹的最低点压进了大气层：T+2:28:52 它用腹部的隔热瓦朝前再入大气，T+3:08:30 溅落在太平洋。", specs: [["点火", "T+2:12:00，11 秒"], ["再入", "T+2:28:52"], ["溅落", "T+3:08:30"]] },
    },
    say: { km: "公里", outBefore: "已放出 ", outAfter: "" },
  },
};
