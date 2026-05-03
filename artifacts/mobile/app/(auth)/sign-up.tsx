import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
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

export default function SignUpScreen() {
  const { signUp, setActive } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSignUp = async () => {
    if (!signUp) return;
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const created: any = await signUp.create({ emailAddress: email, password });
      // created is the returned SignUp resource — use it directly (not window.Clerk.client.signUp
      // which gets reset to blank after create()).
      if (typeof created.prepareVerification === "function") {
        await created.prepareVerification({ strategy: "email_code" });
      } else if (typeof created.prepareEmailAddressVerification === "function") {
        await created.prepareEmailAddressVerification({ strategy: "email_code" });
      }
      // If neither method exists, Clerk auto-sent the code on create().
      setPendingVerification(true);
    } catch (err: any) {
      const clerkErr = err.errors?.[0];
      const msg = clerkErr?.longMessage ?? clerkErr?.message ?? err.message ?? JSON.stringify(err);
      const code = clerkErr?.code ?? "unknown";
      setError(`[${code}] ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUp) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!signUp) return;
    try {
      const live: any =
        (typeof window !== "undefined" && (window as any).Clerk?.client?.signUp) ??
        signUp;
      if (typeof live.prepareVerification === "function") {
        await live.prepareVerification({ strategy: "email_code" });
      } else if (typeof live.prepareEmailAddressVerification === "function") {
        await live.prepareEmailAddressVerification({ strategy: "email_code" });
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message ?? "Could not resend code");
    }
  };

  if (pendingVerification) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.logoRow}>
            <Text style={styles.logoTalk}>Talk</Text>
            <Text style={styles.logoPrep}>Prep</Text>
          </View>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>
          <Text style={styles.label}>Verification code</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="6-digit code"
            placeholderTextColor={C.ink4}
            keyboardType="numeric"
            autoFocus
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable
            style={[styles.btn, (loading || !code) && styles.btnDisabled]}
            onPress={handleVerify}
            disabled={loading || !code}
          >
            <Text style={styles.btnText}>{loading ? "Verifying…" : "Verify email"}</Text>
          </Pressable>
          <Pressable onPress={resendCode}>
            <Text style={styles.link}>Resend code</Text>
          </Pressable>
        </View>
        <View nativeID="clerk-captcha" />
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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Your sessions sync across devices</Text>

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
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password (8+ characters)"
            placeholderTextColor={C.ink4}
            secureTextEntry
            autoComplete="new-password"
          />

          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={[
              styles.input,
              confirmPassword.length > 0 && password !== confirmPassword && styles.inputError,
            ]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat your password"
            placeholderTextColor={C.ink4}
            secureTextEntry
            autoComplete="new-password"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[
              styles.btn,
              (!email || !password || !confirmPassword || loading) && styles.btnDisabled,
            ]}
            onPress={handleSignUp}
          >
            <Text style={styles.btnText}>
              {loading ? "Creating account…" : "Create account"}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/sign-in">
              <Text style={styles.link}>Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <View nativeID="clerk-captcha" />
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
    borderRadius: 14,
    padding: 15,
    fontSize: 15,
    color: C.ink,
    marginBottom: 16,
  },
  btn: {
    backgroundColor: C.rust,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  error: { color: "#c0392b", fontSize: 13, marginBottom: 12 },
  inputError: { borderColor: "#c0392b", borderWidth: 1.5 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { color: C.ink4, fontSize: 14 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 8 },
});
