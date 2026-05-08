import { useClerk } from "@clerk/expo";
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

function WebForm({
  onSubmit,
  children,
}: {
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  if (Platform.OS !== "web") return <>{children}</>;
  return React.createElement(
    "form",
    {
      onSubmit: (e: Event) => {
        e.preventDefault();
        onSubmit();
      },
      style: { display: "flex", flexDirection: "column" },
    },
    children
  );
}

function SubmitBtn({
  onPress,
  disabled,
  label,
}: {
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  if (Platform.OS === "web") {
    return React.createElement(
      "button",
      {
        type: "submit",
        disabled,
        onClick: (e: Event) => {
          e.preventDefault();
          if (!disabled) onPress();
        },
        style: {
          backgroundColor: C.rust,
          borderRadius: 28,
          paddingTop: 16,
          paddingBottom: 16,
          color: "#fff",
          fontSize: 16,
          fontWeight: "600",
          border: "none",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          marginTop: 4,
          marginBottom: 20,
          width: "100%",
        },
      },
      label
    );
  }
  return (
    <Pressable
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

export default function SignInScreen() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clerk = useClerk() as any;
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const signIn = clerk?.client?.signIn;
  const isLoaded = !!clerk?.loaded;

  const handleSignIn = async () => {
    if (!isLoaded || !signIn) {
      setError("Authentication is still loading. Please wait a moment.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await signIn.create({
        identifier: email.trim().toLowerCase(),
        strategy: "password",
        password,
      });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { longMessage?: string; message?: string }[]; message?: string };
      const clerkMsg = e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message;
      setError(clerkMsg ?? e.message ?? "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const btnDisabled = !email || !password || loading || !isLoaded;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          overScrollMode="never"
        >
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to access your sessions</Text>

          <WebForm onSubmit={handleSignIn}>
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
              textContentType="emailAddress"
              returnKeyType="next"
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={C.ink4}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={handleSignIn}
              returnKeyType="go"
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <SubmitBtn
              onPress={handleSignIn}
              disabled={btnDisabled}
              label={loading ? "Signing in…" : !isLoaded ? "Loading…" : "Sign in"}
            />
          </WebForm>

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
  error: { color: "#c0392b", fontSize: 13, marginBottom: 12 },
  forgotLink: { alignSelf: "center", marginBottom: 20 },
  forgotText: { color: C.ink4, fontSize: 14 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { color: C.ink4, fontSize: 14 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600" },
});
