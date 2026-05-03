import { useSignIn } from "@clerk/expo";
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

export default function SignInScreen() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSignIn = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

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
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to access your sessions</Text>

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
            placeholder="Your password"
            placeholderTextColor={C.ink4}
            secureTextEntry
            autoComplete="password"
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[
              styles.btn,
              (!email || !password || loading) && styles.btnDisabled,
            ]}
            onPress={handleSignIn}
            disabled={!email || !password || loading}
          >
            <Text style={styles.btnText}>
              {loading ? "Signing in…" : "Sign in"}
            </Text>
          </Pressable>

          <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </Link>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <Link href="/(auth)/sign-up">
              <Text style={styles.link}>Sign up</Text>
            </Link>
          </View>
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
  forgotLink: { alignSelf: "center", marginBottom: 20 },
  forgotText: { color: C.ink4, fontSize: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { color: C.ink4, fontSize: 14 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600" },
});
