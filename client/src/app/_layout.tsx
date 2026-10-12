import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// GestureHandlerRootView wraps the navigator so native gestures work on all routes.
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack />
    </GestureHandlerRootView>
  );
}
