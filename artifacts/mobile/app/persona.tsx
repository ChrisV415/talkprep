import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Slider from "@react-native-community/slider";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { Persona, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

const REACTIONS = [
  "Defensive",
  "Dismissive",
  "Emotional",
  "Reasonable",
  "Confrontational",
  "Avoidant",
  "Cooperative",
  "Passive-aggressive",
];

const DIFFICULTIES = ["Realistic", "Challenging", "Curveball"];

export default function PersonaScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { who, persona, setPersona } = useApp();

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  function update(key: keyof Persona, value: string | number) {
    setPersona({ ...persona, [key]: value });
  }

  function toggleReaction(r: string) {
    Haptics.selectionAsync();
    update("reaction", persona.reaction === r ? "" : r);
  }

  function setDifficulty(d: string) {
    Haptics.selectionAsync();
    update("difficulty", d);
  }

  function startRoleplay() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push("/roleplay");
  }

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const personName = who.split(/[,.]/ )[0]?.trim() || "the other person";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <Text style={styles.topTitle}>Configure Persona</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        overScrollMode="never"
      >
        <Text style={styles.sectionTag}>PRACTICE PARTNER</Text>
        <Text style={styles.sectionTitle}>How does {personName} tend to behave?</Text>
        <Text style={styles.sectionHint}>
          Tune these to make your practice more realistic. Defaults are fine if you're unsure.
        </Text>

        {[
          {
            key: "emotional_intensity" as keyof Persona,
            label: "Emotional Intensity",
            low: "Stays calm",
            high: "Gets emotional",
          },
          {
            key: "defensiveness" as keyof Persona,
            label: "Defensiveness",
            low: "Open",
            high: "Gets defensive",
          },
          {
            key: "communication" as keyof Persona,
            label: "Communication Style",
            low: "Direct",
            high: "Indirect",
          },
          {
            key: "power" as keyof Persona,
            label: "Power Dynamic",
            low: "Equal",
            high: "Has authority",
          },
        ].map((trait) => (
          <View key={trait.key} style={styles.traitCard}>
            <Text style={styles.traitLabel}>{trait.label}</Text>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={100}
              step={1}
              value={persona[trait.key] as number}
              onValueChange={(v) => update(trait.key, Math.round(v))}
              minimumTrackTintColor={colors.rust}
              maximumTrackTintColor={colors.cream3}
              thumbTintColor={colors.rust}
            />
            <View style={styles.traitEnds}>
              <Text style={styles.traitEnd}>{trait.low}</Text>
              <Text style={styles.traitEnd}>{trait.high}</Text>
            </View>
          </View>
        ))}

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>TYPICAL REACTIONS</Text>
          <View style={styles.reactionGrid}>
            {REACTIONS.map((r) => (
              <Pressable
                key={r}
                style={[
                  styles.reactionBtn,
                  persona.reaction === r && {
                    backgroundColor: colors.rustLight,
                    borderColor: colors.rust,
                  },
                ]}
                onPress={() => toggleReaction(r)}
              >
                <Text
                  style={[
                    styles.reactionBtnText,
                    persona.reaction === r && {
                      color: colors.rustDim,
                      fontFamily: "Sora_600SemiBold",
                    },
                  ]}
                >
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>DIFFICULTY</Text>
          <View style={styles.difficultyRow}>
            {DIFFICULTIES.map((d) => (
              <Pressable
                key={d}
                style={[
                  styles.difficultyBtn,
                  persona.difficulty === d && {
                    backgroundColor: colors.rustLight,
                    borderColor: colors.rust,
                  },
                ]}
                onPress={() => setDifficulty(d)}
              >
                <Text
                  style={[
                    styles.difficultyBtnText,
                    persona.difficulty === d && {
                      color: colors.rustDim,
                      fontFamily: "Sora_600SemiBold",
                    },
                  ]}
                >
                  {d}
                </Text>
              </Pressable>
            ))}
          </View>
          {persona.difficulty === "Curveball" && (
            <Text style={styles.difficultyHint}>
              The AI will introduce 2 unexpected curveballs during practice.
            </Text>
          )}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>EXTRA CONTEXT</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Anything else about this person or situation..."
            placeholderTextColor={colors.ink4}
            value={persona.extra}
            onChangeText={(v) => update("extra", v)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={styles.skipBtn} onPress={startRoleplay}>
          <Text style={styles.skipBtnText}>Skip — use defaults</Text>
        </Pressable>
        <Pressable style={styles.startBtn} onPress={startRoleplay}>
          <Feather name="play" size={16} color={colors.cream} />
          <Text style={styles.startBtnText}>Start Practice</Text>
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
      fontSize: 20,
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
    traitCard: {
      backgroundColor: "white",
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 2,
    },
    traitLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.ink2,
      fontFamily: "Sora_600SemiBold",
      marginBottom: 8,
    },
    slider: { width: "100%", height: 30 },
    traitEnds: { flexDirection: "row", justifyContent: "space-between" },
    traitEnd: {
      fontSize: 10,
      color: colors.ink4,
      fontFamily: "Sora_400Regular",
    },
    fieldGroup: { marginTop: 16 },
    fieldLabel: {
      fontSize: 10,
      fontWeight: "600",
      color: colors.ink2,
      letterSpacing: 1.2,
      fontFamily: "Sora_600SemiBold",
      marginBottom: 8,
    },
    reactionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    reactionBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 20,
      backgroundColor: "white",
    },
    reactionBtnText: {
      fontSize: 12,
      color: colors.ink2,
      fontFamily: "Sora_400Regular",
    },
    difficultyRow: { flexDirection: "row", gap: 8 },
    difficultyBtn: {
      flex: 1,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 20,
      backgroundColor: "white",
      alignItems: "center",
    },
    difficultyBtnText: {
      fontSize: 13,
      color: colors.ink2,
      fontFamily: "Sora_400Regular",
    },
    difficultyHint: {
      fontSize: 11,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
      marginTop: 6,
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
    textarea: { minHeight: 80, paddingTop: 14 },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    skipBtn: {
      flex: 0,
      paddingHorizontal: 18,
      paddingVertical: 15,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    skipBtnText: {
      fontSize: 13,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
    },
    startBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.rust,
      paddingVertical: 15,
      borderRadius: 28,
    },
    startBtnText: {
      color: colors.cream,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
  });
}
