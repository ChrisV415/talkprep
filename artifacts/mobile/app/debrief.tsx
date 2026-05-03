import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "@/context/AppContext";
import { streamRequest } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const OUTCOME_CHIPS = [
  "Went well",
  "Could be better",
  "Difficult",
  "Ongoing",
  "Avoided it",
];

export default function DebriefScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scenario, who, situation, scores, currentSessionId, updateSessionDebrief } = useApp();

  const [happened, setHappened] = useState("");
  const [different, setDifferent] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [debriefText, setDebriefText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const debriefRef = useRef("");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  async function generateDebrief() {
    if (!happened.trim() || isGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    debriefRef.current = "";
    setDebriefText("");

    await streamRequest(
      "api/talkprep/debrief",
      { scenario, who, situation, outcome: selectedOutcome || "Not specified", happened, different, scores },
      (chunk) => {
        debriefRef.current += chunk;
        setDebriefText(debriefRef.current);
      },
      async () => {
        setIsGenerating(false);
        if (currentSessionId) {
          await updateSessionDebrief(currentSessionId, {
            outcome: selectedOutcome,
            happened,
            different,
            text: debriefRef.current,
          });
        }
      },
      () => setIsGenerating(false)
    );
  }

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <Text style={styles.topTitle}>Debrief</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTag}>POST-CONVERSATION</Text>
        <Text style={styles.sectionTitle}>How did it actually go?</Text>
        <Text style={styles.sectionHint}>
          If you've had the real conversation, reflect on what happened. If not, skip this for later.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>ACTUAL OUTCOME</Text>
          <View style={styles.chips}>
            {OUTCOME_CHIPS.map((c) => (
              <Pressable
                key={c}
                style={[
                  styles.chip,
                  selectedOutcome === c && {
                    backgroundColor: colors.rustLight,
                    borderColor: colors.rust,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSelectedOutcome(selectedOutcome === c ? "" : c);
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedOutcome === c && {
                      color: colors.rustDim,
                      fontFamily: "Sora_600SemiBold",
                    },
                  ]}
                >
                  {c}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>WHAT HAPPENED?</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe how the actual conversation went..."
            placeholderTextColor={colors.ink4}
            value={happened}
            onChangeText={setHappened}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>WHAT WOULD YOU DO DIFFERENTLY?</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Optional — anything you'd change? (optional)"
            placeholderTextColor={colors.ink4}
            value={different}
            onChangeText={setDifferent}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {debriefText ? (
          <View style={styles.debriefCard}>
            <View style={styles.debriefHeader}>
              <Feather name="message-circle" size={14} color={colors.rust} />
              <Text style={styles.debriefHeaderText}>YOUR DEBRIEF</Text>
            </View>
            <Text style={styles.debriefText}>{debriefText}</Text>
            {isGenerating && (
              <View style={styles.generatingRow}>
                <ActivityIndicator size="small" color={colors.rust} />
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {!debriefText ? (
          <Pressable
            style={[
              styles.generateBtn,
              { opacity: happened.trim() && !isGenerating ? 1 : 0.4 },
            ]}
            onPress={generateDebrief}
            disabled={!happened.trim() || isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color={colors.cream} size="small" />
            ) : (
              <Feather name="zap" size={16} color={colors.cream} />
            )}
            <Text style={styles.generateBtnText}>
              {isGenerating ? "Reflecting..." : "Get my debrief"}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.doneBtn}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.dismissAll();
            }}
          >
            <Feather name="check" size={16} color={colors.cream} />
            <Text style={styles.doneBtnText}>Done — back to home</Text>
          </Pressable>
        )}
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
    fieldGroup: { marginBottom: 18 },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.ink2,
      letterSpacing: 1.2,
      fontFamily: "Sora_600SemiBold",
      marginBottom: 8,
    },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 20,
      backgroundColor: "white",
    },
    chipText: { fontSize: 13, color: colors.ink2, fontFamily: "Sora_400Regular" },
    input: {
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 12,
      padding: 14,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: "white",
      fontFamily: "Sora_400Regular",
    },
    textarea: { minHeight: 90, paddingTop: 14 },
    debriefCard: {
      backgroundColor: colors.rustPale,
      borderWidth: 1,
      borderColor: colors.rustLight,
      borderRadius: 16,
      padding: 16,
      marginTop: 4,
    },
    debriefHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 10,
    },
    debriefHeaderText: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.rust,
      letterSpacing: 1,
      fontFamily: "Sora_600SemiBold",
    },
    debriefText: {
      fontSize: 15,
      color: colors.ink2,
      lineHeight: 26,
      fontFamily: "Sora_400Regular",
    },
    generatingRow: { marginTop: 10, alignItems: "center" },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    generateBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.rust,
      paddingVertical: 15,
      borderRadius: 28,
    },
    generateBtnText: {
      color: colors.cream,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
    doneBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.rust,
      paddingVertical: 15,
      borderRadius: 28,
    },
    doneBtnText: {
      color: colors.cream,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
  });
}
