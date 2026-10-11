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

const BASE = { x: -416, y: -44, w: 866, d: 88, r: 6 };
const PULL = { beng: 5.5, slox: 5.5 };
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
    [xOf(-23), 0, ZC + R],
    [xOf(68 - 2), 0, ZC + R + (0.5 + FIN_SPAN) * U],
    [xOf(68 - 2), R + (0.5 + FIN_SPAN) * U, ZC],
  ],
  W,
  560,
  { pad: 30, azimuth: AZIMUTH, elevation: ELEVATION },
);
const unitP = { origin: [0, 0], scale: P.scale, azimuth: AZIMUTH, elevation: ELEVATION };
const extent = (() => {
  const points = [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [xOf(68 - 2), 0, ZC + R + (0.5 + FIN_SPAN) * U], [xOf(M.stack + 21), 0, ZC + R], [xOf(-23), R, ZC - R]].map((p) => k.iso(p, unitP));
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

const layers = Object.fromEntries(PIECES.map((piece) => [piece.id, { back: [], hull: [], inside: [], engines: [], jaws: [], front: [] }]));
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

const cavity = (paths, kind = "") => S(paths, { tone: "faint", crease: "none", className: kind ? `ss-cav ss-cav-${kind}` : "ss-cav" });

const RAPTOR = { exit: 0.6, bell: 1.65, throat: 0.19, chamber: 0.3, chamberLen: 0.5, converge: 0.2, head: 0.34, headLen: 0.38, pump: 0.25, pumpOff: 0.43, puck: 0.26, puckLen: 0.3 };
const RVAC = { ...RAPTOR, exit: 1.15, bell: 2.6, regen: 1.15 };
const lengthOf = (spec) => spec.bell + spec.converge + spec.chamberLen + spec.headLen + spec.puckLen;
const bellR = (spec, s) => {
  const x = Math.min(1, Math.max(0, (s + spec.bell) / spec.bell));
  return spec.throat + (spec.exit - spec.throat) * (1 - (1 - x) * (1 - x));
};

function engineParts(origin, dir, spec, { P: Q = P, unit = U, pumpDir = [0, 0, 1], detail = false } = {}) {
  const VQ = G.viewOf(Q);
  const atQ = (p) => k.iso(p, Q);
  const E = G.frameAlong(origin, dir);
  const L = lengthOf(spec);
  const sT = -spec.bell;
  const sC1 = sT - spec.converge;
  const sC0 = sC1 - spec.chamberLen;
  const sH0 = sC0 - spec.headLen;
  const sP0 = sH0 - spec.puckLen;
  const u = (m) => m * unit;
  const parts = [];
  const put = (centreS, offset, svg) => parts.push({ depth: G.dot3(G.add3(G.pointOf(E, u(centreS), 0, 0), offset), VQ), svg });
  const solid = (paths, style) => k.solidSvg(paths, style);
  const lite = detail ? {} : { steps: 20, smooth: false };
  const liteSteps = detail ? {} : { steps: 20 };
  put(sP0 + spec.puckLen / 2, [0, 0, 0], solid(G.disc(u(sP0), u(sH0), u(spec.puck), E, Q, liteSteps), { tone: "hi", className: "ss-gunmetal" }));
  put(sH0 + spec.headLen / 2, [0, 0, 0], solid(G.disc(u(sH0), u(sC0), u(spec.head), E, Q, liteSteps), { tone: "hi", className: "ss-gunmetal", inner: detail ? k.lineSvg(G.arcOf(E, u(sH0 + spec.headLen * 0.55), u(spec.head), Q), { tone: "faint" }) : "" }));
  const pumpAngle = G.angleToward(E, pumpDir);
  for (const [index, angle] of [pumpAngle, pumpAngle + Math.PI].entries()) {
    const offset = G.mul3(G.radialOf(E, angle), u(spec.pumpOff));
    const F = G.frameOf(G.add3(origin, offset), E.a, E.u, E.v);
    const r = u(spec.pump * (index ? 0.9 : 1));
    const p0 = u(sP0 + 0.04);
    const p1 = u(sC0 + 0.22);
    const meridian = [[p0, 0], [p0, r * 0.55], [p0 + r * 0.45, r, 1], [p1 - r * 0.45, r, 1], [p1, r * 0.55], [p1, 0]];
    const flange = detail ? solid(G.ringBand(p1 - r * 0.9, p1 - r * 0.45, r * 0.8, r * 1.22, F, Q), { tone: "hi", className: "ss-gunmetal" }) + solid(G.ringBand(p0 + r * 0.6, p0 + r * 0.75, r * 0.9, r * 1.06, F, Q), { tone: "hi", className: "ss-gunmetal" }) : "";
    put((sP0 + sC0) / 2, offset, solid(G.lathe(meridian, F, Q, lite), { tone: "hi", className: "ss-gunmetal" }) + flange);
  }
  const body = [[u(sC0), 0], [u(sC0), u(spec.chamber)], [u(sC1 - 0.05), u(spec.chamber), 1]];
  const convergeSteps = detail ? 6 : 3;
  for (let i = 1; i < convergeSteps; i++) {
    const f = i / convergeSteps;
    body.push([u(sC1 + spec.converge * f), u(spec.chamber + (spec.throat - spec.chamber) * (0.5 - 0.5 * Math.cos(Math.PI * f))), 1]);
  }
  const split = spec.regen ? sT + spec.regen : 0;
  const bellPoints = (from, to, n) => Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  for (const s of bellPoints(sT, split, detail ? 12 : 5)) body.push([u(s), u(bellR(spec, s)), s > sT && s < split ? 1 : 0]);
  const regenLines = [];
  if (detail) for (const s of [sT + 0.35, sT + 0.8, sT + 1.3]) if (s < split - 0.1) regenLines.push(G.arcOf(E, u(s), u(bellR(spec, s)), Q, { slope: (bellR(spec, s + 0.01) - bellR(spec, s - 0.01)) / 0.02 }));
  const chamberRings = detail ? [sC0 + 0.12, sC1 - 0.12].map((s) => G.arcOf(E, u(s), u(spec.chamber), Q)).join("") : "";
  const channels = [];
  if (detail) {
    const count = 56;
    for (let j = 0; j < count; j++) {
      const angle = (j / count) * TAU;
      const run = [];
      let facing = 0;
      for (let i = 0; i <= 16; i++) {
        const sAt = sT + 0.35 + ((split - (sT + 0.35)) * i) / 16;
        const slope = (bellR(spec, sAt + 0.01) - bellR(spec, sAt - 0.01)) / 0.02;
        const normal = G.unit3(G.sub3(G.radialOf(E, angle), G.mul3(E.a, slope)));
        facing += G.dot3(normal, VQ) / 17;
        run.push(atQ(G.pointOf(E, u(sAt), u(bellR(spec, sAt)) + 0.02, angle)));
      }
      if (facing > 0.05) channels.push([k.pathOf(run), G.fadeOf(facing, [0.05, 0.5]) * 0.8]);
    }
  }
  put((sC0 + split) / 2, [0, 0, 0], solid(G.lathe(body, E, Q, { rims: spec.regen ? "none" : "last", ...lite }), { tone: "hi", className: "ss-bronze", inner: k.fadedSvg(channels, { tone: "faint" }) + k.lineSvg(regenLines.join("") + chamberRings, { tone: "lo" }) }));
  if (spec.regen) {
    const ext = bellPoints(split, 0, detail ? 14 : 5).map((s, i, list) => [u(s), u(bellR(spec, s)), i > 0 && i < list.length - 1 ? 1 : 0]);
    const extLines = detail ? [split + 0.5, split + 1.0].map((s) => G.arcOf(E, u(s), u(bellR(spec, s)), Q, { slope: (bellR(spec, s + 0.01) - bellR(spec, s - 0.01)) / 0.02 })).join("") : "";
    put(split / 2, [0, 0, 0], solid(G.lathe(ext, E, Q, { rims: "all", ...lite }), { tone: "hi", className: "ss-niobium", inner: k.lineSvg(extLines, { tone: "faint" }) }));
  }
  if (G.dot3(E.a, VQ) > 0.05) {
    const lip = u(0.03);
    const exitR = u(spec.exit);
    const exitSvg =
      solid(G.ringBand(-u(0.08), 0, exitR - lip, exitR, E, Q, liteSteps), { tone: "hi", crease: "none", className: spec.regen ? "ss-niobium" : "ss-bronze" }) +
      `<path class="ss-nozzle" d="${G.circleOf(E, 0, exitR - lip, Q)}"/>` +
      k.lineSvg(G.arcOf(E, u(-0.3 * spec.bell), u(bellR(spec, -0.3 * spec.bell)), Q, { inward: true, least: -1 }), { tone: "lo", className: "ss-bell-in" }) +
      k.lineSvg(G.arcOf(E, u(-0.62 * spec.bell), u(bellR(spec, -0.62 * spec.bell)), Q, { inward: true, least: -1 }), { tone: "lo", className: "ss-bell-in" }) +
      `<path class="ss-throat" d="${G.circleOf(E, u(sT + 0.02), u(spec.throat * 1.1), Q)}"/>`;
    put(0.2, [0, 0, 0], exitSvg);
  }
  parts.sort((a, b) => a.depth - b.depth);
  void atQ;
  void L;
  return parts.map((part) => part.svg).join("");
}

function enginesOf(list, exitS) {
  return list
    .map((engine) => ({ ...engine, centre: on(exitS + (engine.inset ?? 0), engine.r, engine.deg) }))
    .sort((a, b) => G.dot3(a.centre, V) - G.dot3(b.centre, V))
    .map((engine) => engineParts(engine.centre, [1, 0, 0], engine.spec))
    .join("");
}

function mountsOf(list, faceOf, size = 0.2) {
  return list
    .map((engine) => {
      const from = engine.inset + lengthOf(engine.spec);
      const to = faceOf(engine);
      if (to - from < 0.05) return null;
      const F = G.frameOf(on(0, engine.r, engine.deg), VEH.a, VEH.u, VEH.v);
      return { depth: G.dot3(on((from + to) / 2 + engine.base, engine.r, engine.deg), V), svg: S(G.disc((engine.base + from) * U, (engine.base + to) * U, size * U, F, P), { tone: "hi", className: "ss-gunmetal" }) };
    })
    .filter(Boolean)
    .sort((a, b) => a.depth - b.depth)
    .map((part) => part.svg)
    .join("");
}

let outsideCount = 0;
function outsideClip(piece) {
  const points = [];
  for (const s of [piece.s0, piece.s1]) for (let i = 0; i < 120; i++) points.push(at(on(s, M.radius, i * 3)));
  const hull = G.hullOf(points);
  const ring = [];
  for (let i = 0; i < 120; i++) ring.push(at(on(piece.s0, M.radius, i * 3)));
  const id = `ss-out-${++outsideCount}`;
  const big = `M${-W} ${-W}H${3 * W}V${3 * W}H${-W}Z`;
  return { id, svg: `<clipPath id="${id}"><path clip-rule="evenodd" d="${big}${k.pathOf(hull, true)}"/><path d="${k.pathOf(ring, true)}"/></clipPath>` };
}

function engineBundle(piece, list, exitS) {
  const clip = outsideClip(piece);
  const [mx, my, mz] = [PULL[piece.id] * U, 0, 0];
  add(piece.id, "engines", `${clip.svg}<g clip-path="url(#${clip.id})"><g class="it-sub" data-ride="${piece.id}-e" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}">${enginesOf(list, exitS)}</g></g>`);
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
  ...[90, 210, 330].map((deg) => ({ deg, r: 0.95, ring: "centre" })),
  ...Array.from({ length: 10 }, (_, i) => ({ deg: 18 + i * 36, r: 2.45, ring: "middle" })),
  ...Array.from({ length: 20 }, (_, i) => ({ deg: i * 18, r: 3.85, ring: "outer" })),
].map((engine) => ({ ...engine, spec: RAPTOR, inset: 0.25, base: 0 }));
const SHIP_ENGINES = [
  ...[0, 120, 240].map((deg) => ({ deg, r: 1.05, spec: RAPTOR, inset: 1.3, base: SHIP })),
  ...[60, 180, 300].map((deg) => ({ deg, r: 3.0, spec: RVAC, inset: 0.3, base: SHIP })),
];

for (const piece of PIECES) {
  const paths = hull(piece);
  const inner = Ln(seamsOf(piece), { tone: "faint" }) + tilesOf(piece);
  add(piece.id, "hull", S(paths, { tone: "hi", inner, className: "ss-steel" }));
}

const innerSeams = (s0, s1, kind = "", r = M.radius) => {
  const lines = [];
  for (let s = Math.ceil(s0 / M.ring) * M.ring; s < s1; s += M.ring) lines.push(G.arcOf(VEH, s * U, r * U, P, { inward: true, least: -0.02 }));
  return Ln(lines.join(""), { tone: "lo", className: kind ? `ss-in-${kind}` : "ss-in" });
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

{
  const puck = S(G.disc(4.2 * U, 4.6 * U, 2.9 * U, VEH, P), { tone: "hi", crease: "none", className: "ss-gunmetal" });
  const ring = S(G.ringBand(4.3 * U, 4.6 * U, 3.3 * U, 4.4 * U, VEH, P), { tone: "hi", crease: "none", className: "ss-gunmetal" });
  const mounts = mountsOf(BOOSTER_ENGINES, (engine) => (engine.ring === "outer" ? 4.3 : 4.2));
  aftOpening(BY.beng, cavity(wall(0, 4.6)) + cavity(backDisc(4.6)) + ring + puck + mounts);
  engineBundle(BY.beng, BOOSTER_ENGINES, 0);
}
aftOpening(BY.blox, cavity(dish(6, 1.8)) + Ln(dishLines(6, 1.8, { rings: [0.25, 0.42, 0.57, 0.7, 0.81, 0.9, 0.96], spokes: 32, hub: 0.25 }), { tone: "lo", className: "ss-in" }) + S(G.ringBand(7.6 * U, 7.8 * U, 0.8 * U, 1.1 * U, VEH, P), { tone: "mid" }) + `<path class="ss-void" d="${G.circleOf(VEH, 7.6 * U, 0.8 * U, P)}"/>`);
aftOpening(BY.bch4, cavity(dish(41, 1.8), "lox") + Ln(dishLines(41, 1.8, { rings: [0.25, 0.88], spokes: 12, hub: 0.25 }), { tone: "lo", className: "ss-in-lox" }) + S(G.ringBand(42.6 * U, 42.8 * U, 0.8 * U, 1.1 * U, VEH, P), { tone: "mid" }) + `<path class="ss-void" d="${G.circleOf(VEH, 42.6 * U, 0.8 * U, P)}"/>`);
{
  const domeAt = (r) => 3.5 + 1.8 * Math.sqrt(Math.max(0, 1 - (r / M.radius) ** 2));
  const puck = S(G.disc((SHIP + 4.45) * U, (SHIP + domeAt(1.6)) * U, 1.6 * U, VEH, P), { tone: "hi", crease: "none", className: "ss-gunmetal" });
  const mounts = mountsOf(SHIP_ENGINES, (engine) => (engine.spec === RVAC ? domeAt(engine.r) : 4.45), 0.24);
  aftOpening(BY.slox, cavity(wall(SHIP, SHIP + 3.5)) + cavity(dish(SHIP + 3.5, 1.8)) + puck + mounts);
  engineBundle(BY.slox, SHIP_ENGINES, SHIP);
}
aftOpening(BY.sch4, cavity(dish(SHIP + 20, 1.8), "lox") + Ln(dishLines(SHIP + 20, 1.8, { rings: [0.2, 0.88], spokes: 12, phase: 30, hub: 0.2 }), { tone: "lo", className: "ss-in-lox" }) + [60, 180, 300].map((deg) => portOn(SHIP + 20, 1.8, 2.7, deg, 0.28)).join("") + S(G.ringBand((SHIP + 21.6) * U, (SHIP + 21.8) * U, 0.45 * U, 0.65 * U, VEH, P), { tone: "mid" }) + `<path class="ss-void" d="${G.circleOf(VEH, (SHIP + 21.6) * U, 0.45 * U, P)}"/>`);
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
  cavity(wall(6, 41), "lox") +
    innerSeams(6, 41, "lox") +
    S(G.disc(7.8 * U, 42.8 * U, 0.8 * U, VEH, P), { tone: "hi", className: "ss-methane", inner: Ln(tubeRings(VEH, 7.8, 42.8, 0.8, M.ring * 2), { tone: "faint" }) }),
);
const DOWNCOMERS = [{ r: 0, size: 0.45 }, ...[60, 180, 300].map((deg) => ({ r: 2.7, deg, size: 0.28 }))];
window(
  BY.slox,
  SHIP + 6.5,
  SHIP + 16.5,
  14,
  86,
  cavity(wall(SHIP + 3.5, SHIP + 20), "lox") +
    innerSeams(SHIP + 3.5, SHIP + 20, "lox") +
    cavity(dish(SHIP + 20, 1.8), "lox") +
    DOWNCOMERS.map((pipe) => ({ ...pipe, centre: pipe.r ? on(SHIP + 10, pipe.r, pipe.deg) : on(SHIP + 10, 0, 0) }))
      .sort((a, b) => G.dot3(a.centre, V) - G.dot3(b.centre, V))
      .map((pipe) => {
        const lift = pipe.r ? 1.8 * Math.sqrt(1 - (pipe.r / M.radius) ** 2) : 1.8;
        const F = G.frameOf(pipe.r ? on(0, pipe.r, pipe.deg) : VEH.o, VEH.a, VEH.u, VEH.v);
        return S(G.disc((SHIP + 3.5 + lift) * U, (SHIP + 20 + lift) * U, pipe.size * U, F, P), { tone: "hi", className: "ss-methane" });
      })
      .join(""),
);

window(BY.bch4, 45.5, 60.5, 6, 108, cavity(wall(41, 64.5), "ch4") + innerSeams(41, 64.5, "ch4") + cavity(dish(64.5, 1.8), "ch4"));
window(BY.sch4, SHIP + 22.5, SHIP + 31, 14, 86, cavity(wall(SHIP + 20, SHIP + 33), "ch4") + innerSeams(SHIP + 20, SHIP + 33, "ch4") + cavity(dish(SHIP + 33, 1.8), "ch4"));

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
  parts.push({ depth: G.dot3(on((CH4_HEADER[0] + CH4_HEADER[1]) / 2, 0, 0), V), svg: S(capsule(...CH4_HEADER), { tone: "hi", className: "ss-methane" }) });
  parts.push({ depth: G.dot3(on((LOX_HEADER[0] + LOX_HEADER[1]) / 2, 0, 0), V), svg: S(capsule(...LOX_HEADER), { tone: "hi", className: "ss-oxygen" }) });
  parts.sort((a, b) => a.depth - b.depth);
  noseWindow(SHIP + 41.2, SHIP + 50.6, 8, 98, cavity(facets(noseRows, VEH, { inward: true, steps: 72 })) + parts.map((part) => part.svg).join(""));
}

function clampsOf(s0, s1, deg, every, { width = 0.35, height = 0.35 } = {}) {
  const F = G.frameOf(on(0, 0, 0), VEH.a, radial(deg), tangent(deg));
  const list = [];
  for (let s = s0 + every / 2; s < s1 - 0.3; s += every) list.push(prism(F, [[R - 0.05 * U, -width * 1.4 * U], [R + (height + 0.12) * U, -width * 1.15 * U], [R + (height + 0.12) * U, width * 1.15 * U], [R - 0.05 * U, width * 1.4 * U]], s * U, (s + 0.32) * U, { tone: "hi", className: "ss-gunmetal" }));
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
  const housing = prism(F, [[R - 0.1 * U, -1.2 * U], [r0, -1.0 * U], [r0, 1.0 * U], [R - 0.1 * U, 1.2 * U]], -0.6 * U, 1.4 * U, { tone: "hi", className: "ss-fin" });
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
  return { housing, fin: S(plate, { tone: "hi", className: "ss-fin", inner: Ln(lattice.join(""), { tone: "lo" }) + Ln(frame, { tone: "mid" }) }) };
}

function flapOf(base, deg, polygon, half = 0.25) {
  const F = G.frameOf(G.add3(on(base, 0, 0), G.mul3(tangent(deg), -half * U)), tangent(deg), VEH.a, radial(deg));
  const poly = polygon.map(([s, r]) => [(s - base) * U, r * U]);
  const face = G.dot3(F.a, V) > 0 ? half * 2 * U : 0;
  const point = ([x, y]) => at(G.add3(G.add3(G.add3(F.o, G.mul3(F.a, face)), G.mul3(F.u, x)), G.mul3(F.v, y)));
  const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  const ribs = [0.22, 0.44, 0.66, 0.84].map((f) => k.pathOf([point(mix(poly[0], poly[1], f)), point(mix(poly[3], poly[2], f))])).join("");
  const spar = k.pathOf([point(mix(poly[0], poly[3], 0.12)), point(mix(poly[1], poly[2], 0.12))]);
  return prism(F, poly, 0, half * 2 * U, { tone: "hi", className: "ss-tile", inner: Ln(ribs, { tone: "faint" }) + Ln(spar, { tone: "lo" }) });
}

function hingeOf(s0, s1, r, deg, size = 0.22) {
  const F = G.frameOf(on(0, r, deg), VEH.a, VEH.u, VEH.v);
  return S(G.disc(s0 * U, s1 * U, size * U, F, P), { tone: "hi", crease: "none", className: "ss-gunmetal" });
}

function stripOf(s0, s1, deg, { width = 0.35, height = 0.35, tone = "mid" } = {}) {
  const F = G.frameOf(on(0, 0, 0), VEH.a, radial(deg), tangent(deg));
  return prism(F, [[R - 0.05 * U, -width * U], [R + height * U, -width * 0.8 * U], [R + height * U, width * 0.8 * U], [R - 0.05 * U, width * U]], s0 * U, s1 * U, { tone: tone === "mid" ? "hi" : tone, className: "ss-steel" });
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
  return `<g class="it" data-piece="${piece.id}" data-m="${mx.toFixed(1)},${my.toFixed(1)},${mz.toFixed(1)}">${L.back.join("")}${L.hull.join("")}${L.inside.join("")}${L.engines.join("")}${L.jaws.join("")}${L.front.join("")}</g>`;
});

function fitWith(points, width, height, scale, azimuth, elevation, pad = 0) {
  const unitQ = { origin: [0, 0], scale, azimuth, elevation };
  const flat = points.map((point) => k.iso(point, unitQ));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  return { origin: [width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2, pad + (height - pad) / 2 - (Math.min(...ys) + Math.max(...ys)) / 2], scale, azimuth, elevation };
}

const FIG = { width: 160, height: 230, azimuth: 40, elevation: 20, unit: 40 };
function engineBounds(spec) {
  const EU = FIG.unit;
  const base = (spec.exit + 0.3) * EU;
  const top = (0.22 + lengthOf(spec)) * EU;
  return [[-base, -base, -0.12 * EU], [base, base, -0.12 * EU], [base, -base, -0.12 * EU], [-base, base, -0.12 * EU], [-base, -base, top], [base, base, top], [0, 0, top + 0.1 * EU]];
}
const scaleFor = (spec) => k.fitProjection(engineBounds(spec), FIG.width, FIG.height, { pad: 10, azimuth: FIG.azimuth, elevation: FIG.elevation }).scale;
const PAIR_SCALE = Math.min(scaleFor(RAPTOR), scaleFor(RVAC));
function engineFigure(spec, label, scale) {
  const EU = FIG.unit;
  const Q = fitWith(engineBounds(spec), FIG.width, FIG.height, scale, FIG.azimuth, FIG.elevation);
  const exit = spec.exit * EU;
  const z0 = 0.22 * EU;
  const plate = { x: -(exit + 0.28 * EU), y: -(exit + 0.28 * EU), w: (exit + 0.28 * EU) * 2, d: (exit + 0.28 * EU) * 2, r: 0.12 * EU };
  const ringF = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const across = [-Math.sin(FIG.azimuth * DEG), Math.cos(FIG.azimuth * DEG), 0];
  const body = [
    `<path class="iso-halo" d="${k.haloOf(plate, -0.12 * EU, 0.12 * EU, Q)}"/>`,
    k.solidSvg(k.slabOf(plate, -0.12 * EU, 0.12 * EU, Q, 8, 1), { tone: "mid" }),
    k.dotsSvg(k.corners(plate, 0.1 * EU).map(([x, y]) => k.iso([x, y, 0], Q)), { size: 0.6, tone: "mid" }),
    k.solidSvg(G.ringBand(0, z0, exit - 0.06 * EU, exit + 0.08 * EU, ringF, Q), { tone: "mid" }),
    engineParts([0, 0, z0], [0, 0, -1], spec, { P: Q, unit: EU, pumpDir: across, detail: true }),
  ];
  return k.figureSvg({ width: FIG.width, height: FIG.height, label, body, className: "ss-engine-fig" });
}
const SL_LABEL = "A Raptor 3 sea-level engine standing on its nozzle: gimbal block on top, two turbopumps either side of the powerhead, the main chamber and the bronze regeneratively cooled bell.";
const FIG_SL = engineFigure(RAPTOR, SL_LABEL, scaleFor(RAPTOR));
const FIG_SL_PAIR = engineFigure(RAPTOR, SL_LABEL, PAIR_SCALE);
const FIG_VAC = engineFigure(RVAC, "A Raptor Vacuum engine: the same powerhead and chamber with a much larger nozzle, its lower part an uncooled extension.", PAIR_SCALE);

function boxOf(piece, extra = 0) {
  const span = { bch4: 0.7 + FIN_SPAN, slox: 4.4, nose: 3.0 }[piece.id] ?? 0.8;
  const points = [];
  for (const s of [piece.s0 - extra, piece.s1]) for (let d = 0; d < 360; d += 10) points.push(at(on(s, M.radius + span, d)));
  for (const s of piece.cradles) points.push(at([xOf(s), 27, RAIL_H]), at([xOf(s), -27, RAIL_H]));
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v * 10) / 10);
}

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
const ORDER = ["beng", "blox", "bch4", "slox", "sch4", "nose"];
const SECTIONS = {
  beng: {
    title: "33 Raptors and aft skirt",
    text: `Thirty-three Raptor 3 engines in three rings. The 3 in the centre and the 10 around them gimbal to steer, and relight for the boostback and landing burns; the outer 20 are fixed. Raptor 3 carries inside its housing the plumbing that Raptor 2 had on the outside, so V3 boosters no longer need a shroud around each engine. Take the stack apart and the engines slide out of the skirt, leaving the thrust puck and their mounts.`,
    specs: [["Engines", "33 Raptor 3"], ["Thrust", `${M.raptorSea} tf each · ≈${fmt(33 * M.raptorSea)} tf in all`], ["Steering", "13 gimbal · 20 fixed"], ["Mass", "1,525 kg per engine"]],
    figs: ["sl"],
  },
  blox: {
    title: "Booster oxygen tank",
    text: `The biggest tank on the vehicle, full of liquid oxygen. The methane stored above it reaches the engines through a large transfer tube down its centre, shown in amber in the cut-open window. On V3 the aft dome under it, facing the engines, carries metallic heat-shield tiles.`,
    specs: [["Liquid oxygen", `≈${fmt(t(bLox))} t`], ["Walls", `steel rings ${M.ring} m tall, about 4 mm thick`], ["Through it", "the methane transfer tube"]],
    figs: [],
  },
  bch4: {
    title: "Booster methane tank, grid fins, interstage",
    text: `Liquid methane, above the oxygen and separated from it by the common dome. Three grid fins near the top steer the booster back to the tower, whose arms catch it by them. On V3 the vented hot-staging interstage is built into this tank and stays with the booster instead of being dropped.`,
    specs: [["Liquid methane", `≈${fmt(t(bCh4))} t`], ["Grid fins", "3 · about 1.5× earlier ones · 90/90/180°"], ["Interstage", "vented, built in, kept"]],
    figs: [],
  },
  slox: {
    title: "Ship oxygen tank and six Raptors",
    text: `The ship's oxygen tank sits over its six engines. The three sea-level Raptors in the centre gimbal for steering and landing; the three Raptor Vacuum engines with their large fixed nozzles do most of the work in space. One central downcomer feeds methane to the sea-level engines and one more feeds each vacuum engine. The two aft flaps steer the ship as it falls belly first.`,
    specs: [["Liquid oxygen", `≈${fmt(t(sLox))} t`], ["Sea level", `3 × ${M.raptorSea} tf, gimballed`], ["Vacuum", `3 × ${M.raptorVac} tf, fixed`], ["Downcomers", "4"]],
    figs: ["pair", "vac"],
  },
  sch4: {
    title: "Ship methane tank",
    text: `The ship's methane, above its oxygen. The common dome at its bottom is where the four downcomers begin their run through the oxygen tank to the engines.`,
    specs: [["Liquid methane", `≈${fmt(t(sCh4))} t`], ["Heat shield", "hexagonal tiles on the windward half"]],
    figs: [],
  },
  nose: {
    title: "Payload bay and nose",
    text: `Starlink satellites leave through the slot-shaped payload door. The two forward flaps are smaller than the aft pair and sit toward the leeward side. Inside the nose (cut open here) are the landing header tanks, oxygen in blue and methane in amber, which feed the engines for the landing burn when the main tanks are nearly empty.`,
    specs: [["Header tanks", "oxygen + methane, in the nose since Ship 24"], ["Flaps", "2 forward · 2 aft"], ["Heat shield", "about 18,000 tiles · rated to 1,400 °C"]],
    figs: [],
  },
};
const OVERVIEW = {
  title: "Starship V3",
  text: `Two stainless-steel stages, both 9 m across: the ${M.booster} m Super Heavy booster and the ${M.ship} m ship. Each keeps its methane above its oxygen, so the methane has to run through the oxygen tank to reach the engines. Point at a section or pick one below to see it close up; zoom with the scroll wheel or a pinch, and drag to pan.`,
  specs: [["Height", `${M.stack} m`], ["Engines", "33 + 6 Raptor 3"], ["Propellant", `${fmt(M.boosterProp)} t + ≈${fmt(M.shipProp)} t`], ["Liftoff thrust", `≈${fmt(33 * M.raptorSea)} tf`]],
};

const LABEL =
  "SpaceX Starship V3 drawn as a full stack lying on a stacking jig: a long base plate with two rails, a metre ruler and cradles that carry six sections. From the engine end: the booster's aft skirt with 33 Raptor engines, its oxygen tank cut open to show the amber methane transfer tube, its methane tank with three grid fins and a vented interstage, then the ship's oxygen tank with six Raptors, four downcomers and two aft flaps, its methane tank, and the payload bay and nose with two forward flaps and the header tanks. Oxygen spaces are tinted blue and methane amber; the heat-shield tiles are black.";
const svg = k.figureSvg({ width: W, height: H, label: LABEL, body: [`<g id="ss-scene"><g class="ss-stand">${stand.join("")}</g><g class="ss-stack">${groups.join("")}</g></g>`], className: "ss-main" });
const unit = (vector) => {
  const o = at([0, 0, 0]);
  const p = at(vector);
  return [p[0] - o[0], p[1] - o[1]];
};
const DATA = {
  W,
  H,
  EX: unit([1, 0, 0]),
  order: ORDER,
  stagger: ["beng", "nose", "blox", "sch4", "bch4", "slox"],
  subs: { "beng-e": "beng", "slox-e": "slox" },
  spring: { stagger: 0.06, stiffness: 42, damping: 12.5, substeps: 4 },
  moves: Object.fromEntries(PIECES.map((piece) => [piece.id, moveOf(piece)[0]])),
  boxes: Object.fromEntries(PIECES.map((piece) => [piece.id, { rest: boxOf(piece), pulled: boxOf(piece, PULL[piece.id] ? PULL[piece.id] + 0.4 : 0) }])),
  pieces: Object.fromEntries(PIECES.map((piece) => [piece.id, { say: SAY[piece.id] }])),
  sections: Object.fromEntries(ORDER.map((id, index) => [id, { ...SECTIONS[id], num: String(index + 1).padStart(2, "0") }])),
  overview: OVERVIEW,
  idle: IDLE,
};

const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const specsHtml = (list) => list.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("");
const PARTS = ORDER.map((id, index) => `<button type="button" class="ss-part" data-part="${id}"><span class="ss-num">${String(index + 1).padStart(2, "0")}</span>${esc(SECTIONS[id].title)}</button>`).join("");
const KEYS = [["var(--ss-lox)", "Liquid oxygen"], ["var(--ss-ch4)", "Liquid methane"], ["var(--ss-tile-key)", "Heat-shield tiles"], ["var(--ss-bronze-key)", "Raptor nozzles"]]
  .map(([colour, label]) => `<span class="ss-key"><i style="--key:${colour}"></i>${label}</span>`)
  .join("");
const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig">Fig 1</span><span class="iso-plate-corner" data-corner="title">Starship V3 · full stack</span><span class="iso-plate-corner" data-corner="readout" data-readout>${IDLE}</span></div>`;
const stage = `<div class="ss-stage" tabindex="0" role="slider" aria-label="Starship V3 on a stacking jig. Hover or use the arrow keys to pick a section, Space to take it apart, plus and minus to zoom, Escape to reset." aria-valuemin="0" aria-valuemax="${ORDER.length}" aria-valuenow="0" aria-valuetext="Assembled">${svg}</div>`;
const controls = `<div class="ss-controls"><button type="button" class="ss-button" data-icon data-zoom="out" aria-label="Zoom out">−</button><span class="ss-zoom-level" data-zoom-level>100%</span><button type="button" class="ss-button" data-icon data-zoom="in" aria-label="Zoom in">+</button><button type="button" class="ss-button" data-zoom="reset">Reset</button><button type="button" class="ss-button" data-apart aria-pressed="false">Take apart</button><span class="ss-hint">Scroll to zoom · drag to pan</span></div>`;
const extra = `<div class="ss-extra" data-p-extra><div class="ss-extra-figs"><figure class="ss-extra-fig" data-fig="sl">${FIG_SL}<figcaption>Raptor 3 · sea level</figcaption></figure><figure class="ss-extra-fig" data-fig="pair" hidden>${FIG_SL_PAIR}<figcaption>Raptor 3 · sea level</figcaption></figure><figure class="ss-extra-fig" data-fig="vac" hidden>${FIG_VAC}<figcaption>Raptor Vacuum</figcaption></figure></div></div>`;
const panel = `<aside class="iso-plate ss-panel" aria-label="Section details"><h2 class="ss-panel-head"><span class="ss-panel-num" data-p-num>V3</span><span class="ss-panel-title" data-p-title>${esc(OVERVIEW.title)}</span></h2><div class="ss-lens-box" data-p-lens hidden><svg class="iso-svg ss-lens" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><use href="#ss-scene"/></svg></div>${extra}<p class="ss-text" data-p-text>${esc(OVERVIEW.text)}</p><dl class="ss-specs" data-p-specs>${specsHtml(OVERVIEW.specs)}</dl><button type="button" class="ss-button ss-zoom-here" data-zoom-here hidden>Zoom the drawing here</button><div class="ss-keys">${KEYS}</div><div class="ss-parts">${PARTS}</div></aside>`;
const caption = `Starship V3 stands ${M.stack} m tall: a ${M.booster} m Super Heavy booster under a ${M.ship} m ship, both 9 m across and built from stainless-steel rings ${M.ring} m tall. Oxygen spaces are tinted blue and methane amber; in each stage the methane tank sits above the oxygen tank, so the methane reaches the engines through a tube down the middle of the oxygen tank (the cut-open windows). Take it apart and the six sections slide apart on their cradles, then the 33 + 6 engines slide out of their skirts. The ship lies belly up so its black heat-shield tiles and flaps show. Numbers follow SpaceX's May 2026 figures as listed on Wikipedia: Raptor 3 at ${M.raptorSea} tf (${M.raptorVac} tf vacuum), ${fmt(M.boosterProp)} t of propellant in the booster and about ${fmt(M.shipProp)} t in the ship, split here at Raptor's ${M.mixture}:1 oxygen-to-methane ratio. Engines are simplified, and proportions inside the tanks are approximate.`;
const body = `<figure class="iso-figure ss"><div class="ss-layout"><div class="iso-plate ss-card">${corners}${stage}${controls}</div>${panel}</div><figcaption class="iso-legend"><span class="iso-caption">${caption}</span></figcaption></figure><span class="ss-live" aria-live="polite" data-live></span>`;

const CSS = readFileSync(join(HERE, "starship.css"), "utf8");
const LIVE = readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const page = k.pageHtml({ title: "Starship V3", theme: THEME, body: `<style>${CSS}</style>${body}`, script: LIVE, width: 1440 });
const name = THEME === "light" ? "starship-light.html" : "starship.html";
writeFileSync(join(HERE, "..", name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `${W}×${H}`);
