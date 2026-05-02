import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const SCENARIOS = [
  { label: "Resignation", icon: "log-out" as const, hint: "Leaving a job" },
  { label: "Salary negotiation", icon: "trending-up" as const, hint: "Ask for what you're worth" },
  { label: "Difficult feedback", icon: "message-circle" as const, hint: "Hard truths" },
  { label: "Family confrontation", icon: "users" as const, hint: "Family dynamics" },
  { label: "Relationship talk", icon: "heart" as const, hint: "Important conversations" },
  { label: "Firing someone", icon: "user-x" as const, hint: "Ending employment" },
  { label: "Confronting a friend", icon: "user" as const, hint: "Friendship tension" },
  { label: "Setting a boundary", icon: "shield" as const, hint: "Protect your limits" },
  { label: "Bad news to client", icon: "alert-circle" as const, hint: "Deliver difficult news" },
  { label: "Landlord dispute", icon: "home" as const, hint: "Housing issues" },
  { label: "Other difficult conversation", icon: "edit-3" as const, hint: "Something else" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, setScenario, resetCurrentSession, loadSession } = useApp();
  const recentSessions = sessions.slice(0, 3);

  function startWithScenario(scenario: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetCurrentSession();
    setScenario(scenario);
    router.push("/prep");
  }

  function startFresh() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetCurrentSession();
    router.push("/prep");
  }

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={styles.logoText}>
            Talk<Text style={{ color: colors.rust }}>Prep</Text>
          </Text>
          <Text style={styles.tagline}>Prepare for conversations that matter</Text>
        </View>
        <Pressable style={styles.newBtn} onPress={startFresh}>
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={styles.newBtnText}>New Prep</Text>
        </Pressable>
      </View>

      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>
          Say the hard thing,{"\n"}
          <Text style={{ color: colors.rust, fontStyle: "italic" }}>the right way.</Text>
        </Text>
        <Text style={styles.heroSub}>
          AI-powered prep for difficult conversations — so you walk in confident, not nervous.
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>QUICK START</Text>
      </View>
      <View style={styles.scenarioGrid}>
        {SCENARIOS.map((sc) => (
          <Pressable
            key={sc.label}
            style={({ pressed }) => [
              styles.scenarioCard,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => startWithScenario(sc.label)}
          >
            <View style={styles.scenarioIconWrap}>
              <Feather name={sc.icon} size={18} color={colors.rust} />
            </View>
            <Text style={styles.scenarioTitle}>{sc.label}</Text>
            <Text style={styles.scenarioHint}>{sc.hint}</Text>
          </Pressable>
        ))}
      </View>

      {recentSessions.length > 0 && (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>RECENT SESSIONS</Text>
            <Pressable onPress={() => router.push("/(tabs)/history")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          <View style={[styles.sessionList, { borderColor: colors.border }]}>
            {recentSessions.map((s, i) => (
              <Pressable
                key={s.id}
                style={({ pressed }) => [
                  styles.sessionRow,
                  {
                    borderBottomWidth: i < recentSessions.length - 1 ? 1 : 0,
                    borderBottomColor: colors.border,
                    backgroundColor: pressed ? colors.cream2 : colors.card,
                  },
                ]}
                onPress={() => {
                  const { loadSession } = useApp();
                  loadSession(s);
                  router.push("/result");
                }}
              >
                <View style={styles.sessionLeft}>
                  <Text style={[styles.sessionScenario, { color: colors.rust }]}>
                    {s.scenario.toUpperCase()}
                  </Text>
                  <Text style={styles.sessionWho}>{s.who.split(/[,.]/ )[0]?.trim()}</Text>
                </View>
                <View style={styles.sessionRight}>
                  {s.scores ? (
                    <View style={styles.scoreDots}>
                      {[s.scores.clarity, s.scores.composure, s.scores.outcome_score].map(
                        (v, idx) => (
                          <View
                            key={idx}
                            style={[
                              styles.scoreDot,
                              {
                                backgroundColor:
                                  v >= 4
                                    ? colors.sage
                                    : v >= 2
                                    ? colors.rust
                                    : colors.cream3,
                              },
                            ]}
                          />
                        )
                      )}
                    </View>
                  ) : null}
                  <Text style={styles.sessionDate}>{s.date}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    logoText: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.ink,
      fontFamily: "Inter_700Bold",
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 11,
      color: colors.ink3,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.ink,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 6,
    },
    newBtnText: {
      color: colors.primaryForeground,
      fontSize: 13,
      fontWeight: "500",
      fontFamily: "Inter_500Medium",
    },
    heroSection: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    heroTitle: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.ink,
      lineHeight: 34,
      letterSpacing: -0.5,
      fontFamily: "Inter_700Bold",
      marginBottom: 10,
    },
    heroSub: {
      fontSize: 14,
      color: colors.ink2,
      lineHeight: 21,
      fontFamily: "Inter_400Regular",
    },
    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.rust,
      letterSpacing: 1.5,
      fontFamily: "Inter_600SemiBold",
    },
    seeAll: {
      fontSize: 12,
      color: colors.ink3,
      fontFamily: "Inter_400Regular",
    },
    scenarioGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: 16,
      gap: 8,
    },
    scenarioCard: {
      width: "47%",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 14,
    },
    scenarioIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.rustLight,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    scenarioTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Inter_600SemiBold",
      lineHeight: 18,
    },
    scenarioHint: {
      fontSize: 11,
      color: colors.ink3,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    sessionList: {
      marginHorizontal: 16,
      borderWidth: 1,
      borderRadius: 6,
      overflow: "hidden",
    },
    sessionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 14,
    },
    sessionLeft: { flex: 1 },
    sessionScenario: {
      fontSize: 9,
      letterSpacing: 1,
      fontFamily: "Inter_600SemiBold",
      marginBottom: 2,
    },
    sessionWho: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Inter_600SemiBold",
    },
    sessionRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    scoreDots: { flexDirection: "row", gap: 3 },
    scoreDot: { width: 8, height: 8, borderRadius: 4 },
    sessionDate: {
      fontSize: 10,
      color: colors.ink4,
      fontFamily: "Inter_400Regular",
    },
  });
}
