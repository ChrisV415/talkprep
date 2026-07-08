import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/expo";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { SymbolView } from "expo-symbols";

import { useColors } from "@/hooks/useColors";
import { setAuthTokenGetter } from "@/lib/api";

const ONBOARDING_KEY = "@talkprep_onboarded";

export default function TabLayout() {
  const { isSignedIn, isLoaded, getToken } = useAuth();
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      setNeedsOnboarding(val === null);
      setOnboardingChecked(true);
    });
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />;
  if (!onboardingChecked) return null;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.rust,
        tabBarInactiveTintColor: colors.ink4,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="house" tintColor={color} size={26} />
            ) : (
              <Feather name="home" size={26} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="clock" tintColor={color} size={26} />
            ) : (
              <Feather name="clock" size={26} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Progress",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="chart.bar" tintColor={color} size={26} />
            ) : (
              <Feather name="bar-chart-2" size={26} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="person.circle" tintColor={color} size={26} />
            ) : (
              <Feather name="user" size={26} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
