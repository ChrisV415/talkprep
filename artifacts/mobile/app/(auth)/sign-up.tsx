import { useSignUp } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  const { isLoaded, signUp, setActive } = useSignUp();
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [debugMsg, setDebugMsg] = React.useState("");

  const handleSignUp = async () => {
    setDebugMsg(`tap: loaded=${isLoaded} email=${!!email} pw=${!!password} cpw=${!!confirmPassword}`);
    if (!isLoaded) {
      setDebugMsg("BLOCKED: Clerk not loaded");
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
    if (!email || !password || !confirmPassword) {
      setDebugMsg("BLOCKED: empty field(s)");
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");
    setDebugMsg("calling signUp.create…");
    try {
      await signUp.create({ emailAddress: email, password });
      setDebugMsg("signUp.create OK — preparing verification…");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      const msg = err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Something went wrong";
      const code = err.errors?.[0]?.code ?? "no_code";
      Alert.alert("Sign up error", `[${code}] ${msg}\n\nFull: ${JSON.stringify(err.errors ?? err)}`);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
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
    if (!isLoaded) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
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
          {!isLoaded && (
            <View style={styles.iframeBanner}>
              <Text style={styles.iframeBannerTitle}>⚠️ Can't sign up in the preview panel</Text>
              <Text style={styles.iframeBannerBody}>
                Copy this URL and open it in a new browser tab:
              </Text>
              <Text selectable style={styles.iframeBannerUrl}>
                https://8ac4c588-a224-4df1-93a4-eca47741178d-00-rnh93ea02kni.expo.worf.replit.dev
              </Text>
            </View>
          )}
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

          {!!debugMsg && (
            <Text style={styles.debug}>{debugMsg}</Text>
          )}
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
  iframeBanner: { backgroundColor: "#fff3cd", borderColor: "#ffc107", borderWidth: 1.5, borderRadius: 10, padding: 14, marginBottom: 20 },
  iframeBannerTitle: { fontSize: 14, fontWeight: "700", color: "#856404", marginBottom: 4 },
  iframeBannerBody: { fontSize: 13, color: "#856404", lineHeight: 18, marginBottom: 6 },
  iframeBannerUrl: { fontSize: 12, color: "#495057", backgroundColor: "#fff", borderRadius: 6, padding: 8, fontFamily: "monospace" },
  debug: { color: "#555", fontSize: 11, marginBottom: 8, fontFamily: "monospace", backgroundColor: "#f0f0f0", padding: 6, borderRadius: 4 },
  error: { color: "#c0392b", fontSize: 13, marginBottom: 12 },
  inputError: { borderColor: "#c0392b", borderWidth: 1.5 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { color: C.ink4, fontSize: 14 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 8 },
});
