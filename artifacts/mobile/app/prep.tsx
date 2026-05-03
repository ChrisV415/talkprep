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

const SCENARIOS = [
  "Resignation",
  "Salary negotiation",
  "Difficult feedback",
  "Family confrontation",
  "Relationship talk",
  "Firing someone",
  "Confronting a friend",
  "Setting a boundary",
  "Bad news to client",
  "Landlord dispute",
  "Other difficult conversation",
];

const TONES = [
  "Direct",
  "Empathetic",
  "Assertive",
  "Collaborative",
  "Calm",
  "Firm",
];

export default function PrepScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    scenario,
    who,
    situation,
    outcome,
    tone,
    setScenario,
    setWho,
    setSituation,
    setOutcome,
    setTone,
    setFullResponse,
    saveSession,
  } = useApp();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showScenarioPicker, setShowScenarioPicker] = useState(false);
  const responseRef = useRef("");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const canGenerate = scenario.trim() && who.trim() && situation.trim();

  async function generate() {
    if (!canGenerate || isGenerating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsGenerating(true);
    responseRef.current = "";

    await streamRequest(
      "api/talkprep/generate",
      { scenario, who, situation, outcome, tone },
      (chunk) => {
        responseRef.current += chunk;
      },
      async () => {
        setFullResponse(responseRef.current);
        const id = await saveSession();
        setIsGenerating(false);
        router.push("/result");
      },
      () => {
        setIsGenerating(false);
      }
    );
  }

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.topBar,
          { paddingTop: topPad + 8 },
        ]}
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <Text style={styles.topTitle}>New Prep</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTag}>CONVERSATION TYPE</Text>
        <Text style={styles.sectionTitle}>What kind of conversation?</Text>
        <Text style={styles.sectionHint}>
          Tell us what you're walking into so we can prepare the right approach.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>SCENARIO</Text>
          <Pressable
            style={styles.selectBtn}
            onPress={() => setShowScenarioPicker(!showScenarioPicker)}
          >
            <Text
              style={[
                styles.selectText,
                { color: scenario ? colors.ink : colors.ink4 },
              ]}
            >
              {scenario || "Select scenario..."}
            </Text>
            <Feather
              name={showScenarioPicker ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.ink3}
            />
          </Pressable>
          {showScenarioPicker && (
            <View style={styles.pickerList}>
              {SCENARIOS.map((sc) => (
                <Pressable
                  key={sc}
                  style={({ pressed }) => [
                    styles.pickerItem,
                    scenario === sc && styles.pickerItemSelected,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                  onPress={() => {
                    setScenario(sc);
                    setShowScenarioPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      scenario === sc && { color: colors.rust, fontFamily: "Sora_600SemiBold" },
                    ]}
                  >
                    {sc}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>WHO IS THIS WITH?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. My manager Sarah, My partner, My landlord"
            placeholderTextColor={colors.ink4}
            value={who}
            onChangeText={setWho}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>YOUR SITUATION</Text>
          <Text style={styles.fieldSub}>
            What's happening? The more specific, the better your prep.
          </Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe what's going on, what led to this, and what you're worried about..."
            placeholderTextColor={colors.ink4}
            value={situation}
            onChangeText={setSituation}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DESIRED OUTCOME</Text>
          <TextInput
            style={styles.input}
            placeholder="What does success look like? (optional)"
            placeholderTextColor={colors.ink4}
            value={outcome}
            onChangeText={setOutcome}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>CONVERSATION TONE</Text>
          <View style={styles.toneGrid}>
            {TONES.map((t) => (
              <Pressable
                key={t}
                style={[
                  styles.toneBtn,
                  tone === t && {
                    backgroundColor: colors.rustLight,
                    borderColor: colors.rust,
                  },
                ]}
                onPress={() => setTone(tone === t ? "" : t)}
              >
                <Text
                  style={[
                    styles.toneBtnText,
                    tone === t && {
                      color: colors.rustDim,
                      fontFamily: "Sora_600SemiBold",
                    },
                  ]}
                >
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + 16 },
          { backgroundColor: colors.background },
        ]}
      >
        <Pressable
          style={[
            styles.generateBtn,
            { opacity: canGenerate && !isGenerating ? 1 : 0.45 },
          ]}
          onPress={generate}
          disabled={!canGenerate || isGenerating}
        >
          {isGenerating ? (
            <>
              <ActivityIndicator color={colors.cream} size="small" />
              <Text style={styles.generateBtnText}>Preparing your guide...</Text>
            </>
          ) : (
            <>
              <Feather name="zap" size={16} color={colors.cream} />
              <Text style={styles.generateBtnText}>Generate my prep guide</Text>
            </>
          )}
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
      marginBottom: 24,
    },
    fieldGroup: { marginBottom: 20 },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.ink2,
      letterSpacing: 1.2,
      fontFamily: "Sora_600SemiBold",
      marginBottom: 6,
    },
    fieldSub: {
      fontSize: 11,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
      marginBottom: 6,
      lineHeight: 16,
    },
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
    textarea: { minHeight: 110, paddingTop: 14 },
    selectBtn: {
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 12,
      padding: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: "white",
    },
    selectText: { fontSize: 14, fontFamily: "Sora_400Regular" },
    pickerList: {
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: colors.input,
      borderRadius: 12,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      overflow: "hidden",
      backgroundColor: "white",
    },
    pickerItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerItemSelected: { backgroundColor: colors.rustPale },
    pickerItemText: {
      fontSize: 14,
      color: colors.ink2,
      fontFamily: "Sora_400Regular",
    },
    toneGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    toneBtn: {
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 20,
      backgroundColor: "white",
    },
    toneBtnText: {
      fontSize: 13,
      color: colors.ink2,
      fontFamily: "Sora_400Regular",
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    generateBtn: {
      backgroundColor: colors.rust,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 16,
      borderRadius: 28,
    },
    generateBtnText: {
      color: colors.cream,
      fontSize: 15,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
  });
}
