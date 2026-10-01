// Landing screen (route "/") — the app's introductory page. It pitches
// Calvin Finder with a hero message and feature list, then hands off to the
// data-driven Finder screen (src/app/finder.tsx) via the CTA button.
import { Text, View, Pressable, StyleSheet } from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";

// Shared color palette for this screen.
const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const BG = "#F6F8FB";
const CARD_BG = "#FFFFFF";
const BORDER = "#E6EAF0";

// Hard-coded (mocked) feature blurbs shown on the landing page. Exported so
// tests can assert every feature card actually renders.
export const FEATURES = [
  {
    icon: "🔍",
    title: "Classroom & Room Search",
    body: "Type a room or building name, get walking directions instantly.",
  },
  {
    icon: "🧭",
    title: "Points of Interest",
    body: "Restrooms, vending machines, water fountains, and printers — all mapped.",
  },
  {
    icon: "📍",
    title: "Live Campus Map",
    body: "An interactive map that actually knows where you're headed.",
  },
] as const;

// Cast because expo-router's typed routes are generated at dev-server
// start-up and won't yet know about `/finder` on a fresh checkout.
const FINDER_ROUTE = "/finder" as Href;
const ROOM_SEARCH_ROUTE = "/room-search" as Href;

export default function Landing() {
  const router = useRouter();

  // Custom fonts load asynchronously; render an empty placeholder until
  // they're ready so text doesn't flash in the default system font first.
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={styles.container} testID="landing-loading" />;
  }

  return (
    <View style={styles.container} testID="landing-screen">
      {/* Hide the default expo-router header; this screen has its own hero. */}
      <Stack.Screen options={{ headerShown: false }} />

      {/* Hero: app name, headline, and short pitch. */}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>CALVIN FINDER</Text>
        <Text style={styles.title} testID="landing-title">
          Never get lost on campus again.
        </Text>
        <Text style={styles.subtitle}>
          Search any room or building and get pinned live on an interactive
          map of Calvin&apos;s campus.
        </Text>
      </View>

      {/* One card per mocked feature in FEATURES. */}
      <View style={styles.featureList}>
        {FEATURES.map((feature) => {
          const content = (
            <>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureBody}>{feature.body}</Text>
              </View>
            </>
          );

          if (feature.title === "Classroom & Room Search") {
            return (
              <Pressable
                key={feature.title}
                testID="classroom-search-feature"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.featureCard,
                  pressed && styles.ctaPressed,
                ]}
                onPress={() => router.push(ROOM_SEARCH_ROUTE)}
              >
                {content}
              </Pressable>
            );
          }

          return (
            <View key={feature.title} style={styles.featureCard}>
              {content}
            </View>
          );
        })}
      </View>

      {/* Primary call to action: push the Finder screen onto the stack. */}
      <Pressable
        testID="get-started-button"
        style={({ pressed }) => [
          styles.cta,
          pressed && styles.ctaPressed,
        ]}
        onPress={() => router.push(FINDER_ROUTE)}
      >
        <Text style={styles.ctaText}>Find a Room</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 24,
    paddingTop: 96,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  hero: {
    gap: 12,
  },
  eyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    letterSpacing: 1.5,
    color: ACCENT,
  },
  title: {
    fontFamily: "Inter_800ExtraBold",
    fontSize: 32,
    lineHeight: 38,
    color: INK,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 24,
    color: SUBTLE,
  },
  featureList: {
    gap: 12,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    padding: 16,
  },
  featureIcon: {
    fontSize: 22,
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    color: INK,
  },
  featureBody: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: SUBTLE,
  },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaPressed: {
    opacity: 0.85,
  },
  ctaText: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: "#FFFFFF",
  },
});
