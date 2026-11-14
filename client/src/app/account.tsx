import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { useAuth } from "../data/auth-context";
import { useFavorites } from "../data/favorites-context";

const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const BORDER = "#E6EAF0";
const BG = "#F6F8FB";
const CARD_BG = "#FFFFFF";

function getInitials(name?: string, email?: string): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "U";
  const words = source.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, profile, isAuthenticated, logout } = useAuth();
  const { favorites } = useFavorites();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  const handleSignOut = async () => {
    await logout();
    router.replace("/");
  };

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initials = getInitials(profile?.display_name, user?.email);

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      testID="account-screen"
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header navigation bar */}
      <View style={styles.header}>
        <Pressable
          testID="account-back-button"
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Account Profile</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.avatarHeader}>
          <View style={styles.avatarCircle} testID="account-avatar-circle">
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
          <Text style={styles.displayName} testID="account-display-name">
            {displayName}
          </Text>
          <Text style={styles.email} testID="account-email">
            {user?.email || "Guest Account"}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.syncBadge} testID="account-sync-badge">
              <Text style={styles.syncBadgeText}>
                {isAuthenticated ? "● Account Synced" : "○ Guest Mode"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Saved Favorites</Text>
            <Text style={styles.infoValue} testID="account-favorites-count">
              {favorites.length} {favorites.length === 1 ? "place" : "places"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Status</Text>
            <Text style={styles.infoValue}>
              {isAuthenticated ? "Logged In" : "Guest (Local Storage Only)"}
            </Text>
          </View>
        </View>

        {isAuthenticated ? (
          <Pressable
            testID="account-sign-out-button"
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
            ]}
            onPress={handleSignOut}
          >
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </Pressable>
        ) : (
          <Pressable
            testID="account-login-redirect-button"
            accessibilityRole="button"
            accessibilityLabel="Log in"
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.loginButtonPressed,
            ]}
            onPress={() => router.push("/login" as Href)}
          >
            <Text style={styles.loginButtonText}>Log In to Account</Text>
          </Pressable>
        )}

        <Pressable
          testID="account-goto-finder-button"
          accessibilityRole="button"
          accessibilityLabel="Go to campus map"
          style={({ pressed }) => [
            styles.mapButton,
            pressed && styles.mapButtonPressed,
          ]}
          onPress={() => router.push("/finder" as Href)}
        >
          <Text style={styles.mapButtonText}>Open Campus Map</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: "center",
  },
  header: {
    width: "100%",
    maxWidth: 420,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  backButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: INK,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 16,
    color: INK,
  },
  headerPlaceholder: {
    width: 60,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    gap: 18,
  },
  avatarHeader: {
    alignItems: "center",
    gap: 6,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: ACCENT,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  avatarInitials: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: "#FFFFFF",
  },
  displayName: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
    color: INK,
  },
  email: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: SUBTLE,
  },
  badgeRow: {
    marginTop: 4,
  },
  syncBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  syncBadgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11.5,
    color: ACCENT,
  },
  infoSection: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: SUBTLE,
  },
  infoValue: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: INK,
  },
  signOutButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonPressed: {
    backgroundColor: "#FCD34D",
  },
  signOutButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: "#DC2626",
  },
  loginButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  loginButtonPressed: {
    opacity: 0.88,
  },
  loginButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13.5,
    color: "#FFFFFF",
  },
  mapButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonPressed: {
    backgroundColor: "#F1F5F9",
  },
  mapButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: INK,
  },
});
