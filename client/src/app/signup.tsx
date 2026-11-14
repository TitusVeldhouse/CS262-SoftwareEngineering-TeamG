import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter, type Href } from "expo-router";
import { useAuth } from "../data/auth-context";

const ACCENT = "#208AEF";
const INK = "#101828";
const SUBTLE = "#5B6472";
const BORDER = "#E6EAF0";
const BG = "#F6F8FB";
const CARD_BG = "#FFFFFF";

export default function SignupScreen() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async () => {
    clearError();
    const ok = await register(email.trim(), password, displayName.trim());
    if (ok) {
      router.replace("/");
    }
  };

  const handleGoToLogin = () => {
    clearError();
    router.push("/login" as Href);
  };

  const handleBack = () => {
    clearError();
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.keyboardContainer}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="signup-screen"
      >
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header navigation bar */}
        <View style={styles.header}>
          <Pressable
            testID="signup-back-button"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={styles.backButton}
            onPress={handleBack}
          >
            <Text style={styles.backButtonText}>‹ Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Calvin Finder</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          <View style={styles.avatarHeader}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarIcon}>✨</Text>
            </View>
            <Text style={styles.title}>Create an Account</Text>
            <Text style={styles.subtitle}>
              Sign up to catch & save your favorites permanently across devices.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBanner} testID="signup-error-banner">
              <Text style={styles.errorText} testID="signup-error-text">
                {error}
              </Text>
            </View>
          )}

          {/* Form fields */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              testID="signup-display-name-input"
              accessibilityLabel="Display name"
              style={styles.input}
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (error) clearError();
              }}
              placeholder="e.g. Titus"
              placeholderTextColor={SUBTLE}
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              testID="signup-email-input"
              accessibilityLabel="Email address"
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) clearError();
              }}
              placeholder="e.g. student@calvin.edu"
              placeholderTextColor={SUBTLE}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              testID="signup-password-input"
              accessibilityLabel="Password"
              style={styles.input}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) clearError();
              }}
              placeholder="At least 6 characters"
              placeholderTextColor={SUBTLE}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Submit Button */}
          <Pressable
            testID="signup-submit-button"
            accessibilityRole="button"
            disabled={isLoading || !email.trim() || password.length < 6}
            style={({ pressed }) => [
              styles.submitButton,
              pressed && styles.submitButtonPressed,
              (isLoading || !email.trim() || password.length < 6) &&
                styles.submitButtonDisabled,
            ]}
            onPress={handleSignup}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                Create Account & Save Favorites
              </Text>
            )}
          </Pressable>

          {/* Login prompt with Click HERE! link */}
          <View style={styles.loginPromptRow} testID="signup-login-prompt">
            <Text style={styles.promptText}>Already have an account? Click </Text>
            <Pressable
              testID="signup-login-link"
              accessibilityRole="link"
              accessibilityLabel="Log in to existing account"
              onPress={handleGoToLogin}
              style={({ pressed }) => pressed && styles.linkPressed}
            >
              <Text style={styles.linkText}>HERE!</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: BG,
  },
  scrollContent: {
    flexGrow: 1,
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
    gap: 16,
  },
  avatarHeader: {
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarIcon: {
    fontSize: 24,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 22,
    color: INK,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: SUBTLE,
    textAlign: "center",
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  errorText: {
    fontFamily: "Inter_500Medium",
    fontSize: 12.5,
    color: "#DC2626",
    textAlign: "center",
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
    color: INK,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: INK,
  },
  submitButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  submitButtonPressed: {
    opacity: 0.88,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#FFFFFF",
  },
  loginPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    flexWrap: "wrap",
  },
  promptText: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: SUBTLE,
  },
  linkText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: ACCENT,
    textDecorationLine: "underline",
  },
  linkPressed: {
    opacity: 0.7,
  },
});
