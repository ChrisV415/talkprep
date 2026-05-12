import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  ImageSourcePropType,
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

type ScenarioItem = {
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  hint: string;
  image?: ImageSourcePropType;
};

type VerticalId = "general" | "healthcare" | "legal" | "hr" | "sales";

type Vertical = {
  id: VerticalId;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  scenarios: ScenarioItem[];
};

const VERTICALS: Vertical[] = [
  {
    id: "general",
    label: "General",
    icon: "home",
    color: "#C67C4E",
    scenarios: [
      { label: "Resignation", icon: "log-out", hint: "Leaving a job", image: require("../../assets/images/scenario_resign.jpg") },
      { label: "Salary negotiation", icon: "trending-up", hint: "Ask for what you're worth", image: require("../../assets/images/scenario_salary.jpg") },
      { label: "Difficult feedback", icon: "message-circle", hint: "Hard truths", image: require("../../assets/images/scenario_feedback.jpg") },
      { label: "Family confrontation", icon: "users", hint: "Family dynamics", image: require("../../assets/images/scenario_family.jpg") },
      { label: "Relationship talk", icon: "heart", hint: "Important conversations", image: require("../../assets/images/scenario_relationship.jpg") },
      { label: "Firing someone", icon: "user-x", hint: "Ending employment", image: require("../../assets/images/scenario_firing.jpg") },
      { label: "Confronting a friend", icon: "user", hint: "Friendship tension", image: require("../../assets/images/scenario_friend.jpg") },
      { label: "Setting a boundary", icon: "shield", hint: "Protect your limits", image: require("../../assets/images/scenario_boundary.jpg") },
      { label: "Bad news to client", icon: "alert-circle", hint: "Deliver difficult news", image: require("../../assets/images/scenario_client.jpg") },
      { label: "Landlord dispute", icon: "home", hint: "Housing issues", image: require("../../assets/images/scenario_landlord.jpg") },
      { label: "Other difficult conversation", icon: "edit-3", hint: "Something else" },
    ],
  },
  {
    id: "healthcare",
    label: "Healthcare",
    icon: "activity",
    color: "#4A7C6F",
    scenarios: [
      { label: "Breaking bad news", icon: "alert-circle", hint: "Serious diagnosis or prognosis" },
      { label: "End-of-life care conversation", icon: "heart", hint: "Goals of care & comfort" },
      { label: "Addiction intervention", icon: "user", hint: "Substance use conversation" },
      { label: "Mental health crisis", icon: "shield", hint: "Patient in acute distress" },
      { label: "Informed consent", icon: "file-text", hint: "Procedure or treatment decision" },
      { label: "Difficult patient or family", icon: "users", hint: "Managing conflict & anger" },
      { label: "Reporting a colleague error", icon: "alert-triangle", hint: "Patient safety disclosure" },
      { label: "Clinical team conflict", icon: "message-circle", hint: "Interprofessional tension" },
    ],
  },
  {
    id: "legal",
    label: "Legal",
    icon: "briefcase",
    color: "#5B6DA8",
    scenarios: [
      { label: "Client deposition prep", icon: "file-text", hint: "Preparing client to testify" },
      { label: "Settlement negotiation", icon: "trending-up", hint: "Reaching a deal" },
      { label: "Delivering bad case news", icon: "alert-circle", hint: "Weak position or loss" },
      { label: "Workplace investigation interview", icon: "search", hint: "Sensitive fact-finding" },
      { label: "Client expectation reset", icon: "refresh-cw", hint: "Scope or timeline change" },
      { label: "Mediation session", icon: "users", hint: "Neutral dispute resolution" },
      { label: "Confidentiality concern", icon: "lock", hint: "Privilege or disclosure issues" },
    ],
  },
  {
    id: "hr",
    label: "HR & Managers",
    icon: "users",
    color: "#8B6BB1",
    scenarios: [
      { label: "Performance improvement plan", icon: "trending-down", hint: "Placing an employee on a PIP" },
      { label: "Termination conversation", icon: "user-x", hint: "Ending employment" },
      { label: "Hard performance review", icon: "clipboard", hint: "Honest feedback session" },
      { label: "Denying a raise or promotion", icon: "x-circle", hint: "Saying no with care" },
      { label: "Team conflict resolution", icon: "shuffle", hint: "Between two employees" },
      { label: "Layoff notification", icon: "alert-triangle", hint: "Workforce reduction" },
      { label: "Promotion conversation", icon: "award", hint: "Delivering good news well" },
      { label: "Harassment complaint handling", icon: "shield", hint: "Sensitive HR investigation" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: "bar-chart-2",
    color: "#C0763A",
    scenarios: [
      { label: "Price objection", icon: "dollar-sign", hint: "Defending your value" },
      { label: "Procurement pushback", icon: "alert-circle", hint: "Contract under pressure" },
      { label: "Renewal at risk", icon: "refresh-cw", hint: "Saving a churning account" },
      { label: "Stalled deal close", icon: "target", hint: "Moving a stuck opportunity" },
      { label: "Executive sponsor conversation", icon: "trending-up", hint: "C-suite alignment" },
      { label: "Lost deal debrief", icon: "x-circle", hint: "Learning from a loss" },
      { label: "Competitive displacement", icon: "zap", hint: "Unseating a competitor" },
      { label: "Asking for a referral", icon: "share-2", hint: "Warm introduction request" },
    ],
  },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, sessionsLoaded, isPro, isProLoaded, setScenario, resetCurrentSession, loadSession } = useApp();
  const recentSessions = sessions.slice(0, 3);
  const [activeVertical, setActiveVertical] = useState<VerticalId>("general");

  const vertical = VERTICALS.find((v) => v.id === activeVertical)!;
  const accentColor = vertical.color;

  function startWithScenario(scenario: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sessionsLoaded && isProLoaded && sessions.length > 0 && !isPro) {
      router.push("/upgrade");
      return;
    }
    resetCurrentSession();
    setScenario(scenario);
    router.push("/prep");
  }

  function startFresh() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sessionsLoaded && isProLoaded && sessions.length > 0 && !isPro) {
      router.push("/upgrade");
      return;
    }
    resetCurrentSession();
    router.push("/prep");
  }

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
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Prepare for conversations that matter</Text>
        </View>
        <Pressable style={styles.newBtn} onPress={startFresh}>
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text style={styles.newBtnText}>New Prep</Text>
        </Pressable>
      </View>

      {/* Hero banner */}
      <View style={styles.heroBanner}>
        <Image
          source={require("../../assets/images/hero.jpg")}
          style={styles.heroBannerImg}
          resizeMode="cover"
        />
        <View style={styles.heroBannerOverlay} />
        <View style={styles.heroBannerText}>
          <Text style={styles.heroTitle}>
            Say the hard thing,{"\n"}
            <Text style={{ fontStyle: "italic" }}>the right way.</Text>
          </Text>
          <Text style={styles.heroSub}>
            AI-powered prep for difficult conversations — walk in confident, not nervous.
          </Text>
        </View>
      </View>

      {/* Vertical tabs */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionLabel}>QUICK START</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.verticalTabsRow}
        style={{ marginBottom: 14 }}
      >
        {VERTICALS.map((v) => {
          const active = v.id === activeVertical;
          return (
            <Pressable
              key={v.id}
              style={[
                styles.verticalTab,
                active
                  ? { backgroundColor: v.color, borderColor: v.color }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveVertical(v.id);
              }}
            >
              <Feather
                name={v.icon}
                size={13}
                color={active ? "#fff" : colors.ink3}
                style={{ marginRight: 5 }}
              />
              <Text
                style={[
                  styles.verticalTabText,
                  { color: active ? "#fff" : colors.ink3 },
                ]}
              >
                {v.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Scenario grid for active vertical */}
      <View style={styles.scenarioGrid}>
        {vertical.scenarios.map((sc) => (
          <Pressable
            key={sc.label}
            style={({ pressed }) => [
              styles.scenarioCard,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() => startWithScenario(sc.label)}
          >
            {sc.image ? (
              <View style={styles.cardImageWrap}>
                <Image source={sc.image} style={styles.cardImage} resizeMode="cover" />
                <View style={styles.cardImageOverlay} />
              </View>
            ) : (
              <View style={[styles.scenarioIconWrap, { backgroundColor: `${accentColor}18` }]}>
                <Feather name={sc.icon} size={18} color={accentColor} />
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.scenarioTitle}>{sc.label}</Text>
              <Text style={styles.scenarioHint}>{sc.hint}</Text>
            </View>
          </Pressable>
        ))}
        {/* Custom scenario card */}
        <Pressable
          style={({ pressed }) => [styles.scenarioCard, styles.customCard, { opacity: pressed ? 0.75 : 1, borderColor: accentColor + "55" }]}
          onPress={startFresh}
        >
          <View style={[styles.scenarioIconWrap, { backgroundColor: `${accentColor}18`, margin: 12, marginBottom: 4 }]}>
            <Feather name="edit-3" size={18} color={accentColor} />
          </View>
          <View style={styles.cardBody}>
            <Text style={[styles.scenarioTitle, { color: accentColor }]}>Custom</Text>
            <Text style={styles.scenarioHint}>Describe your own</Text>
          </View>
        </Pressable>
      </View>

      {/* Recent sessions */}
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
                                  v >= 4 ? colors.sage : v >= 2 ? colors.rust : colors.cream3,
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
    logo: { width: 60, height: 60, marginBottom: 2 },
    tagline: { fontSize: 11, color: colors.ink3, fontFamily: "Sora_400Regular", marginTop: 2 },
    newBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.rust,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 22,
    },
    newBtnText: { color: colors.primaryForeground, fontSize: 13, fontWeight: "500", fontFamily: "Sora_500Medium" },

    heroBanner: { marginHorizontal: 16, marginBottom: 4, borderRadius: 20, overflow: "hidden", height: 170, position: "relative" },
    heroBannerImg: { width: "100%", height: "100%" },
    heroBannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(49,49,49,0.52)" },
    heroBannerText: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 18 },
    heroTitle: { fontSize: 22, fontWeight: "700", color: "#fff", lineHeight: 28, letterSpacing: -0.5, fontFamily: "Sora_700Bold", marginBottom: 6 },
    heroSub: { fontSize: 12, color: "rgba(255,255,255,0.80)", lineHeight: 18, fontFamily: "Sora_400Regular" },

    sectionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 10,
    },
    sectionLabel: { fontSize: 10, fontWeight: "600", color: colors.rust, letterSpacing: 1.5, fontFamily: "Sora_600SemiBold" },
    seeAll: { fontSize: 12, color: colors.ink3, fontFamily: "Sora_400Regular" },

    verticalTabsRow: { paddingHorizontal: 16, gap: 8, flexDirection: "row" },
    verticalTab: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      ...(Platform.OS === "web" ? {} : {}),
    },
    verticalTabText: { fontSize: 12, fontWeight: "600", fontFamily: "Sora_600SemiBold" },

    scenarioGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 10 },
    scenarioCard: {
      width: "47%",
      backgroundColor: "#ffffff",
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 2,
    },
    customCard: {
      borderWidth: 1.5,
      borderStyle: "dashed",
      backgroundColor: "transparent",
      shadowOpacity: 0,
      elevation: 0,
    },
    cardImageWrap: { width: "100%", height: 78, position: "relative" },
    cardImage: { width: "100%", height: "100%" },
    cardImageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.08)" },
    cardBody: { padding: 12 },
    scenarioIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      margin: 12,
      marginBottom: 4,
    },
    scenarioTitle: { fontSize: 13, fontWeight: "600", color: colors.ink, fontFamily: "Sora_600SemiBold", lineHeight: 18 },
    scenarioHint: { fontSize: 11, color: colors.ink3, fontFamily: "Sora_400Regular", marginTop: 2 },

    sessionList: {
      marginHorizontal: 16,
      borderRadius: 16,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 2,
    },
    sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
    sessionLeft: { flex: 1 },
    sessionScenario: { fontSize: 9, letterSpacing: 1, fontFamily: "Sora_600SemiBold", marginBottom: 2 },
    sessionWho: { fontSize: 14, fontWeight: "600", color: colors.ink, fontFamily: "Sora_600SemiBold" },
    sessionRight: { alignItems: "flex-end", gap: 4 },
    scoreDots: { flexDirection: "row", gap: 3 },
    scoreDot: { width: 8, height: 8, borderRadius: 4 },
    sessionDate: { fontSize: 10, color: colors.ink4, fontFamily: "Sora_400Regular" },
  });
}
