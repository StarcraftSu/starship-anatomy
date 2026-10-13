// Fig 3: one flight. The stack stands on the launch mount beside the tower; a timeline drives
// liftoff, hot staging, the booster's flip and boostback, its return and the catch by the tower's arms.
// Everything that turns is prebuilt as frames (booster rotation, arm swing); the page only moves groups.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const U = 2;
const W = 980;
const H = 700;
const AZIMUTH = 50;
const ELEVATION = 22;

const R = 4.5;
const BOOSTER = 72.3;
const SHIP = 52.1;
const OLM_TOP = 20;
const PIVOT = 36;
const TOWER = { x0: -36, x1: -24, y0: -6, y1: 6, height: 146 };
const ARM = { z: 100, hingeX: -24, y: 5.9, length: 31, half: 0.8, depth: 1.1, open: 85 };
const FIN_S = 66.8;
const ROT_FRAMES = 25;
const ARM_FRAMES = 13;
const TILE_C = 165;

// Mission time (s) of each event, and the playback time (s) where it sits on the compressed timeline.
const EVENTS = [
  { id: "ignition", tm: -3, ta: 3, sections: ["beng"] },
  { id: "liftoff", tm: 0, ta: 4.5, sections: ["beng"] },
  { id: "maxq", tm: 59, ta: 13, sections: [] },
  { id: "meco", tm: 154, ta: 18, sections: ["beng"] },
  { id: "hotstage", tm: 157, ta: 19.5, sections: ["bch4", "slox"] },
  { id: "boostback", tm: 168, ta: 23, sections: ["beng"] },
  { id: "descent", tm: 240, ta: 32, sections: ["bch4"] },
  { id: "landing", tm: 390, ta: 36.5, sections: ["beng"] },
  { id: "catch", tm: 414, ta: 42, sections: ["bch4"] },
  { id: "orbit", tm: 510, ta: 45, sections: ["slox", "nose"], next: "orbit" },
];

// Playback seconds -> mission seconds, and the scene keyframes, all as [playback s, value].
const TRACKS = {
  clock: [[0, -6], [3, -3], [4.5, 0], [9, 12], [13, 59], [17, 150], [18, 154], [19.5, 157], [23, 168], [26, 190], [30, 221], [32, 240], [35, 385], [36.5, 390], [42, 414], [44, 440], [45, 510], [48, 540]],
  base: [[0, OLM_TOP], [4.5, OLM_TOP], [9, 190], [13, 420], [18, 600], [19.5, 606], [23, 618], [26, 628], [30, 640], [32, 640], [35, 190], [38.5, 80], [42, 35], [48, 35]],
  sep: [[0, 0], [19.5, 0], [21, 5], [23, 40], [26, 420], [48, 420]],
  rot: [[0, 0], [23, 0], [26, 180], [30, 180], [32, 0], [48, 0]],
  arms: [[0, 1], [40, 1], [41.6, 0], [48, 0]],
  booster: [[0, 0], [2.6, 0], [3.4, 0.5], [4.5, 1], [18, 1], [18.2, 0.3], [20.5, 0.3], [21, 0], [26.3, 0], [26.8, 0.55], [29.6, 0.55], [30, 0], [36.4, 0], [36.8, 0.55], [39.5, 0.45], [40, 0.25], [41.8, 0.2], [42.1, 0], [48, 0]],
  ship: [[0, 0], [18.6, 0], [19, 1], [26, 1], [26.5, 0], [48, 0]],
  vents: [[0, 0], [18.6, 0], [19, 1], [20.4, 1], [21.2, 0], [48, 0]],
  // Altitude in km of the vehicle in view, approximate, after Flight 5's profile.
  altitude: [[-6, 0], [0, 0], [5, 0.05], [10, 0.25], [20, 1.2], [30, 3], [45, 7], [59, 12], [90, 28], [120, 45], [154, 65], [157, 70], [190, 82], [221, 88], [260, 84], [300, 70], [340, 40], [370, 12], [385, 2.5], [390, 1.2], [400, 0.4], [414, 0.035], [600, 0.035]],
};
const END = 48;

export function buildFlight({ esc }) {
  const fitPoints = [];
  const APRON = { x: -60, y: -36, w: 104, d: 80, r: 3 };
  for (const [x, y] of [[APRON.x, APRON.y], [APRON.x + APRON.w, APRON.y], [APRON.x, APRON.y + APRON.d], [APRON.x + APRON.w, APRON.y + APRON.d]]) fitPoints.push([x * U, y * U, -1.5 * U]);
  fitPoints.push([-30 * U, 0, (TOWER.height + 12) * U], [0, 0, (OLM_TOP + BOOSTER + SHIP + 6) * U], [12 * U, 12 * U, 0]);
  const P = k.fitProjection(fitPoints, W, H, { pad: 22, azimuth: AZIMUTH, elevation: ELEVATION });
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const atM = (p) => at(p.map((v) => v * U));
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const item = (point, svg) => ({ depth: G.dot3(point, V), svg });
  const sorted = (list) => [...list].sort((a, b) => a.depth - b.depth).map((part) => part.svg).join("");
  const steel = { tone: "hi", className: "ss-steel" };

  // A strip of a body of revolution between two angles, only the quads that face the camera.
  function shell(F, rows, from, to, steps, style) {
    const buckets = [[], [], [], [], []];
    const fill = [];
    for (let i = 0; i < rows.length - 1; i++) {
      const [s0, r0] = rows[i];
      const [s1, r1] = rows[i + 1];
      for (let j = 0; j < steps; j++) {
        const a0 = from + ((to - from) * j) / steps;
        const a1 = from + ((to - from) * (j + 1)) / steps;
        const n = G.unit3(G.sub3(G.mul3(G.radialOf(F, (a0 + a1) / 2), s1 - s0), G.mul3(F.a, r1 - r0)));
        if (G.dot3(n, V) <= 1e-6) continue;
        const d = k.pathOf([G.pointOf(F, s0, r0, a0), G.pointOf(F, s0, r0, a1), G.pointOf(F, s1, r1, a1), G.pointOf(F, s1, r1, a0)].map(at), true);
        fill.push(d);
        buckets[G.toneOf(n, P)].push(d);
      }
    }
    return S({ fill: fill.join(""), outline: "", crease: "", top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")), seamless: true }, { crease: "none", ...style });
  }

  // ---- The booster, drawn once per rotation angle about a pivot 36 m up its axis. ----
  function boosterFrame(theta) {
    const a = [Math.sin(theta), 0, Math.cos(theta)];
    const u = [Math.cos(theta), 0, -Math.sin(theta)];
    const base = [-PIVOT * Math.sin(theta) * U, 0, (PIVOT - PIVOT * Math.cos(theta)) * U];
    const F = G.frameOf(base, a, u, [0, 1, 0]);
    const lite = { steps: 36, smooth: false };
    const band = (id, s0, s1, extra = "") => {
      const paths = G.lathe([[s0 * U, R * U], [s1 * U, R * U]], F, P, { rims: "all", ...lite });
      const seams = [];
      for (let s = Math.ceil(s0 / 1.83 + 0.3) * 1.83; s < s1 - 0.5; s += 1.83 * 3) seams.push(G.arcOf(F, s * U, R * U, P));
      return item(G.pointOf(F, ((s0 + s1) / 2) * U, 0, 0), `<g data-sec="${id}">${S(paths, { ...steel, inner: Ln(seams.join(""), { tone: "faint" }) + extra })}</g>`);
    };
    const vents = [];
    for (let deg = 0; deg < 360; deg += 12) {
      const n = G.radialOf(F, deg * DEG);
      const f = G.dot3(n, V);
      if (f < 0.08) continue;
      vents.push([k.pathOf([at(G.pointOf(F, 69.8 * U, R * U + 0.1, deg * DEG)), at(G.pointOf(F, 71.5 * U, R * U + 0.1, deg * DEG))]), G.fadeOf(f, [0.08, 0.4])]);
    }
    const ventRims = Ln(G.arcOf(F, 69.6 * U, R * U, P) + G.arcOf(F, 71.7 * U, R * U, P), { tone: "lo" });
    const bands = [band("beng", 0, 6), band("blox", 6, 41), band("bch4", 41, BOOSTER, k.fadedSvg(vents, { tone: "hi" }) + ventRims)];
    const fins = [];
    for (const deg of [-90, 0, 90]) {
      const r = G.radialOf(F, deg * DEG);
      const t = G.tangentOf(F, deg * DEG);
      const FF = G.frameOf(G.pointOf(F, FIN_S * U, 0, 0), a, r, t);
      const plate = G.prismOf(FF, [[(R + 0.4) * U, -1.7 * U], [(R + 5) * U, -1.7 * U], [(R + 5) * U, 1.7 * U], [(R + 0.4) * U, 1.7 * U]], -0.4 * U, 0.4 * U, P);
      const housing = G.prismOf(FF, [[(R - 0.1) * U, -1.1 * U], [(R + 0.5) * U, -0.9 * U], [(R + 0.5) * U, 0.9 * U], [(R - 0.1) * U, 1.1 * U]], -0.7 * U, 0.9 * U, P);
      const svg = `<g data-sec="bch4">${S(housing, { tone: "hi", className: "ss-fin" })}${S(plate, { tone: "hi", className: "ss-fin" })}</g>`;
      fins.push({ front: G.dot3(r, V) > 0, svg });
    }
    let bottom = "";
    if (G.dot3(G.mul3(a, -1), V) > 0.04) {
      const rings = [[0.95, 3, 90], [2.45, 10, 18], [3.85, 20, 0]];
      const points = [];
      for (const [r, n, phase] of rings) for (let i = 0; i < n; i++) points.push(at(G.pointOf(F, 0, r * U, (phase + (i * 360) / n) * DEG)));
      bottom = `<path class="ss-nozzle" d="${G.circleOf(F, 0, (R - 0.3) * U, P)}"/><g class="fl-bell">${Dots(points, { size: 1.2, tone: "hi" })}</g>`;
    }
    let top = "";
    if (G.dot3(a, V) > 0.04) top = `<path class="ss-void" d="${G.circleOf(F, BOOSTER * U, (R - 0.5) * U, P)}"/>`;
    return fins.filter((fin) => !fin.front).map((fin) => fin.svg).join("") + sorted(bands) + bottom + top + fins.filter((fin) => fin.front).map((fin) => fin.svg).join("");
  }
  const boosterFrames = [];
  for (let i = 0; i < ROT_FRAMES; i++) boosterFrames.push(`<g data-rot="${i}"${i ? ` display="none"` : ""}>${boosterFrame((Math.PI * i) / (ROT_FRAMES - 1))}</g>`);
  // Flame from the interstage vents during hot staging, on the side facing the camera.
  const VX = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const jets = [];
  const facingDeg = Math.atan2(V[1], V[0]) / DEG;
  for (let deg = -75; deg <= 75; deg += 25) {
    const n = G.radialOf(VX, (facingDeg + deg) * DEG);
    const p0 = G.pointOf(VX, 70.6 * U, R * U, (facingDeg + deg) * DEG);
    const p1 = G.add3(p0, G.add3(G.mul3(n, 7 * U), [0, 0, -2 * U]));
    const side = G.mul3([-n[1], n[0], 0], 0.9 * U);
    jets.push(`<path class="fl-jet" d="${k.pathOf([at(G.add3(p0, side)), at(p1), at(G.sub3(p0, side))], true)}"/>`);
  }

  // ---- The ship, upright, translated only. ----
  const NOSE_BASE = 38.5;
  const NOSE_L = SHIP - NOSE_BASE;
  const noseR = (s) => (s <= NOSE_BASE ? R : R * Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, (s - NOSE_BASE) / NOSE_L), 1.8)), 0.6));
  const SF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const shipBands = [];
  const tileRows = (s0, s1, n) => Array.from({ length: n + 1 }, (_, i) => {
    const s = s0 + ((s1 - s0) * i) / n;
    return [s * U, noseR(s) * U + 0.15];
  });
  const tiles = (s0, s1, n) => shell(SF, tileRows(s0, s1, n), (TILE_C - 90) * DEG, (TILE_C + 90) * DEG, 30, { tone: "hi", className: "ss-tile" });
  const shipBand = (id, s0, s1) => {
    const paths = G.lathe([[s0 * U, R * U], [s1 * U, R * U]], SF, P, { rims: "all", steps: 40, smooth: false });
    return item(G.pointOf(SF, ((s0 + s1) / 2) * U, 0, 0), `<g data-sec="${id}">${S(paths, { ...steel, inner: tiles(s0, s1, 1) })}</g>`);
  };
  shipBands.push(shipBand("slox", 0, 20), shipBand("sch4", 20, 33));
  {
    const meridian = [[33 * U, R * U], [NOSE_BASE * U, R * U, 1]];
    for (let i = 1; i < 18; i++) {
      const s = NOSE_BASE + (NOSE_L * i) / 18;
      meridian.push([s * U, noseR(s) * U, 1]);
    }
    meridian.push([SHIP * U, 0]);
    const paths = G.lathe(meridian, SF, P, { rims: "first", steps: 40 });
    shipBands.push(item(G.pointOf(SF, 40 * U, 0, 0), `<g data-sec="nose">${S(paths, { ...steel, inner: tiles(33, SHIP - 0.5, 12) })}</g>`));
  }
  const flap = (deg, s0, s1, out0, out1, sec) => {
    const r = G.radialOf(SF, deg * DEG);
    const t = G.tangentOf(SF, deg * DEG);
    const FF = G.frameOf(G.mul3(t, -0.25 * U), t, [0, 0, 1], r);
    const poly = [[s0 * U, (noseR(s0) + 0.2) * U], [s1 * U, (noseR(s1) + 0.2) * U], [(s1 - 1.5) * U, (noseR(s1) + out1) * U], [s0 * U, (noseR(s0) + out0) * U]];
    return { front: G.dot3(r, V) > 0, svg: `<g data-sec="${sec}">${S(G.prismOf(FF, poly, 0, 0.5 * U, P), { tone: "hi", className: "ss-tile" })}</g>` };
  };
  const flaps = [flap(TILE_C - 90, 0.6, 9.6, 3.6, 3.6, "slox"), flap(TILE_C + 90, 0.6, 9.6, 3.6, 3.6, "slox"), flap(TILE_C - 90, 40.6, 46.4, 2.6, 2.4, "nose"), flap(TILE_C + 90, 40.6, 46.4, 2.6, 2.4, "nose")];
  const shipSvg = flaps.filter((f) => !f.front).map((f) => f.svg).join("") + sorted(shipBands) + flaps.filter((f) => f.front).map((f) => f.svg).join("");

  // ---- The launch site. ----
  const site = { back: [], front: [] };
  site.back.push(`<path class="iso-halo" d="${k.haloOf(APRON, -1.5 * U - 2, 18, P)}"/>`);
  const apron = { x: APRON.x * U, y: APRON.y * U, w: APRON.w * U, d: APRON.d * U, r: APRON.r * U };
  site.back.push(S(k.slabOf(apron, -1.5 * U, 1.5 * U, P, 8, 1), { tone: "mid", className: "fl-concrete", inner: Ln(k.sideSeam(apron, -0.75 * U, P, 8), { tone: "faint" }) }));
  const joints = [];
  for (let x = APRON.x + 8; x < APRON.x + APRON.w; x += 8) joints.push(k.lineOnTop([x * U, APRON.y * U], [x * U, (APRON.y + APRON.d) * U], 0, P));
  for (let y = APRON.y + 8; y < APRON.y + APRON.d; y += 8) joints.push(k.lineOnTop([APRON.x * U, y * U], [(APRON.x + APRON.w) * U, y * U], 0, P));
  site.back.push(Ln(joints.join(""), { tone: "faint" }));
  const plate = { x: -11 * U, y: -11 * U, w: 22 * U, d: 22 * U, r: 1 };
  site.back.push(S(k.slabOf(plate, 0, 0.5 * U, P, 4, 0.5), { tone: "hi", className: "ss-gunmetal" }));
  const holes = [];
  for (let x = -9; x <= 9; x += 2) for (let y = -9; y <= 9; y += 2) if (Math.hypot(x, y) > 3) holes.push(at([x * U, y * U, 0.5 * U]));
  site.back.push(Dots(holes, { size: 0.5, tone: "lo" }));

  // Tower: four corner columns, girders and braces on the two faces that face the camera.
  const column = (x, y) => S(k.slabOf({ x: (x - 0.7) * U, y: (y - 0.7) * U, w: 1.4 * U, d: 1.4 * U, r: 0 }, 0, TOWER.height * U, P, 4, 0), { tone: "hi", className: "fl-tower" });
  const corners = [[TOWER.x0, TOWER.y0], [TOWER.x1, TOWER.y0], [TOWER.x0, TOWER.y1], [TOWER.x1, TOWER.y1]].sort((p, q) => G.dot3([p[0], p[1], 0], V) - G.dot3([q[0], q[1], 0], V));
  const towerBack = column(...corners[0]);
  const braces = [];
  const girders = [];
  const levels = [];
  for (let z = 0; z <= TOWER.height; z += 12) levels.push(Math.min(z, TOWER.height));
  for (let i = 0; i < levels.length - 1; i++) {
    const z0 = levels[i];
    const z1 = levels[i + 1];
    for (const face of [[[TOWER.x1, TOWER.y0], [TOWER.x1, TOWER.y1]], [[TOWER.x0, TOWER.y1], [TOWER.x1, TOWER.y1]]]) {
      const [[ax, ay], [bx, by]] = face;
      braces.push(k.pathOf([atM([ax, ay, z0]), atM([bx, by, z1])]), k.pathOf([atM([bx, by, z0]), atM([ax, ay, z1])]));
    }
  }
  for (const z of levels) {
    girders.push(k.pathOf([atM([TOWER.x1, TOWER.y0, z]), atM([TOWER.x1, TOWER.y1, z]), atM([TOWER.x0, TOWER.y1, z])]));
  }
  const towerTop = S(k.slabOf({ x: (TOWER.x0 - 0.6) * U, y: (TOWER.y0 - 0.6) * U, w: (TOWER.x1 - TOWER.x0 + 1.2) * U, d: (TOWER.y1 - TOWER.y0 + 1.2) * U, r: 0 }, TOWER.height * U, 1.6 * U, P, 4, 0.4), { tone: "hi", className: "fl-tower" });
  const rodF = G.frameOf([(TOWER.x0 + TOWER.x1) * U * 0.5, 0, (TOWER.height + 1.6) * U], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const rod = S(G.disc(0, 10 * U, 0.25 * U, rodF, P, { steps: 12 }), { tone: "hi", className: "fl-tower" });
  const carriage = S(k.slabOf({ x: (TOWER.x0 - 1) * U, y: (TOWER.y0 - 1) * U, w: (TOWER.x1 - TOWER.x0 + 2) * U, d: (TOWER.y1 - TOWER.y0 + 2) * U, r: 0 }, (ARM.z - 3) * U, 6 * U, P, 4, 0.5), { tone: "hi", className: "ss-gunmetal" });
  site.back.push(`<g class="fl-tower-group">${towerBack}${Ln(braces.join(""), { tone: "faint" })}${Ln(girders.join(""), { tone: "lo" })}${corners.slice(1).map(([x, y]) => column(x, y)).join("")}${towerTop}${rod}${carriage}</g>`);

  // Chopstick arms: prebuilt from open (frame 0) to closed (last frame).
  const armFrames = (side) => {
    const frames = [];
    for (let i = 0; i < ARM_FRAMES; i++) {
      const open = 1 - i / (ARM_FRAMES - 1);
      const phi = side * ARM.open * open * DEG;
      const dir = [Math.cos(phi), Math.sin(phi), 0];
      const across = [-Math.sin(phi), Math.cos(phi), 0];
      const F = G.frameOf([ARM.hingeX * U, side * ARM.y * U, (ARM.z - ARM.depth) * U], [0, 0, 1], dir, across);
      const beam = G.prismOf(F, [[0, -ARM.half * U], [ARM.length * U, -ARM.half * U], [ARM.length * U, ARM.half * U], [0, ARM.half * U]], 0, ARM.depth * 2 * U, P);
      const pad = G.prismOf(F, [[(ARM.length - 7) * U, -ARM.half * 0.9 * U], [(ARM.length - 1) * U, -ARM.half * 0.9 * U], [(ARM.length - 1) * U, ARM.half * 0.9 * U], [(ARM.length - 7) * U, ARM.half * 0.9 * U]], ARM.depth * 2 * U, (ARM.depth * 2 + 0.5) * U, P);
      frames.push(`<g data-arm="${i}"${i ? ` display="none"` : ""}>${S(beam, { tone: "hi", className: "ss-gunmetal" })}${S(pad, { tone: "hi", className: "fl-pad" })}</g>`);
    }
    return frames.join("");
  };
  const armBack = `<g class="fl-arm" data-side="back">${armFrames(-1)}</g>`;
  const armFront = `<g class="fl-arm" data-side="front">${armFrames(1)}</g>`;

  // Launch mount: six legs and a ring table, split into the half behind the rocket and the half in front.
  const OF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const viewDeg = Math.atan2(V[1], V[0]) / DEG;
  const ringSector = (a0, a1) => {
    const poly = [];
    for (let i = 0; i <= 24; i++) {
      const a = (a0 + ((a1 - a0) * i) / 24) * DEG;
      poly.push([11 * U * Math.cos(a), 11 * U * Math.sin(a)]);
    }
    for (let i = 24; i >= 0; i--) {
      const a = (a0 + ((a1 - a0) * i) / 24) * DEG;
      poly.push([6.5 * U * Math.cos(a), 6.5 * U * Math.sin(a)]);
    }
    const clamps = [];
    for (let i = 0; i < 10; i++) clamps.push(at(G.pointOf(OF, OLM_TOP * U, 8.6 * U, (a0 + ((a1 - a0) * (i + 0.5)) / 10) * DEG)));
    return S(G.prismOf(OF, poly, (OLM_TOP - 2) * U, OLM_TOP * U, P), { tone: "hi", className: "ss-gunmetal" }) + Dots(clamps, { size: 0.9, tone: "mid" });
  };
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const a = (30 + i * 60) * DEG;
    const x = 10 * Math.cos(a);
    const y = 10 * Math.sin(a);
    legs.push({ front: Math.cos(a - viewDeg * DEG) > 0, svg: S(k.cylinder(x * U, y * U, 1.3 * U, 0, (OLM_TOP - 2) * U, P, 20), { tone: "hi", className: "ss-gunmetal" }) });
  }
  const olmBack = legs.filter((leg) => !leg.front).map((leg) => leg.svg).join("") + ringSector(viewDeg + 90, viewDeg + 270);
  const olmFront = legs.filter((leg) => leg.front).map((leg) => leg.svg).join("") + ringSector(viewDeg - 90, viewDeg + 90);

  // Clouds the stack climbs through, and stars that show once the sky goes dark.
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const cloud = (x, y, z, size) => {
    const [cx, cy] = atM([x, y, z]);
    const s = size * P.scale * U;
    const puffs = [[0, 0, 1, 0.45], [-0.55, 0.08, 0.7, 0.35], [0.6, 0.06, 0.75, 0.38], [0.15, -0.18, 0.6, 0.32]];
    return `<g class="fl-cloud">${puffs.map(([dx, dy, rx, ry]) => `<ellipse cx="${(cx + dx * s).toFixed(1)}" cy="${(cy + dy * s).toFixed(1)}" rx="${(rx * s).toFixed(1)}" ry="${(ry * s).toFixed(1)}"/>`).join("")}</g>`;
  };
  const cloudsBack = [];
  const cloudsFront = [];
  for (let i = 0; i < 9; i++) {
    const z = 150 + i * 36 + rand() * 18;
    const x = (rand() - 0.5) * 70;
    const y = (rand() - 0.5) * 40;
    (i % 2 ? cloudsFront : cloudsBack).push(cloud(x, y, z, 14 + rand() * 16));
  }
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push(`<circle cx="${(rand() * W).toFixed(1)}" cy="${(rand() * H * 0.9).toFixed(1)}" r="${(0.5 + rand() * 0.9).toFixed(2)}"/>`);

  // Plumes and steam: unit shapes the page places and stretches each frame.
  const plumeShape = "M0 -0.16C0.14 -0.4 0.42 -0.5 0.68 -0.36C0.85 -0.26 0.96 -0.1 1 0C0.96 0.1 0.85 0.26 0.68 0.36C0.42 0.5 0.14 0.4 0 0.16Z";
  const plume = (name) => `<g class="fl-plume" data-plume="${name}" display="none"><path class="fl-plume-out" d="${plumeShape}"/><path class="fl-plume-core" d="${plumeShape}" transform="scale(0.5 0.55)"/></g>`;
  const steam = [];
  for (let i = 0; i < 16; i++) {
    const a = rand() * TAU;
    const r = 8 + rand() * 18;
    steam.push({ p: [r * Math.cos(a), r * Math.sin(a), 1 + rand() * 6], r0: 3 + rand() * 3, r1: 12 + rand() * 12, t0: 2.8 + rand() * 1.8 });
  }
  const steamSvg = steam.map((_, i) => `<circle class="fl-steam" data-steam="${i}" r="0" cx="0" cy="0"/>`).join("");

  const defs = `<defs><linearGradient id="fl-grad-out" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="var(--fl-flame-0)"/><stop offset="0.3" stop-color="var(--fl-flame-1)" stop-opacity="0.95"/><stop offset="0.75" stop-color="var(--fl-flame-2)" stop-opacity="0.45"/><stop offset="1" stop-color="var(--fl-flame-2)" stop-opacity="0"/></linearGradient><linearGradient id="fl-grad-core" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="var(--fl-flame-0)" stop-opacity="0.9"/><stop offset="1" stop-color="var(--fl-flame-1)" stop-opacity="0"/></linearGradient></defs>`;
  // One <svg> layer per thing that moves on its own, in painter's order. The camera and the two stages slide whole
  // layers on the GPU; only small layers (plumes, steam, the arm and booster frames) ever repaint while it plays.
  // data-cam layers ride the camera; fl-over layers draw outside their box (clouds wait high above the view).
  const layer = (body, { cam = false, moves = false, over = false, first = false } = {}) =>
    `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg ss-layer${moves || cam ? " ss-moves" : ""}${over ? " fl-over" : ""}"${cam ? " data-cam" : ""} viewBox="0 0 ${W} ${H}"${first ? ` role="img" aria-label="${esc(TEXT.en.ui.label)}"` : ` aria-hidden="true"`}>${body}</svg>`;
  const svg = [
    layer(`${defs}<rect class="fl-sky" x="0" y="0" width="${W}" height="${H}"/><rect class="fl-space" data-space x="0" y="0" width="${W}" height="${H}" opacity="0"/><g class="fl-stars" data-stars opacity="0">${stars.join("")}</g>`, { first: true }),
    layer(`<g class="fl-site">${site.back.join("")}${olmBack}</g>`, { cam: true }),
    layer(armBack, { cam: true }),
    layer(`<g class="fl-clouds">${cloudsBack.join("")}</g>`, { cam: true, over: true }),
    layer(plume("booster")),
    layer(`<g data-booster>${boosterFrames.join("")}<g class="fl-jets" data-vents opacity="0">${jets.join("")}</g></g>`, { moves: true }),
    layer(plume("ship")),
    layer(`<g data-ship>${shipSvg}</g>`, { moves: true }),
    layer(`<g class="fl-site">${olmFront}</g>`, { cam: true }),
    layer(armFront, { cam: true }),
    layer(`<g class="fl-steam-group">${steamSvg}</g>`),
    layer(`<g class="fl-clouds">${cloudsFront.join("")}</g>`, { cam: true, over: true }),
  ].join("");

  const unit = (vector) => {
    const o = at([0, 0, 0]);
    const p = at(vector);
    return [p[0] - o[0], p[1] - o[1]];
  };
  const data = {
    W,
    H,
    O: at([0, 0, 0]),
    EX: unit([U, 0, 0]),
    EY: unit([0, U, 0]),
    EZ: unit([0, 0, U]),
    pivot: PIVOT,
    booster: BOOSTER,
    rotFrames: ROT_FRAMES,
    armFrames: ARM_FRAMES,
    end: END,
    tracks: TRACKS,
    events: EVENTS,
    steam,
    t: TEXT,
  };

  const en = TEXT.en;
  const tx = (key) => `data-ft="${key}">${esc(en.ui[key])}`;
  const fmtT = (tm) => `T${tm < 0 ? "−" : "+"}${Math.floor(Math.abs(tm) / 60)}:${String(Math.round(Math.abs(tm) % 60)).padStart(2, "0")}`;
  const chips = EVENTS.map((event, index) => `<button type="button" class="ss-part fl-event" data-event="${event.id}"><span class="ss-num">${fmtT(event.tm)}</span><span class="fl-event-name">${esc(en.events[event.id].short)}</span></button>`).join("");
  const specsHtml = (list) => list.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("");
  const cornersHtml = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig" ${tx("fig")}</span><span class="iso-plate-corner" data-corner="title" ${tx("figTitle")}</span><span class="iso-plate-corner" data-corner="readout" data-readout>T−0:06</span></div>`;
  const stage = `<div class="ss-stage fl-stage" tabindex="0" role="slider" data-ft-aria="stage" aria-label="${esc(en.ui.stage)}" aria-valuemin="0" aria-valuemax="${END}" aria-valuenow="0" aria-valuetext="T−0:06">${svg}</div>`;
  const controls = `<div class="ss-controls fl-controls"><button type="button" class="ss-button" data-play aria-pressed="false">${esc(en.ui.play)}</button><button type="button" class="ss-button" data-restart ${tx("restart")}</button><input class="fl-scrub" type="range" min="0" max="${END}" step="0.05" value="0" data-scrub data-ft-aria="scrub" aria-label="${esc(en.ui.scrub)}"></div>`;
  const panel = `<aside class="iso-plate ss-panel fl-panel" data-ft-aria="panel" aria-label="${esc(en.ui.panel)}"><div class="ss-parts ss-chips2">${chips}</div><h3 class="ss-panel-head"><span class="ss-panel-num" data-p-num>T</span><span class="ss-panel-title" data-p-title>${esc(en.overview.title)}</span></h3><p class="ss-text" data-p-text>${esc(en.overview.text)}</p><dl class="ss-specs" data-p-specs>${specsHtml(en.overview.specs)}</dl><div class="fl-links" data-p-links hidden><span class="fl-links-label" ${tx("linked")}</span><div class="fl-link-list" data-p-link-list></div></div><a class="ss-button ss-link" href="#orbit" data-p-next hidden ${tx("toNext")}</a></aside>`;
  const html = `<figure class="iso-figure ss fl" id="flight"><header class="ss-fig-head"><h2 ${tx("fig3Head")}</h2><p ${tx("fig3Intro")}</p></header><div class="ss-layout"><div class="iso-plate ss-card">${cornersHtml}${stage}${controls}</div>${panel}</div><figcaption class="iso-legend"><span class="iso-caption" ${tx("notes")}</span></figcaption></figure>`;
  return { html, data };
}

const TEXT = {
  en: {
    ui: {
      fig: "Fig 3",
      figTitle: "One flight · booster caught",
      fig3Head: "One flight, from the pad and back",
      fig3Intro: "The stack lifts off, splits in two at the edge of space, and the booster flies back to be caught by the tower that launched it. Drag the timeline or press Play; each event lights the parts it uses and links to them in Fig 1.",
      play: "Play",
      pause: "Pause",
      restart: "Restart",
      scrub: "Mission time",
      panel: "Flight events",
      stage: "Starship V3 standing on its launch mount beside the tower. Space plays or pauses the flight, the arrow keys step between events.",
      linked: "In Fig 1:",
      toNext: "The ship goes on: Fig 4 ↓",
      notes: "Times follow Flight 5 in October 2024, the first time the tower caught a booster: Max-Q at T+0:59, engine cutoff at T+2:34 with staging at about 70 km, boostback ending at T+3:41, landing burn from T+6:30 and the catch at T+6:54. Altitudes between those points are approximate, and the timeline speeds up and slows down so the whole flight plays in under a minute. The camera follows the vehicle, so heights on screen are not to scale above the tower; the booster's flip is drawn in the plane of the picture.",
      label: "Starship V3 on its launch mount beside the launch tower with its two catch arms. A timeline plays the flight: ignition and steam, liftoff, climbing through clouds into a darkening sky, hot staging with flame from the interstage vents, the ship leaving, the booster flipping for its boostback burn, falling back with its grid fins, its landing burn, and the arms closing to catch it.",
    },
    overview: {
      title: "One flight",
      text: "From ignition to the catch takes about seven minutes; the ship carries on to orbit. Pick an event to jump to it.",
      specs: [["Booster back", "about T+6:54"], ["Staging", "about 70 km up"], ["Ship", "on to orbit"]],
    },
    events: {
      ignition: { short: "Ignition", title: "Ignition", text: "A few seconds before liftoff the 33 Raptors light in quick succession while the mount's clamps hold the stack down. The steel plate under the mount sprays water up into the exhaust, which is the white cloud.", specs: [["Engines", "33 lighting"], ["Held by", "clamps on the mount"]] },
      liftoff: { short: "Liftoff", title: "Liftoff", text: "The clamps let go and the stack climbs past the tower on the thrust of all 33 engines, more than 8,000 tonnes of force.", specs: [["Engines", "33"], ["Thrust", "≈ 8,250 tf"]] },
      maxq: { short: "Max-Q", title: "Max-Q", text: "About a minute in, the stack is moving fast through air that is still thick: the moment of greatest aerodynamic pressure on the structure. After this the air thins quickly.", specs: [["Time", "T+0:59"], ["Altitude", "≈ 12 km"]] },
      meco: { short: "Cutoff", title: "Main engine cutoff", text: "Most of the booster's engines shut down; the three in the centre keep running so the stack stays under thrust for staging.", specs: [["Time", "T+2:34"], ["Engines", "33 → 3"]] },
      hotstage: { short: "Hot staging", title: "Hot staging", text: "The ship lights its six Raptors while it is still attached. Their exhaust escapes through the vents in the interstage, which V3 keeps on the booster, and the two stages part at about 70 km.", specs: [["Altitude", "≈ 70 km"], ["Ship", "6 engines lit"]] },
      boostback: { short: "Boostback", title: "Flip and boostback", text: "The booster flips round and relights the 13 engines in its middle rings to cancel its speed away from the coast and turn back toward the launch site.", specs: [["Engines", "13"], ["Burn ends", "T+3:41"]] },
      descent: { short: "Grid fins", title: "Falling back on its grid fins", text: "Engines first, the empty booster falls back through the atmosphere, steering with its three grid fins toward the tower.", specs: [["Steering", "3 grid fins"], ["Engines", "off"]] },
      landing: { short: "Landing burn", title: "Landing burn", text: "Close to the ground it relights 13 engines, then slows on the centre three as it comes down beside the tower.", specs: [["Time", "T+6:30"], ["Engines", "13 → 3"]] },
      catch: { short: "Catch", title: "Caught by the tower", text: "The tower's arms, nicknamed the chopsticks, close round the booster and catch it by its grid fins, ready to set it back on the mount. Flight 5 did this first, in October 2024.", specs: [["Time", "T+6:54"], ["Held by", "its grid fins"]] },
      orbit: { short: "Ship in orbit", title: "Ship in orbit", text: "Far downrange, the ship burns for several more minutes and shuts its engines down in orbit, about eight and a half minutes after liftoff. On Flight 14 it then released 26 Starlink V3 satellites from its payload bay.", specs: [["Engines", "6 → 0"], ["Payload", "e.g. 26 Starlink V3"]] },
    },
    say: { pad: "on the pad", km: "km" },
  },
  zh: {
    ui: {
      fig: "图 3",
      figTitle: "一次飞行 · 接住助推器",
      fig3Head: "一次飞行，从发射台出发再回到发射台",
      fig3Intro: "火箭起飞，在太空边缘一分为二，助推器飞回来，被发射它的那座塔接住。拖动时间轴或按「播放」；每个事件都会点亮它用到的部件，并能跳到图 1 里对应的分段。",
      play: "播放",
      pause: "暂停",
      restart: "重新开始",
      scrub: "任务时间",
      panel: "飞行事件",
      stage: "立在发射台上、紧挨着发射塔的星舰 V3。空格键播放或暂停，方向键在事件之间跳转。",
      linked: "在图 1 中：",
      toNext: "飞船接着往前飞：图 4 ↓",
      notes: "时间采用 2024 年 10 月第 5 次飞行的数据，那是发射塔第一次接住助推器：Max-Q 在 T+0:59，主发动机关机在 T+2:34，约 70 公里高度分离，返航点火在 T+3:41 结束，着陆点火从 T+6:30 开始，T+6:54 被接住。这些时间点之间的高度是近似值，时间轴也有快有慢，好让整次飞行在一分钟内播完。镜头跟着飞行器走，所以塔顶以上的画面高度不按比例；助推器的翻转画在画面所在的平面里。",
      label: "立在发射台上的星舰 V3，旁边是带两条接箭机械臂的发射塔。时间轴播放整次飞行：点火和水汽、起飞、穿过云层进入越来越暗的天空、热分离时级间段排气孔喷出火焰、飞船离开、助推器翻转进行返航点火、靠栅格舵落回、着陆点火，最后机械臂合拢把它接住。",
    },
    overview: {
      title: "一次飞行",
      text: "从点火到接住助推器大约七分钟；飞船则继续飞向轨道。选一个事件即可跳过去。",
      specs: [["助推器返回", "约 T+6:54"], ["分离", "约 70 公里高度"], ["飞船", "继续入轨"]],
    },
    events: {
      ignition: { short: "点火", title: "点火", text: "起飞前几秒，33 台猛禽依次快速点火，发射台上的夹具把火箭压住。发射台下的钢板向上喷水冲进尾焰，那团白雾就是这样来的。", specs: [["发动机", "33 台依次点火"], ["固定", "发射台上的夹具"]] },
      liftoff: { short: "起飞", title: "起飞", text: "夹具松开，火箭靠 33 台发动机超过 8,000 吨力的推力爬升，越过发射塔。", specs: [["发动机", "33 台"], ["推力", "约 8,250 吨力"]] },
      maxq: { short: "Max-Q", title: "最大动压（Max-Q）", text: "起飞约一分钟后，火箭在仍然稠密的空气里高速飞行，这是结构承受气动压力最大的时刻。之后空气迅速变稀薄。", specs: [["时间", "T+0:59"], ["高度", "约 12 公里"]] },
      meco: { short: "主机关机", title: "主发动机关机", text: "助推器的大部分发动机关机，中间 3 台继续工作，让整箭在分离时仍然有推力。", specs: [["时间", "T+2:34"], ["发动机", "33 → 3"]] },
      hotstage: { short: "热分离", title: "热分离", text: "飞船在仍与助推器相连时点燃自己的 6 台猛禽。尾焰从级间段的排气孔喷出（V3 把级间段留在助推器上），两级在约 70 公里高度分开。", specs: [["高度", "约 70 公里"], ["飞船", "6 台发动机点火"]] },
      boostback: { short: "返航点火", title: "翻转与返航点火", text: "助推器调头，重新点燃中间两圈的 13 台发动机，抵消飞离海岸方向的速度，转头飞回发射场。", specs: [["发动机", "13 台"], ["点火结束", "T+3:41"]] },
      descent: { short: "栅格舵", title: "靠栅格舵落回", text: "空的助推器发动机朝下穿过大气层落回，用三片栅格舵把自己引向发射塔。", specs: [["转向", "3 片栅格舵"], ["发动机", "关闭"]] },
      landing: { short: "着陆点火", title: "着陆点火", text: "接近地面时重新点燃 13 台发动机，再靠中间 3 台减速，降到发射塔旁。", specs: [["时间", "T+6:30"], ["发动机", "13 → 3"]] },
      catch: { short: "接住", title: "被发射塔接住", text: "发射塔上的两条机械臂（外号「筷子」）合拢，托住助推器的栅格舵把它接住，随后可以放回发射台。第 5 次飞行（2024 年 10 月）首次做到。", specs: [["时间", "T+6:54"], ["托住", "栅格舵"]] },
      orbit: { short: "飞船入轨", title: "飞船入轨", text: "在远处，飞船又工作了好几分钟，在起飞约八分半后于轨道上关机。第 14 次飞行中，它随后从载荷舱放出了 26 颗 Starlink V3 卫星。", specs: [["发动机", "6 → 0"], ["载荷", "如 26 颗 Starlink V3"]] },
    },
    say: { pad: "在发射台上", km: "公里" },
  },
};
