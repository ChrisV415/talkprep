import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

type Tab = "opening" | "keypoints" | "responses" | "raw";

function parseSections(text: string) {
  const sections: Record<string, string> = {};
  if (!text) return sections;

  const lines = text.split(/\r?\n/);
  let currentHeader: string | null = null;
  let contentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const nextTrimmed = lines[i + 1]?.trim() ?? "";

    const isHeader =
      trimmed.length > 2 &&
      /^[A-Z][A-Z ]+$/.test(trimmed) &&
      (nextTrimmed === "---" || nextTrimmed.startsWith("---"));

    if (isHeader) {
      if (currentHeader !== null) {
        sections[currentHeader] = contentLines.join("\n").trim();
      }
      currentHeader = trimmed;
      contentLines = [];
      i++; // skip the "---" line
    } else if (currentHeader !== null) {
      contentLines.push(lines[i]);
    }
  }

  if (currentHeader !== null) {
    sections[currentHeader] = contentLines.join("\n").trim();
  }

  return sections;
}

export default function ResultScreen() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scenario, who, fullResponse, resetCurrentSession } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>("opening");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const sections = useMemo(() => parseSections(fullResponse), [fullResponse]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

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

  async function handleShare() {
    if (!fullResponse) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const text = `TalkPrep Guide — ${scenario}${who ? ` with ${who}` : ""}\n${"─".repeat(40)}\n\n${fullResponse}`;
    if (Platform.OS === "web") {
      try {
        if (navigator?.share) {
          await navigator.share({ title: "My TalkPrep Guide", text });
        } else if (navigator?.clipboard) {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch {
        // dismissed
      }
      return;
    }
    try {
      await Share.share({ message: text, title: "My TalkPrep Guide" });
    } catch {
      // dismissed
    }
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
        <Pressable
          onPress={handleShare}
          style={styles.shareBtn}
          disabled={!fullResponse}
          accessibilityLabel="Share prep guide"
          accessibilityRole="button"
        >
          {copied ? (
            <Text style={styles.copiedText}>Copied!</Text>
          ) : (
            <Feather name="share" size={19} color={fullResponse ? colors.ink3 : colors.border} />
          )}
        </Pressable>
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
          onPress={() => {
            resetCurrentSession();
            router.push("/prep");
          }}
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
    shareBtn: { width: 52, height: 36, alignItems: "center", justifyContent: "center" },
    copiedText: { fontSize: 11, color: colors.rust, fontFamily: "Sora_600SemiBold" },
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
