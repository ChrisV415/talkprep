import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function DashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions } = useApp();

  const stats = useMemo(() => {
    const withScores = sessions.filter((s) => s.scores);
    const total = sessions.length;
    const avgClarity = withScores.length
      ? (
          withScores.reduce((a, s) => a + (s.scores!.clarity || 0), 0) /
          withScores.length
        ).toFixed(1)
      : "—";
    const avgComposure = withScores.length
      ? (
          withScores.reduce((a, s) => a + (s.scores!.composure || 0), 0) /
          withScores.length
        ).toFixed(1)
      : "—";
    const avgOutcome = withScores.length
      ? (
          withScores.reduce((a, s) => a + (s.scores!.outcome_score || 0), 0) /
          withScores.length
        ).toFixed(1)
      : "—";

    const scenDist: Record<string, number> = {};
    sessions.forEach((s) => {
      scenDist[s.scenario] = (scenDist[s.scenario] || 0) + 1;
    });
    const topScenarios = Object.entries(scenDist)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const recent = sessions.slice(0, 6).reverse();
    const maxScore = 5;

    return {
      total,
      avgClarity,
      avgComposure,
      avgOutcome,
      withScores,
      topScenarios,
      recent,
      maxScore,
    };
  }, [sessions]);

  const styles = makeStyles(colors);
  const topPad = insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
      bounces={false}
      overScrollMode="never"
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.title}>Progress</Text>
        <Text style={styles.subtitle}>Track how you're improving</Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="bar-chart-2" size={32} color={colors.ink4} />
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyHint}>
            Complete sessions and score them to see your progress
          </Text>
          <Pressable
            style={styles.emptyBtn}
            onPress={() => router.push("/prep")}
          >
            <Text style={styles.emptyBtnText}>Start a prep session</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            {[
              { label: "SESSIONS", value: String(stats.total) },
              { label: "AVG CLARITY", value: String(stats.avgClarity) },
              { label: "AVG COMPOSURE", value: String(stats.avgComposure) },
              { label: "AVG OUTCOME", value: String(stats.avgOutcome) },
            ].map((s) => (
              <View key={s.label} style={styles.statCell}>
                <Text style={styles.statVal}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {stats.recent.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Progress Trend</Text>
                <View
                  style={[styles.badge, { backgroundColor: colors.rustLight }]}
                >
                  <Text style={[styles.badgeText, { color: colors.rustDim }]}>
                    LAST {stats.recent.length}
                  </Text>
                </View>
              </View>
              <View style={styles.trendChart}>
                {stats.recent.map((s) => {
                  const avg = s.scores
                    ? ((s.scores.clarity || 0) +
                        (s.scores.composure || 0) +
                        (s.scores.outcome_score || 0)) /
                      3
                    : 0;
                  const heightPct = s.scores ? Math.max(0.06, avg / 5) : 0.05;
                  return (
                    <View key={s.id} style={styles.trendBarWrap}>
                      <View
                        style={[
                          styles.trendBar,
                          {
                            height: heightPct * 60,
                            backgroundColor: !s.scores
                              ? colors.cream3
                              : avg >= 4
                                ? colors.sage
                                : colors.rust,
                            opacity: s.scores ? 0.85 : 0.35,
                          },
                        ]}
                      />
                      <Text style={styles.trendLabel} numberOfLines={1}>
                        {s.scenario.split(" ")[0]}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.trendNote}>
                Green = avg score ≥ 4 · Orange = needs work · Faded = not yet
                scored
              </Text>
            </View>
          )}

          {stats.topScenarios.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>What You Prep For</Text>
              </View>
              {stats.topScenarios.map(([sc, count]) => (
                <View key={sc} style={styles.scenRow}>
                  <Text style={styles.scenLabel}>{sc}</Text>
                  <Text style={styles.scenCount}>{count}×</Text>
                </View>
              ))}
            </View>
          )}

          {stats.withScores.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Score Breakdown</Text>
              </View>
              {[
                {
                  label: "Clarity",
                  value: parseFloat(String(stats.avgClarity)) || 0,
                },
                {
                  label: "Composure",
                  value: parseFloat(String(stats.avgComposure)) || 0,
                },
                {
                  label: "Outcome",
                  value: parseFloat(String(stats.avgOutcome)) || 0,
                },
              ].map((s) => (
                <View key={s.label} style={styles.barRow}>
                  <Text style={styles.barLabel}>{s.label}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${(s.value / 5) * 100}%` as any,
                          backgroundColor:
                            s.label === "Composure" ? colors.sage : colors.rust,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barVal}>{s.value.toFixed(1)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.ink,
      fontFamily: "Sora_700Bold",
    },
    subtitle: {
      fontSize: 13,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
      marginTop: 2,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      paddingHorizontal: 40,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.ink2,
      fontFamily: "Sora_600SemiBold",
      marginTop: 12,
    },
    emptyHint: {
      fontSize: 14,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
      textAlign: "center",
      lineHeight: 20,
    },
    emptyBtn: {
      marginTop: 16,
      backgroundColor: colors.rust,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 28,
    },
    emptyBtnText: {
      color: "white",
      fontSize: 14,
      fontFamily: "Sora_500Medium",
      fontWeight: "500",
    },
    statsRow: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statCell: {
      flex: 1,
      padding: 16,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      alignItems: "center",
    },
    statVal: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.ink,
      fontFamily: "Sora_700Bold",
    },
    statLabel: {
      fontSize: 8,
      color: colors.ink3,
      fontFamily: "Sora_600SemiBold",
      letterSpacing: 0.8,
      marginTop: 2,
      textAlign: "center",
    },
    card: {
      marginHorizontal: 16,
      marginTop: 16,
      backgroundColor: "white",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      overflow: "hidden",
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Sora_600SemiBold",
    },
    badge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 3 },
    badgeText: {
      fontSize: 9,
      fontWeight: "600",
      letterSpacing: 0.5,
      fontFamily: "Sora_600SemiBold",
    },
    trendChart: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 6,
      height: 80,
      paddingHorizontal: 14,
      paddingTop: 14,
    },
    trendBarWrap: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
    trendBar: { width: "100%", borderRadius: 2, minHeight: 4 },
    trendLabel: {
      fontSize: 8,
      color: colors.ink4,
      fontFamily: "Sora_400Regular",
      marginTop: 4,
      textAlign: "center",
    },
    trendNote: {
      fontSize: 9,
      color: colors.ink4,
      fontFamily: "Sora_400Regular",
      padding: 14,
      paddingTop: 8,
    },
    scenRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    scenLabel: {
      fontSize: 13,
      color: colors.ink2,
      fontFamily: "Sora_400Regular",
      flex: 1,
    },
    scenCount: {
      fontSize: 12,
      color: colors.rust,
      fontFamily: "Sora_600SemiBold",
    },
    barRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    barLabel: {
      fontSize: 12,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
      width: 70,
    },
    barTrack: {
      flex: 1,
      height: 8,
      backgroundColor: colors.cream3,
      borderRadius: 4,
      overflow: "hidden",
    },
    barFill: { height: "100%", borderRadius: 4 },
    barVal: {
      fontSize: 11,
      color: colors.ink3,
      fontFamily: "Sora_500Medium",
      width: 28,
      textAlign: "right",
    },
  });
}
