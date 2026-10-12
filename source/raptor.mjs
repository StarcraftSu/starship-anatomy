// Fig 2: one Raptor 3 standing on its nozzle on an engine stand. Assembled it is the clean engine
// SpaceX flies; taken apart, the turbopump and preburner pairs move out to either side and the
// flow paths Raptor 3 hides inside its housings are drawn between the parts, step by step.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const U = 100;
const W = 980;
const H = 640;
const AZIMUTH = 34;
const ELEVATION = 20;

const R3 = { thrust: 250, vac: 275, pc: 330, pcTest: 350, mass: 1525, ispSL: 350, ispVac: 380, mix: 3.6, length: 3.1, width: 1.3 };

const EXIT_Z = 0.3;
const BELL = { exit: 0.65, throat: 0.2, length: 1.65, converge: 0.2, chamber: 0.31, chamberLen: 0.5 };
const TOP_S = BELL.length + BELL.converge + BELL.chamberLen;
const bellR = (h) => {
  const x = Math.min(1, Math.max(0, 1 - h / BELL.length));
  return BELL.throat + (BELL.exit - BELL.throat) * (1 - (1 - x) * (1 - x));
};
const bodyR = (h) => {
  if (h <= BELL.length) return bellR(h);
  if (h <= BELL.length + BELL.converge) {
    const f = (h - BELL.length) / BELL.converge;
    return BELL.throat + (BELL.chamber - BELL.throat) * (0.5 - 0.5 * Math.cos(Math.PI * f));
  }
  return BELL.chamber;
};
const bodySlope = (h) => (bodyR(h + 0.005) - bodyR(h - 0.005)) / 0.01;

const SIDE = [1, 0, 0];
const CH4_AT = 0.68;
const MOVES = {
  injector: [0, 0, 0.5],
  ox: [-1.5, 0, 0.55],
  gimbal: [0, 0, 1.0],
  ch4: [0.95, 0, 0.55],
};
const ORDER = ["chamber", "injector", "ox", "gimbal", "ch4"];
const STAGGER = ["gimbal", "ox", "ch4", "injector"];

// Heights above the nozzle exit plane, assembled.
const Z = {
  injector: [TOP_S, TOP_S + 0.25],
  opb: [TOP_S + 0.25, TOP_S + 0.57],
  oTurbine: [TOP_S + 0.57, TOP_S + 0.79],
  oNeck: [TOP_S + 0.79, TOP_S + 0.87],
  oPump: [TOP_S + 0.87, TOP_S + 1.15],
  oInlet: [TOP_S + 1.15, TOP_S + 1.21],
  gimbal: [TOP_S + 1.21, TOP_S + 1.49],
  fpb: [TOP_S - 0.25, TOP_S + 0.13],
  fTurbine: [TOP_S + 0.13, TOP_S + 0.33],
  fNeck: [TOP_S + 0.33, TOP_S + 0.4],
  fPump: [TOP_S + 0.4, TOP_S + 0.67],
  fInlet: [TOP_S + 0.67, TOP_S + 0.73],
};

export function buildRaptor({ esc }) {
  const fitPoints = [];
  const box = (x0, y0, z0, x1, y1, z1) => {
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) fitPoints.push([x * U, y * U, z * U]);
  };
  const DECK = { x: -320, y: -150, w: 640, d: 300, r: 12 };
  const DECK_H = 16;
  box(-3.2, -1.5, -0.24, 3.2, 1.5, 0);
  box(-0.7, -0.7, 0, 0.7, 0.7, EXIT_Z + TOP_S + 1.49 + 1.05);
  box(-2.8, -0.2, 0, 2.9, 0.2, 4.9);
  const P = k.fitProjection(fitPoints, W, H, { pad: 34, azimuth: AZIMUTH, elevation: ELEVATION });
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
  const up = (x, y, z) => G.frameOf([x * U, y * U, z * U], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  const AX = up(0, 0, EXIT_Z);
  const FX = up(CH4_AT * SIDE[0], CH4_AT * SIDE[1], EXIT_Z);
  const metal = (extra = "") => ({ tone: "hi", className: `rp-metal${extra ? ` ${extra}` : ""}` });

  const pieces = Object.fromEntries(ORDER.map((id) => [id, []]));
  // The visible quads of a band of revolution hugging the nozzle: drawn without a fill across its middle.
  function sleeve(F, h0, h1, rOf, out, steps = 72) {
    const buckets = [[], [], [], [], []];
    const fill = [];
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const a0 = h0 + ((h1 - h0) * i) / rows;
      const a1 = h0 + ((h1 - h0) * (i + 1)) / rows;
      const r0 = (rOf(a0) + out) * U;
      const r1 = (rOf(a1) + out) * U;
      for (let j = 0; j < steps; j++) {
        const t0 = (j / steps) * TAU;
        const t1 = ((j + 1) / steps) * TAU;
        const n = G.unit3(G.sub3(G.mul3(G.radialOf(F, (t0 + t1) / 2), (a1 - a0) * U), G.mul3(F.a, r1 - r0)));
        if (G.dot3(n, V) <= 1e-6) continue;
        const d = k.pathOf([G.pointOf(F, a0 * U, r0, t0), G.pointOf(F, a0 * U, r0, t1), G.pointOf(F, a1 * U, r1, t1), G.pointOf(F, a1 * U, r1, t0)].map(at), true);
        fill.push(d);
        buckets[G.toneOf(n, P)].push(d);
      }
    }
    const rims = [h0, h1].map((h) => G.arcOf(F, h * U, (rOf(h) + out) * U, P, { slope: (rOf(h + 0.005) - rOf(h - 0.005)) / 0.01 })).join("");
    return S({ fill: fill.join(""), outline: "", crease: "", top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")), seamless: true }, { ...metal(), crease: "none", inner: Ln(rims, { tone: "hi" }) });
  }
  const org = (name, svg) => `<g data-org="${name}">${svg}</g>`;

  // Chamber and nozzle: one regeneratively cooled body.
  {
    const profile = [];
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const h = (BELL.length * i) / n;
      profile.push([h * U, bellR(h) * U, i > 0 && i < n ? 1 : 0]);
    }
    for (let i = 1; i <= 6; i++) {
      const h = BELL.length + (BELL.converge * i) / 6;
      profile.push([h * U, bodyR(h) * U, 1]);
    }
    profile.push([TOP_S * U, BELL.chamber * U, 0], [TOP_S * U, 0, 0]);
    const channels = [];
    for (let j = 0; j < 72; j++) {
      const a = (j / 72) * TAU;
      const run = [];
      let face = 0;
      for (let i = 0; i <= 24; i++) {
        const h = ((TOP_S - 0.12) * i) / 24;
        const normal = G.unit3(G.sub3(G.radialOf(AX, a), G.mul3(AX.a, bodySlope(h))));
        face += G.dot3(normal, V) / 25;
        run.push(at(G.pointOf(AX, h * U, bodyR(h) * U + 0.2, a)));
      }
      if (face > 0.05) channels.push([k.pathOf(run), G.fadeOf(face, [0.05, 0.5]) * 0.7]);
    }
    const rings = [0.35, 0.8, 1.25, TOP_S - 0.12].map((h) => G.arcOf(AX, h * U, bodyR(h) * U, P, { slope: bodySlope(h) })).join("");
    const body = S(G.lathe(profile, AX, P, { rims: "first" }), { tone: "hi", className: "ss-bronze", inner: k.fadedSvg(channels, { tone: "faint" }) + Ln(rings, { tone: "lo" }) });
    const lip = S(G.ringBand(-0.04 * U, 0, (BELL.exit - 0.025) * U, (BELL.exit + 0.012) * U, AX, P), { tone: "hi", crease: "none", className: "ss-bronze" });
    const inletH = 0.46;
    const inlet = sleeve(AX, inletH - 0.06, inletH + 0.06, bodyR, 0.03);
    const outlet = sleeve(AX, TOP_S - 0.16, TOP_S - 0.04, bodyR, 0.03);
    pieces.chamber.push(org("chamber jacket", lip + body + inlet + outlet));
  }

  // Main injector: a flanged head with a ring of bolts on top of the chamber.
  {
    const [z0, z1] = Z.injector;
    const flange = S(G.ringBand(z0 * U, (z0 + 0.06) * U, 0.2 * U, 0.41 * U, AX, P), metal());
    const ports = Ln(G.arcOf(AX, (z0 + 0.15) * U, 0.36 * U, P), { tone: "faint" });
    const head = S(G.lathe([[(z0 + 0.06) * U, 0], [(z0 + 0.06) * U, 0.36 * U], [(z1 - 0.06) * U, 0.36 * U, 1], [z1 * U, 0.3 * U, 1], [z1 * U, 0]], AX, P, { rims: "last" }), { ...metal(), inner: ports });
    const bolts = Dots(G.dotsOf(AX, (z0 + 0.06) * U, 0.385 * U, 16, P, { least: 0.05 }), { size: 0.55, tone: "mid" });
    pieces.injector.push(org("injector", flange + bolts + head));
  }

  // A turbopump: pump on top with its volute, a neck, the turbine below; a preburner can under it.
  function turbopump(F, z, { pumpR, turbineR, pbR, side }) {
    const parts = [];
    const [p0, p1] = z.pb;
    parts.push(org(`pb ${side}`, S(G.lathe([[p0 * U, 0], [p0 * U, pbR * 0.7 * U], [(p0 + 0.06) * U, pbR * U, 1], [(p1 - 0.04) * U, pbR * U, 1], [p1 * U, pbR * 1.05 * U], [p1 * U, 0]], F, P), metal("rp-pb")) + Ln(G.arcOf(F, (p0 + (p1 - p0) * 0.55) * U, pbR * U, P), { tone: "faint" })));
    const [t0, t1] = z.turbine;
    parts.push(org(`turbine ${side}`, S(G.lathe([[t0 * U, 0], [t0 * U, turbineR * 0.8 * U], [(t0 + 0.04) * U, turbineR * U, 1], [(t1 - 0.04) * U, turbineR * U, 1], [t1 * U, turbineR * 0.8 * U], [t1 * U, 0]], F, P), metal("rp-turbine")) + Ln(G.arcOf(F, ((t0 + t1) / 2) * U, turbineR * U, P), { tone: "faint" })));
    const [n0, n1] = z.neck;
    parts.push(S(G.disc(n0 * U, n1 * U, 0.13 * U, F, P), metal()));
    const [q0, q1] = z.pump;
    const volute = S(G.ringBand((q0 + 0.05) * U, (q1 - 0.08) * U, pumpR * 0.9 * U, (pumpR + 0.06) * U, F, P), metal("rp-volute"));
    const pump = S(G.lathe([[q0 * U, 0], [q0 * U, pumpR * U], [(q1 - 0.05) * U, pumpR * U, 1], [q1 * U, pumpR * 0.6 * U, 1], [q1 * U, 0]], F, P), metal("rp-pump"));
    const [i0, i1] = z.inlet;
    const inlet = S(G.disc(i0 * U, i1 * U, 0.11 * U, F, P), metal()) + S(G.ringBand((i1 - 0.03) * U, i1 * U, 0.11 * U, 0.15 * U, F, P), metal());
    parts.push(org(`pump ${side}`, pump + volute + inlet));
    return parts.join("");
  }
  pieces.ox.push(turbopump(AX, { pb: Z.opb, turbine: Z.oTurbine, neck: Z.oNeck, pump: Z.oPump, inlet: Z.oInlet }, { pumpR: 0.27, turbineR: 0.25, pbR: 0.2, side: "ox" }));
  pieces.ch4.push(turbopump(FX, { pb: Z.fpb, turbine: Z.fTurbine, neck: Z.fNeck, pump: Z.fPump, inlet: Z.fInlet }, { pumpR: 0.24, turbineR: 0.22, pbR: 0.17, side: "ch4" }));

  // Gimbal and thrust puck on top: the engine's one mount to the vehicle.
  {
    const [g0, g1] = Z.gimbal;
    const knuckle = S(G.sphereOf(G.pointOf(AX, (g0 + 0.07) * U, 0, 0), 0.1 * U, P), metal());
    const puck = S(G.disc((g0 + 0.12) * U, g1 * U, 0.22 * U, AX, P), metal());
    const lugs = Dots(G.dotsOf(AX, g1 * U, 0.17 * U, 8, P, { all: true }), { size: 0.55, tone: "mid" });
    pieces.gimbal.push(org("gimbal", knuckle + puck + lugs));
  }

  // The stand: deck on feet, a ring that takes the nozzle, two propellant standpipes, a ruler.
  const stand = [];
  stand.push(`<path class="iso-halo" d="${k.haloOf(DECK, -DECK_H - 8, 14, P)}"/>`);
  const feet = [];
  for (const fx of [-0.9, 0, 0.9]) for (const fy of [-1, 1]) feet.push([DECK.x + DECK.w / 2 + (fx * DECK.w) / 2, fy * (DECK.d / 2 - 22)]);
  feet.sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [fx, fy] of feet) stand.push(S(k.cylinder(fx, fy, 14, -DECK_H - 8, 8, P, 28), { tone: "lo" }));
  stand.push(S(k.slabOf(DECK, -DECK_H, DECK_H, P, 8, 2), { tone: "mid", inner: Ln(k.sideSeam(DECK, -DECK_H / 2, P, 8), { tone: "faint" }) }));
  stand.push(Ln(k.planOutline(k.insetPlan(DECK, 10), 0, P), { tone: "faint" }));
  stand.push(Dots(k.corners(DECK, 18).map(([x, y]) => at([x, y, 0])), { size: 0.6, tone: "mid" }));
  const STRIP = { x: -240, y: DECK.y + DECK.d - 24, w: 480, d: 12, r: 2 };
  stand.push(S(k.slabOf(STRIP, 0, 1, P, 3), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let x = -230; x <= 230; x += 10) (x % 50 === 0 ? major : minor).push(k.lineOnTop([x, STRIP.y + 1.5], [x, STRIP.y + 1.5 + (x % 50 === 0 ? 7 : 4)], 1, P));
  stand.push(Ln(minor.join(""), { tone: "lo" }) + Ln(major.join(""), { tone: "mid" }));
  const ringF = up(0, 0, 0);
  stand.push(S(G.ringBand(0, EXIT_Z * U, (BELL.exit - 0.06) * U, (BELL.exit + 0.12) * U, ringF, P), { tone: "mid" }));
  stand.push(Dots(G.dotsOf(ringF, EXIT_Z * U, (BELL.exit + 0.05) * U, 12, P, { least: 0.05 }), { size: 0.55, tone: "lo" }));
  const pipe = (x, top, reach, cls) => {
    const F = up(x, 0, 0);
    const toward = Math.sign(-x);
    const flangeF = G.frameOf([x * U, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const run = S(G.disc(0.02 * U, top * U, 0.07 * U, F, P), { tone: "hi", className: cls });
    const foot = S(G.ringBand(0, 0.05 * U, 0.07 * U, 0.14 * U, flangeF, P), { tone: "mid" });
    const valve = S(G.disc((top * 0.45) * U, (top * 0.45 + 0.14) * U, 0.11 * U, F, P), { tone: "mid" });
    const armF = G.frameOf([x * U, 0, top * U], [toward, 0, 0], [0, 1, 0], [0, 0, 1]);
    const arm = S(G.disc(-0.07 * U, reach * U, 0.07 * U, armF, P), { tone: "hi", className: cls });
    const cap = S(G.ringBand((reach - 0.04) * U, reach * U, 0.07 * U, 0.12 * U, armF, P), { tone: "mid" });
    return foot + run + valve + arm + cap;
  };
  const LOX_PIPE = { x: -2.6, top: 4.75, reach: 0.15 };
  const CH4_PIPE = { x: 2.7, top: 4.25, reach: 0.15 };
  const backPipe = pipe(LOX_PIPE.x, LOX_PIPE.top, LOX_PIPE.reach, "ss-oxygen");
  const frontPipe = pipe(CH4_PIPE.x, CH4_PIPE.top, CH4_PIPE.reach, "ss-methane");

  // Flow paths, drawn over the apart pose. Points are in metres, in the apart positions.
  const zA = (z, piece) => z + EXIT_Z + (MOVES[piece]?.[2] ?? 0);
  const oxX = MOVES.ox[0];
  const fX = CH4_AT + MOVES.ch4[0];
  const mid = (a, b) => (a + b) / 2;
  const ROUTES = [
    { id: "lox-in", kind: "lox", step: 1, points: [[LOX_PIPE.x + LOX_PIPE.reach, 0, LOX_PIPE.top], [oxX, 0, LOX_PIPE.top], [oxX, 0, zA(Z.oInlet[1], "ox")]] },
    { id: "ch4-in", kind: "ch4", step: 1, points: [[CH4_PIPE.x - CH4_PIPE.reach, 0, CH4_PIPE.top], [fX, 0, CH4_PIPE.top], [fX, 0, zA(Z.fInlet[1], "ch4")]] },
    { id: "ch4-jacket", kind: "ch4", step: 2, from: "ch4", to: "chamber", points: [[fX + 0.3, 0, zA(mid(...Z.fPump), "ch4")], [fX + 0.55, 0, zA(mid(...Z.fPump), "ch4")], [fX + 0.55, 0, EXIT_Z + 0.46], [bellR(0.46) + 0.07, 0, EXIT_Z + 0.46]] },
    { id: "lox-opb", kind: "lox", step: 3, from: "ox", to: "ox", points: [[oxX - 0.33, 0, zA(mid(...Z.oPump), "ox")], [oxX - 0.55, 0, zA(mid(...Z.oPump), "ox")], [oxX - 0.55, 0, zA(mid(...Z.opb), "ox")], [oxX - 0.2, 0, zA(mid(...Z.opb), "ox")]] },
    { id: "ch4-fpb", kind: "ch4", step: 3, from: "chamber", to: "ch4", points: [[BELL.chamber + 0.06, 0, EXIT_Z + TOP_S - 0.1], [fX, 0, EXIT_Z + TOP_S - 0.1], [fX, 0, zA(Z.fpb[0], "ch4")]] },
    { id: "lox-fpb", kind: "lox", step: 3, thin: true, from: "ox", to: "ch4", points: [[oxX, -0.27, zA(mid(...Z.oPump), "ox")], [oxX, -0.7, zA(mid(...Z.oPump), "ox")], [fX, -0.7, zA(mid(...Z.oPump), "ox")], [fX, -0.7, zA(mid(...Z.fpb), "ch4")], [fX, -0.17, zA(mid(...Z.fpb), "ch4")]] },
    { id: "ch4-opb", kind: "ch4", step: 3, thin: true, from: "chamber", to: "ox", points: [[-(BELL.chamber + 0.06), 0, EXIT_Z + TOP_S - 0.1], [oxX, 0, EXIT_Z + TOP_S - 0.1], [oxX, 0, zA(Z.opb[0], "ox")]] },
    { id: "oxgas", kind: "oxgas", step: 4, from: "ox", to: "injector", points: [[oxX + 0.25, 0, zA(mid(...Z.oTurbine), "ox")], [-0.22, 0, zA(mid(...Z.oTurbine), "ox")], [-0.22, 0, zA(Z.injector[1], "injector")]] },
    { id: "fuelgas", kind: "fuelgas", step: 4, from: "ch4", to: "injector", points: [[fX - 0.22, 0, zA(mid(...Z.fTurbine), "ch4")], [0.55, 0, zA(mid(...Z.fTurbine), "ch4")], [0.55, 0, zA(mid(...Z.injector), "injector")], [0.36, 0, zA(mid(...Z.injector), "injector")]] },
    { id: "exhaust", kind: "hot", step: 5, points: [[0, 0, EXIT_Z + TOP_S - 0.2], [0, 0, EXIT_Z + 0.05]] },
  ];
  // Methane climbing the cooling channels: a few meridians on the near side of the jacket.
  const jacket = [];
  for (const deg of [-60, -30, 0, 30, 60]) {
    const a = Math.atan2(V[1], V[0]) + deg * DEG;
    const run = [];
    for (let i = 0; i <= 30; i++) {
      const h = 0.46 + ((TOP_S - 0.1 - 0.46) * i) / 30;
      run.push(G.pointOf(AX, h * U, bodyR(h) * U + 2, a));
    }
    jacket.push(run);
  }
  const atM = (p) => at(p.map((v) => v * U));
  // A short flanged port on the part wherever a path leaves or enters it; the path then starts at the port's face.
  const STUB = 0.07;
  const portOn = (piece, point, dir, thin) => {
    const home = G.sub3(point, MOVES[piece] ?? [0, 0, 0]).map((v) => v * U);
    const F = G.frameAlong(home, dir);
    const r = (thin ? 0.032 : 0.045) * U;
    const svg = S(G.disc(-0.03 * U, STUB * U, r, F, P), metal()) + S(G.ringBand((STUB - 0.022) * U, STUB * U, r, r * 1.5, F, P), metal());
    if (G.dot3(dir, V) < 0) pieces[piece].unshift(svg);
    else pieces[piece].push(svg);
  };
  for (const route of ROUTES) {
    const list = route.points;
    if (route.from) {
      const dir = G.unit3(G.sub3(list[1], list[0]));
      portOn(route.from, list[0], dir, route.thin);
      list[0] = G.add3(list[0], G.mul3(dir, STUB));
    }
    if (route.to) {
      const n = list.length - 1;
      const dir = G.unit3(G.sub3(list[n - 1], list[n]));
      portOn(route.to, list[n], dir, route.thin);
      list[n] = G.add3(list[n], G.mul3(dir, STUB));
    }
  }
  const dot = ([x, y]) => `<circle class="rp-end" r="2.2" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}"/>`;
  const flows = [];
  for (const route of ROUTES) {
    const d = k.pathOf(route.points.map(atM));
    flows.push(`<g class="rp-flow" data-kind="${route.kind}" data-step="${route.step}"${route.thin ? " data-thin" : ""}><path class="rp-duct" d="${d}"/><path class="rp-stream" d="${d}"/>${dot(atM(route.points[0]))}${dot(atM(route.points.at(-1)))}</g>`);
  }
  for (const run of jacket) {
    const d = k.pathOf(run.map(at));
    flows.push(`<g class="rp-flow" data-kind="ch4" data-step="2" data-thin><path class="rp-duct" d="${d}"/><path class="rp-stream" d="${d}"/></g>`);
  }

  const unit = (vector) => {
    const o = at([0, 0, 0]);
    const p = at(vector);
    return [p[0] - o[0], p[1] - o[1]];
  };
  const groups = ORDER.map((id) => {
    const m = (MOVES[id] ?? [0, 0, 0]).map((v) => v * U);
    return `<g class="rp-it" data-piece="${id}" data-m="${m.map((v) => v.toFixed(1)).join(",")}">${pieces[id].join("")}</g>`;
  });
  const scene = `<g class="rp-stand">${stand.join("")}${backPipe}</g>${groups.join("")}${frontPipe}<g class="rp-flows" data-flows>${flows.join("")}</g>`;
  const svg = k.figureSvg({ width: W, height: H, label: TEXT.en.ui.label, body: [scene], className: "rp-main" });

  const STEPS = [1, 2, 3, 4, 5];
  const ORGS = { 1: ["pump"], 2: ["jacket"], 3: ["pb"], 4: ["turbine", "injector"], 5: ["chamber", "injector"] };
  const data = {
    W,
    H,
    EX: unit([1, 0, 0]),
    EY: unit([0, 1, 0]),
    EZ: unit([0, 0, 1]),
    stagger: STAGGER,
    spring: { stagger: 0.07, stiffness: 46, damping: 12.8, substeps: 4 },
    steps: STEPS,
    orgs: ORGS,
    t: TEXT,
  };

  const en = TEXT.en;
  const tx = (key) => `data-rt="${key}">${esc(en.ui[key])}`;
  const stepButtons = STEPS.map((n) => `<button type="button" class="ss-part rp-step" data-step="${n}"><span class="ss-num">${n}</span><span class="rp-step-name">${esc(en.steps[n].title)}</span></button>`).join("");
  const keys = [["var(--rp-lox)", "keyLox"], ["var(--rp-ch4)", "keyCh4"], ["var(--rp-oxgas)", "keyOxgas"], ["var(--rp-fuelgas)", "keyFuelgas"], ["var(--rp-hot)", "keyHot"]]
    .map(([colour, key]) => `<span class="ss-key"><i style="--key:${colour}"></i><span ${tx(key)}</span></span>`)
    .join("");
  const specsHtml = (list) => list.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("");
  const corners = `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig" ${tx("fig")}</span><span class="iso-plate-corner" data-corner="title" ${tx("figTitle")}</span><span class="iso-plate-corner" data-corner="readout" data-readout>${esc(en.idle)}</span></div>`;
  const stage = `<div class="ss-stage rp-stage" tabindex="0" role="slider" data-rt-aria="stage" aria-label="${esc(en.ui.stage)}" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0" aria-valuetext="${esc(en.ui.assembled)}">${svg}</div>`;
  const controls = `<div class="ss-controls"><button type="button" class="ss-button" data-apart aria-pressed="false">${esc(en.ui.apart)}</button><button type="button" class="ss-button" data-play aria-pressed="false">${esc(en.ui.play)}</button><span class="ss-hint" ${tx("hint")}</span></div>`;
  const panel = `<aside class="iso-plate ss-panel rp-panel" data-rt-aria="panel" aria-label="${esc(en.ui.panel)}"><div class="ss-parts">${stepButtons}</div><h2 class="ss-panel-head"><span class="ss-panel-num" data-p-num>R3</span><span class="ss-panel-title" data-p-title>${esc(en.overview.title)}</span><button type="button" class="ss-lang" data-lang>${esc(en.ui.langSwitch)}</button></h2><p class="ss-text" data-p-text>${esc(en.overview.text)}</p><dl class="ss-specs" data-p-specs>${specsHtml(en.overview.specs)}</dl><div class="ss-keys">${keys}</div></aside>`;
  const html = `<figure class="iso-figure ss rp" id="raptor"><div class="ss-layout"><div class="iso-plate ss-card">${corners}${stage}${controls}</div>${panel}</div><figcaption class="iso-legend"><span class="iso-caption" ${tx("caption")}</span></figcaption></figure>`;
  return { html, data };
}

const TEXT = {
  en: {
    idle: `Raptor 3 · ${R3.thrust} tf · ${R3.pc} bar · ${R3.mass.toLocaleString("en-US")} kg`,
    ui: {
      fig: "Fig 2",
      figTitle: "Raptor 3 · how the propellant flows",
      hint: "Point at the engine to take it apart",
      apart: "Take apart",
      together: "Put together",
      play: "Play the flow",
      pause: "Pause",
      panel: "Raptor 3 flow, step by step",
      stage: "A Raptor 3 engine on a stand. Hover or press Space to take it apart, arrow keys to step through the propellant flow, Escape to reset.",
      assembled: "Assembled",
      apartSay: "Apart: all flow paths",
      taking: "taking it apart",
      closing: "putting it together",
      apartIdle: "apart · every path Raptor 3 hides inside",
      keyLox: "Liquid oxygen",
      keyCh4: "Methane",
      keyOxgas: "Oxygen-rich gas",
      keyFuelgas: "Methane-rich gas",
      keyHot: "Burning gas",
      langSwitch: "中文",
      caption: `Raptor 3 is ${R3.length} m long and ${R3.width} m across and weighs ${R3.mass.toLocaleString("en-US")} kg. Assembled it shows almost no pipes: SpaceX moved most of Raptor 2's plumbing and sensors into the engine's main structure. Taken apart on its stand, the oxygen turbopump and its preburner move to the left, the methane pair to the right, and the paths between them are drawn in colour: liquid oxygen blue, methane amber, oxygen-rich gas violet, methane-rich gas red. The routes are a diagram of the cycle, not the real internal passages, and the parts are simplified. Numbers: ${R3.thrust} tf at sea level and ${R3.vac} tf in vacuum (SpaceX, May 2026), ${R3.pc} bar in service and ${R3.pcTest} bar reached in testing, specific impulse ${R3.ispSL} s at sea level and ${R3.ispVac} s for the vacuum version, as listed on Wikipedia.`,
      label: "A Raptor 3 rocket engine standing on its nozzle on an engine stand, with a blue oxygen standpipe on the left and an amber methane standpipe on the right. Taken apart, the oxygen turbopump and preburner sit to the left, the methane turbopump and preburner to the right, the injector, gimbal and the chamber with its bronze nozzle in the middle, and coloured paths show how the propellants flow between them.",
    },
    overview: {
      title: "Raptor 3",
      text: "Raptor burns liquid methane with liquid oxygen in a full-flow staged combustion cycle: all of both propellants passes through a turbine before it reaches the main chamber, and none is thrown away. Raptor 3 looks bare because the plumbing Raptor 2 carried outside is now built into its housings. Take it apart to see the paths it hides, then step through them.",
      specs: [["Thrust", `${R3.thrust} tf sea level · ${R3.vac} tf vacuum`], ["Chamber pressure", `${R3.pc} bar (${R3.pcTest} in tests)`], ["Specific impulse", `${R3.ispSL} s · ${R3.ispVac} s vacuum`], ["Mass", `${R3.mass.toLocaleString("en-US")} kg`], ["Mixture", `${R3.mix} : 1 oxygen to methane`]],
    },
    steps: {
      1: {
        title: "Two pumps",
        say: "1 · propellants enter the two turbopumps",
        text: "Liquid oxygen and liquid methane come from the tanks at only a few bar and enter two turbopumps, one for each propellant. Each pump raises its propellant far above the pressure in the main chamber, because it still has to pass through a preburner and a turbine on the way.",
        specs: [["Oxygen pump", "spun by oxygen-rich gas"], ["Methane pump", "spun by methane-rich gas"]],
      },
      2: {
        title: "Methane cools the engine",
        say: "2 · methane runs up the nozzle and chamber walls",
        text: "Before it burns, the methane cools the engine. From its pump it goes down to a manifold low on the nozzle and climbs through channels in the nozzle and chamber walls, carrying away the heat of the burning gas inside. It leaves, warmed, at the top of the chamber.",
        specs: [["Coolant", "all of the methane"], ["Path", "nozzle manifold → wall channels → chamber top"]],
      },
      3: {
        title: "Two preburners",
        say: "3 · each preburner burns a little of the other propellant",
        text: "This is what makes the cycle full-flow. All the oxygen goes to the oxygen-rich preburner and burns there with a little methane; all the methane goes to the methane-rich preburner and burns with a little oxygen. Each makes a hot gas that is mostly one propellant, cool enough for a turbine to survive.",
        specs: [["Oxygen-rich", "all the oxygen + a little methane"], ["Methane-rich", "all the methane + a little oxygen"]],
      },
      4: {
        title: "Turbines, then the injector",
        say: "4 · hot gas spins each pump, then flows to the injector",
        text: "Each hot gas spins the turbine on its own pump: oxygen-rich gas drives the oxygen pump and methane-rich gas the methane pump, so no seal inside a pump has to keep oxygen from methane. Still at high pressure, both gases then flow on to the main injector.",
        specs: [["Oxygen side", "oxygen-rich gas → oxygen turbine → injector"], ["Methane side", "methane-rich gas → methane turbine → injector"]],
      },
      5: {
        title: "Main chamber",
        say: `5 · gas meets gas in the chamber at ${R3.pc} bar`,
        text: `In the injector the two hot gases meet, both already gaseous, and burn completely at about ${R3.pc} bar. The exhaust speeds up through the narrow throat and expands in the bell. Because nothing is dumped overboard to drive the pumps, all the propellant makes thrust.`,
        specs: [["Chamber", `${R3.pc} bar · ${R3.pcTest} bar in tests`], ["Thrust", `${R3.thrust} tf at sea level`]],
      },
    },
  },
  zh: {
    idle: `猛禽 3 · ${R3.thrust} 吨力 · ${R3.pc} bar · ${R3.mass.toLocaleString("en-US")} 千克`,
    ui: {
      fig: "图 2",
      figTitle: "猛禽 3 · 推进剂怎么流",
      hint: "把鼠标移到发动机上把它拆开",
      apart: "拆开",
      together: "装回",
      play: "播放流程",
      pause: "暂停",
      panel: "猛禽 3 的推进剂流程，分步讲解",
      stage: "放在发动机支架上的猛禽 3。悬停或按空格键拆开，方向键逐步查看推进剂的流程，Esc 复位。",
      assembled: "已装好",
      apartSay: "已拆开：全部流路",
      taking: "正在拆开",
      closing: "正在装回",
      apartIdle: "已拆开 · 猛禽 3 藏在内部的全部流路",
      keyLox: "液氧",
      keyCh4: "甲烷",
      keyOxgas: "富氧燃气",
      keyFuelgas: "富燃燃气",
      keyHot: "燃烧中的燃气",
      langSwitch: "English",
      caption: `猛禽 3 长 ${R3.length} 米、直径 ${R3.width} 米，重 ${R3.mass.toLocaleString("en-US")} 千克。装好时几乎看不到管子：SpaceX 把猛禽 2 的大部分管路和传感器都做进了发动机主体。在支架上拆开后，氧涡轮泵和它的预燃室移到左边，甲烷那一对移到右边，它们之间的通路用颜色画出：液氧蓝色、甲烷琥珀色、富氧燃气紫色、富燃燃气红色。这些路线是循环原理的示意，并不是真实的内部通道，零件也做了简化。数字：海平面推力 ${R3.thrust} 吨力、真空 ${R3.vac} 吨力（SpaceX，2026 年 5 月），燃烧室压力服役中 ${R3.pc} bar、测试中达到 ${R3.pcTest} bar，比冲海平面 ${R3.ispSL} 秒、真空版 ${R3.ispVac} 秒，均取自维基百科。`,
      label: "一台猛禽 3 火箭发动机，喷管朝下立在发动机支架上，左边是蓝色的液氧立管，右边是琥珀色的甲烷立管。拆开后，氧涡轮泵和预燃室在左，甲烷涡轮泵和预燃室在右，中间是喷注器、万向节和带青铜色喷管的燃烧室，彩色路线表示推进剂在它们之间如何流动。",
    },
    overview: {
      title: "猛禽 3",
      text: "猛禽用液氧燃烧液态甲烷，采用全流量分级燃烧循环：两种推进剂全部先流过涡轮，再进入主燃烧室，一点也不浪费。猛禽 3 看上去光秃秃的，是因为猛禽 2 露在外面的管路现在都做进了壳体里。把它拆开，就能看到这些藏起来的通路，再一步步看下去。",
      specs: [["推力", `海平面 ${R3.thrust} 吨力 · 真空 ${R3.vac} 吨力`], ["燃烧室压力", `${R3.pc} bar（测试中 ${R3.pcTest}）`], ["比冲", `${R3.ispSL} 秒 · 真空版 ${R3.ispVac} 秒`], ["质量", `${R3.mass.toLocaleString("en-US")} 千克`], ["混合比", `氧 : 甲烷 = ${R3.mix} : 1`]],
    },
    steps: {
      1: {
        title: "两台泵",
        say: "1 · 推进剂进入两台涡轮泵",
        text: "液氧和液态甲烷从贮箱流来时只有几个大气压，分别进入两台涡轮泵，每种推进剂一台。每台泵都要把压力提到远高于主燃烧室，因为推进剂在路上还要先经过预燃室和涡轮。",
        specs: [["氧泵", "由富氧燃气驱动"], ["甲烷泵", "由富燃燃气驱动"]],
      },
      2: {
        title: "甲烷给发动机降温",
        say: "2 · 甲烷沿喷管和燃烧室壁向上流",
        text: "甲烷在燃烧之前，先给发动机降温。它从泵出来后流到喷管下部的集合环，再沿着喷管和燃烧室壁里的通道一路向上，带走里面燃气的热量，最后在燃烧室顶部流出时已经被加热。",
        specs: [["冷却剂", "全部甲烷"], ["路径", "喷管集合环 → 壁内通道 → 燃烧室顶部"]],
      },
      3: {
        title: "两个预燃室",
        say: "3 · 每个预燃室烧掉一点另一种推进剂",
        text: "这就是“全流量”的由来。全部液氧进入富氧预燃室，和少量甲烷一起燃烧；全部甲烷进入富燃预燃室，和少量液氧一起燃烧。各自产生一股以一种推进剂为主的热燃气，温度低到涡轮能承受。",
        specs: [["富氧", "全部液氧 + 少量甲烷"], ["富燃", "全部甲烷 + 少量液氧"]],
      },
      4: {
        title: "先过涡轮，再到喷注器",
        say: "4 · 热燃气带动各自的泵，再流向喷注器",
        text: "每股热燃气驱动自己那台泵上的涡轮：富氧燃气带动氧泵，富燃燃气带动甲烷泵，所以泵里不需要密封件把氧和甲烷隔开。两股燃气仍然保持着高压，接着流到主喷注器。",
        specs: [["氧这一侧", "富氧燃气 → 氧涡轮 → 喷注器"], ["甲烷这一侧", "富燃燃气 → 甲烷涡轮 → 喷注器"]],
      },
      5: {
        title: "主燃烧室",
        say: `5 · 气与气在燃烧室相遇，${R3.pc} bar`,
        text: `两股热燃气在喷注器里相遇，都已经是气体，在约 ${R3.pc} bar 下完全燃烧。燃气穿过狭窄的喉部加速，在钟形喷管里膨胀。因为没有任何推进剂为了驱动泵而被排掉，全部推进剂都用来产生推力。`,
        specs: [["燃烧室", `${R3.pc} bar · 测试中 ${R3.pcTest} bar`], ["推力", `海平面 ${R3.thrust} 吨力`]],
      },
    },
  },
};
