// © 2026 Riadh MNASRI
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { legalDestinations, pieceAt, playMove, toPgn, turnOf, type Color } from "../domain/game";
import {
  RAPID_CONTROLS,
  applyGameState,
  formatClock,
  onlineGameFromFull,
  remainingTime,
  resultOf,
  type LichessGameFull,
  type LichessGameState,
  type OnlineGame,
} from "../domain/online";
import { useI18n } from "../i18n";
import { LichessClient, type LichessAccount } from "../infrastructure/lichess/client";
import { useLichessAuth } from "../infrastructure/lichess/useLichessAuth";
import { Board } from "../ui/board/Board";
import { haptic } from "../ui/game/GameView";
import { colors, radius } from "../ui/theme";

const isAbort = (error: unknown) => error instanceof Error && error.name === "AbortError";

/**
 * Sur le web, la connexion Lichess (OAuth PKCE) a besoin de WebCrypto, que les
 * navigateurs réservent aux adresses sécurisées (https ou localhost).
 */
const insecureWeb = Platform.OS === "web" && typeof window !== "undefined" && !window.isSecureContext;

export default function OnlineScreen() {
  return insecureWeb ? <InsecureOrigin /> : <OnlinePlay />;
}

function InsecureOrigin() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={[styles.card, { marginHorizontal: 16, maxWidth: 520 }]}>
        <View style={styles.heroIcon}>
          <Ionicons name="lock-closed-outline" size={28} color={colors.gold} />
        </View>
        <Text style={styles.cardTitle}>{t.online.title}</Text>
        <Text style={styles.body}>{t.online.insecure}</Text>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          style={({ pressed }) => [styles.secondaryButton, { alignSelf: "flex-start" }, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={16} color={colors.ivory} />
          <Text style={styles.secondaryText}>{t.game.back}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function OnlinePlay() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const boardSize = Math.floor(Math.min(width - 24, height - insets.top - insets.bottom - 330, 560));

  const auth = useLichessAuth();
  const client = useMemo(() => (auth.token ? new LichessClient(auth.token) : null), [auth.token]);
  const [account, setAccount] = useState<LichessAccount | null>(null);
  const [control, setControl] = useState(0);
  const [rated, setRated] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [now, setNow] = useState(Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [drawSent, setDrawSent] = useState(false);
  const seekAbort = useRef<AbortController | null>(null);

  // Compte Lichess : identifiant (pour savoir de quel côté on joue) et classement rapide.
  useEffect(() => {
    if (!client) {
      setAccount(null);
      return;
    }
    client
      .account()
      .then(setAccount)
      .catch(() => void auth.signOut());
  }, [client, auth.signOut]);

  // Flux d'événements : signale le début d'une partie, y compris une partie déjà en cours.
  useEffect(() => {
    if (!client) return;
    const controller = new AbortController();
    client
      .streamEvents((event) => {
        if (event.type === "gameStart" && event.game) {
          const id = event.game.gameId;
          setGameId((current) => current ?? id);
        }
      }, controller.signal)
      .catch((error: unknown) => {
        if (!isAbort(error)) setNotice(t.online.connectionLost);
      });
    return () => controller.abort();
  }, [client, t.online.connectionLost]);

  // Flux de la partie : état complet puis chaque coup, pendules et fin de partie.
  useEffect(() => {
    if (!client || !gameId || !account) return;
    seekAbort.current?.abort();
    const controller = new AbortController();
    client
      .streamGame(
        gameId,
        (event) => {
          if (event.type === "gameFull") setGame(onlineGameFromFull(event as LichessGameFull, account.id, Date.now()));
          if (event.type === "gameState") {
            setGame((current) => (current ? applyGameState(current, event as LichessGameState, Date.now()) : current));
          }
        },
        controller.signal,
      )
      .catch((error: unknown) => {
        if (!isAbort(error)) setNotice(t.online.connectionLost);
      });
    return () => controller.abort();
  }, [client, gameId, account, t.online.connectionLost]);

  const playing = game?.status === "started";

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [playing]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const lastPlies = useRef(0);
  useEffect(() => {
    if (!game) return;
    if (game.uciMoves.length !== lastPlies.current) {
      lastPlies.current = game.uciMoves.length;
      haptic(game.status === "started" ? "move" : "end");
      setDrawSent(false);
    }
  }, [game]);

  const startSeek = () => {
    if (!client) return;
    const choice = RAPID_CONTROLS[control];
    const controller = new AbortController();
    seekAbort.current = controller;
    setSeeking(true);
    client
      .seek({ minutes: choice.minutes, increment: choice.increment, rated }, controller.signal)
      .catch((error: unknown) => {
        if (!isAbort(error)) setNotice(t.online.connectionLost);
      })
      .finally(() => setSeeking(false));
  };

  const onMove = (from: string, to: string) => {
    if (!client || !game || !playing) return;
    const promotes = pieceAt(game.board, from)?.type === "p" && /[18]$/.test(to);
    const uci = `${from}${to}${promotes ? "q" : ""}`;
    const board = playMove(game.board, { from, to, promotion: promotes ? "q" : undefined });
    if (!board) return;
    const before = game;
    // Affichage immédiat du coup ; Lichess le confirme dans le flux de la partie.
    setGame({ ...game, board, uciMoves: [...game.uciMoves, uci] });
    client.move(game.id, uci).catch(() => {
      setGame(before);
      setNotice(t.online.moveFailed);
    });
  };

  const leaveGame = () => {
    setGame(null);
    setGameId(null);
    setConfirmResign(false);
    lastPlies.current = 0;
  };

  const canPick = useCallback(
    (square: string) =>
      !!game && playing && turnOf(game.board) === game.myColor && pieceAt(game.board, square)?.color === game.myColor,
    [game, playing],
  );
  const destinations = useCallback((square: string) => (game ? legalDestinations(game.board, square) : []), [game]);

  const header = (
    <View style={[styles.header, { width: boardSize }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t.game.back}
      >
        <Ionicons name="chevron-back" size={22} color={colors.ivory} />
      </Pressable>
      <Text style={styles.title}>{t.online.title}</Text>
      <View style={styles.iconButton} />
    </View>
  );

  const toast = notice ? (
    <View style={[styles.toast, { bottom: 80 }]} pointerEvents="none">
      <Ionicons name="warning-outline" size={16} color={colors.danger} />
      <Text style={styles.toastText}>{notice}</Text>
    </View>
  ) : null;

  // Partie en cours ou terminée.
  if (game) {
    const result = resultOf(game);
    const opponentColor: Color = game.myColor === "w" ? "b" : "w";
    const myTurn = playing && turnOf(game.board) === game.myColor;
    const canAbort = game.uciMoves.length < 2;

    const bar = (color: Color) => {
      const player = color === game.myColor ? game.me : game.opponent;
      const active = playing && turnOf(game.board) === color;
      const time = remainingTime(game, color, now);
      return (
        <View style={[styles.player, active && styles.playerActive]}>
          <View style={[styles.dot, { backgroundColor: color === "w" ? colors.ivory : "#05080f" }]} />
          <Text style={[styles.playerName, active && { color: colors.ivory }]} numberOfLines={1}>
            {player.title ? `${player.title} ` : ""}
            {player.name ?? t.online.anonymous}
            {color === game.myColor ? ` (${t.online.you})` : ""}
          </Text>
          {player.rating ? <Text style={styles.rating}>{player.rating}</Text> : null}
          <View style={[styles.clock, active && styles.clockActive, time < 20000 && active && styles.clockLow]}>
            <Text style={[styles.clockText, active && { color: colors.canvas }]}>{formatClock(time)}</Text>
          </View>
        </View>
      );
    };

    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: 8 }]}>
        {header}
        <View style={{ width: boardSize, gap: 10 }}>
          {bar(opponentColor)}
          <View>
            <Board
              fen={game.board.fen}
              size={boardSize}
              orientation={game.myColor}
              lastMove={game.board.lastMove}
              checkSquare={game.board.checkSquare}
              canPick={canPick}
              destinations={destinations}
              onMove={onMove}
            />
            {result ? (
              <View style={styles.overlay}>
                <View style={styles.sheet}>
                  <Ionicons
                    name={result.outcome === "win" ? "trophy" : result.outcome === "loss" ? "flag" : "git-compare-outline"}
                    size={30}
                    color={colors.gold}
                  />
                  <Text style={styles.resultText}>{t.online.outcome[result.outcome]}</Text>
                  {t.online.reason[result.reason] ? <Text style={styles.muted}>{t.online.reason[result.reason]}</Text> : null}
                  <Pressable onPress={leaveGame} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Ionicons name="refresh" size={16} color={colors.canvas} />
                    <Text style={styles.primaryText}>{t.online.newGame}</Text>
                  </Pressable>
                  {game.uciMoves.length > 0 ? (
                    <Pressable
                      onPress={() =>
                        router.push({
                          pathname: "/analysis",
                          params: {
                            pgn: toPgn(game.board, {
                              date: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
                              event: `Lichess ${game.id}`,
                              white: (game.myColor === "w" ? game.me : game.opponent).name,
                              black: (game.myColor === "b" ? game.me : game.opponent).name,
                            }),
                          },
                        })
                      }
                      style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                    >
                      <Ionicons name="analytics" size={16} color={colors.ivory} />
                      <Text style={styles.secondaryText}>{t.online.analyse}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
          {bar(game.myColor)}

          {game.opponentOffersDraw && playing ? (
            <View style={styles.drawBanner}>
              <Text style={styles.drawText}>{t.online.opponentOffersDraw}</Text>
              <Pressable onPress={() => void client?.draw(game.id, true)} style={styles.smallButton}>
                <Text style={styles.smallButtonText}>{t.online.accept}</Text>
              </Pressable>
              <Pressable onPress={() => void client?.draw(game.id, false)} style={styles.smallButtonGhost}>
                <Text style={styles.smallGhostText}>{t.online.decline}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.status}>{playing ? (myTurn ? t.online.yourTurn : t.online.theirTurn) : " "}</Text>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moves} contentContainerStyle={styles.movesContent}>
            {game.board.sanHistory.map((san, index) => (
              <View key={index} style={styles.moveItem}>
                {index % 2 === 0 ? <Text style={styles.moveNumber}>{index / 2 + 1}.</Text> : null}
                <Text style={[styles.moveSan, index === game.board.sanHistory.length - 1 && styles.moveSanLast]}>{san}</Text>
              </View>
            ))}
          </ScrollView>

          {playing ? (
            <View style={styles.actions}>
              <Pressable
                onPress={() => {
                  if (!confirmResign) {
                    setConfirmResign(true);
                    return;
                  }
                  setConfirmResign(false);
                  void (canAbort ? client?.abort(game.id) : client?.resign(game.id));
                }}
                style={({ pressed }) => [styles.action, confirmResign && styles.actionDanger, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="flag-outline" size={18} color={confirmResign ? colors.canvas : colors.ivory} />
                <Text style={[styles.actionText, confirmResign && { color: colors.canvas }]}>
                  {confirmResign ? t.online.confirm : canAbort ? t.online.abort : t.online.resign}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDrawSent(true);
                  void client?.draw(game.id, true);
                }}
                disabled={drawSent || canAbort}
                style={({ pressed }) => [styles.action, (drawSent || canAbort) && styles.disabled, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Ionicons name="git-compare-outline" size={18} color={colors.ivory} />
                <Text style={styles.actionText}>{drawSent ? t.online.drawOffered : t.online.offerDraw}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {toast}
      </View>
    );
  }

  // Connexion, puis choix de la cadence et recherche d'un adversaire.
  const rapid = account?.perfs?.rapid?.rating;
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: 8 }]}>
      {header}
      <ScrollView style={{ width: boardSize }} contentContainerStyle={{ gap: 12, paddingVertical: 8 }}>
        {auth.state === "loading" || (auth.state === "signedIn" && !account) ? (
          <View style={styles.card}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : auth.state !== "signedIn" ? (
          <View style={styles.card}>
            <View style={styles.heroIcon}>
              <Ionicons name="globe-outline" size={30} color={colors.gold} />
            </View>
            <Text style={styles.cardTitle}>{t.online.title}</Text>
            <Text style={styles.body}>{t.online.intro}</Text>
            <View style={styles.note}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
              <Text style={[styles.muted, { flex: 1 }]}>{t.online.fairPlay}</Text>
            </View>
            {auth.error ? <Text style={styles.error}>{t.online.signInError}</Text> : null}
            <Pressable
              onPress={auth.signIn}
              disabled={!auth.ready || auth.state === "signingIn"}
              style={({ pressed }) => [styles.primaryButton, (!auth.ready || auth.state === "signingIn") && styles.disabled, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              {auth.state === "signingIn" ? (
                <ActivityIndicator size="small" color={colors.canvas} />
              ) : (
                <Ionicons name="log-in-outline" size={18} color={colors.canvas} />
              )}
              <Text style={styles.primaryText}>{auth.state === "signingIn" ? t.online.signingIn : t.online.signIn}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.accountCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.muted}>{t.online.connectedAs}</Text>
                <Text style={styles.username}>{account?.username}</Text>
                {rapid ? <Text style={styles.ratingLine}>{t.online.rapidRating(rapid)}</Text> : null}
              </View>
              <Pressable
                onPress={() => {
                  void client?.revoke().catch(() => undefined);
                  void auth.signOut();
                }}
                style={({ pressed }) => [styles.smallButtonGhost, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.smallGhostText}>{t.online.signOut}</Text>
              </Pressable>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>{t.online.timeControl}</Text>
              <View style={styles.controls}>
                {RAPID_CONTROLS.map(({ minutes, increment }, index) => (
                  <Pressable
                    key={`${minutes}+${increment}`}
                    onPress={() => setControl(index)}
                    disabled={seeking}
                    style={({ pressed }) => [styles.control, index === control && styles.chipActive, pressed && styles.pressed]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: index === control }}
                  >
                    <Text style={[styles.controlText, index === control && styles.chipTextActive]}>
                      {minutes}+{increment}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.muted}>{t.online.rapidOnly}</Text>
              <View style={styles.toggle}>
                {[false, true].map((value) => (
                  <Pressable
                    key={String(value)}
                    onPress={() => setRated(value)}
                    disabled={seeking}
                    style={[styles.toggleOption, rated === value && styles.chipActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: rated === value }}
                  >
                    <Text style={[styles.controlText, rated === value && styles.chipTextActive]}>
                      {value ? t.online.rated : t.online.casual}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {seeking ? (
                <View style={styles.seeking}>
                  <ActivityIndicator color={colors.gold} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seekingText}>{t.online.seeking}</Text>
                    <Text style={styles.muted}>{t.online.seekingHint}</Text>
                  </View>
                  <Pressable onPress={() => seekAbort.current?.abort()} style={styles.smallButtonGhost} accessibilityRole="button">
                    <Text style={styles.smallGhostText}>{t.online.cancel}</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={startSeek} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]} accessibilityRole="button">
                  <Ionicons name="search" size={18} color={colors.canvas} />
                  <Text style={styles.primaryText}>{t.online.seek}</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </ScrollView>
      {toast}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", gap: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.ivory, fontSize: 17, fontWeight: "800" },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.4 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  body: { color: colors.ivory, fontSize: 15, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 13, fontWeight: "600" },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: colors.ivory, fontSize: 20, fontWeight: "800" },
  note: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.gold,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
  primaryText: { color: colors.canvas, fontWeight: "800", fontSize: 15 },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryText: { color: colors.ivory, fontWeight: "700", fontSize: 14 },
  accountCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  username: { color: colors.ivory, fontSize: 18, fontWeight: "800" },
  ratingLine: { color: colors.gold, fontSize: 13, fontWeight: "700", marginTop: 2 },
  label: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  controls: { flexDirection: "row", gap: 8 },
  control: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlText: { color: colors.muted, fontWeight: "800", fontSize: 15 },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  chipTextActive: { color: colors.gold },
  toggle: { flexDirection: "row", gap: 8 },
  toggleOption: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seeking: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHigh,
  },
  seekingText: { color: colors.ivory, fontWeight: "700", fontSize: 14 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.gold },
  smallButtonText: { color: colors.canvas, fontWeight: "800", fontSize: 13 },
  smallButtonGhost: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  smallGhostText: { color: colors.ivory, fontWeight: "700", fontSize: 13 },
  player: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 46,
  },
  playerActive: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceHigh },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: colors.borderStrong },
  playerName: { flex: 1, color: colors.muted, fontWeight: "700", fontSize: 15 },
  rating: { color: colors.faint, fontSize: 13, fontWeight: "600" },
  clock: {
    minWidth: 76,
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.canvas,
  },
  clockActive: { backgroundColor: colors.ivory },
  clockLow: { backgroundColor: colors.danger },
  clockText: { color: colors.muted, fontSize: 18, fontWeight: "800", fontVariant: ["tabular-nums"] },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11, 18, 38, 0.55)",
    borderRadius: 6,
  },
  sheet: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 18,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.5)",
  },
  resultText: { color: colors.ivory, fontSize: 18, fontWeight: "800" },
  status: { color: colors.muted, fontSize: 14, textAlign: "center" },
  drawBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  drawText: { flex: 1, color: colors.ivory, fontWeight: "700", fontSize: 13 },
  moves: {
    flexGrow: 0,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  movesContent: { paddingHorizontal: 12, paddingVertical: 10, gap: 10, minHeight: 40, alignItems: "center" },
  moveItem: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  moveNumber: { color: colors.faint, fontSize: 13, fontWeight: "600" },
  moveSan: { color: colors.ivory, fontSize: 14, fontWeight: "600", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 5 },
  moveSanLast: { backgroundColor: colors.goldSoft, color: colors.gold },
  actions: { flexDirection: "row", gap: 8 },
  action: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionDanger: { backgroundColor: colors.danger, borderColor: colors.danger },
  actionText: { color: colors.ivory, fontWeight: "700", fontSize: 14 },
  toast: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toastText: { color: colors.ivory, fontWeight: "600", fontSize: 13 },
});
