import { useClerk, useUser } from "@clerk/expo";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";

const APP_VERSION = "1.0.0";
const ONBOARDING_KEY = "@talkprep_onboarded";

function Avatar({ initials, size = 72, colors }: { initials: string; size?: number; colors: any }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.rust, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontSize: size * 0.38, fontWeight: "700" }}>{initials}</Text>
    </View>
  );
}

function SectionHeader({ label, colors }: { label: string; colors: any }) {
  if (!label) return <View style={{ height: 12 }} />;
  return (
    <Text style={{ fontSize: 11, fontWeight: "700", color: colors.ink4, letterSpacing: 1.1, marginBottom: 6, marginTop: 24, marginLeft: 24 }}>
      {label.toUpperCase()}
    </Text>
  );
}

function RowItem({ icon, label, value, onPress, destructive, rightElement, colors, last }: {
  icon: string; label: string; value?: string; onPress?: () => void;
  destructive?: boolean; rightElement?: React.ReactNode; colors: any; last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        { backgroundColor: colors.cream3, opacity: pressed && onPress ? 0.7 : 1 },
        !last && { borderBottomWidth: 1, borderBottomColor: colors.border },
      ]}
    >
      <View style={s.rowLeft}>
        <Feather name={icon as any} size={18} color={destructive ? colors.destructive : colors.rust} style={{ marginRight: 12 }} />
        <Text style={{ fontSize: 15, color: destructive ? colors.destructive : colors.ink, fontWeight: "500" }}>{label}</Text>
      </View>
      <View style={s.rowRight}>
        {value ? <Text style={{ fontSize: 13, color: colors.ink4, marginRight: 6, maxWidth: 160 }} numberOfLines={1}>{value}</Text> : null}
        {rightElement ?? (onPress ? <Feather name="chevron-right" size={16} color={colors.ink4} /> : null)}
      </View>
    </Pressable>
  );
}

type EditModalStep = "input" | "verify";

function EditModal({
  visible, onClose, title, placeholder, keyboardType, onSubmit, onVerify, step, loading, colors,
}: {
  visible: boolean; onClose: () => void; title: string; placeholder: string;
  keyboardType?: "email-address" | "phone-pad" | "default";
  onSubmit: (val: string) => void; onVerify: (code: string) => void;
  step: EditModalStep; loading: boolean; colors: any;
}) {
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");

  function reset() { setValue(""); setCode(""); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={reset}>
      <Pressable style={em.backdrop} onPress={reset} />
      <View style={[em.sheet, { backgroundColor: colors.background }]}>
        <View style={em.handle} />
        <Text style={[em.title, { color: colors.ink }]}>{title}</Text>

        {step === "input" ? (
          <>
            <TextInput
              style={[em.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.cream3 }]}
              placeholder={placeholder}
              placeholderTextColor={colors.ink4}
              value={value}
              onChangeText={setValue}
              keyboardType={keyboardType ?? "default"}
              autoCapitalize="none"
              autoFocus
            />
            <Text style={[em.hint, { color: colors.ink4 }]}>
              {keyboardType === "email-address"
                ? "We'll send a verification code to your new email."
                : "We'll send a verification code via SMS."}
            </Text>
            <Pressable
              style={[em.btn, { backgroundColor: colors.rust, opacity: value.trim() && !loading ? 1 : 0.4 }]}
              onPress={() => onSubmit(value.trim())}
              disabled={!value.trim() || loading}
            >
              <Text style={em.btnText}>{loading ? "Sending…" : "Send verification code"}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[em.hint, { color: colors.ink4, marginTop: 0, marginBottom: 12 }]}>
              Enter the 6-digit code we sent to verify your new contact info.
            </Text>
            <TextInput
              style={[em.input, { borderColor: colors.border, color: colors.ink, backgroundColor: colors.cream3, letterSpacing: 8, textAlign: "center", fontSize: 22 }]}
              placeholder="000000"
              placeholderTextColor={colors.ink4}
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
            />
            <Pressable
              style={[em.btn, { backgroundColor: colors.rust, opacity: code.length === 6 && !loading ? 1 : 0.4 }]}
              onPress={() => onVerify(code)}
              disabled={code.length < 6 || loading}
            >
              <Text style={em.btnText}>{loading ? "Verifying…" : "Confirm"}</Text>
            </Pressable>
          </>
        )}
        <Pressable onPress={reset} style={{ marginTop: 12, alignItems: "center" }}>
          <Text style={{ color: colors.ink4, fontSize: 14 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

export default function ProfileScreen() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [remindersEnabled, setRemindersEnabled] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(user?.fullName ?? user?.firstName ?? "");
  const [savingName, setSavingName] = useState(false);

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<EditModalStep>("input");
  const [emailLoading, setEmailLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<any>(null);

  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [phoneStep, setPhoneStep] = useState<EditModalStep>("input");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [pendingPhone, setPendingPhone] = useState<any>(null);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const phone = user?.primaryPhoneNumber?.phoneNumber ?? "";
  const initials = ((user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")).toUpperCase()
    || email.slice(0, 2).toUpperCase() || "?";

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

  async function handleSubmitEmail(newEmail: string) {
    if (!user) return;
    setEmailLoading(true);
    try {
      const obj = await user.createEmailAddress({ email: newEmail });
      await obj.prepareVerification({ strategy: "email_code" });
      setPendingEmail(obj);
      setEmailStep("verify");
    } catch (e: any) {
      Alert.alert("Error", e?.errors?.[0]?.message ?? "Could not add email. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleVerifyEmail(code: string) {
    if (!pendingEmail) return;
    setEmailLoading(true);
    try {
      await pendingEmail.attemptVerification({ code });
      await pendingEmail.makePrimary();
      await user?.reload();
      setEmailModalOpen(false);
      setEmailStep("input");
      setPendingEmail(null);
      Alert.alert("Updated", "Your email address has been updated.");
    } catch (e: any) {
      Alert.alert("Invalid code", e?.errors?.[0]?.message ?? "Incorrect code. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleSubmitPhone(newPhone: string) {
    if (!user) return;
    const formatted = newPhone.startsWith("+") ? newPhone : `+1${newPhone.replace(/\D/g, "")}`;
    setPhoneLoading(true);
    try {
      const obj = await user.createPhoneNumber({ phoneNumber: formatted });
      await obj.prepareVerification();
      setPendingPhone(obj);
      setPhoneStep("verify");
    } catch (e: any) {
      Alert.alert("Error", e?.errors?.[0]?.message ?? "Could not add phone number. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleVerifyPhone(code: string) {
    if (!pendingPhone) return;
    setPhoneLoading(true);
    try {
      await pendingPhone.attemptVerification({ code });
      await pendingPhone.makePrimary();
      await user?.reload();
      setPhoneModalOpen(false);
      setPhoneStep("input");
      setPendingPhone(null);
      Alert.alert("Updated", "Your phone number has been updated.");
    } catch (e: any) {
      Alert.alert("Invalid code", e?.errors?.[0]?.message ?? "Incorrect code. Please try again.");
    } finally {
      setPhoneLoading(false);
    }
  }

  async function handleSignOut() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out", style: "destructive",
        onPress: async () => { await signOut(); router.replace("/(auth)/sign-in"); },
      },
    ]);
  }

  async function handleReplayOnboarding() {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
    router.push("/onboarding");
  }

  const ms = makeSStyles(colors);

  return (
    <ScrollView
      style={[ms.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={[ms.header, { paddingTop: topPad + 16 }]}>
        <Text style={ms.pageTitle}>Profile</Text>
      </View>

      {/* Avatar + identity */}
      <View style={ms.avatarSection}>
        <Avatar initials={initials} colors={colors} />
        <View style={{ marginTop: 12, alignItems: "center" }}>
          {editingName ? (
            <View style={ms.nameEditRow}>
              <TextInput
                value={nameValue}
                onChangeText={setNameValue}
                style={[ms.nameInput, { borderColor: colors.rust, color: colors.ink }]}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <Pressable onPress={handleSaveName} disabled={savingName} style={ms.saveBtn}>
                <Text style={{ color: "#fff", fontWeight: "600", fontSize: 14 }}>
                  {savingName ? "Saving…" : "Save"}
                </Text>
              </Pressable>
              <Pressable onPress={() => setEditingName(false)} style={{ marginLeft: 8 }}>
                <Feather name="x" size={20} color={colors.ink4} />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setEditingName(true)} style={ms.nameRow}>
              <Text style={ms.nameText}>{user?.fullName || user?.firstName || "Your Name"}</Text>
              <Feather name="edit-2" size={14} color={colors.ink4} style={{ marginLeft: 6, marginTop: 2 }} />
            </Pressable>
          )}
          <Text style={ms.emailText}>{email}</Text>
          {phone ? <Text style={[ms.emailText, { marginTop: 2 }]}>{phone}</Text> : null}
        </View>
      </View>

      {/* ACCOUNT */}
      <SectionHeader label="Account" colors={colors} />
      <View style={ms.card}>
        <RowItem icon="user" label="Display name" value={user?.fullName || user?.firstName || "—"} onPress={() => setEditingName(true)} colors={colors} />
        <RowItem
          icon="mail" label="Email address" value={email}
          onPress={() => { setEmailStep("input"); setEmailModalOpen(true); }}
          colors={colors}
        />
        <RowItem
          icon="phone" label="Phone number" value={phone || "Add phone"}
          onPress={() => { setPhoneStep("input"); setPhoneModalOpen(true); }}
          colors={colors}
        />
        <RowItem icon="lock" label="Change password" onPress={() => router.push("/(auth)/forgot-password")} colors={colors} last />
      </View>

      {/* SETTINGS */}
      <SectionHeader label="Settings" colors={colors} />
      <View style={ms.card}>
        <RowItem
          icon="bell" label="Push notifications" colors={colors}
          rightElement={
            <Switch value={notificationsEnabled} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setNotificationsEnabled(v); }}
              trackColor={{ false: colors.border, true: colors.rust }} thumbColor="#fff" />
          }
        />
        <RowItem
          icon="calendar" label="Practice reminders" colors={colors}
          rightElement={
            <Switch value={remindersEnabled} onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setRemindersEnabled(v); }}
              trackColor={{ false: colors.border, true: colors.rust }} thumbColor="#fff" />
          }
        />
        <RowItem icon="clock" label="Session history" onPress={() => router.push("/(tabs)/history")} colors={colors} />
        <RowItem icon="bar-chart-2" label="Progress & scores" onPress={() => router.push("/(tabs)/dashboard")} colors={colors} last />
      </View>

      {/* HELP & SUPPORT */}
      <SectionHeader label="Help & Support" colors={colors} />
      <View style={ms.card}>
        <RowItem
          icon="message-square" label="Contact support"
          onPress={() => Linking.openURL("mailto:support@talkprep.app?subject=TalkPrep%20Support")}
          colors={colors}
        />
        <RowItem
          icon="book-open" label="FAQ & guides"
          onPress={() => Linking.openURL("https://talkprep.app/help")}
          colors={colors}
        />
        <RowItem
          icon="alert-circle" label="Report a bug"
          onPress={() => Linking.openURL("mailto:support@talkprep.app?subject=Bug%20Report")}
          colors={colors}
        />
        <RowItem
          icon="play-circle" label="Replay intro tutorial"
          onPress={handleReplayOnboarding}
          colors={colors} last
        />
      </View>

      {/* ABOUT */}
      <SectionHeader label="About" colors={colors} />
      <View style={ms.card}>
        <RowItem icon="info" label="Version" value={APP_VERSION} colors={colors} />
        <RowItem icon="shield" label="Privacy policy" onPress={() => Linking.openURL("https://talkprep.app/privacy")} colors={colors} />
        <RowItem icon="file-text" label="Terms of service" onPress={() => Linking.openURL("https://talkprep.app/terms")} colors={colors} />
        <RowItem icon="star" label="Rate TalkPrep" onPress={() => Linking.openURL("https://apps.apple.com")} colors={colors} last />
      </View>

      {/* SIGN OUT */}
      <SectionHeader label="" colors={colors} />
      <View style={ms.card}>
        <RowItem icon="log-out" label="Sign out" onPress={handleSignOut} destructive colors={colors} last />
      </View>

      {/* Email edit modal */}
      <EditModal
        visible={emailModalOpen}
        onClose={() => { setEmailModalOpen(false); setEmailStep("input"); setPendingEmail(null); }}
        title={emailStep === "input" ? "Update email address" : "Verify new email"}
        placeholder="new@example.com"
        keyboardType="email-address"
        onSubmit={handleSubmitEmail}
        onVerify={handleVerifyEmail}
        step={emailStep}
        loading={emailLoading}
        colors={colors}
      />

      {/* Phone edit modal */}
      <EditModal
        visible={phoneModalOpen}
        onClose={() => { setPhoneModalOpen(false); setPhoneStep("input"); setPendingPhone(null); }}
        title={phoneStep === "input" ? "Add phone number" : "Verify phone number"}
        placeholder="+1 555 000 0000"
        keyboardType="phone-pad"
        onSubmit={handleSubmitPhone}
        onVerify={handleVerifyPhone}
        step={phoneStep}
        loading={phoneLoading}
        colors={colors}
      />
    </ScrollView>
  );
}

const em = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#D0C8C0",
    alignSelf: "center",
    marginBottom: 20,
  },
  title: { fontSize: 19, fontWeight: "700", marginBottom: 20 },
  input: {
    borderWidth: 1.5, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, marginBottom: 10,
  },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 20, marginTop: 4 },
  btn: { borderRadius: 28, paddingVertical: 15, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowRight: { flexDirection: "row", alignItems: "center" },
});

function makeSStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 20, paddingBottom: 8 },
    pageTitle: { fontSize: 28, fontWeight: "700", color: colors.ink, fontFamily: "Sora_700Bold" },
    avatarSection: {
      alignItems: "center", paddingVertical: 24,
      borderBottomWidth: 1, borderBottomColor: colors.border,
      marginHorizontal: 20, marginBottom: 4,
    },
    nameText: { fontSize: 20, fontWeight: "700", color: colors.ink, fontFamily: "Sora_700Bold" },
    emailText: { fontSize: 14, color: colors.ink4, marginTop: 4, fontFamily: "Sora_400Regular" },
    card: { marginHorizontal: 16, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cream3 },
    nameInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 16, minWidth: 160, color: colors.ink },
    saveBtn: { backgroundColor: colors.rust, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, marginLeft: 8 },
    nameRow: { flexDirection: "row", alignItems: "center" },
    nameEditRow: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  });
}
