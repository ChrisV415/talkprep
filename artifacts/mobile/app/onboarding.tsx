import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
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
};

const slides: {
  id: string;
  image: ImageSourcePropType;
  tag: string;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "1",
    image: require("../assets/images/onboard1.jpg"),
    tag: "PREPARE",
    title: "Stop winging it",
    subtitle:
      "TalkPrep builds you a custom script for the conversations that actually matter — raises, boundaries, hard truths, big asks.",
  },
  {
    id: "2",
    image: require("../assets/images/onboard2.jpg"),
    tag: "PRACTICE",
    title: "Practice with AI that pushes back",
    subtitle:
      "Roleplay with an AI playing the other person. Get real-time coaching nudges so you're ready when it counts — not after.",
  },
  {
    id: "3",
    image: require("../assets/images/onboard3.jpg"),
    tag: "PROGRESS",
    title: "Watch yourself get better",
    subtitle:
      "Every session is scored and saved. Track your clarity, composure, and outcomes over time — proof that practice works.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);

  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    router.replace("/(tabs)");
  };

  const next = () => {
    if (activeIndex < slides.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else {
      finish();
    }
  };

  const isLast = activeIndex === slides.length - 1;
  const slide = slides[activeIndex];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Skip button */}
      <View style={styles.skipRow}>
        {!isLast ? (
          <Pressable onPress={finish} hitSlop={12}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      {/* Hero image */}
      <View style={styles.imageWrap}>
        <Image source={slide.image} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay} />
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{slide.tag}</Text>
        </View>
      </View>

      {/* Text */}
      <View style={styles.textWrap}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </View>

      {/* Dots + button */}
      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <Pressable key={i} onPress={() => setActiveIndex(i)} hitSlop={8}>
              <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
            </Pressable>
          ))}
        </View>
        <Pressable
          style={styles.btn}
          onPress={next}
          accessibilityLabel={isLast ? "Get started" : "Next slide"}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>{isLast ? "Get started" : "Next"}</Text>
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

  imageWrap: {
    marginHorizontal: 20,
    borderRadius: 24,
    overflow: "hidden",
    height: 220,
    position: "relative",
  },
  image: { width: "100%", height: "100%" },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  tagPill: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: C.rust,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  tagText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },

  textWrap: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    justifyContent: "flex-start",
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 15,
    color: C.ink4,
    lineHeight: 23,
  },

  bottom: { paddingHorizontal: 28, paddingBottom: 28 },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 20,
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
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
