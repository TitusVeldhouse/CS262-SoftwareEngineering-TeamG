import { View } from "react-native";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { FavoritesProvider } from "../data/favorites-context";
import { AuthProvider } from "../data/auth-context";
import FavoritesDrawer from "../components/FavoritesDrawer";

// GestureHandlerRootView wraps the navigator so native gestures work on all routes.
export default function RootLayout() {
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
