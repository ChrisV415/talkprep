import { useAuth } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { getApiUrl } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

type Price = {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
};

type Product = {
  id: string;
  name: string;
  description: string;
  metadata: Record<string, string>;
  prices: Price[];
};

function formatPrice(amount: number, interval: string | null) {
  const dollars = amount / 100;
  if (!interval) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(2).replace(".00", "")}/${interval === "month" ? "mo" : "yr"}`;
}

const PLAN_ORDER = ["Single Session", "Monthly Pro", "Annual Pro"];
const PLAN_BADGE: Record<string, string> = {
  "Monthly Pro": "MOST POPULAR",
  "Annual Pro": "BEST VALUE",
  "Single Session": "PAY AS YOU GO",
};
const PLAN_FEATURES: Record<string, string[]> = {
  "Single Session": [
    "Full prep guide",
    "Opening script + 3 response handlers",
    "Persona setup + role-play",
    "Annotated transcript review",
    "Post-conversation debrief",
  ],
  "Monthly Pro": [
    "Unlimited conversations",
    "Full conversation history",
    "Progress dashboard + score tracking",
    "Curveballs mode + persona depth",
    "Live strategy nudges",
    "Session sharing links",
  ],
  "Annual Pro": [
    "Everything in Monthly",
    "Save 49% vs monthly",
    "Export conversation history",
    "Priority response speed",
  ],
};

export default function UpgradeScreen() {
  const colors = useColors();
  const router = useRouter();
  const { getToken } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentSub, setCurrentSub] = useState<{ status: string } | null>(null);

  useEffect(() => {
    const baseUrl = getApiUrl();

    // Safety net: always stop spinner after 10s no matter what
    const safetyTimer = setTimeout(() => setLoading(false), 10_000);

    // Pro-status — try primary endpoint, fall back to Stripe subscription
    const checkPro = (token: string | null) =>
      fetch(`${baseUrl}api/user/pro-status`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json() as Promise<{ isPro?: boolean }>;
        })
        .catch(() =>
          fetch(`${baseUrl}api/stripe/subscription`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          })
            .then((r) => r.json())
            .then((d: { subscription?: { status: string } | null }) => ({
              isPro:
                d?.subscription != null &&
                (d.subscription.status === "active" || d.subscription.status === "trialing"),
            }))
            .catch(() => ({ isPro: false })),
        );

    getToken()
      .then((token) => checkPro(token))
      .then((proRes) => {
        if (proRes?.isPro) {
          setCurrentSub({ status: "active" });
          clearTimeout(safetyTimer);
          setLoading(false);
        }
      })
      .catch(() => {});

    // Products fetch — failure shows a graceful error, never blocks Pro state
    const productsCtrl = new AbortController();
    const productsTimeout = setTimeout(() => productsCtrl.abort(), 8_000);
    fetch(`${baseUrl}api/stripe/products`, { signal: productsCtrl.signal })
      .then((r) => r.json())
      .then((productsRes: { data?: Product[] }) => {
        const sorted = ((productsRes.data ?? []) as Product[]).sort(
          (a, b) => PLAN_ORDER.indexOf(a.name) - PLAN_ORDER.indexOf(b.name),
        );
        setProducts(sorted);
        const monthly = sorted.find((p) => p.name === "Monthly Pro");
        if (monthly?.prices[0]) setSelectedPriceId(monthly.prices[0].id);
      })
      .catch(() => setError("Plans unavailable. Contact support to upgrade."))
      .finally(() => {
        clearTimeout(productsTimeout);
        clearTimeout(safetyTimer);
        setLoading(false);
      });

    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(productsTimeout);
      productsCtrl.abort();
    };
  }, []);

  const handleSubscribe = useCallback(async () => {
    if (!selectedPriceId) return;
    setCheckoutLoading(true);
    setError("");
    try {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ priceId: selectedPriceId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        await Linking.openURL(data.url);
      } else {
        setError(data.error ?? "Failed to start checkout");
      }
    } catch {
      setError("Couldn't connect. Check your connection and try again.");
    } finally {
      setCheckoutLoading(false);
    }
  }, [selectedPriceId, getToken]);

  const handleManageBilling = useCallback(async () => {
    setCheckoutLoading(true);
    try {
      const token = await getToken();
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/stripe/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) await Linking.openURL(data.url);
    } catch {
      setError("Couldn't open billing portal.");
    } finally {
      setCheckoutLoading(false);
    }
  }, [getToken]);

  const isPro =
    currentSub?.status === "active" || currentSub?.status === "trialing";

  const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
    },
    backBtn: { padding: 8, marginRight: 8 },
    headerTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
    scroll: { flex: 1 },
    inner: { padding: 20, paddingBottom: 40 },
    hero: { alignItems: "center", marginBottom: 28 },
    heroTag: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: colors.rust,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    heroTitle: {
      fontSize: 26,
      fontWeight: "700",
      color: colors.ink,
      textAlign: "center",
      marginBottom: 8,
      lineHeight: 32,
    },
    heroSub: {
      fontSize: 14,
      color: colors.ink4,
      textAlign: "center",
      lineHeight: 20,
    },
    card: {
      borderRadius: 18,
      padding: 20,
      marginBottom: 12,
      borderWidth: 2,
    },
    cardSelected: {
      borderColor: colors.rust,
      backgroundColor: colors.card,
    },
    cardUnselected: {
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    cardHighlighted: {
      borderColor: colors.rust,
      backgroundColor: "#2A1F1A",
    },
    badge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 20,
      backgroundColor: colors.rust,
      marginBottom: 10,
    },
    badgeText: { fontSize: 10, fontWeight: "700", color: "#fff", letterSpacing: 1 },
    planName: { fontSize: 18, fontWeight: "700", marginBottom: 4 },
    planNameLight: { color: colors.ink },
    planNameDark: { color: "#fff" },
    planPrice: { fontSize: 32, fontWeight: "700", marginBottom: 4 },
    planPriceLight: { color: colors.ink },
    planPriceDark: { color: "#fff" },
    planSub: { fontSize: 12, marginBottom: 14 },
    planSubLight: { color: colors.ink4 },
    planSubDark: { color: "#C8B4A8" },
    featureRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    featureCheck: { marginRight: 8 },
    featureText: { fontSize: 14, flex: 1 },
    featureTextLight: { color: colors.ink },
    featureTextDark: { color: "#EDD6C8" },
    radioRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
    },
    radioLabel: { fontSize: 14, fontWeight: "600" },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.rust },
    ctaBtn: {
      backgroundColor: colors.rust,
      borderRadius: 28,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
      marginBottom: 12,
    },
    ctaBtnDisabled: { opacity: 0.5 },
    ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
    manageBtn: {
      borderWidth: 1.5,
      borderColor: colors.rust,
      borderRadius: 28,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 12,
    },
    manageBtnText: { color: colors.rust, fontSize: 15, fontWeight: "600" },
    error: { color: "#c0392b", fontSize: 13, textAlign: "center", marginTop: 8 },
    disclaimer: { fontSize: 11, color: colors.ink4, textAlign: "center", lineHeight: 16 },
    proTag: {
      backgroundColor: colors.rust,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: "center",
      marginBottom: 20,
    },
    proTagText: { color: "#fff", fontWeight: "700", fontSize: 14 },
    proMsg: { fontSize: 16, color: colors.ink, textAlign: "center", marginBottom: 20, lineHeight: 24 },
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Upgrade to Pro</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} bounces={false} overScrollMode="never">
        <View style={styles.hero}>
          <Text style={styles.heroTag}>Pricing</Text>
          <Text style={styles.heroTitle}>Less than one{"\n"}hour of coaching.</Text>
          <Text style={styles.heroSub}>
            Your first prep is free.{"\n"}Upgrade anytime for unlimited access.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.rust} style={{ marginTop: 40 }} />
        ) : isPro ? (
          <>
            <View style={styles.proTag}>
              <Text style={styles.proTagText}>Pro Active</Text>
            </View>
            <Text style={styles.proMsg}>
              You have unlimited access to all TalkPrep features. Thank you for being a Pro member!
            </Text>
            <Pressable
              style={[styles.manageBtn, checkoutLoading && styles.ctaBtnDisabled]}
              onPress={handleManageBilling}
              disabled={checkoutLoading}
            >
              <Text style={styles.manageBtnText}>
                {checkoutLoading ? "Opening…" : "Manage Billing"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            {products.map((product) => {
              const price = product.prices[0];
              const isMonthly = product.name === "Monthly Pro";
              const isSelected = price && selectedPriceId === price.id;
              const isHighlighted = isMonthly;

              return (
                <Pressable
                  key={product.id}
                  style={[
                    styles.card,
                    isHighlighted
                      ? styles.cardHighlighted
                      : isSelected
                        ? styles.cardSelected
                        : styles.cardUnselected,
                  ]}
                  onPress={() => price && setSelectedPriceId(price.id)}
                >
                  {PLAN_BADGE[product.name] && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{PLAN_BADGE[product.name]}</Text>
                    </View>
                  )}
                  <Text
                    style={[
                      styles.planName,
                      isHighlighted ? styles.planNameDark : styles.planNameLight,
                    ]}
                  >
                    {product.name.replace(" Pro", "")}
                  </Text>
                  {price && (
                    <Text
                      style={[
                        styles.planPrice,
                        isHighlighted ? styles.planPriceDark : styles.planPriceLight,
                      ]}
                    >
                      {formatPrice(price.unit_amount, price.recurring?.interval ?? null)}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.planSub,
                      isHighlighted ? styles.planSubDark : styles.planSubLight,
                    ]}
                  >
                    {price?.recurring
                      ? `per ${price.recurring.interval} · cancel anytime`
                      : "per conversation"}
                  </Text>

                  {(PLAN_FEATURES[product.name] ?? []).map((feat) => (
                    <View key={feat} style={styles.featureRow}>
                      <Feather
                        name="check"
                        size={14}
                        color={isHighlighted ? colors.rust : colors.rust}
                        style={styles.featureCheck}
                      />
                      <Text
                        style={[
                          styles.featureText,
                          isHighlighted ? styles.featureTextDark : styles.featureTextLight,
                        ]}
                      >
                        {feat}
                      </Text>
                    </View>
                  ))}

                  <View style={styles.radioRow}>
                    <Text
                      style={[
                        styles.radioLabel,
                        isHighlighted ? styles.planNameDark : styles.planNameLight,
                      ]}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </Text>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: isSelected ? colors.rust : colors.border,
                        },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={[styles.ctaBtn, (!selectedPriceId || checkoutLoading) && styles.ctaBtnDisabled]}
              onPress={handleSubscribe}
              disabled={!selectedPriceId || checkoutLoading}
            >
              <Text style={styles.ctaText}>
                {checkoutLoading ? "Opening checkout…" : "Get started →"}
              </Text>
            </Pressable>

            <Text style={styles.disclaimer}>
              Payments processed securely by Stripe.{"\n"}
              Cancel anytime from the billing portal.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
