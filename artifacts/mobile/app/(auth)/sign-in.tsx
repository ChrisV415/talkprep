import { useSignIn } from "@clerk/expo";
import { Link, useRouter } from "expo-router";

import React from "react";
import {
  Image,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { isLoaded, signIn, setActive } = useSignIn() as any;
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleSignIn = async () => {
    if (!signIn) return;
    setLoading(true);
    setError("");
    try {
      const result: any = await signIn.create({
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
      const clerkMsg = err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message;
      setError(clerkMsg ?? err.message ?? JSON.stringify(err).slice(0, 200));
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
          {!signIn && (
            <View style={styles.iframeBanner}>
              <Text style={styles.iframeBannerTitle}>⚠️ Open in a new tab to sign in</Text>
              <Text style={styles.iframeBannerBody}>
                Sign-in doesn't work inside an embedded preview. Copy this link and open it directly:
              </Text>
              <Text selectable style={styles.iframeBannerUrl}>
                {process.env.EXPO_PUBLIC_DOMAIN
                  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
                  : "Open TalkPrep in a new browser tab"}
              </Text>
            </View>
          )}
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
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
  logo: { width: 120, height: 120, alignSelf: "center", marginBottom: 24 },
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
  iframeBanner: { backgroundColor: "#fff3cd", borderColor: "#ffc107", borderWidth: 1.5, borderRadius: 10, padding: 14, marginBottom: 20 },
  iframeBannerTitle: { fontSize: 14, fontWeight: "700", color: "#856404", marginBottom: 4 },
  iframeBannerBody: { fontSize: 13, color: "#856404", lineHeight: 18, marginBottom: 6 },
  iframeBannerUrl: { fontSize: 12, color: "#495057", backgroundColor: "#fff", borderRadius: 6, padding: 8, fontFamily: "monospace" },
  error: { color: "#c0392b", fontSize: 13, marginBottom: 12 },
  forgotLink: { alignSelf: "center", marginBottom: 20 },
  forgotText: { color: C.ink4, fontSize: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { color: C.ink4, fontSize: 14 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600" },
});
