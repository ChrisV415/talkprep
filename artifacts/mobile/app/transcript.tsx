import { Feather } from "@expo/vector-icons";
import { router, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";
import { streamRequest } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface AnnotatedMsg {
  role: "user" | "assistant";
  content: string;
  annotation?: string;
  isGood?: boolean;
  annotating?: boolean;
}

export default function TranscriptScreen() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scenario, outcome, who, rpMessages } = useApp();
  const [messages, setMessages] = useState<AnnotatedMsg[]>([]);
  const annotatingRef = useRef(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    const initial: AnnotatedMsg[] = rpMessages.map((m) => ({
      role: m.role,
      content: m.content,
      annotating: m.role === "user",
    }));
    setMessages(initial);

    if (!annotatingRef.current) {
      annotatingRef.current = true;
      annotateMessages(initial);
    }
  }, []);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  async function annotateMessages(msgs: AnnotatedMsg[]) {
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role !== "user") continue;

      const context = msgs
        .slice(Math.max(0, i - 2), i + 2)
        .map((m) => `${m.role === "user" ? "User" : "Them"}: ${m.content}`)
        .join("\n");

      let annotText = "";
      const token = await getToken();
      await streamRequest(
        "api/talkprep/annotate",
        { scenario, outcome, context, message: msgs[i].content },
        (chunk) => {
          annotText += chunk;
        },
        () => {
          const isGood = annotText.toUpperCase().includes("RATING: GOOD");
          const match = annotText.match(/ANNOTATION:\s*([\s\S]*)/);
          const note = match ? match[1].trim() : annotText.trim();
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[i]) {
              updated[i] = {
                ...updated[i],
                annotation: note,
                isGood,
                annotating: false,
              };
            }
            return updated;
          });
        },
        () => {
          setMessages((prev) => {
            const updated = [...prev];
            if (updated[i]) {
              updated[i] = { ...updated[i], annotating: false };
            }
            return updated;
          });
        },
        token,
      );

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const styles = makeStyles(colors);
  const topPad = insets.top;
  const personName = who.split(/[,.]/)[0]?.trim() || "Them";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <Text style={styles.topTitle}>Annotated Transcript</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        overScrollMode="never"
      >
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[styles.messageRow, { borderBottomColor: colors.border }]}
          >
            <View style={styles.msgHeader}>
              <Text style={[styles.speaker, { color: colors.ink3 }]}>
                {msg.role === "user" ? "YOU" : personName.toUpperCase()}
              </Text>
              {msg.role === "user" && (
                <View
                  style={[styles.tag, { backgroundColor: colors.rustLight }]}
                >
                  <Text style={[styles.tagText, { color: colors.rustDim }]}>
                    YOUR MESSAGE
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.msgText}>{msg.content}</Text>
            {msg.role === "user" && (
              <View
                style={[
                  styles.annotationBox,
                  msg.isGood
                    ? {
                        backgroundColor: colors.sageLight,
                        borderLeftColor: colors.sage,
                      }
                    : {
                        backgroundColor: colors.rustLight,
                        borderLeftColor: colors.rust,
                      },
                ]}
              >
                {msg.annotating ? (
                  <View style={styles.annotatingRow}>
                    <ActivityIndicator size="small" color={colors.rust} />
                    <Text style={styles.annotatingText}>Analyzing...</Text>
                  </View>
                ) : msg.annotation ? (
                  <View style={styles.annotationContent}>
                    <Feather
                      name={msg.isGood ? "check" : "alert-triangle"}
                      size={13}
                      color={msg.isGood ? colors.sage : colors.rust}
                    />
                    <Text
                      style={[
                        styles.annotationText,
                        {
                          color: msg.isGood ? colors.sageDark : colors.rustDim,
                        },
                      ]}
                    >
                      {msg.annotation}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={styles.scoreBtn}
          onPress={() => router.push("/score")}
        >
          <Text style={styles.scoreBtnText}>Score my performance</Text>
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
    backBtn: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Sora_600SemiBold",
    },
    content: { paddingVertical: 8 },
    messageRow: {
      borderBottomWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    msgHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 6,
    },
    speaker: {
      fontSize: 10,
      letterSpacing: 1,
      fontFamily: "Sora_600SemiBold",
      fontWeight: "600",
    },
    tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
    tagText: {
      fontSize: 8,
      fontFamily: "Sora_600SemiBold",
      letterSpacing: 0.5,
    },
    msgText: {
      fontSize: 14,
      color: colors.ink2,
      lineHeight: 22,
      fontFamily: "Sora_400Regular",
    },
    annotationBox: {
      marginTop: 8,
      borderLeftWidth: 2,
      padding: 8,
      borderRadius: 3,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    },
    annotatingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    annotatingText: {
      fontSize: 11,
      color: colors.rust,
      fontFamily: "Sora_400Regular",
    },
    annotationContent: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
    },
    annotationText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: "Sora_400Regular",
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    scoreBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.rust,
      paddingVertical: 15,
      borderRadius: 28,
    },
    scoreBtnText: {
      color: colors.cream,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: "Sora_600SemiBold",
    },
  });
}
