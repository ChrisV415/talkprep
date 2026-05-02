import { Feather } from "@expo/vector-icons";
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
import { Session, useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { sessions, loadSession } = useApp();

  function openSession(s: Session) {
    loadSession(s);
    router.push("/result");
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
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>{sessions.length} sessions</Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="clock" size={32} color={colors.ink4} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyHint}>Your prep history will appear here</Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push("/prep")}>
            <Text style={styles.emptyBtnText}>Start your first prep</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {sessions.map((s, i) => (
            <Pressable
              key={s.id}
              style={({ pressed }) => [
                styles.item,
                {
                  borderBottomWidth: i < sessions.length - 1 ? 1 : 0,
                  borderBottomColor: colors.border,
                  backgroundColor: pressed ? colors.cream2 : colors.background,
                },
              ]}
              onPress={() => openSession(s)}
            >
              <View style={styles.itemLeft}>
                <Text style={[styles.itemScenario, { color: colors.rust }]}>
                  {s.scenario.toUpperCase()}
                </Text>
                <Text style={styles.itemWho}>
                  {s.who.split(/[,.]/ )[0]?.trim()}
                </Text>
                <Text style={styles.itemPreview} numberOfLines={1}>
                  {s.situation}
                </Text>
              </View>
              <View style={styles.itemRight}>
                <Text style={styles.itemDate}>{s.date}</Text>
                {s.scores ? (
                  <View style={[styles.badge, { backgroundColor: colors.sageLight }]}>
                    <Text style={[styles.badgeText, { color: colors.sageDark }]}>SCORED</Text>
                  </View>
                ) : s.debrief ? (
                  <View style={[styles.badge, { backgroundColor: colors.rustLight }]}>
                    <Text style={[styles.badgeText, { color: colors.rustDim }]}>DEBRIEFED</Text>
                  </View>
                ) : null}
                <Feather name="chevron-right" size={16} color={colors.ink4} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: colors.ink,
      fontFamily: "Inter_700Bold",
    },
    subtitle: {
      fontSize: 13,
      color: colors.ink3,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      paddingHorizontal: 40,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.ink2,
      fontFamily: "Inter_600SemiBold",
      marginTop: 12,
    },
    emptyHint: {
      fontSize: 14,
      color: colors.ink3,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
    },
    emptyBtn: {
      marginTop: 16,
      backgroundColor: colors.rust,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 4,
    },
    emptyBtnText: {
      color: "white",
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      fontWeight: "500",
    },
    list: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 14,
    },
    itemLeft: { flex: 1, marginRight: 12 },
    itemScenario: {
      fontSize: 9,
      letterSpacing: 1,
      fontFamily: "Inter_600SemiBold",
      fontWeight: "600",
      marginBottom: 2,
    },
    itemWho: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.ink,
      fontFamily: "Inter_600SemiBold",
    },
    itemPreview: {
      fontSize: 12,
      color: colors.ink3,
      fontFamily: "Inter_400Regular",
      marginTop: 2,
    },
    itemRight: {
      alignItems: "flex-end",
      gap: 4,
    },
    itemDate: {
      fontSize: 10,
      color: colors.ink4,
      fontFamily: "Inter_400Regular",
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 3,
    },
    badgeText: {
      fontSize: 8,
      fontWeight: "600",
      letterSpacing: 0.5,
      fontFamily: "Inter_600SemiBold",
    },
  });
}
