import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";
import { useAuth } from "../data/auth-context";

const ACCENT = "#208AEF";
const INK = "#101828";
const BORDER = "#E6EAF0";
const ACCENT_LIGHT = "#EFF6FF";

function getInitials(name?: string, email?: string): string {
  const source = (name && name.trim()) || (email && email.split("@")[0]) || "U";
  const words = source.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export function UserAvatarButton({
  testID = "user-avatar-button",
  onPressOverride,
}: {
  testID?: string;
  onPressOverride?: () => void;
}) {
  const router = useRouter();
  const { user, profile, isAuthenticated } = useAuth();

  const handlePress = () => {
    if (onPressOverride) {
      onPressOverride();
      return;
    }
    if (isAuthenticated) {
      router.push("/account" as Href);
    } else {
      router.push("/login" as Href);
    }
  };

  if (!isAuthenticated) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="Log in to your account"
        style={({ pressed }) => [
          styles.guestButton,
          pressed && styles.buttonPressed,
        ]}
        onPress={handlePress}
      >
        <View style={styles.guestIconCircle}>
          <Text style={styles.guestIcon}>👤</Text>
        </View>
        <Text style={styles.guestLabel}>Log In</Text>
      </Pressable>
    );
  }

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initials = getInitials(profile?.display_name, user?.email);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Account profile for ${displayName}`}
      style={({ pressed }) => [
        styles.userButton,
        pressed && styles.buttonPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.avatarCircle} testID="user-avatar-circle">
        <Text style={styles.avatarInitials}>{initials}</Text>
      </View>
      <Text style={styles.userLabel} numberOfLines={1}>
        {displayName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  guestButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 11,
    gap: 6,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  userButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    gap: 7,
    maxWidth: 140,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  buttonPressed: {
    opacity: 0.85,
    backgroundColor: "#F8FAFC",
  },
  guestIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: ACCENT_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  guestIcon: {
    fontSize: 11,
  },
  guestLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
    color: ACCENT,
  },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontFamily: "Inter_700Bold",
    fontSize: 10.5,
    color: "#FFFFFF",
  },
  userLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
    color: INK,
  },
});
