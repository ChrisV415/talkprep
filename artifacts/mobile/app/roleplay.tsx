import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useNavigation } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView as RNKeyboardAvoidingView } from "react-native";
const KeyboardAvoidingView = RNKeyboardAvoidingView;
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/expo";
import { Redirect } from "expo-router";
import { RpMessage, useApp } from "@/context/AppContext";
import { streamRequest } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import Animated, { FadeInDown } from "react-native-reanimated";

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

let msgCounter = 0;
function newId() {
  msgCounter++;
  return `msg-${Date.now()}-${msgCounter}-${Math.random().toString(36).substr(2, 6)}`;
}

function buildSystemContext(
  scenario: string,
  who: string,
  situation: string,
  outcome: string,
  persona: { emotional_intensity: number; defensiveness: number; communication: number; power: number; reaction: string; difficulty: string; extra: string }
) {
  const traitDesc = `Emotional intensity: ${persona.emotional_intensity}/100 (${persona.emotional_intensity > 60 ? "tends to get emotional" : "stays fairly calm"}).
Defensiveness: ${persona.defensiveness}/100 (${persona.defensiveness > 60 ? "gets defensive" : "relatively open"}).
Communication: ${persona.communication}/100 (${persona.communication > 60 ? "indirect" : "direct"}).
Power dynamic: ${persona.power}/100 (${persona.power > 60 ? "has authority over the user" : "roughly equal"}).
Typical reactions: ${persona.reaction || "varied"}.
Additional context: ${persona.extra || "none"}.
Difficulty: ${persona.difficulty}.`;

  return `You are roleplaying as this specific person: ${who}.
Scenario: ${scenario}. Background: ${situation}.
${outcome ? `The user wants: ${outcome}.` : ""}

Their personality profile:
${traitDesc}

IMPORTANT INSTRUCTIONS:
- Stay in character throughout. Be realistic — not artificially easy or difficult.
- Match the personality profile closely.
- ${persona.difficulty === "Curveball" ? "At some point, introduce 2 unexpected curveballs — things the user did NOT anticipate. Make them realistic, not absurd." : "Respond naturally to what is said."}
- Keep responses to 2-4 sentences like a real conversation.
- Do NOT break character or give coaching. Just be the person.`;
}

export default function RoleplayScreen() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { scenario, who, situation, outcome, persona, rpMessages, setRpMessages, setRpSystemContext } = useApp();

  const [displayMsgs, setDisplayMsgs] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [nudge, setNudge] = useState<string | null>(null);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const historyRef = useRef<RpMessage[]>([]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });

    const sysCtx = buildSystemContext(scenario, who, situation, outcome, persona);
    setRpSystemContext(sysCtx);

    timerRef.current = setInterval(() => setElapsedSecs((s) => s + 1), 1000);

    const systemMsg: ChatMsg = {
      id: newId(),
      role: "system",
      content: `Practice started. You're talking to: ${who.split(/[,.]/ )[0]?.trim() || "them"}. Start the conversation with what you'd actually say.`,
    };
    setDisplayMsgs([systemMsg]);
    historyRef.current = [];

    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = useCallback((secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");
    setIsStreaming(true);
    setShowTyping(true);
    setNudge(null);

    const userMsg: ChatMsg = { id: newId(), role: "user", content: text };
    setDisplayMsgs((prev) => [...prev, userMsg]);

    const newHistory: RpMessage[] = [...historyRef.current, { role: "user", content: text }];
    historyRef.current = newHistory;
    const newExchanges = exchangeCount + 1;
    setExchangeCount(newExchanges);

    const sysCtx = buildSystemContext(scenario, who, situation, outcome, persona);
    let fullContent = "";
    let assistantAdded = false;
    const assistantId = newId();

    const token = await getToken();
    await streamRequest(
      "api/talkprep/roleplay",
      { messages: newHistory, systemContext: sysCtx },
      (chunk) => {
        fullContent += chunk;
        if (!assistantAdded) {
          setShowTyping(false);
          setDisplayMsgs((prev) => [
            ...prev,
            { id: assistantId, role: "assistant", content: fullContent },
          ]);
          assistantAdded = true;
        } else {
          setDisplayMsgs((prev) => {
            const updated = [...prev];
            const lastIdx = updated.length - 1;
            if (updated[lastIdx]) {
              updated[lastIdx] = { ...updated[lastIdx], content: fullContent };
            }
            return updated;
          });
        }
      },
      () => {
        historyRef.current = [...newHistory, { role: "assistant", content: fullContent }];
        setRpMessages(historyRef.current);
        setIsStreaming(false);
        setShowTyping(false);
        inputRef.current?.focus();
        if (newExchanges % 2 === 0) {
          generateNudge(text, fullContent);
        }
      },
      (err) => {
        setIsStreaming(false);
        setShowTyping(false);
        const isLimit = err?.message?.includes("limit") || err?.message?.includes("429");
        if (isLimit) {
          router.push("/upgrade");
        } else {
          setDisplayMsgs((prev) => [
            ...prev,
            { id: newId(), role: "system", content: "Couldn't get a response. Check your connection and try again." },
          ]);
        }
      },
      token,
    );
  }

  async function generateNudge(userSaid: string, theySaid: string) {
    let nudgeText = "";
    const token = await getToken();
    await streamRequest(
      "api/talkprep/nudge",
      { scenario, outcome, userSaid, theySaid },
      (chunk) => { nudgeText += chunk; },
      () => {
        if (nudgeText.trim()) {
          setNudge(nudgeText.trim());
          setTimeout(() => setNudge(null), 12000);
        }
      },
      () => {},
      token,
    );
  }

  function endRoleplay() {
    if (historyRef.current.length < 2) return;
    clearInterval(timerRef.current);
    router.push("/transcript");
  }

  const reversedMsgs = [...displayMsgs].reverse();

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream2 }}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.ink3} />
        </Pressable>
        <View style={styles.topMeta}>
          <View style={styles.personaPill}>
            <View style={styles.personaDot} />
            <Text style={styles.personaName}>
              {who.split(/[,.]/ )[0]?.trim() || "them"}
            </Text>
          </View>
        </View>
        <View style={styles.topStats}>
          <Text style={styles.statText}>{formatTime(elapsedSecs)}</Text>
          <Text style={styles.statSep}>·</Text>
          <Text style={styles.statText}>{exchangeCount}x</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {nudge ? (
          <Animated.View entering={FadeInDown} style={styles.nudgeCard}>
            <Feather name="zap" size={14} color={colors.gold} />
            <Text style={styles.nudgeText}>{nudge}</Text>
          </Animated.View>
        ) : null}

        <FlatList
          data={reversedMsgs}
          keyExtractor={(item) => item.id}
          inverted={displayMsgs.length > 0}
          renderItem={({ item }) => <MessageBubble msg={item} who={who} colors={colors} />}
          ListHeaderComponent={
            showTyping ? (
              <View style={styles.typingBubble}>
                <ActivityIndicator size="small" color={colors.ink3} />
              </View>
            ) : null
          }
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 12, paddingHorizontal: 16 }}
          style={styles.chatList}
        />

        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="What would you actually say?"
            placeholderTextColor={colors.ink4}
            value={input}
            onChangeText={setInput}
            multiline
            blurOnSubmit={false}
            onSubmitEditing={sendMessage}
          />
          <Pressable
            style={[styles.sendBtn, { opacity: isStreaming || !input.trim() ? 0.4 : 1 }]}
            onPress={() => {
              sendMessage();
              inputRef.current?.focus();
            }}
            disabled={isStreaming || !input.trim()}
          >
            <Feather name="send" size={16} color={colors.cream} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Pressable
        style={[styles.endBtn, { bottom: insets.bottom + 80 }]}
        onPress={endRoleplay}
      >
        <Text style={styles.endBtnText}>End Practice</Text>
      </Pressable>
    </View>
  );
}

function MessageBubble({
  msg,
  who,
  colors,
}: {
  msg: ChatMsg;
  who: string;
  colors: ReturnType<typeof useColors>;
}) {
  const styles = StyleSheet.create({
    wrap: {
      marginVertical: 4,
      maxWidth: "82%",
    },
    label: {
      fontSize: 9,
      letterSpacing: 0.8,
      marginBottom: 2,
      fontFamily: "Sora_400Regular",
    },
    bubble: {
      padding: 12,
      borderRadius: 16,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "Sora_400Regular",
    },
    systemBubble: {
      backgroundColor: colors.goldLight,
      borderWidth: 1,
      borderColor: "rgba(201,144,58,0.2)",
      padding: 10,
      borderRadius: 16,
      fontStyle: "italic",
      fontSize: 12,
      color: colors.gold,
      fontFamily: "Sora_400Regular",
    },
  });

  if (msg.role === "system") {
    return (
      <View style={{ alignItems: "center", marginVertical: 8 }}>
        <Text style={styles.systemBubble}>{msg.content}</Text>
      </View>
    );
  }

  const isUser = msg.role === "user";
  return (
    <View
      style={[
        styles.wrap,
        { alignSelf: isUser ? "flex-end" : "flex-start" },
      ]}
    >
      <Text style={[styles.label, { color: colors.ink4, textAlign: isUser ? "right" : "left" }]}>
        {isUser ? "YOU" : (who.split(/[,.]/ )[0]?.trim()?.toUpperCase() || "THEM")}
      </Text>
      <Text
        style={[
          styles.bubble,
          isUser
            ? { backgroundColor: colors.ink, color: colors.cream }
            : {
                backgroundColor: "white",
                color: colors.ink,
                borderWidth: 1,
                borderColor: colors.border,
              },
        ]}
      >
        {msg.content}
      </Text>
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
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cream2,
    },
    backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    topMeta: { flex: 1, alignItems: "center" },
    personaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.rustLight,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
    },
    personaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.rust },
    personaName: {
      fontSize: 12,
      color: colors.rustDim,
      fontFamily: "Sora_500Medium",
      fontWeight: "500",
    },
    topStats: { flexDirection: "row", alignItems: "center", gap: 4 },
    statText: { fontSize: 11, color: colors.ink3, fontFamily: "Sora_400Regular" },
    statSep: { fontSize: 11, color: colors.ink4 },
    chatList: { flex: 1 },
    nudgeCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      backgroundColor: colors.goldLight,
      borderWidth: 1,
      borderColor: "rgba(201,144,58,0.25)",
      borderRadius: 16,
      padding: 12,
      marginHorizontal: 16,
      marginTop: 8,
    },
    nudgeText: {
      flex: 1,
      fontSize: 12,
      color: colors.ink2,
      lineHeight: 18,
      fontFamily: "Sora_400Regular",
    },
    typingBubble: {
      alignSelf: "flex-start",
      backgroundColor: "white",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 12,
      marginBottom: 8,
    },
    inputRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.cream2,
      alignItems: "flex-end",
    },
    textInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.input,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.ink,
      backgroundColor: "white",
      maxHeight: 100,
      fontFamily: "Sora_400Regular",
    },
    sendBtn: {
      width: 42,
      height: 42,
      backgroundColor: colors.rust,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    endBtn: {
      position: "absolute",
      right: 16,
      backgroundColor: colors.cream3,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    endBtnText: { fontSize: 12, color: colors.ink2, fontFamily: "Sora_400Regular" },
  });
}
