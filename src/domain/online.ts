// © 2026 Riadh MNASRI
import { parseUciMove } from "./bot";
import { newGame, playMove, START_FEN, turnOf, type Color, type GameState } from "./game";

/**
 * Cadences proposées. L'API Board de Lichess n'accepte les parties contre un
 * inconnu qu'en rapide ou plus lent (durée estimée : temps + 40 × incrément ≥ 8 min).
 */
export const RAPID_CONTROLS = [
  { minutes: 10, increment: 0 },
  { minutes: 10, increment: 5 },
  { minutes: 15, increment: 10 },
  { minutes: 30, increment: 0 },
] as const;

export interface LichessPlayer {
  id?: string;
  name?: string;
  rating?: number;
  title?: string | null;
  aiLevel?: number;
}

/** Statuts de partie Lichess : « started » tant qu'elle se joue. */
export type LichessStatus =
  | "created"
  | "started"
  | "aborted"
  | "mate"
  | "resign"
  | "stalemate"
  | "timeout"
  | "draw"
  | "outoftime"
  | "cheat"
  | "noStart"
  | "unknownFinish"
  | "variantEnd";

export interface LichessGameState {
  type: "gameState";
  moves: string;
  wtime: number;
  btime: number;
  winc: number;
  binc: number;
  status: LichessStatus;
  winner?: "white" | "black";
  wdraw?: boolean;
  bdraw?: boolean;
}

export interface LichessGameFull {
  type: "gameFull";
  id: string;
  rated: boolean;
  speed: string;
  white: LichessPlayer;
  black: LichessPlayer;
  initialFen: string;
  clock: { initial: number; increment: number } | null;
  state: LichessGameState;
}

export interface OnlineGame {
  id: string;
  rated: boolean;
  myColor: Color;
  me: LichessPlayer;
  opponent: LichessPlayer;
  initialFen: string;
  uciMoves: string[];
  board: GameState;
  clock: { w: number; b: number; receivedAt: number };
  increment: number;
  status: LichessStatus;
  winner: Color | null;
  /** Le camp adverse propose la nulle. */
  opponentOffersDraw: boolean;
}

/** Découpe un flux NDJSON reçu par morceaux en lignes JSON complètes (lignes vides ignorées). */
export function createLineSplitter(): (chunk: string) => string[] {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    return parts.map((line) => line.trim()).filter((line) => line.length > 0);
  };
}

function boardFrom(initialFen: string, uciMoves: readonly string[]): GameState {
  let board = newGame(initialFen);
  for (const uci of uciMoves) {
    const move = parseUciMove(uci);
    const next = move ? playMove(board, move) : null;
    if (!next) break;
    board = next;
  }
  return board;
}

const splitMoves = (moves: string) => (moves.trim() ? moves.trim().split(/\s+/) : []);
const colorOf = (winner?: "white" | "black"): Color | null => (winner ? (winner === "white" ? "w" : "b") : null);

export function onlineGameFromFull(full: LichessGameFull, myId: string, receivedAt: number): OnlineGame {
  const isWhite = full.white.id?.toLowerCase() === myId.toLowerCase();
  const initialFen = full.initialFen === "startpos" ? START_FEN : full.initialFen;
  const myColor: Color = isWhite ? "w" : "b";
  const base: OnlineGame = {
    id: full.id,
    rated: full.rated,
    myColor,
    me: isWhite ? full.white : full.black,
    opponent: isWhite ? full.black : full.white,
    initialFen,
    uciMoves: [],
    board: newGame(initialFen),
    clock: { w: full.state.wtime, b: full.state.btime, receivedAt },
    increment: (full.clock?.increment ?? 0) * 1000,
    status: full.state.status,
    winner: null,
    opponentOffersDraw: false,
  };
  return applyGameState(base, full.state, receivedAt);
}

export function applyGameState(game: OnlineGame, state: LichessGameState, receivedAt: number): OnlineGame {
  const uciMoves = splitMoves(state.moves);
  const sameMoves = uciMoves.length === game.uciMoves.length && uciMoves.every((move, index) => move === game.uciMoves[index]);
  return {
    ...game,
    uciMoves,
    board: sameMoves ? game.board : boardFrom(game.initialFen, uciMoves),
    clock: { w: state.wtime, b: state.btime, receivedAt },
    status: state.status,
    winner: colorOf(state.winner),
    opponentOffersDraw: game.myColor === "w" ? !!state.bdraw : !!state.wdraw,
  };
}

/** Temps restant d'un camp à l'instant `now` ; la pendule ne tourne qu'après le premier coup de chacun. */
export function remainingTime(game: OnlineGame, color: Color, now: number): number {
  const base = game.clock[color];
  const running = game.status === "started" && game.uciMoves.length >= 2 && turnOf(game.board) === color;
  return running ? Math.max(0, base - (now - game.clock.receivedAt)) : base;
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type OnlineOutcome = "win" | "loss" | "draw" | "aborted";

export function resultOf(game: OnlineGame): { outcome: OnlineOutcome; reason: LichessStatus } | null {
  if (game.status === "started" || game.status === "created") return null;
  if (game.status === "aborted" || game.status === "noStart") return { outcome: "aborted", reason: game.status };
  if (!game.winner) return { outcome: "draw", reason: game.status };
  return { outcome: game.winner === game.myColor ? "win" : "loss", reason: game.status };
}
