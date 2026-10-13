import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "./kit/iso-kit.mjs";
import * as STACK from "./stack.mjs";
import { buildRaptor } from "./raptor.mjs";
import { buildFlight } from "./flight.mjs";
import { buildOrbit } from "./orbit.mjs";
import { buildHome } from "./home.mjs";

// The page ships the code that draws each figure, not the drawing: it holds the words, panels and controls, each
// stage holds an empty drawing of the right size, and the script draws the stages (boot.js). That keeps the page
// a single file that works offline, at a fraction of the size.
const HERE = dirname(fileURLToPath(import.meta.url));
const THEME = process.argv.includes("--light") ? "light" : "dark";
const source = (name) => readFileSync(join(HERE, name), "utf8");

// A small bundler for this project's own modules: each becomes a function scope that returns its exports, and its
// imports read those of the modules before it. It handles only the forms used here (import * as, import { },
// export function and export const, export { a as b }).
function bundle(files) {
  return files
    .map((file) => {
      const id = (path) => path.split("/").pop().replace(".mjs", "");
      const names = [];
      const code = source(file)
        .replace(/^import \* as (\w+) from "([^"]+)";$/gm, (_, as, path) => `const ${as} = SS_MODULES["${id(path)}"];`)
        .replace(/^import \{([^}]+)\} from "([^"]+)";$/gm, (_, list, path) => `const {${list}} = SS_MODULES["${id(path)}"];`)
        .replace(/^export (function|const) (\w+)/gm, (_, kind, name) => (names.push(name), `${kind} ${name}`))
        .replace(/^export \{([^}]+)\};$/gm, (_, list) => (names.push(...list.split(",").map((part) => part.trim().replace(/^(\w+) as (\w+)$/, "$2: $1"))), ""));
      return `SS_MODULES["${id(file)}"] = (() => {\n${code}\nreturn { ${names.join(", ")} };\n})();`;
    })
    .join("\n");
}
const MODULES = `const SS_MODULES = {};\n${bundle(["kit/iso-kit.mjs", "kit/lathe.mjs", "parts.mjs", "site.mjs", "stack.mjs", "raptor.mjs", "flight.mjs", "orbit.mjs", "home.mjs"])}`;
const live = (file, token) => `(${token}) => {\n${source(file)}\n}`;
const FIGURES = `const SS_FIGS = [
  { id: "stack", build: () => SS_MODULES.stack, live: ${live("live.js", "__DATA__")} },
  { id: "raptor", build: () => SS_MODULES.raptor.buildRaptor(), live: ${live("raptor-live.js", "__RAPTOR__")} },
  { id: "flight", build: () => SS_MODULES.flight.buildFlight(), live: ${live("flight-live.js", "__FLIGHT__")} },
  { id: "orbit", build: () => SS_MODULES.orbit.buildOrbit(), live: ${live("orbit-live.js", "__ORBIT__")} },
  { id: "home", build: () => SS_MODULES.home.buildHome(), live: ${live("home-live.js", "__HOME__")} },
];`;
const script = [MODULES, source("runtime.js"), source("timeline.js"), FIGURES, source("boot.js")].join("\n");

const FIG2 = buildRaptor();
const FIG3 = buildFlight();
const FIG4 = buildOrbit();
const FIG5 = buildHome();
const CSS = source("starship.css");
const page = k.pageHtml({ title: STACK.title, theme: THEME, body: `<style>${CSS}</style>${STACK.shell}${FIG2.html}${FIG3.html}${FIG4.html}${FIG5.html}${STACK.footer}`, script, width: 1440 });
const name = THEME === "light" ? "starship-light.html" : "starship.html";
writeFileSync(join(HERE, "..", name), page);
console.log("wrote", name, `${(page.length / 1024).toFixed(0)} KB`, `(script ${(script.length / 1024).toFixed(0)} KB)`);
