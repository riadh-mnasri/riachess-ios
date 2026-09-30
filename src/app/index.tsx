// © 2026 Riadh MNASRI
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../i18n";
import { MiniBoard } from "../ui/board/MiniBoard";
import { colors, radius } from "../ui/theme";
import { Wordmark } from "../ui/Wordmark";

// Partie de l'Opéra (Morphy, 1858), juste avant 17.Td8#.
const HERO_FEN = "1n2kb1r/p4ppp/4q3/4p1B1/4P3/8/PPP2PPP/2KR4 w k - 0 17";

const MODES = [
  { key: "bot", icon: "hardware-chip-outline", route: "/play/bot" },
  { key: "online", icon: "globe-outline", route: "/online" },
  { key: "puzzles", icon: "extension-puzzle-outline", route: "/puzzles" },
  { key: "analysis", icon: "analytics-outline", route: "/analysis" },
  { key: "learn", icon: "school-outline", route: null },
] as const;

export default function Home() {
  const { t, language, toggleLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 560) - 40;
  const heroBoard = Math.min(contentWidth * 0.42, 190);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 20, paddingBottom: 24 },
      ]}
    >
      <View style={[styles.column, { width: contentWidth }]}>
        <View style={styles.topBar}>
          <View>
            <Wordmark />
            <Text style={styles.tagline}>{t.home.tagline}</Text>
          </View>
          <Pressable
            onPress={toggleLanguage}
            style={({ pressed }) => [styles.langChip, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={language === "fr" ? "Switch to English" : "Passer en français"}
          >
            <Text style={styles.langText}>{language === "fr" ? "EN" : "FR"}</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push("/play/local")}
          style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
          accessibilityRole="button"
        >
            <View style={styles.heroGlow} />
            <View style={styles.heroText}>
              <View style={styles.heroBadge}>
                <Ionicons name="people" size={13} color={colors.canvas} />
                <Text style={styles.heroBadgeText}>{t.home.localTitle}</Text>
              </View>
              <Text style={styles.heroBody}>{t.home.localBody}</Text>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>{t.home.playNow}</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.canvas} />
              </View>
            </View>
            <View style={styles.heroBoard}>
              <MiniBoard fen={HERO_FEN} size={heroBoard} />
            </View>
        </Pressable>

        <Text style={styles.sectionTitle}>{t.home.modesTitle}</Text>
        <View style={styles.list}>
          {MODES.map(({ key, icon, route }, index) => (
            <Pressable
              key={key}
              disabled={!route}
              onPress={() => route && router.push(route)}
              style={({ pressed }) => [
                styles.row,
                index < MODES.length - 1 && styles.rowDivider,
                !route && styles.rowSoon,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !route }}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={icon} size={20} color={colors.gold} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{t.home.modes[key].title}</Text>
                <Text style={styles.rowBody}>{t.home.modes[key].body}</Text>
              </View>
              {route ? (
                <Ionicons name="chevron-forward" size={18} color={colors.gold} />
              ) : (
                <Text style={styles.soon}>{t.home.comingSoon}</Text>
              )}
            </Pressable>
          ))}
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  content: { alignItems: "center" },
  column: { gap: 18 },
  topBar: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  tagline: { color: colors.muted, fontSize: 14, marginTop: 2 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: 6,
  },
  langText: { color: colors.gold, fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  pressed: { opacity: 0.7 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: "hidden",
    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
  },
  heroPressed: { transform: [{ scale: 0.985 }] },
  heroGlow: {
    position: "absolute",
    right: -60,
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: colors.goldSoft,
  },
  heroText: { flex: 1, gap: 12 },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  heroBadgeText: { color: colors.canvas, fontWeight: "800", fontSize: 13 },
  heroBody: { color: colors.ivory, fontSize: 15, lineHeight: 21 },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.ivory,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  ctaText: { color: colors.canvas, fontWeight: "800", fontSize: 14 },
  heroBoard: {
    transform: [{ rotate: "-4deg" }],
    boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)",
    borderRadius: 10,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 6,
  },
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowSoon: { opacity: 0.55 },
  rowPressed: { backgroundColor: colors.surfaceHigh },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowTitle: { color: colors.ivory, fontSize: 15, fontWeight: "700" },
  rowBody: { color: colors.muted, fontSize: 13, marginTop: 2 },
  soon: {
    color: colors.faint,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});
