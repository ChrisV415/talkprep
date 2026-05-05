import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import React, { useEffect } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { Scores, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const SCORE_DIMS = [
  {
    key: "clarity" as keyof Scores,
    label: "Clarity",
    desc: "How clearly did you communicate your main points?",
  },
  {
    key: "composure" as keyof Scores,
    label: "Composure",
    desc: "How well did you stay calm and focused under pressure?",
  },
  {
    key: "outcome_score" as keyof Scores,
    label: "Outcome",
    desc: "How well did the conversation move toward your goal?",
  },
];

export default function ScoreScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scores, setScores, currentSessionId, updateSessionScores } = useApp();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  const allScored = scores.clarity > 0 && scores.composure > 0 && scores.outcome_score > 0;

  function setScore(dim: keyof Scores, value: number) {
    Haptics.selectionAsync();
    setScores({ ...scores, [dim]: value });
  }

  async function save() {
    if (!allScored) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (currentSessionId) {
      await updateSessionScores(currentSessionId, scores);
    }
    router.push("/debrief");
  }

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <Text style={styles.topTitle}>Rate Your Practice</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        <Text style={styles.sectionTag}>PERFORMANCE SCORES</Text>
        <Text style={styles.sectionTitle}>How did you do?</Text>
        <Text style={styles.sectionHint}>
          Score yourself honestly. This helps track your progress over time.
        </Text>

        {SCORE_DIMS.map((dim) => (
          <View key={dim.key} style={styles.scoreCard}>
            <View style={styles.scoreCardHead}>
              <Text style={styles.scoreName}>{dim.label}</Text>
              {scores[dim.key] > 0 && (
                <Text style={styles.scoreValue}>{scores[dim.key]}/5</Text>
              )}
            </View>
            <Text style={styles.scoreDesc}>{dim.desc}</Text>
            <View style={styles.scoreBtns}>
              {[1, 2, 3, 4, 5].map((v) => (
                <Pressable
                  key={v}
                  style={[
                    styles.scoreBtn,
                    scores[dim.key] === v &&
                      (v === 5
                        ? { backgroundColor: colors.sageLight, borderColor: colors.sage }
                        : { backgroundColor: colors.rustLight, borderColor: colors.rust }),
                  ]}
                  onPress={() => setScore(dim.key, v)}
                >
                  <Text
                    style={[
                      styles.scoreBtnText,
                      scores[dim.key] === v &&
                        (v === 5 ? { color: colors.sageDark } : { color: colors.rustDim }),
                    ]}
                  >
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.saveBtn, { opacity: allScored ? 1 : 0.4 }]}
          onPress={save}
          disabled={!allScored}
        >
          <Text style={styles.saveBtnText}>Save & Get Debrief</Text>
          <Feather name="arrow-right" size={16} color={colors.cream} />
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    topTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Sora_600SemiBold",
    },
    content: { padding: 20 },
    sectionTag: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.rust,
      letterSpacing: 1.5,
      fontFamily: "Sora_600SemiBold",
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.ink,
      fontFamily: "Sora_700Bold",
      marginBottom: 6,
    },
    sectionHint: {
      fontSize: 13,
      color: colors.ink3,
      lineHeight: 19,
      fontFamily: "Sora_400Regular",
      marginBottom: 20,
    },
    scoreCard: {
      backgroundColor: "white",
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 2,
    },
    scoreCardHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    scoreName: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Sora_600SemiBold",
    },
    scoreValue: {
      fontSize: 13,
      color: colors.rust,
      fontFamily: "Sora_600SemiBold",
      fontWeight: "600",
    },
    scoreDesc: {
      fontSize: 12,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
      marginBottom: 12,
      lineHeight: 17,
    },
    scoreBtns: { flexDirection: "row", gap: 8 },
    scoreBtn: {
      flex: 1,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      alignItems: "center",
    },
    scoreBtnText: {
      fontSize: 14,
      color: colors.ink3,
      fontFamily: "Sora_500Medium",
      fontWeight: "500",
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.rust,
      paddingVertical: 15,
      borderRadius: 28,
    },
    saveBtnText: {
      color: colors.cream,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
  });
}
