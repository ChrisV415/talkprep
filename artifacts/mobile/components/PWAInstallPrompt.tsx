import React, { useEffect, useState } from "react";
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const SESSION_KEY = "talkprep_sessions";
const DISMISSED_KEY = "talkprep_pwa_dismissed";

const C = {
  cream: "#F9F2ED",
  rust: "#C67C4E",
  ink: "#313131",
  ink4: "#9e9189",
  card: "#EDD6C8",
  white: "#ffffff",
};

export function PWAInstallPrompt() {
  if (Platform.OS !== "web") return null;
  return <PWAInstallPromptWeb />;
}

function PWAInstallPromptWeb() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
   
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
       
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    if (localStorage.getItem(DISMISSED_KEY)) return;

    const sessions = parseInt(localStorage.getItem(SESSION_KEY) || "0", 10) + 1;
    localStorage.setItem(SESSION_KEY, String(sessions));
    if (sessions < 2) return;

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
       
      !(window as any).MSStream;
    setIsIOS(ios);

    if (ios) {
      setTimeout(() => setShow(true), 1500);
      return;
    }

     
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setShow(true), 1500);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    }
    dismiss();
  };

  const dismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISSED_KEY, "1");
  };

  if (!show) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.icon}
            resizeMode="contain"
          />
          <View style={styles.textGroup}>
            <Text style={styles.title}>Install TalkPrep</Text>
            <Text style={styles.subtitle}>
              Add to your home screen for instant access
            </Text>
          </View>
          <Pressable onPress={dismiss} style={styles.closeBtn} hitSlop={12}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {isIOS ? (
          <View style={styles.iosRow}>
            <Text style={styles.iosText}>
              Tap <Text style={styles.bold}>Share</Text>
              {"  ⬆︎  then  "}
              <Text style={styles.bold}>"Add to Home Screen"</Text>
            </Text>
          </View>
        ) : (
          <Pressable style={styles.installBtn} onPress={handleInstall}>
            <Text style={styles.installBtnText}>Install app</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: C.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  textGroup: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: C.ink,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: C.ink4,
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 14,
    color: C.ink4,
  },
  iosRow: {
    backgroundColor: C.cream,
    borderRadius: 10,
    padding: 12,
  },
  iosText: {
    fontSize: 14,
    color: C.ink,
    textAlign: "center",
    lineHeight: 22,
  },
  bold: {
    fontWeight: "700",
    color: C.rust,
  },
  installBtn: {
    backgroundColor: C.rust,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  installBtnText: {
    color: C.white,
    fontSize: 15,
    fontWeight: "600",
  },
});
