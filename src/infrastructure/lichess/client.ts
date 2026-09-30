// © 2026 Riadh MNASRI
import { fetch } from "expo/fetch";
import { createLineSplitter } from "../../domain/online";

const BASE = "https://lichess.org";

export interface LichessAccount {
  id: string;
  username: string;
  perfs?: Record<string, { rating: number } | undefined>;
}

export class LichessError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Client de l'API Lichess (Board API), authentifié par un jeton OAuth du joueur. */
export class LichessClient {
  constructor(private readonly token: string) {}

  private async request(path: string, init: { method?: string; body?: string; signal?: AbortSignal } = {}) {
    const response = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      body: init.body,
      signal: init.signal,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(init.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      },
    });
    if (!response.ok) throw new LichessError(response.status, await response.text());
    return response;
  }

  /** Lit une réponse NDJSON au fil de l'eau ; se termine quand Lichess ferme le flux. */
  private async stream<T>(
    path: string,
    onEvent: (event: T) => void,
    init: { method?: string; body?: string; signal?: AbortSignal } = {},
  ): Promise<void> {
    const response = await this.request(path, init);
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    const split = createLineSplitter();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of split(decoder.decode(value, { stream: true }))) {
        onEvent(JSON.parse(line) as T);
      }
    }
  }

  account(): Promise<LichessAccount> {
    return this.request("/api/account").then((response) => response.json() as Promise<LichessAccount>);
  }

  /** Événements du joueur : début et fin de partie, défis. */
  streamEvents(onEvent: (event: { type: string; game?: { gameId: string } }) => void, signal: AbortSignal) {
    return this.stream("/api/stream/event", onEvent, { signal });
  }

  /** Cherche un adversaire ; la recherche reste active tant que la connexion est ouverte. */
  seek(options: { minutes: number; increment: number; rated: boolean }, signal: AbortSignal) {
    const body = new URLSearchParams({
      time: String(options.minutes),
      increment: String(options.increment),
      rated: String(options.rated),
    }).toString();
    return this.stream("/api/board/seek", () => undefined, { method: "POST", body, signal });
  }

  streamGame(gameId: string, onEvent: (event: { type: string }) => void, signal: AbortSignal) {
    return this.stream(`/api/board/game/stream/${gameId}`, onEvent, { signal });
  }

  move(gameId: string, uci: string) {
    return this.request(`/api/board/game/${gameId}/move/${uci}`, { method: "POST" });
  }

  resign(gameId: string) {
    return this.request(`/api/board/game/${gameId}/resign`, { method: "POST" });
  }

  abort(gameId: string) {
    return this.request(`/api/board/game/${gameId}/abort`, { method: "POST" });
  }

  /** Propose ou accepte la nulle (`true`), ou refuse une proposition (`false`). */
  draw(gameId: string, accept: boolean) {
    return this.request(`/api/board/game/${gameId}/draw/${accept ? "yes" : "no"}`, { method: "POST" });
  }

  /** Révoque le jeton côté Lichess. */
  revoke() {
    return this.request("/api/token", { method: "DELETE" });
  }
}
