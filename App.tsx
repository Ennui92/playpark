import React from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Ionicons } from "@expo/vector-icons";
import { LanguageProvider } from "@/i18n";
import { SessionProvider } from "@/contexts/SessionContext";
import { RootNavigator } from "@/navigation";
import { DialogHost } from "@/components/dialog";

export default function App() {
  // Explicitly load the Ionicons font BEFORE rendering the navigator.
  // Without this the bottom-tab icons render as boxy fallback characters
  // (□) on Android — the font file isn't auto-bundled in the APK.
  const [fontsLoaded] = useFonts({
    ...Ionicons.font,
  });
  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <LanguageProvider>
          <SessionProvider>
            <StatusBar style="dark" />
            <RootNavigator />
            {/* Mounted once; renders branded dialogs over everything. */}
            <DialogHost />
          </SessionProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
