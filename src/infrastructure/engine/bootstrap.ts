// © 2026 Riadh MNASRI

/**
 * Démarre Stockfish dans un Web Worker à partir du script et du WASM embarqués,
 * et renvoie la fonction d'envoi des commandes UCI.
 *
 * Gardé sous forme de texte : il est injecté tel quel dans la page de la WebView
 * (Android, iOS), où `Function.prototype.toString` ne rendrait pas le source
 * une fois le code compilé par Hermes.
 */
export const START_STOCKFISH_SOURCE = `function startStockfish(script, wasmBase64, onLine) {
  var binary = atob(wasmBase64);
  var bytes = new Uint8Array(binary.length);
  for (var index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  var wasmUrl = URL.createObjectURL(new Blob([bytes], { type: "application/wasm" }));
  // L'adresse du WASM est posée dans une variable globale lue par stockfish.js
  // (voir scripts/build-engine.mjs), plutôt que dans le fragment de l'URL du worker.
  var prelude = "self.__stockfishWasm=" + JSON.stringify("#" + encodeURIComponent(wasmUrl)) + ";\\n";
  var scriptUrl = URL.createObjectURL(new Blob([prelude, script], { type: "application/javascript" }));
  var worker = new Worker(scriptUrl);
  worker.onmessage = function (event) { onLine(String(event.data)); };
  return function (command) { worker.postMessage(command); };
}`;

export type StartStockfish = (
  script: string,
  wasmBase64: string,
  onLine: (line: string) => void,
) => (command: string) => void;
