import { useClerk, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const APP_VERSION = "1.0.0";

function Avatar({ initials, size = 72, colors }: { initials: string; size?: number; colors: any }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: colors.rust, alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: "#fff", fontSize: size * 0.38, fontWeight: "700" }}>
        {initials}
      </Text>
    </View>
  );
}

function SectionHeader({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.ink4, letterSpacing: 1.1, marginBottom: 6, marginTop: 24, marginLeft: 4 }}>
      {label.toUpperCase()}
    </Text>
  );
}

function RowItem({
  icon, label, value, onPress, destructive, rightElement, colors,
}: {
  icon: string; label: string; value?: string; onPress?: () => void;
  destructive?: boolean; rightElement?: React.ReactNode; colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.cream3, opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      <View style={styles.rowLeft}>
        <Feather name={icon as any} size={18} color={destructive ? colors.destructive : colors.rust} style={{ marginRight: 12 }} />
        <Text style={{ fontSize: 15, color: destructive ? colors.destructive : colors.ink, fontWeight: "500" }}>
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value ? <Text style={{ fontSize: 14, color: colors.ink4, marginRight: 6, maxWidth: 160 }} numberOfLines={1}>{value}</Text> : null}
        {rightElement ?? (onPress ? <Feather name="chevron-right" size={16} color={colors.ink4} /> : null)}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(
    user?.fullName ?? user?.firstName ?? ""
  );
  const [savingName, setSavingName] = useState(false);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const initials = (
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")
  ).toUpperCase() || email.slice(0, 2).toUpperCase() || "?";

  async function handleSaveName() {
    if (!user || !nameValue.trim()) return;
    setSavingName(true);
    try {
      const parts = nameValue.trim().split(" ");
      await user.update({ firstName: parts[0], lastName: parts.slice(1).join(" ") || undefined });
      setEditingName(false);
    } catch {
      Alert.alert("Error", "Could not update name. Please try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out", style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  }

  const s = makeStyles(colors);

  return (
    <ScrollView
      style={[s.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[s.header, { paddingTop: topPad + 16 }]}>
        <Text style={s.pageTitle}>Profile</Text>
      </View>

      {/* Avatar + identity */}
      <View style={s.avatarSection}>
        <Avatar initials={initials} colors={colors} />
        <View style={{ marginTop: 12, alignItems: "center" }}>
          {editingName ? (
            <View style={s.nameEditRow}>
              <TextInput
                value={nameValue}
                onChangeText={setNameValue}
                style={[s.nameInput, { borderColor: colors.rust, color: colors.ink }]}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <Pressable onPress={handleSaveName} disabled={savingName} style={s.saveBtn}>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  {savingName ? "Saving…" : "Save"}
                </Text>
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={{ marginLeft: 8 }}>
                <Feather name="x" size={20} color={colors.ink4} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={s.nameRow}>
              <Text style={s.nameText}>{user?.fullName || user?.firstName || "Your Name"}</Text>
              <Feather name="edit-2" size={14} color={colors.ink4} style={{ marginLeft: 6, marginTop: 2 }} />
            </Pressable>
          )}
          <Text style={s.emailText}>{email}</Text>
        </View>
      </View>

      {/* Account */}
      <SectionHeader label="Account" colors={colors} />
      <View style={s.card}>
        <RowItem
          icon="user"
          label="Display name"
          value={user?.fullName || user?.firstName || "—"}
          onPress={() => setEditingName(true)}
          colors={colors}
        />
        <View style={s.divider} />
        <RowItem
          icon="mail"
          label="Email"
          value={email}
          colors={colors}
        />
        <View style={s.divider} />
        <RowItem
          icon="lock"
          label="Change password"
          onPress={() => router.push("/(auth)/forgot-password")}
          colors={colors}
        />
      </View>

      {/* Preferences */}
      <SectionHeader label="Preferences" colors={colors} />
      <View style={s.card}>
        <RowItem
          icon="bell"
          label="Notifications"
          colors={colors}
          rightElement={
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setNotificationsEnabled(v);
              }}
              trackColor={{ false: colors.border, true: colors.rust }}
              thumbColor="#fff"
            />
          }
        />
      </View>

      {/* Stats summary */}
      <SectionHeader label="Your Activity" colors={colors} />
      <View style={s.card}>
        <RowItem
          icon="clock"
          label="Session history"
          onPress={() => router.push("/history")}
          colors={colors}
        />
        <View style={s.divider} />
        <RowItem
          icon="bar-chart-2"
          label="Progress & scores"
          onPress={() => router.push("/dashboard")}
          colors={colors}
        />
      </View>

      {/* About */}
      <SectionHeader label="About" colors={colors} />
      <View style={s.card}>
        <RowItem
          icon="info"
          label="Version"
          value={APP_VERSION}
          colors={colors}
        />
        <View style={s.divider} />
        <RowItem
          icon="shield"
          label="Privacy policy"
          onPress={() => Linking.openURL("https://talkprep.app/privacy")}
          colors={colors}
        />
        <View style={s.divider} />
        <RowItem
          icon="file-text"
          label="Terms of service"
          onPress={() => Linking.openURL("https://talkprep.app/terms")}
          colors={colors}
        />
        <View style={s.divider} />
        <RowItem
          icon="star"
          label="Rate TalkPrep"
          onPress={() => Linking.openURL("https://apps.apple.com")}
          colors={colors}
        />
      </View>

      {/* Sign out */}
      <SectionHeader label="" colors={colors} />
      <View style={s.card}>
        <RowItem
          icon="log-out"
          label="Sign out"
          onPress={handleSignOut}
          destructive
          colors={colors}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowRight: { flexDirection: "row", alignItems: "center" },
  nameEditRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  nameInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 16, minWidth: 160 },
  saveBtn: { backgroundColor: "#C67C4E", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginLeft: 8 },
  nameRow: { flexDirection: "row", alignItems: "center" },
});

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingBottom: 8 },
    pageTitle: { fontSize: 28, fontWeight: "700", color: colors.ink },
    avatarSection: { alignItems: "center", paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.border, marginHorizontal: 20, marginBottom: 4 },
    nameText: { fontSize: 20, fontWeight: "700", color: colors.ink },
    emailText: { fontSize: 14, color: colors.ink4, marginTop: 4 },
    card: { marginHorizontal: 20, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
    divider: { height: 1, backgroundColor: colors.border, marginLeft: 46 },
    nameInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 16, minWidth: 160, color: colors.ink },
    saveBtn: { backgroundColor: colors.rust, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginLeft: 8 },
    nameRow: { flexDirection: "row", alignItems: "center" },
    nameEditRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
    rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
    rowRight: { flexDirection: "row", alignItems: "center" },
  });
}
