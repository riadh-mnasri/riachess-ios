// © 2026 Riadh MNASRI
// Embarque Stockfish (build « lite single-thread », WASM) dans un module TypeScript,
// pour qu'il tourne hors ligne dans un Web Worker (web) ou une WebView (Android, iOS).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bin = join(root, "node_modules", "stockfish", "bin");
// stockfish.js lit l'adresse de son WASM dans le fragment (#) de l'URL du worker.
// Safari gère mal un fragment sur un worker créé depuis un blob : on lui fait lire
// une variable globale posée juste avant, à la place.
const HASH_READ = 'self.location.hash.substr(1).split(",")';
const original = readFileSync(join(bin, "stockfish-19-lite-single.js"), "utf8");
if (!original.includes(HASH_READ)) throw new Error("stockfish.js a changé : lecture du fragment introuvable");
const script = original.replace(HASH_READ, '(self.__stockfishWasm||self.location.hash).substr(1).split(",")');
const wasm = readFileSync(join(bin, "stockfish-19-lite-single.wasm")).toString("base64");

const target = join(root, "src", "infrastructure", "engine", "generated");
mkdirSync(target, { recursive: true });
writeFileSync(
  join(target, "stockfishBundle.ts"),
  "// Fichier généré par scripts/build-engine.mjs, ne pas modifier.\n" +
    `export const STOCKFISH_JS = ${JSON.stringify(script)};\n` +
    `export const STOCKFISH_WASM_BASE64 = ${JSON.stringify(wasm)};\n`,
);
console.log(`Stockfish embarqué (${Math.round(wasm.length / 1024)} Ko en base64)`);
