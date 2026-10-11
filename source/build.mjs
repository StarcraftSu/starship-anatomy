import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

const M = {
  stack: 124.4,
  booster: 72.3,
  ship: 52.1,
  radius: 4.5,
  boosterProp: 3650,
  shipProp: 1600,
  mixture: 3.6,
  raptorSea: 250,
  raptorVac: 275,
  ring: 1.83,
};
const lox = (total) => (total * M.mixture) / (1 + M.mixture);
const ch4 = (total) => total / (1 + M.mixture);
const t = (value) => Math.round(value / 10) * 10;
const fmt = (value) => Math.round(value).toLocaleString("en-US");

const U = 5;
const R = M.radius * U;
const ZC = 34;
const X0 = 64.2 * U;
const SHIP = M.booster;
const W = 980;
const AZIMUTH = 52;
const ELEVATION = 26;

const PIECES = [
  { id: "nose", name: "Payload bay and nose", s0: SHIP + 33, s1: M.stack, out: 21, cradles: [SHIP + 36] },
  { id: "sch4", name: "Ship methane tank", s0: SHIP + 20, s1: SHIP + 33, out: 14, cradles: [SHIP + 26.5] },
  { id: "slox", name: "Ship oxygen tank and six Raptors", s0: SHIP, s1: SHIP + 20, out: 7, cradles: [SHIP + 11, SHIP + 17.5] },
  { id: "bch4", name: "Booster methane tank, grid fins, interstage", s0: 41, s1: SHIP, out: -2, cradles: [47, 61] },
  { id: "blox", name: "Booster oxygen tank", s0: 6, s1: 41, out: -9, cradles: [11, 35] },
  { id: "beng", name: "33 Raptors and aft skirt", s0: 0, s1: 6, out: -16, cradles: [3] },
];
const BY = Object.fromEntries(PIECES.map((piece) => [piece.id, piece]));
const xOf = (s) => X0 - s * U;

const BASE = { x: -416, y: -44, w: 832, d: 88, r: 6 };
const BASE_H = 9;
const FOOT_H = 6;
const RAIL_Y = 21;
const RAIL_H = 3;
const CARRIAGE_TOP = 8;
const FIN_SPAN = 4.6;

const P = k.fitProjection(
  [
    ...k.boxCorners(BASE, -BASE_H - FOOT_H, 0),
    [xOf(M.stack + 21), 0, ZC + R],
    [xOf(-16), 0, ZC + R],
    [xOf(68 - 2), 0, ZC + R + (0.5 + FIN_SPAN) * U],
    [xOf(68 - 2), R + (0.5 + FIN_SPAN) * U, ZC],
  ],
  W,
  560,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);
const unitP = { origin: [0, 0], scale: P.scale, azimuth: AZIMUTH, elevation: ELEVATION };
const extent = (() => {
  const points = [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [xOf(68 - 2), 0, ZC + R + (0.5 + FIN_SPAN) * U], [xOf(M.stack + 21), 0, ZC + R], [xOf(-16), R, ZC - R]].map((p) => k.iso(p, unitP));
  const ys = points.map(([, y]) => y);
  return [Math.min(...ys), Math.max(...ys)];
})();
const H = Math.ceil(extent[1] - extent[0] + 60);
P.origin = [P.origin[0], 30 - extent[0]];

const V = G.viewOf(P);
const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dots = (points, style) => k.dotsSvg(points, style);
const VEH = G.frameOf([X0, 0, ZC], [-1, 0, 0], [0, 0, 1], [0, 1, 0]);
const on = (s, r, deg) => G.pointOf(VEH, s * U, r * U, deg * DEG);
const radial = (deg) => G.radialOf(VEH, deg * DEG);
const tangent = (deg) => G.tangentOf(VEH, deg * DEG);
const facing = (deg) => G.dot3(radial(deg), V);

function facets(rows, F, { inward = false, steps = 72, from = 0, to = TAU } = {}) {
  const buckets = [[], [], [], [], []];
  const fill = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const [s0, r0] = rows[i];
    const [s1, r1] = rows[i + 1];
    const ds = s1 - s0;
    const dr = r1 - r0;
    for (let j = 0; j < steps; j++) {
      const a0 = from + ((to - from) * j) / steps;
      const a1 = from + ((to - from) * (j + 1)) / steps;
      let n = G.unit3(G.sub3(G.mul3(G.radialOf(F, (a0 + a1) / 2), ds), G.mul3(F.a, dr)));
      if (inward) n = G.mul3(n, -1);
      if (G.dot3(n, V) <= 1e-6) continue;
      const quad = [G.pointOf(F, s0, r0, a0), G.pointOf(F, s0, r0, a1), G.pointOf(F, s1, r1, a1), G.pointOf(F, s1, r1, a0)].map(at);
      const d = k.pathOf(quad, true);
      fill.push(d);
      buckets[G.toneOf(n, P)].push(d);
    }
  }
  return { fill: fill.join(""), outline: "", crease: "", top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")), seamless: true };
}

function outlineOnSurface(points) {
  return k.pathOf(points.map(at), true);
}

function patchOn(s0, s1, r0, r1, a0, a1, n = 18) {
  const ring = [];
  for (let i = 0; i <= n; i++) ring.push(on(s0, r0, a0 + ((a1 - a0) * i) / n));
  for (let i = 0; i <= n; i++) ring.push(on(s1, r1, a1 - ((a1 - a0) * i) / n));
  return ring;
}

const NOSE_L = M.stack - (SHIP + 38.5);
const NOSE_BASE = SHIP + 38.5;
const noseR = (s) => {
  if (s <= NOSE_BASE) return M.radius;
  const x = Math.min(1, (s - NOSE_BASE) / NOSE_L);
  return M.radius * Math.pow(Math.max(0, 1 - Math.pow(x, 1.8)), 0.6);
};
const noseSlope = (s) => {
  if (s <= NOSE_BASE) return 0;
  const x = Math.min(0.9995, (s - NOSE_BASE) / NOSE_L);
  const inner = 1 - Math.pow(x, 1.8);
  return (M.radius * 0.6 * Math.pow(inner, -0.4) * -1.8 * Math.pow(x, 0.8)) / NOSE_L;
};

const layers = Object.fromEntries(PIECES.map((piece) => [piece.id, { back: [], hull: [], inside: [], jaws: [], front: [] }]));
const add = (id, layer, svg) => layers[id][layer].push(svg);

function hull(piece) {
  const nose = piece.id === "nose";
  const meridian = [];
  if (nose) {
    meridian.push([piece.s0 * U, R]);
    meridian.push([NOSE_BASE * U, R, 1]);
    for (let i = 1; i < 28; i++) {
      const s = NOSE_BASE + (NOSE_L * i) / 28;
      meridian.push([s * U, noseR(s) * U, 1]);
    }
    meridian.push([M.stack * U, 0]);
  } else {
    meridian.push([piece.s0 * U, R], [piece.s1 * U, R]);
  }
  const options = nose ? { rims: "first", smooth: { slope: (s) => noseSlope(s / U), radius: (s) => noseR(s / U) * U } } : { rims: "all" };
  return G.lathe(meridian, VEH, P, options);
}

function seamsOf(piece) {
  const lines = [];
  const top = piece.id === "nose" ? NOSE_BASE : piece.s1;
  for (let s = Math.ceil(piece.s0 / M.ring + 0.3) * M.ring; s < top - 0.4; s += M.ring) lines.push(G.arcOf(VEH, s * U, R, P));
  return lines.join("");
}

const TILE_FROM = -90;
const TILE_TO = 90;
function tilesOf(piece) {
  if (!["slox", "sch4", "nose"].includes(piece.id)) return "";
  const nose = piece.id === "nose";
  const rows = [];
  const top = nose ? M.stack - 0.6 : piece.s1;
  const n = nose ? 30 : 2;
  for (let i = 0; i <= n; i++) {
    const s = piece.s0 + ((top - piece.s0) * i) / n;
    rows.push([s * U, (nose ? noseR(s) : M.radius) * U]);
  }
  const shield = facets(rows, VEH, { from: TILE_FROM * DEG, to: TILE_TO * DEG, steps: 48 });
  const lines = [];
  const ticks = [];
  const pitch = 1.0;
  const across = 1.15 / M.radius / DEG;
  let row = 0;
  for (let s = piece.s0 + pitch; s < top - 0.2; s += pitch, row++) {
    const r = nose ? noseR(s) : M.radius;
    lines.push(G.arcOf(VEH, s * U, r * U, P, { from: TILE_FROM * DEG, to: TILE_TO * DEG, slope: nose ? noseSlope(s) : 0 }));
  }
  row = 0;
  for (let s = piece.s0; s < top - 0.2; s += pitch, row++) {
    const s1 = Math.min(s + pitch, top - 0.2);
    if (s1 - s < 0.3) continue;
    const r0 = nose ? noseR(s) : M.radius;
    const r1 = nose ? noseR(s1) : M.radius;
    const slope = nose ? noseSlope((s + s1) / 2) : 0;
    for (let deg = TILE_FROM + (row % 2 ? across / 2 : 0); deg < TILE_TO - 0.5; deg += across) {
      const n = G.unit3(G.sub3(radial(deg), G.mul3(VEH.a, slope)));
      const f = G.dot3(n, V);
      if (f < 0.03) continue;
      ticks.push([k.pathOf([at(on(s, r0, deg)), at(on(s1, r1, deg))]), G.fadeOf(f, [0.03, 0.3])]);
    }
  }
  const edge = [];
  for (let i = 0; i <= 40; i++) {
    const s = piece.s0 + ((top - piece.s0) * i) / 40;
    edge.push(at(on(s, nose ? noseR(s) : M.radius, TILE_TO)));
  }
  return `<g class="ss-tile">${S(shield, { tone: "lo", crease: "none" })}${Ln(lines.join(""), { tone: "faint" })}${k.fadedSvg(ticks, { tone: "faint" })}</g>${Ln(k.pathOf(edge), { tone: "lo" })}`;
}

function dish(rim, depth, { r = M.radius, rows = 14, steps = 72 } = {}) {
  const list = [];
  for (let i = 0; i <= rows; i++) {
    const u = (i / rows) * (Math.PI / 2);
    list.push([(rim + depth * Math.sin(u)) * U, r * Math.cos(u) * U]);
  }
  return facets(list, VEH, { inward: true, steps });
}

function wall(s0, s1, { r = M.radius } = {}) {
  return facets([[s0 * U, r * U], [s1 * U, r * U]], VEH, { inward: true, steps: 96 });
}

function backDisc(s, r = M.radius) {
  return facets([[s * U, r * U], [s * U, 0]], VEH, { inward: true, steps: 72 });
}

let clipCount = 0;
function clipped(id, layer, pathD, body) {
  const name = `ss-clip-${++clipCount}`;
  add(id, layer, `<clipPath id="${name}"><path d="${pathD}"/></clipPath><g clip-path="url(#${name})">${body}</g>`);
}

const cavity = (paths) => S(paths, { tone: "faint", crease: "none", className: "ss-cav" });

function bell(F, exitR, throatR, length) {
  const profile = [];
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * length;
    profile.push([-x, throatR + (exitR - throatR) * Math.pow(1 - x / length, 1.6), i > 0 && i < 10 ? 1 : 0]);
  }
  profile.reverse();
  const body = G.lathe([[-length, 0], ...profile.map(([s, r, smooth]) => (smooth ? [s, r, 1] : [s, r]))], F, P, { rims: "last" });
  const lip = 0.035 * U;
  return (
    S(body, { tone: "mid", crease: "none" }) +
    S(G.ringBand(-0.4, 0, exitR - lip, exitR, F, P), { tone: "hi", crease: "none" }) +
    `<path class="ss-void" d="${G.circleOf(F, 0, exitR - lip, P)}"/>` +
    Ln(G.arcOf(F, -0.3 * length, throatR + (exitR - throatR) * Math.pow(0.7, 1.6), P, { inward: true, least: -1 }), { tone: "lo", className: "ss-bell-in" }) +
    `<path class="ss-throat" d="${G.circleOf(F, -0.92 * length, throatR * 1.05, P)}"/>`
  );
}

function enginesOf(list, exitS) {
  const sorted = list
    .map((engine) => ({ ...engine, centre: on(exitS + (engine.inset ?? 0), engine.r, engine.deg) }))
    .sort((a, b) => G.dot3(a.centre, V) - G.dot3(b.centre, V));
  return sorted
    .map((engine) => {
      const F = G.frameAlong(engine.centre, [1, 0, 0]);
      return bell(F, engine.exit * U, engine.throat * U, engine.length * U);
    })
    .join("");
}

function aftOpening(piece, body) {
  const ring = [];
  for (let i = 0; i < 96; i++) ring.push(at(on(piece.s0, M.radius, (i / 96) * 360)));
  clipped(piece.id, "inside", k.pathOf(ring, true), body);
  add(piece.id, "inside", Ln(G.circleOf(VEH, piece.s0 * U, R, P), { tone: "hi" }));
}

function window(piece, s0, s1, a0, a1, body) {
  const ring = patchOn(s0, s1, M.radius, M.radius, a0, a1, 24);
  const d = outlineOnSurface(ring);
  clipped(piece.id, "inside", d, body);
  add(piece.id, "inside", Ln(d, { tone: "mid" }));
}

const BOOSTER_ENGINES = [
  ...[90, 210, 330].map((deg) => ({ deg, r: 0.95 })),
  ...Array.from({ length: 10 }, (_, i) => ({ deg: 18 + i * 36, r: 2.45 })),
  ...Array.from({ length: 20 }, (_, i) => ({ deg: i * 18, r: 3.85 })),
].map((engine) => ({ ...engine, exit: 0.6, throat: 0.22, length: 2.1, inset: 0.25 }));
const SHIP_ENGINES = [
  ...[0, 120, 240].map((deg) => ({ deg, r: 1.05, exit: 0.6, throat: 0.22, length: 1.9, inset: 1.3 })),
  ...[60, 180, 300].map((deg) => ({ deg, r: 3.0, exit: 1.15, throat: 0.24, length: 3.1, inset: 0.3 })),
];

for (const piece of PIECES) {
  const paths = hull(piece);
  const inner = Ln(seamsOf(piece), { tone: "faint" }) + tilesOf(piece);
  add(piece.id, "hull", S(paths, { tone: "hi", inner }));
}

const innerSeams = (s0, s1, r = M.radius) => {
  const lines = [];
  for (let s = Math.ceil(s0 / M.ring) * M.ring; s < s1; s += M.ring) lines.push(G.arcOf(VEH, s * U, r * U, P, { inward: true, least: -0.02 }));
  return Ln(lines.join(""), { tone: "lo", className: "ss-in" });
};

function dishLines(rim, depth, { rings = [], spokes = 0, phase = 0, hub = 0.25 } = {}) {
  const pointAt = (u, deg) => on(rim + depth * Math.sin(u), M.radius * Math.cos(u), deg);
  const seen = (u, deg) => -G.dot3(G.unit3(G.add3(G.mul3(radial(deg), depth * Math.cos(u)), G.mul3(VEH.a, M.radius * Math.sin(u)))), V);
  const runs = [];
  const push = (samples) => {
    let run = [];
    for (const [p, f] of samples) {
      if (f > 0.01) run.push(at(p));
      else {
        if (run.length > 1) runs.push(k.pathOf(run));
        run = [];
      }
    }
    if (run.length > 1) runs.push(k.pathOf(run));
  };
  for (const frac of rings) {
    const u = Math.acos(frac);
    push(Array.from({ length: 145 }, (_, i) => [pointAt(u, i * 2.5), seen(u, i * 2.5)]));
  }
  const top = Math.acos(hub);
  for (let j = 0; j < spokes; j++) {
    const deg = phase + (j * 360) / spokes;
    push(Array.from({ length: 25 }, (_, i) => [pointAt((top * i) / 24, deg), seen((top * i) / 24, deg)]));
  }
  return runs.join("");
}

function portOn(rim, depth, r, deg, size) {
  const u = Math.acos(r / M.radius);
  const centre = on(rim + depth * Math.sin(u), r, deg);
  const F = G.frameAlong(centre, [1, 0, 0]);
  return `<path class="ss-void" d="${G.circleOf(F, 0, size * U, P)}"/>` + Ln(G.circleOf(F, 0, (size + 0.12) * U, P), { tone: "lo", className: "ss-in" });
}

aftOpening(BY.beng, cavity(wall(0, 4.6)) + cavity(backDisc(4.6)) + S(G.disc(4.25 * U, 4.6 * U, 1.5 * U, G.frameOf(VEH.o, VEH.a, VEH.u, VEH.v), P), { tone: "lo", crease: "none" }) + enginesOf(BOOSTER_ENGINES, 0));
aftOpening(BY.blox, cavity(dish(6, 1.8)) + Ln(dishLines(6, 1.8, { rings: [0.25, 0.42, 0.57, 0.7, 0.81, 0.9, 0.96], spokes: 32, hub: 0.25 }), { tone: "lo", className: "ss-in" }) + S(G.ringBand(7.6 * U, 7.8 * U, 0.8 * U, 1.1 * U, VEH, P), { tone: "mid" }) + `<path class="ss-void" d="${G.circleOf(VEH, 7.6 * U, 0.8 * U, P)}"/>`);
aftOpening(BY.bch4, cavity(dish(41, 1.8)) + Ln(dishLines(41, 1.8, { rings: [0.25, 0.88], spokes: 12, hub: 0.25 }), { tone: "lo", className: "ss-in" }) + S(G.ringBand(42.6 * U, 42.8 * U, 0.8 * U, 1.1 * U, VEH, P), { tone: "mid" }) + `<path class="ss-void" d="${G.circleOf(VEH, 42.6 * U, 0.8 * U, P)}"/>`);
aftOpening(BY.slox, cavity(wall(SHIP, SHIP + 3.4)) + cavity(backDisc(SHIP + 3.4)) + enginesOf(SHIP_ENGINES, SHIP));
aftOpening(BY.sch4, cavity(dish(SHIP + 20, 1.8)) + Ln(dishLines(SHIP + 20, 1.8, { rings: [0.2, 0.88], spokes: 12, phase: 30, hub: 0.2 }), { tone: "lo", className: "ss-in" }) + [60, 180, 300].map((deg) => portOn(SHIP + 20, 1.8, 2.7, deg, 0.28)).join("") + S(G.ringBand((SHIP + 21.6) * U, (SHIP + 21.8) * U, 0.45 * U, 0.65 * U, VEH, P), { tone: "mid" }) + `<path class="ss-void" d="${G.circleOf(VEH, (SHIP + 21.6) * U, 0.45 * U, P)}"/>`);
{
  const rows = [[(SHIP + 33) * U, R], [NOSE_BASE * U, R]];
  for (let i = 1; i <= 24; i++) {
    const s = NOSE_BASE + ((M.stack - 0.4 - NOSE_BASE) * i) / 24;
    rows.push([s * U, noseR(s) * U]);
  }
  aftOpening(BY.nose, cavity(facets(rows, VEH, { inward: true, steps: 96 })) + innerSeams(SHIP + 33.2, NOSE_BASE));
}

const tubeRings = (F, s0, s1, r, every) => {
  const lines = [];
  for (let s = s0 + every; s < s1 - 0.2; s += every) lines.push(G.arcOf(F, s * U, r * U, P));
  return lines.join("");
};
window(
  BY.blox,
  10,
  36,
  6,
  108,
  cavity(wall(6, 41)) +
    innerSeams(6, 41) +
    S(G.disc(7.8 * U, 42.8 * U, 0.8 * U, VEH, P), { tone: "hi", lit: true, inner: Ln(tubeRings(VEH, 7.8, 42.8, 0.8, M.ring * 2), { tone: "faint" }) }),
);
const DOWNCOMERS = [{ r: 0, size: 0.45 }, ...[60, 180, 300].map((deg) => ({ r: 2.7, deg, size: 0.28 }))];
window(
  BY.slox,
  SHIP + 6.5,
  SHIP + 16.5,
  14,
  86,
  cavity(wall(SHIP + 3.5, SHIP + 20)) +
    innerSeams(SHIP + 3.5, SHIP + 20) +
    cavity(dish(SHIP + 20, 1.8)) +
    DOWNCOMERS.map((pipe) => ({ ...pipe, centre: pipe.r ? on(SHIP + 10, pipe.r, pipe.deg) : on(SHIP + 10, 0, 0) }))
      .sort((a, b) => G.dot3(a.centre, V) - G.dot3(b.centre, V))
      .map((pipe) => {
        const lift = pipe.r ? 1.8 * Math.sqrt(1 - (pipe.r / M.radius) ** 2) : 1.8;
        const F = G.frameOf(pipe.r ? on(0, pipe.r, pipe.deg) : VEH.o, VEH.a, VEH.u, VEH.v);
        return S(G.disc((SHIP + 3.5 + lift) * U, (SHIP + 20 + lift) * U, pipe.size * U, F, P), { tone: pipe.r ? "mid" : "hi" });
      })
      .join(""),
);

function noseWindow(s0, s1, a0, a1, body) {
  const ring = [];
  const n = 24;
  for (let i = 0; i <= n; i++) ring.push(on(s0, noseR(s0), a0 + ((a1 - a0) * i) / n));
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n;
    ring.push(on(s, noseR(s), a1));
  }
  for (let i = 0; i <= n; i++) ring.push(on(s1, noseR(s1), a1 - ((a1 - a0) * i) / n));
  for (let i = 0; i <= n; i++) {
    const s = s1 - ((s1 - s0) * i) / n;
    ring.push(on(s, noseR(s), a0));
  }
  const d = outlineOnSurface(ring);
  clipped("nose", "inside", d, body);
  add("nose", "inside", Ln(d, { tone: "mid" }));
}

function capsule(s0, s1, r) {
  const meridian = [[s0 * U, 0]];
  for (let i = 1; i <= 8; i++) {
    const u = (i / 8) * (Math.PI / 2);
    meridian.push([(s0 + r - r * Math.cos(u)) * U, r * Math.sin(u) * U, 1]);
  }
  for (let i = 0; i < 8; i++) {
    const u = (i / 8) * (Math.PI / 2);
    meridian.push([(s1 - r + r * Math.sin(u)) * U, r * Math.cos(u) * U, 1]);
  }
  meridian.push([s1 * U, 0]);
  return G.lathe(meridian, VEH, P);
}

function strutOf(s, r0, r1, deg, size = 0.1) {
  const F = G.frameAlong(on(s, 0, deg), radial(deg));
  return { depth: G.dot3(on(s, (r0 + r1) / 2, deg), V), svg: S(G.disc(r0 * U, r1 * U, size * U, F, P), { tone: "mid", crease: "none" }) };
}

{
  const noseRows = [[(SHIP + 33) * U, R]];
  for (let i = 0; i <= 30; i++) {
    const s = NOSE_BASE + ((M.stack - 0.4 - NOSE_BASE) * i) / 30;
    noseRows.push([s * U, noseR(s) * U]);
  }
  const CH4_HEADER = [SHIP + 43.6, SHIP + 46.9, 1.35];
  const LOX_HEADER = [SHIP + 48.2, SHIP + 50.2, 1.0];
  const parts = [];
  for (const deg of [20, 140, 260]) {
    const sAt = (CH4_HEADER[0] + CH4_HEADER[1]) / 2;
    parts.push(strutOf(sAt, CH4_HEADER[2] - 0.05, noseR(sAt) - 0.02, deg));
  }
  for (const deg of [80, 200, 320]) {
    const sAt = (LOX_HEADER[0] + LOX_HEADER[1]) / 2;
    parts.push(strutOf(sAt, LOX_HEADER[2] - 0.05, noseR(sAt) - 0.02, deg, 0.08));
  }
  parts.push({ depth: G.dot3(on((CH4_HEADER[0] + CH4_HEADER[1]) / 2, 0, 0), V), svg: S(capsule(...CH4_HEADER), { tone: "hi" }) });
  parts.push({ depth: G.dot3(on((LOX_HEADER[0] + LOX_HEADER[1]) / 2, 0, 0), V), svg: S(capsule(...LOX_HEADER), { tone: "hi" }) });
  parts.sort((a, b) => a.depth - b.depth);
  noseWindow(SHIP + 41.2, SHIP + 50.6, 8, 98, cavity(facets(noseRows, VEH, { inward: true, steps: 72 })) + parts.map((part) => part.svg).join(""));
}

function clampsOf(s0, s1, deg, every, { width = 0.35, height = 0.35 } = {}) {
  const F = G.frameOf(on(0, 0, 0), VEH.a, radial(deg), tangent(deg));
  const list = [];
  for (let s = s0 + every / 2; s < s1 - 0.3; s += every) list.push(prism(F, [[R - 0.05 * U, -width * 1.4 * U], [R + (height + 0.12) * U, -width * 1.15 * U], [R + (height + 0.12) * U, width * 1.15 * U], [R - 0.05 * U, width * 1.4 * U]], s * U, (s + 0.32) * U, { tone: "mid" }));
  return list.join("");
}

function prism(F, polygon, s0, s1, style) {
  return S(G.prismOf(F, polygon, s0, s1, P), style);
}

function prismRaw(F, polygon, s0, s1, style) {
  return S(G.prismOf(F, polygon, s0, s1, P), style);
}

function finOf(s, deg) {
  const F = G.frameOf(on(s, 0, 0), VEH.a, radial(deg), tangent(deg));
  const r0 = R + 0.5 * U;
  const r1 = r0 + FIN_SPAN * U;
  const w = 1.7 * U;
  const depth = 0.8 * U;
  const housing = prism(F, [[R - 0.1 * U, -1.2 * U], [r0, -1.0 * U], [r0, 1.0 * U], [R - 0.1 * U, 1.2 * U]], -0.6 * U, 1.4 * U, { tone: "mid" });
  const plate = G.prismOf(F, [[r0, -w], [r1, -w], [r1, w], [r0, w]], 0, depth, P);
  const inset = 0.16 * U;
  const u0 = r0 + inset;
  const u1 = r1 - inset;
  const v0 = -w + inset;
  const v1 = w - inset;
  const cell = 0.5 * U;
  const point = (u, v) => G.add3(G.add3(F.o, G.mul3(F.u, u)), G.mul3(F.v, v));
  const clip = (p, d) => {
    let lo = -Infinity;
    let hi = Infinity;
    for (const [pi, di, a, b] of [[p[0], d[0], u0, u1], [p[1], d[1], v0, v1]]) {
      let ta = (a - pi) / di;
      let tb = (b - pi) / di;
      if (ta > tb) [ta, tb] = [tb, ta];
      lo = Math.max(lo, ta);
      hi = Math.min(hi, tb);
    }
    return hi - lo > 1e-3 ? [[p[0] + d[0] * lo, p[1] + d[1] * lo], [p[0] + d[0] * hi, p[1] + d[1] * hi]] : null;
  };
  const lattice = [];
  const centre = [(u0 + u1) / 2, (v0 + v1) / 2];
  const reach = (u1 - u0 + v1 - v0) / 2;
  for (const d of [[Math.SQRT1_2, Math.SQRT1_2], [Math.SQRT1_2, -Math.SQRT1_2]]) {
    const n = [d[1], -d[0]];
    for (let c = -Math.floor(reach / cell) * cell; c <= reach; c += cell) {
      const seg = clip([centre[0] + n[0] * c, centre[1] + n[1] * c], d);
      if (seg) lattice.push(k.pathOf(seg.map(([u, v]) => at(point(u, v)))));
    }
  }
  const frame = k.pathOf([point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)].map(at), true);
  return { housing, fin: S(plate, { tone: "hi", inner: Ln(lattice.join(""), { tone: "lo" }) + Ln(frame, { tone: "mid" }) }) };
}

function flapOf(base, deg, polygon, half = 0.25) {
  const F = G.frameOf(G.add3(on(base, 0, 0), G.mul3(tangent(deg), -half * U)), tangent(deg), VEH.a, radial(deg));
  const poly = polygon.map(([s, r]) => [(s - base) * U, r * U]);
  const face = G.dot3(F.a, V) > 0 ? half * 2 * U : 0;
  const point = ([x, y]) => at(G.add3(G.add3(G.add3(F.o, G.mul3(F.a, face)), G.mul3(F.u, x)), G.mul3(F.v, y)));
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const ribs = [0.22, 0.44, 0.66, 0.84].map((f) => k.pathOf([point(mix(poly[0], poly[1], f)), point(mix(poly[3], poly[2], f))])).join("");
  const spar = k.pathOf([point(mix(poly[0], poly[3], 0.12)), point(mix(poly[1], poly[2], 0.12))]);
  return prism(F, poly, 0, half * 2 * U, { tone: "hi", inner: Ln(ribs, { tone: "faint" }) + Ln(spar, { tone: "lo" }) });
}

function hingeOf(s0, s1, r, deg, size = 0.22) {
  const F = G.frameOf(on(0, r, deg), VEH.a, VEH.u, VEH.v);
  return S(G.disc(s0 * U, s1 * U, size * U, F, P), { tone: "mid", crease: "none" });
}

function stripOf(s0, s1, deg, { width = 0.35, height = 0.35, tone = "mid" } = {}) {
  const F = G.frameOf(on(0, 0, 0), VEH.a, radial(deg), tangent(deg));
  return prism(F, [[R - 0.05 * U, -width * U], [R + height * U, -width * 0.8 * U], [R + height * U, width * 0.8 * U], [R - 0.05 * U, width * U]], s0 * U, s1 * U, { tone });
}

for (const deg of [-90, 0, 90]) {
  const fin = finOf(66.8, deg);
  const layer = facing(deg) > 0.05 || deg === 0 ? "front" : "back";
  add("bch4", layer, fin.housing + fin.fin);
}
const vents = [];
for (let deg = -60; deg <= 180; deg += 9) {
  const f = facing(deg);
  if (f < 0.04) continue;
  const alpha = G.fadeOf(f, [0.04, 0.4]);
  const slot = outlineOnSurface(patchOn(70.0, 71.7, M.radius, M.radius, deg - 1.7, deg + 1.7, 4));
  vents.push(`<g opacity="${alpha.toFixed(2)}"><path class="ss-void" d="${slot}"/>${Ln(slot, { tone: "lo" })}</g>`);
}
add("bch4", "front", vents.join(""));
add("bch4", "front", Ln(G.arcOf(VEH, 69.6 * U, R, P), { tone: "lo" }));
add("blox", "front", stripOf(6.4, 40.6, 125) + clampsOf(6.4, 40.6, 125, M.ring * 2));
add("bch4", "front", stripOf(41.4, 64.4, 125) + clampsOf(41.4, 64.4, 125, M.ring * 2));
add("beng", "front", stripOf(1.0, 5.6, 125) + clampsOf(1.0, 5.6, 125, 2.3));
add("beng", "front", (() => {
  const F = G.frameOf(on(0, 0, 0), VEH.a, radial(78), tangent(78));
  const plate = prism(F, [[R - 0.05 * U, -1.0 * U], [R + 0.3 * U, -1.0 * U], [R + 0.3 * U, 1.0 * U], [R - 0.05 * U, 1.0 * U]], 1.2 * U, 4.4 * U, { tone: "mid" });
  const bolts = [];
  for (const s of [1.5, 4.1]) for (const v of [-0.75, 0.75]) bolts.push(at(G.add3(G.add3(on(s, 0, 0), G.mul3(radial(78), R + 0.3 * U)), G.mul3(tangent(78), v * U))));
  return plate + Dots(bolts, { size: 0.55, tone: "mid" });
})());

const AFT_FLAP = [[SHIP + 0.6, M.radius + 0.3], [SHIP + 9.6, M.radius + 0.3], [SHIP + 6.8, M.radius + 4.2], [SHIP + 0.6, M.radius + 4.2]];
add("slox", "back", flapOf(SHIP, -90, AFT_FLAP, 0.3) + hingeOf(SHIP + 0.6, SHIP + 9.6, M.radius + 0.3, -90, 0.3));
add("slox", "front", hingeOf(SHIP + 0.6, SHIP + 9.6, M.radius + 0.3, 90, 0.3) + flapOf(SHIP, 90, AFT_FLAP, 0.3));
const fwd = (s, out) => [s, noseR(s) + out];
const FWD_FLAP = [fwd(SHIP + 40.6, 0.2), fwd(SHIP + 46.4, 0.2), [SHIP + 45.2, noseR(SHIP + 46.4) + 2.7], [SHIP + 41.6, noseR(SHIP + 40.6) + 2.7]];
add("nose", "back", flapOf(SHIP + 40, 250, FWD_FLAP, 0.2));
add("nose", "front", flapOf(SHIP + 40, 110, FWD_FLAP, 0.2));
add("slox", "front", stripOf(SHIP + 0.4, SHIP + 19.6, 140, { width: 0.3, height: 0.3 }) + clampsOf(SHIP + 0.4, SHIP + 19.6, 140, M.ring * 2, { width: 0.3, height: 0.3 }));
add("sch4", "front", stripOf(SHIP + 20.4, SHIP + 32.6, 140, { width: 0.3, height: 0.3 }) + clampsOf(SHIP + 20.4, SHIP + 32.6, 140, M.ring * 2, { width: 0.3, height: 0.3 }));
add("nose", "front", stripOf(SHIP + 33.4, SHIP + 38.2, 140, { width: 0.3, height: 0.3 }));
{
  const door = outlineOnSurface(patchOn(SHIP + 34.2, SHIP + 37.6, M.radius, M.radius, 112, 128, 8));
  const inner = outlineOnSurface(patchOn(SHIP + 34.5, SHIP + 37.3, M.radius, M.radius, 113.2, 126.8, 8));
  add("nose", "front", `<path class="ss-door" d="${door}"/>` + Ln(door, { tone: "mid" }) + Ln(inner, { tone: "faint" }));
}

function cradle(id, s) {
  const x = xOf(s);
  const half = 7.5;
  const carriage = { x: x - half, y: -27, w: half * 2, d: 54, r: 1.5 };
  const back = [];
  const front = [];
  for (const y of [-RAIL_Y, RAIL_Y]) {
    const block = S(k.slabOf({ x: x - half - 1.2, y: y - 3.2, w: half * 2 + 2.4, d: 6.4, r: 1 }, RAIL_H, 2.4, P, 3, 0.4), { tone: "lo" });
    (y < 0 ? back : back).push(block);
  }
  back.push(S(k.slabOf(carriage, RAIL_H + 2.4, CARRIAGE_TOP - RAIL_H - 2.4, P, 3, 0.6), { tone: "mid", inner: Ln(k.sideSeam(carriage, RAIL_H + 2.4 + 1.2, P, 3), { tone: "faint" }) }));
  back.push(Dots(k.corners(carriage, 2.4).map(([px, py]) => at([px, py, CARRIAGE_TOP])), { size: 0.5, tone: "mid" }));
  const phi = 40 * DEG;
  const C = [R * Math.sin(phi), ZC - R * Math.cos(phi)];
  const T = [Math.cos(phi), Math.sin(phi)];
  const jaw = (sign) => {
    const poly = [
      [sign * 9, CARRIAGE_TOP],
      [sign * 21, CARRIAGE_TOP],
      [sign * (C[0] + 2.6 * T[0]), C[1] + 2.6 * T[1]],
      [sign * (C[0] - 2.6 * T[0]), C[1] - 2.6 * T[1]],
    ];
    const F = G.frameOf([x - 4.5, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    return S(G.prismOf(F, poly, 0, 9, P), { tone: "mid" });
  };
  back.push(jaw(-1));
  front.push(jaw(1));
  add(id, "back", back.join(""));
  add(id, "jaws", front.join(""));
}
for (const piece of PIECES) for (const s of piece.cradles) cradle(piece.id, s);

const stand = [];
stand.push(`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, 12, P)}"/>`);
const feet = [];
for (const fx of [-0.94, -0.47, 0, 0.47, 0.94]) for (const fy of [-1, 1]) feet.push([BASE.x + BASE.w / 2 + (fx * BASE.w) / 2, fy * (BASE.d / 2 - 8)]);
feet.sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
for (const [fx, fy] of feet) {
  stand.push(S(k.cylinder(fx, fy, 6.5, -BASE_H - FOOT_H, 1.4, P, 28), { tone: "lo" }));
  stand.push(S(k.cylinder(fx, fy, 4.8, -BASE_H - FOOT_H + 1.4, FOOT_H - 1.4, P, 28), { tone: "mid", crease: "none" }));
}
stand.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.4), { tone: "mid", inner: Ln(k.sideSeam(BASE, -BASE_H / 2, P, 8), { tone: "faint" }) }));
stand.push(Ln(k.planOutline(k.insetPlan(BASE, 4.5), 0, P), { tone: "faint" }));
stand.push(Dots(k.corners(BASE, 9).map(([px, py]) => at([px, py, 0])), { size: 0.55, tone: "mid" }));
for (const [px, py] of k.corners(BASE, 9)) stand.push(Ln(k.ring(px, py, 2, 0, P, 16), { tone: "lo" }));
for (const y of [-RAIL_Y, RAIL_Y]) {
  const rail = { x: BASE.x + 14, y: y - 2, w: BASE.w - 28, d: 4, r: 1 };
  stand.push(S(k.slabOf(rail, 0, RAIL_H, P, 3, 0.4), { tone: "mid" }));
  const bolts = [];
  for (let bx = rail.x + 12; bx < rail.x + rail.w - 6; bx += 25) bolts.push(at([bx, y, RAIL_H]));
  stand.push(Dots(bolts, { size: 0.45, tone: "lo" }));
  for (const ex of [BASE.x + 9, BASE.x + BASE.w - 15]) {
    const stop = { x: ex, y: y - 4.5, w: 6, d: 9, r: 1.2 };
    stand.push(S(k.slabOf(stop, 0, 6, P, 3, 0.5), { tone: "mid" }));
    stand.push(Dots([at([ex + 3, y - 2, 6]), at([ex + 3, y + 2, 6])], { size: 0.45, tone: "mid" }));
  }
}
const STRIP = { x: xOf(130), y: 31, w: xOf(-4) - xOf(130), d: 7, r: 1 };
stand.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
const minor = [];
const major = [];
const zero = [];
for (let s = -4; s <= 130; s += 2) {
  const x = xOf(s);
  const big = s % 10 === 0;
  (s === 0 ? zero : big ? major : minor).push(k.lineOnTop([x, STRIP.y + 0.8], [x, STRIP.y + 0.8 + (big ? 3.6 : 2)], 0.6, P));
}
zero.push(k.lineOnTop([xOf(M.stack), STRIP.y + 0.8], [xOf(M.stack), STRIP.y + 0.8 + 4.4], 0.6, P));
stand.push(Ln(minor.join(""), { tone: "lo" }) + Ln(major.join(""), { tone: "mid" }) + Ln(zero.join(""), { tone: "hi" }));
const PLATE = { x: xOf(-4) + 5, y: 26, w: 32, d: 14, r: 1.5 };
stand.push(S(k.slabOf(PLATE, 0, 0.8, P, 4), { tone: "lo" }));
stand.push(Ln(k.planOutline(k.insetPlan(PLATE, 1.6), 0.8, P), { tone: "faint" }));
for (const [index, length] of [[0, 22], [1, 16], [2, 19]]) stand.push(Ln(k.lineOnTop([PLATE.x + 5, PLATE.y + 5 + index * 3], [PLATE.x + 5 + length, PLATE.y + 5 + index * 3], 0.8, P), { tone: "lo", free: true }));
stand.push(Dots([at([PLATE.x + 2.6, PLATE.y + PLATE.d / 2, 0.8]), at([PLATE.x + PLATE.w - 2.6, PLATE.y + PLATE.d / 2, 0.8])], { size: 0.5, tone: "mid" }));

const moveOf = (piece) => [-piece.out * U, 0, 0];
const groups = PIECES.map((piece) => {
  const L = layers[piece.id];
  const [mx, my, mz] = moveOf(piece);
  return `<g class="it" data-piece="${piece.id}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}">${L.back.join("")}${L.hull.join("")}${L.inside.join("")}${L.jaws.join("")}${L.front.join("")}</g>`;
});

const bLox = lox(M.boosterProp);
const bCh4 = ch4(M.boosterProp);
const sLox = lox(M.shipProp);
const sCh4 = ch4(M.shipProp);
const SAY = {
  beng: `33 Raptor 3 · 13 gimbal, 20 fixed · ${fmt(33 * M.raptorSea)} tf`,
  blox: `booster LOX tank · ≈${fmt(t(bLox))} t · methane tube runs through`,
  bch4: `booster methane · ≈${fmt(t(bCh4))} t · 3 grid fins · vented interstage`,
  slox: `ship · 3 × ${M.raptorSea} tf sea level + 3 × ${M.raptorVac} tf vacuum`,
  sch4: `ship methane tank · ≈${fmt(t(sCh4))} t`,
  nose: `payload bay · pez door · landing header tanks`,
};
const IDLE = `${M.stack} m · 39 Raptor 3 · ${fmt(M.boosterProp + M.shipProp)} t propellant`;

const LABEL =
  "SpaceX Starship V3 drawn as a full stack lying on a stacking jig: a long base plate with two rails, a metre ruler and cradles that carry six sections. From the engine end: the booster's aft skirt with 33 Raptor engines, its oxygen tank cut open to show the methane transfer tube, its methane tank with three grid fins and a vented interstage, then the ship's oxygen tank with six Raptors and two aft flaps, its methane tank, and the payload bay and nose with two forward flaps. The heat-shield tiles cover the ship's windward half.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g class="ss-stand">${stand.join("")}</g>`, `<g class="ss-stack">${groups.join("")}</g>`] });
const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const ORDER = ["beng", "blox", "bch4", "slox", "sch4", "nose"];
const DATA = {
  EX: unit([1, 0, 0]),
  pieces: Object.fromEntries(PIECES.map((piece) => [piece.id, { name: piece.name, say: SAY[piece.id] }])),
  order: ORDER,
  stagger: ["beng", "nose", "blox", "sch4", "bch4", "slox"],
  spring: { stagger: 0.06, stiffness: 42, damping: 12.5, substeps: 4 },
  idle: IDLE,
};
const PARTS = ORDER.map((id, index) => `<button type="button" class="ss-part" data-part="${id}"><span class="ss-num">${String(index + 1).padStart(2, "0")}</span>${BY[id].name}</button>`).join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Starship V3 · full stack</span><span class="iso-plate-corner" data-corner="hint" data-hint>Hover to take it apart</span><span class="iso-plate-corner" data-corner="readout" data-readout>${IDLE}</span></div>`;
const stage = `<div class="ss-stage" tabindex="0" role="slider" aria-label="Starship V3 on a stacking jig. Hover or use the arrow keys to take it apart section by section; Escape puts it back together." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Assembled">${svg}</div>`;
const caption = `Starship V3 stands ${M.stack} m tall: a ${M.booster} m Super Heavy booster under a ${M.ship} m ship, both 9 m across and built from stainless-steel rings ${M.ring} m tall. In each stage the methane tank sits above the oxygen tank, so methane reaches the engines through a tube down the middle of the oxygen tank (cut open here; the ship has one central downcomer and one for each vacuum engine). The booster's inner 13 Raptors gimbal and its outer 20 are fixed; V3 boosters carry three larger grid fins and keep their vented interstage. The ship lies belly up so its heat-shield tiles and flaps show, and the window in its nose shows the landing header tanks, which have sat there since Ship 24. Numbers follow SpaceX's May 2026 figures as listed on Wikipedia: Raptor 3 at ${M.raptorSea} tf (${M.raptorVac} tf vacuum), ${fmt(M.boosterProp)} t of propellant in the booster and about ${fmt(M.shipProp)} t in the ship, split here at Raptor's ${M.mixture}:1 oxygen-to-methane ratio. Drawn lying on cradles so the whole stack fits; proportions inside the tanks are approximate.`;
const body = `<figure class="iso-figure ss"><div class="iso-plate">${corners}${stage}</div><figcaption class="iso-legend"><span class="ss-parts">${PARTS}</span><span class="iso-caption">${caption}</span></figcaption></figure><span class="ss-live" aria-live="polite" data-live></span>`;

const CSS = readFileSync(join(HERE, "starship.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Starship V3", theme: THEME, body: `<style>${CSS}</style>${body}`, script: LIVE, width: 1020 });
const name = THEME === "light" ? "starship-light.html" : "starship.html";
writeFileSync(join(HERE, "..", name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${W}×${H}`);
