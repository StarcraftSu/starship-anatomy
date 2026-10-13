// Markup and small helpers every figure module shares: escaping, the words a figure swaps for the reader's language,
// the card's corners, the figure around its card and panel, spec lists, the empty stage the page draws into, the
// mission clock, the timeline figures' card and panel, and screen vectors for a projection.
import * as k from "./kit/iso-kit.mjs";

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

// A timeline figure (Figs 3 and 4): event chips, the stage, Play, Restart and the scrubber, and a panel that can
// link on to the next figure.
export function timelineHtml({ id, cls, W, H, end, start, events, en, head, intro, next = "" }) {
  const tx = wordsFor("ft", en.ui);
  const chips = events.map((event) => `<button type="button" class="ss-part fl-event" data-event="${event.id}"><span class="ss-num">${clockText(event.tm)}</span><span class="fl-event-name">${esc(en.events[event.id].short)}</span></button>`).join("");
  const stage = `<div class="ss-stage fl-stage" tabindex="0" role="slider" data-ft-aria="stage" aria-label="${esc(en.ui.stage)}" aria-valuemin="0" aria-valuemax="${end}" aria-valuenow="0" aria-valuetext="${esc(en.overview.title)}">${waiting(W, H)}</div>`;
  const controls = `<div class="ss-controls fl-controls"><button type="button" class="ss-button" data-play aria-pressed="false">${esc(en.ui.play)}</button><button type="button" class="ss-button" data-restart ${tx("restart")}</button><input class="fl-scrub" type="range" min="0" max="${end}" step="0.05" value="0" data-scrub data-ft-aria="scrub" aria-label="${esc(en.ui.scrub)}"></div>`;
  const nextLink = next ? `<a class="ss-button ss-link" href="#${next}" data-p-next hidden ${tx("toNext")}</a>` : "";
  const panel = `<aside class="iso-plate ss-panel fl-panel" data-ft-aria="panel" aria-label="${esc(en.ui.panel)}"><div class="ss-parts ss-chips2">${chips}</div><h3 class="ss-panel-head"><span class="ss-panel-num" data-p-num>T</span><span class="ss-panel-title" data-p-title>${esc(en.overview.title)}</span></h3><p class="ss-text" data-p-text>${esc(en.overview.text)}</p><dl class="ss-specs" data-p-specs>${specsHtml(en.overview.specs)}</dl><div class="fl-links" data-p-links hidden><span class="fl-links-label" ${tx("linked")}</span><div class="fl-link-list" data-p-link-list></div></div>${nextLink}</aside>`;
  return figureHtml({ id, cls, tx, head, intro, card: cornersHtml(tx, clockText(start)) + stage + controls, panel });
}

// How far one unit along a world vector moves on screen, for projection P.
export const screenOf = (P) => (vector) => {
  const o = k.iso([0, 0, 0], P);
  const p = k.iso(vector, P);
  return [p[0] - o[0], p[1] - o[1]];
};
