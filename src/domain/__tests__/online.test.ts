// © 2026 Riadh MNASRI
import {
  RAPID_CONTROLS,
  applyGameState,
  createLineSplitter,
  formatClock,
  onlineGameFromFull,
  remainingTime,
  resultOf,
  type LichessGameFull,
} from "../online";

const full: LichessGameFull = {
  type: "gameFull",
  id: "xcoxhDvh",
  rated: false,
  speed: "rapid",
  white: { id: "kenneth", name: "Kenneth", rating: 1504 },
  black: { id: "salma", name: "Salma", rating: 1480 },
  initialFen: "startpos",
  clock: { initial: 600000, increment: 0 },
  state: { type: "gameState", moves: "e2e4 e7e5", wtime: 598000, btime: 597000, winc: 0, binc: 0, status: "started" },
};

describe("RAPID_CONTROLS", () => {
  it("ne propose que des cadences acceptées par l'API Board (rapide ou lente)", () => {
    // Given : Lichess estime la durée à temps + 40 × incrément, rapide à partir de 8 minutes
    // When / Then
    RAPID_CONTROLS.forEach(({ minutes, increment }) => {
      expect(minutes * 60 + 40 * increment).toBeGreaterThanOrEqual(480);
    });
  });
});

describe("createLineSplitter", () => {
  it("découpe un flux NDJSON en lignes, même coupé au milieu d'une ligne", () => {
    // Given
    const split = createLineSplitter();

    // When
    const first = split('{"a":1}\n{"b":');
    const second = split('2}\n\n{"c":3}\n');

    // Then
    expect(first).toEqual(['{"a":1}']);
    expect(second).toEqual(['{"b":2}', '{"c":3}']);
  });
});

describe("onlineGameFromFull", () => {
  it("construit la partie du point de vue du joueur connecté", () => {
    // Given / When
    const game = onlineGameFromFull(full, "salma", 1000);

    // Then
    expect(game.myColor).toBe("b");
    expect(game.board.sanHistory).toEqual(["e4", "e5"]);
    expect(game.opponent.name).toBe("Kenneth");
    expect(game.status).toBe("started");
  });

  it("reconnaît le joueur quelle que soit la casse de l'identifiant", () => {
    // Given / When / Then
    expect(onlineGameFromFull(full, "Kenneth", 1000).myColor).toBe("w");
  });
});

describe("applyGameState", () => {
  it("ajoute les nouveaux coups et met à jour les pendules", () => {
    // Given
    const game = onlineGameFromFull(full, "kenneth", 1000);

    // When
    const next = applyGameState(
      game,
      { type: "gameState", moves: "e2e4 e7e5 g1f3", wtime: 590000, btime: 597000, winc: 0, binc: 0, status: "started" },
      2000,
    );

    // Then
    expect(next.board.sanHistory).toEqual(["e4", "e5", "Nf3"]);
    expect(next.clock).toEqual({ w: 590000, b: 597000, receivedAt: 2000 });
  });

  it("enregistre la fin de partie et le vainqueur", () => {
    // Given
    const game = onlineGameFromFull(full, "kenneth", 1000);

    // When
    const next = applyGameState(
      game,
      { type: "gameState", moves: "e2e4 e7e5", wtime: 1, btime: 2, winc: 0, binc: 0, status: "resign", winner: "white" },
      2000,
    );

    // Then
    expect(next.status).toBe("resign");
    expect(next.winner).toBe("w");
    expect(resultOf(next)).toEqual({ outcome: "win", reason: "resign" });
  });
});

describe("remainingTime", () => {
  it("décompte le temps du camp au trait depuis la dernière mise à jour", () => {
    // Given : 2 coups joués, trait aux Blancs
    const game = onlineGameFromFull(full, "kenneth", 1000);

    // When / Then
    expect(remainingTime(game, "w", 4000)).toBe(595000);
    expect(remainingTime(game, "b", 4000)).toBe(597000);
  });

  it("ne décompte pas avant que chaque camp ait joué", () => {
    // Given
    const game = onlineGameFromFull({ ...full, state: { ...full.state, moves: "e2e4" } }, "kenneth", 1000);

    // When / Then
    expect(remainingTime(game, "b", 60000)).toBe(597000);
  });
});

describe("formatClock", () => {
  it("affiche minutes et secondes", () => {
    // Given / When / Then
    expect(formatClock(600000)).toBe("10:00");
    expect(formatClock(65400)).toBe("1:05");
    expect(formatClock(-5)).toBe("0:00");
  });
});
