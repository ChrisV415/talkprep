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

// On web, wrap children in a real <form> so the browser can detect the
// password fields and offer to save / autofill credentials.
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

// On web render a real <button type="submit"> so clicking it fires the form's
// submit event (which is what tells the browser to offer to save the password).
// On native keep the standard Pressable.
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

export default function SignUpScreen() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clerk = useClerk() as any;
  const router = useRouter();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const signUp = clerk?.client?.signUp;
  const isLoaded = !!clerk?.loaded;

  const handleSignUp = async () => {
    if (!isLoaded || !signUp) {
      setError("Authentication is still loading. Please wait a moment.");
      return;
    }
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
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      const clerkErr = err.errors?.[0];
      const msg = clerkErr?.longMessage ?? clerkErr?.message ?? err.message ?? "An error occurred";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUp) return;
    setLoading(true);
    setError("");
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
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
    setError("");
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
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
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
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
            onSubmitEditing={handleVerify}
            returnKeyType="done"
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

  const btnDisabled = !email || !password || !confirmPassword || loading || !isLoaded;

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
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Your sessions sync across devices</Text>

          <WebForm onSubmit={handleSignUp}>
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
              placeholder="Create a password (8+ characters)"
              placeholderTextColor={C.ink4}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
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
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSignUp}
            />

            {!!error && <Text style={styles.error}>{error}</Text>}

            <SubmitBtn
              onPress={handleSignUp}
              disabled={btnDisabled}
              label={loading ? "Creating account…" : !isLoaded ? "Loading…" : "Create account"}
            />
          </WebForm>

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
  inputError: { borderColor: "#c0392b", borderWidth: 1.5 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 8 },
  footerText: { color: C.ink4, fontSize: 14 },
  link: { color: C.rust, fontSize: 14, fontWeight: "600", textAlign: "center", marginTop: 8 },
});
