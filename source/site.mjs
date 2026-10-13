// The launch site at Starbase, shared by Figs 3 and 5: the concrete apron and its steel plate, the tower with its
// lattice, the two catch arms prebuilt from open (frame 0) to closed, and the launch mount, each split into what
// stands behind the vehicle at the origin and what stands in front of it.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

const DEG = Math.PI / 180;
export const APRON = { x: -60, y: -36, w: 104, d: 80, r: 3 };
export const TOWER = { x0: -36, x1: -24, y0: -6, y1: 6, height: 146 };
export const OLM_TOP = 20;

// arm: { z, hingeX, y, length, half, depth, open } in metres; frames: how many steps from open to closed.
export function launchSite(P, { U, arm: ARM, frames: ARM_FRAMES }) {
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const atM = (p) => at(p.map((v) => v * U));
  const S = (paths, style) => k.solidSvg(paths, style);
  const Ln = (d, style) => k.lineSvg(d, style);
  const Dots = (points, style) => k.dotsSvg(points, style);
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
  return { back: site.back.join(""), olmBack, olmFront, armBack, armFront };
}
