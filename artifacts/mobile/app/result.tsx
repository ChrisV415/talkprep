import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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

type Tab = "opening" | "keypoints" | "responses" | "raw";

function parseSections(text: string) {
  const sections: Record<string, string> = {};
  const parts = text.split(/\n(?=[A-Z][A-Z ]+\n---)/);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const header = lines[0]?.trim();
    const dashIdx = lines.findIndex((l) => l.trim() === "---");
    if (header && dashIdx !== -1) {
      const content = lines.slice(dashIdx + 1).join("\n").trim();
      sections[header] = content;
    }
  }
  return sections;
}

export default function ResultScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scenario, who, fullResponse } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("opening");

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const sections = useMemo(() => parseSections(fullResponse), [fullResponse]);

  const tabs: { key: Tab; label: string; section: string }[] = [
    { key: "opening", label: "Opening", section: "OPENING LINE" },
    { key: "keypoints", label: "Key Points", section: "KEY POINTS" },
    { key: "responses", label: "Responses", section: "HOW THEY MIGHT RESPOND" },
    { key: "raw", label: "Full", section: "" },
  ];

  function getContent(tab: Tab) {
    if (tab === "raw") return fullResponse;
    const t = tabs.find((x) => x.key === tab);
    if (!t) return "";
    return sections[t.section] || "Section not found in response.";
  }

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <Text style={styles.topTitle}>Your Prep Guide</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.tag, { backgroundColor: colors.rustLight }]}>
          <Text style={[styles.tagText, { color: colors.rustDim }]}>
            {scenario.toUpperCase()}
          </Text>
        </View>
        {who ? (
          <View style={[styles.tag, { backgroundColor: colors.sageLight }]}>
            <Text style={[styles.tagText, { color: colors.sageDark }]}>
              {who.split(/[,.]/ )[0]?.trim()}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[
              styles.tabItem,
              activeTab === t.key && styles.tabItemActive,
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setActiveTab(t.key);
            }}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === t.key && { color: colors.rust, fontFamily: "Sora_600SemiBold" },
              ]}
            >
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.contentText}>{getContent(activeTab)}</Text>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.roleplayBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/persona");
          }}
        >
          <Feather name="play" size={16} color={colors.cream} />
          <Text style={styles.roleplayBtnText}>Practice Roleplay</Text>
        </Pressable>
        <Pressable
          style={styles.newPrepBtn}
          onPress={() => router.push("/prep")}
        >
          <Feather name="rotate-ccw" size={16} color={colors.ink2} />
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
    metaRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tag: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    tagText: {
      fontSize: 9,
      fontWeight: "600",
      letterSpacing: 0.8,
      fontFamily: "Sora_600SemiBold",
    },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabItem: {
      flex: 1,
      paddingVertical: 12,
      alignItems: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabItemActive: {
      borderBottomColor: colors.rust,
    },
    tabText: {
      fontSize: 12,
      color: colors.ink3,
      fontFamily: "Sora_400Regular",
    },
    content: { padding: 20 },
    contentText: {
      fontSize: 15,
      color: colors.ink2,
      lineHeight: 26,
      fontFamily: "Sora_400Regular",
    },
    footer: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    roleplayBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.rust,
      paddingVertical: 15,
      borderRadius: 28,
    },
    roleplayBtnText: {
      color: colors.cream,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
    newPrepBtn: {
      width: 50,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 25,
      alignItems: "center",
      justifyContent: "center",
    },
  });
}
