// Markup and small helpers every figure module shares: escaping, the words a figure swaps for the reader's language,
// the card's corners, the figure around its card and panel, spec lists, the empty stage the page draws into, the
// mission clock, the timeline figures' card and panel, and screen vectors for a projection.
import * as k from "./kit/iso-kit.mjs";
import * as G from "./kit/lathe.mjs";

export const esc = (text) => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const specsHtml = (list) => list.map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join("");

// tx("figTitle") writes data-<attr>="figTitle">English words; the live script swaps in the reader's language.
export const wordsFor = (attr, ui) => (key) => `data-${attr}="${key}">${esc(ui[key])}`;

export const cornersHtml = (tx, readout) =>
  `<div class="iso-plate-corners" aria-hidden="true"><span class="iso-plate-corner" data-corner="fig" ${tx("fig")}</span><span class="iso-plate-corner" data-corner="title" ${tx("figTitle")}</span><span class="iso-plate-corner" data-corner="readout" data-readout>${esc(readout)}</span></div>`;

// Until the page draws it, a stage holds an empty drawing of the right size, so nothing moves when it arrives.
export const waiting = (W, H) => `<svg class="iso-svg ss-layer" viewBox="0 0 ${W} ${H}" aria-hidden="true"></svg>`;

export const figureHtml = ({ id, cls, tx, head, intro, card, panel }) =>
  `<figure class="iso-figure ss${cls ? ` ${cls}` : ""}" id="${id}"><header class="ss-fig-head"><h2 ${tx(head)}</h2><p ${tx(intro)}</p></header><div class="ss-layout"><div class="iso-plate ss-card">${card}</div>${panel}</div><figcaption class="iso-legend"><span class="iso-caption" ${tx("notes")}</span></figcaption></figure>`;

export const clockText = (tm) => {
  const s = Math.round(Math.abs(tm));
  const sign = tm < 0 ? "−" : "+";
  const sec = String(s % 60).padStart(2, "0");
  if (s < 3600) return `T${sign}${Math.floor(s / 60)}:${sec}`;
  return `T${sign}${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${sec}`;
};

// A timeline figure (Figs 3, 4 and 5): event chips, the stage, Play, Restart and the scrubber, and a panel that can
// switch between variants of the story and link on to the next figure. Text for an event that differs between the
// variants is { variant: words }, and so is its time ({ variant: seconds or null for a plan with no date yet }).
export function timelineHtml({ id, cls, W, H, end, start, events, en, head, intro, next = "", variants = [] }) {
  const tx = wordsFor("ft", en.ui);
  const first = (entry) => (variants.length && entry[variants[0]] ? entry[variants[0]] : entry);
  const timeOf = (tm) => (tm !== null && typeof tm === "object" ? timeOf(tm[variants[0]]) : tm === null ? en.ui.planned : clockText(tm));
  const chips = events.map((event) => `<button type="button" class="ss-part fl-event" data-event="${event.id}"><span class="ss-num">${esc(timeOf(event.tm))}</span><span class="fl-event-name">${esc(first(en.events[event.id]).short)}</span></button>`).join("");
  const switcher = variants.length ? `<div class="ss-pay"><span class="ss-pay-label" ${tx("variantLabel")}</span><div class="ss-seg" role="group">${variants.map((name, index) => `<button type="button" data-variant-set="${name}" aria-pressed="${index === 0}" ${tx(`variant-${name}`)}</button>`).join("")}</div></div>` : "";
  const stage = `<div class="ss-stage fl-stage" tabindex="0" role="slider" data-ft-aria="stage" aria-label="${esc(en.ui.stage)}" aria-valuemin="0" aria-valuemax="${end}" aria-valuenow="0" aria-valuetext="${esc(en.overview.title)}">${waiting(W, H)}</div>`;
  const controls = `<div class="ss-controls fl-controls"><button type="button" class="ss-button" data-play aria-pressed="false">${esc(en.ui.play)}</button><button type="button" class="ss-button" data-restart ${tx("restart")}</button><input class="fl-scrub" type="range" min="0" max="${end}" step="0.05" value="0" data-scrub data-ft-aria="scrub" aria-label="${esc(en.ui.scrub)}"></div>`;
  const nextLink = next ? `<a class="ss-button ss-link" href="#${next}" data-p-next hidden ${tx("toNext")}</a>` : "";
  const panel = `<aside class="iso-plate ss-panel fl-panel" data-ft-aria="panel" aria-label="${esc(en.ui.panel)}"><div class="ss-parts ss-chips2">${chips}</div>${switcher}<h3 class="ss-panel-head"><span class="ss-panel-num" data-p-num>T</span><span class="ss-panel-title" data-p-title>${esc(first(en.overview).title)}</span></h3><p class="ss-text" data-p-text>${esc(first(en.overview).text)}</p><dl class="ss-specs" data-p-specs>${specsHtml(first(en.overview).specs)}</dl><div class="fl-links" data-p-links hidden><span class="fl-links-label" ${tx("linked")}</span><div class="fl-link-list" data-p-link-list></div></div>${nextLink}</aside>`;
  return figureHtml({ id, cls, tx, head, intro, card: cornersHtml(tx, clockText(start)) + stage + controls, panel });
}

// How far one unit along a world vector moves on screen, for projection P.
export const screenOf = (P) => (vector) => {
  const o = k.iso([0, 0, 0], P);
  const p = k.iso(vector, P);
  return [p[0] - o[0], p[1] - o[1]];
};

// A strip of a body of revolution between two angles (radians), only the quads that face the camera, toned by
// facing: a solid's paths without an outline. Rows are [s, r] in drawing units.
export function stripOf(F, rows, from, to, steps, P) {
  const V = G.viewOf(P);
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
      const d = k.pathOf([G.pointOf(F, s0, r0, a0), G.pointOf(F, s0, r0, a1), G.pointOf(F, s1, r1, a1), G.pointOf(F, s1, r1, a0)].map((point) => k.iso(point, P)), true);
      fill.push(d);
      buckets[G.toneOf(n, P)].push(d);
    }
  }
  return { fill: fill.join(""), outline: "", crease: "", top: buckets[4].join(""), shades: buckets.slice(0, 4).map((list) => list.join("")), seamless: true };
}
