import { useClerk, useOAuth } from "@clerk/expo";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
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

WebBrowser.maybeCompleteAuthSession();

const C = {
  cream: "#F9F2ED",
  rust: "#C67C4E",
  ink: "#313131",
  ink4: "#9e9189",
  card: "#EDD6C8",
  border: "#E3E3E3",
  white: "#FFFFFF",
};

const GOOGLE_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path fill="%23EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.62 17.74 9.5 24 9.5z"/><path fill="%234285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="%23FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="%2334A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>`;

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
    children,
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
      label,
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

const RESEND_COOLDOWN = 60;

export default function SignUpScreen() {
   
  const clerk = useClerk() as any;
  const router = useRouter();
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" });

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pendingVerification, setPendingVerification] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  // Resend countdown
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const cooldownRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = React.useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current!);
          cooldownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  React.useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const signUp = clerk?.client?.signUp;
  const isLoaded = !!clerk?.loaded;

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      const redirectUrl =
        Platform.OS === "web" ? window.location.origin + "/" : "talkprep://";
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl,
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: unknown) {
      const e = err as { errors?: { message?: string }[]; message?: string };
      const msg =
        e.errors?.[0]?.message ??
        e.message ??
        "Google sign-up failed. Please try again.";
      setError(msg);
    } finally {
      setGoogleLoading(false);
    }
  };

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
      const result = await signUp.create({ emailAddress: email, password });

      if (result.status === "complete") {
        await clerk.setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
      startCooldown();
    } catch (err: unknown) {
      const e = err as {
        errors?: { longMessage?: string; message?: string }[];
        message?: string;
      };
      const clerkErr = e.errors?.[0];
      const msg =
        clerkErr?.longMessage ??
        clerkErr?.message ??
        e.message ??
        "An error occurred";
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
    } catch (err: unknown) {
      const e = err as {
        errors?: { longMessage?: string; message?: string }[];
      };
      setError(
        e.errors?.[0]?.longMessage ?? e.errors?.[0]?.message ?? "Invalid code",
      );
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (!signUp || resendCooldown > 0) return;
    setError("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      startCooldown();
    } catch (err: unknown) {
      const e = err as { errors?: { message?: string }[] };
      setError(e.errors?.[0]?.message ?? "Could not resend code");
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
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{"\n"}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <Text style={styles.hint}>
            Delivery can take up to 2 minutes. Check your spam folder if it
            hasn't arrived.
          </Text>
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
            <Text style={styles.btnText}>
              {loading ? "Verifying…" : "Verify email"}
            </Text>
          </Pressable>
          <Pressable
            onPress={resendCode}
            disabled={resendCooldown > 0}
            style={resendCooldown > 0 ? styles.resendDisabled : undefined}
          >
            <Text style={[styles.link, resendCooldown > 0 && styles.linkMuted]}>
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : "Resend code"}
            </Text>
          </Pressable>
        </View>
        <View nativeID="clerk-captcha" />
      </SafeAreaView>
    );
  }

  const btnDisabled =
    !email ||
    !password ||
    !confirmPassword ||
    loading ||
    googleLoading ||
    !isLoaded;
  const googleDisabled = loading || googleLoading || !isLoaded;

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

          {/* Google SSO button */}
          <Pressable
            style={({ pressed }) => [
              styles.googleBtn,
              (googleDisabled || pressed) && styles.googleBtnPressed,
            ]}
            onPress={handleGoogleSignUp}
            disabled={googleDisabled}
            accessibilityLabel="Sign up with Google"
          >
            <Image
              source={{ uri: GOOGLE_LOGO }}
              style={styles.googleLogo}
              resizeMode="contain"
            />
            <Text style={styles.googleBtnText}>
              {googleLoading ? "Signing up…" : "Continue with Google"}
            </Text>
          </Pressable>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

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
                confirmPassword.length > 0 &&
                  password !== confirmPassword &&
                  styles.inputError,
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
              label={
                loading
                  ? "Creating account…"
                  : !isLoaded
                    ? "Loading…"
                    : "Create account"
              }
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
  subtitle: { fontSize: 15, color: C.ink4, marginBottom: 24 },
  emailHighlight: { color: C.ink, fontWeight: "600" },
  hint: {
    fontSize: 13,
    color: C.ink4,
    marginBottom: 24,
    lineHeight: 18,
    backgroundColor: C.card,
    padding: 12,
    borderRadius: 10,
  },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  googleBtnPressed: { opacity: 0.7 },
  googleLogo: { width: 20, height: 20, marginRight: 10 },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: C.ink },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { color: C.ink4, fontSize: 13, marginHorizontal: 12 },
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
  link: {
    color: C.rust,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  linkMuted: { color: C.ink4 },
  resendDisabled: { opacity: 0.6 },
});
