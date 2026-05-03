import { useSignIn } from "@clerk/expo";
import { useRouter } from "expo-router";
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const C = {
  cream: "#F9F2ED",
  rust: "#C67C4E",
  ink: "#313131",
  ink4: "#9e9189",
  card: "#EDD6C8",
  border: "#E3E3E3",
};

export default function ForgotPasswordScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [step, setStep] = React.useState<"email" | "reset">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSendCode = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: email,
      });
      setStep("reset");
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Could not send reset code");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (!isLoaded) return;
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code,
        password: newPassword,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Reset could not be completed. Please try again.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (step === "reset") {
    return (
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoRow}>
              <Text style={styles.logoTalk}>Talk</Text>
              <Text style={styles.logoPrep}>Prep</Text>
            </View>
            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>
              Enter the code we sent to {email} and choose a new password.
            </Text>

            <Text style={styles.label}>Reset code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={C.ink4}
              keyboardType="numeric"
              autoFocus
            />

            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={C.ink4}
              secureTextEntry
              autoComplete="new-password"
            />

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat your new password"
              placeholderTextColor={C.ink4}
              secureTextEntry
              autoComplete="new-password"
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={[
                styles.btn,
                (!code || !newPassword || !confirmPassword || loading) && styles.btnDisabled,
              ]}
              onPress={handleReset}
              disabled={!code || !newPassword || !confirmPassword || loading}
            >
              <Text style={styles.btnText}>
                {loading ? "Resetting…" : "Reset password"}
              </Text>
            </Pressable>

            <Pressable onPress={() => { setStep("email"); setError(""); }}>
              <Text style={styles.link}>Use a different email</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoRow}>
            <Text style={styles.logoTalk}>Talk</Text>
            <Text style={styles.logoPrep}>Prep</Text>
          </View>
          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we'll send you a reset code.
          </Text>

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={C.ink4}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            autoFocus
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.btn, (!email || loading) && styles.btnDisabled]}
            onPress={handleSendCode}
            disabled={!email || loading}
          >
            <Text style={styles.btnText}>
              {loading ? "Sending…" : "Send reset code"}
            </Text>
          </Pressable>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  container: { flexGrow: 1, padding: 28, justifyContent: "center" },
  logoRow: { flexDirection: "row", marginBottom: 36 },
  logoTalk: { fontSize: 28, fontWeight: "700", color: C.ink },
  logoPrep: { fontSize: 28, fontWeight: "700", color: C.rust },
  title: { fontSize: 26, fontWeight: "700", color: C.ink, marginBottom: 6 },
  subtitle: { fontSize: 15, color: C.ink4, marginBottom: 28 },
  label: { fontSize: 13, fontWeight: "600", color: C.ink, marginBottom: 6 },
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: C.ink,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: C.rust,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", fontSize: 13, marginBottom: 12 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 4 },
});
