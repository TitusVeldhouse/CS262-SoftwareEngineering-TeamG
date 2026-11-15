import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FavoritesProvider } from "../data/favorites-context";
import { AuthProvider } from "../data/auth-context";
import FavoritesDrawer from "../components/FavoritesDrawer";
import { logApiBaseUrlOnce } from "../config/api";

// GestureHandlerRootView wraps the navigator so native gestures work on all routes.
export default function RootLayout() {
  // Development only: print which server address the app will call.
  useEffect(() => {
    logApiBaseUrlOnce();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <FavoritesProvider>
        <AuthProvider>
          <View style={{ flex: 1 }}>
            <Stack />
            <FavoritesDrawer />
          </View>
        </AuthProvider>
      </FavoritesProvider>
    </GestureHandlerRootView>
  );
}
