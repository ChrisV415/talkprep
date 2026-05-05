import {
  Sora_400Regular,
  Sora_500Medium,
  Sora_600SemiBold,
  Sora_700Bold,
  useFonts,
} from "@expo-google-fonts/sora";
import { ClerkProvider, ClerkLoaded, useAuth } from "@clerk/expo";
import { tokenCache as nativeTokenCache } from "@clerk/expo/token-cache";
import { Platform } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter as setApiClientTokenGetter } from "@workspace/api-client-react";
import { setAuthTokenGetter } from "@/lib/api";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider } from "@/context/AppContext";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { initReminders } from "@/lib/notifications";

const domain = process.env.EXPO_PUBLIC_DOMAIN;

// On web, derive the base URL and Clerk proxy URL from window.location at
// runtime so the bundle is domain-agnostic and works without rebuilding.
function getRuntimeOrigin(): string | null {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location?.hostname &&
    window.location.hostname !== "localhost"
  ) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return domain ? `https://${domain}` : null;
}

const runtimeOrigin = getRuntimeOrigin();
if (runtimeOrigin) setBaseUrl(runtimeOrigin);

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;
const tokenCache = Platform.OS !== "web" ? nativeTokenCache : undefined;
const proxyUrl = runtimeOrigin ? `${runtimeOrigin}/api/__clerk` : undefined;

function AuthSync() {
  const { getToken } = useAuth();
  useEffect(() => {
    const getter = () => getToken();
    setApiClientTokenGetter(getter);
    setAuthTokenGetter(getter);
  }, [getToken]);
  return null;
}

function useWebPWA() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;

    const metaTags: { name?: string; property?: string; content: string }[] = [
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "TalkPrep" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "application-name", content: "TalkPrep" },
      { name: "theme-color", content: "#C67C4E" },
      { name: "msapplication-TileColor", content: "#C67C4E" },
    ];

    metaTags.forEach(({ name, content }) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const meta = document.createElement("meta");
        if (name) meta.name = name;
        meta.content = content;
        document.head.appendChild(meta);
      }
    });

    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const link = document.createElement("link");
      link.rel = "apple-touch-icon";
      link.href = "/apple-touch-icon.png";
      document.head.appendChild(link);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }
  }, []);
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="prep" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="result" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="persona" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="roleplay" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="transcript" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="score" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="debrief" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="upgrade" options={{ headerShown: false, presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    Sora_700Bold,
  });

  useWebPWA();

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    initReminders().catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache} proxyUrl={proxyUrl}>
      <ClerkLoaded>
        <AuthSync />
        <SafeAreaProvider>
          <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
              <AppProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  {Platform.OS !== "web" ? (
                    <KeyboardProvider>
                      <RootLayoutNav />
                      <PWAInstallPrompt />
                    </KeyboardProvider>
                  ) : (
                    <>
                      <RootLayoutNav />
                      <PWAInstallPrompt />
                    </>
                  )}
                </GestureHandlerRootView>
              </AppProvider>
            </QueryClientProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </ClerkLoaded>
    </ClerkProvider>
  );
}
