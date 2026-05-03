import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const ONBOARDING_KEY = "@talkprep_onboarded";

const C = {
  cream: "#F9F2ED",
  rust: "#C67C4E",
  ink: "#313131",
  ink4: "#9e9189",
  card: "#EDD6C8",
  border: "#E3E3E3",
  rustLight: "#F9F2ED",
  sageLight: "#EDD6C8",
};

const slides = [
  {
    id: "1",
    emoji: "🗣️",
    accent: C.rustLight,
    emojiBg: C.rust,
    title: "Stop winging it",
    subtitle:
      "TalkPrep builds you a custom script for the conversations that actually matter — raises, boundaries, hard truths, big asks.",
  },
  {
    id: "2",
    emoji: "🎭",
    accent: C.sageLight,
    emojiBg: C.sage,
    title: "Practice with AI that pushes back",
    subtitle:
      "Roleplay with an AI playing the other person. Get real-time coaching nudges so you're ready when it counts — not after.",
  },
  {
    id: "3",
    emoji: "📈",
    accent: C.rustLight,
    emojiBg: C.rust,
    title: "Watch yourself get better",
    subtitle:
      "Every session is scored and saved. Track your clarity, composure, and outcomes over time — proof that practice works.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/(tabs)");
  };

  const next = () => {
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      finish();
    }
  };

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLast = activeIndex === slides.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.skipRow}>
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={[styles.iconWrap, { backgroundColor: item.accent }]}>
              <View style={[styles.iconCircle, { backgroundColor: item.emojiBg }]}>
                <Text style={styles.emoji}>{item.emoji}</Text>
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <Pressable style={styles.btn} onPress={next}>
          <Text style={styles.btnText}>
            {isLast ? "Get started" : "Next"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream },
  skipRow: {
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skip: { fontSize: 15, color: C.ink4, fontWeight: "500" },

  slide: {
    width,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  iconWrap: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 44,
  },
  iconCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 56 },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: C.ink,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    color: C.ink4,
    textAlign: "center",
    lineHeight: 24,
  },

  bottom: { paddingHorizontal: 28, paddingBottom: 28 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 28,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: "#d9d3c9",
  },
  dotActive: {
    backgroundColor: C.rust,
    borderColor: C.rust,
    width: 24,
  },
  btn: {
    backgroundColor: C.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
