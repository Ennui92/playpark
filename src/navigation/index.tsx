import React, { useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, View, Text, StyleSheet } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { useSession } from "@/contexts/SessionContext";
import { useT } from "@/i18n";
import { Button } from "@/components/Button";
import { COLORS, FONT_SIZE, SPACING } from "@/utils/theme";
import { RootStackParamList, MainTabParamList } from "@/types";

import { SignInScreen } from "@/screens/auth/SignInScreen";
import { OnboardingScreen } from "@/screens/onboarding/OnboardingScreen";
import { HomeScreen } from "@/screens/main/HomeScreen";
import { FriendsScreen } from "@/screens/main/FriendsScreen";
import { MeScreen } from "@/screens/main/MeScreen";
import { LandmarkScreen } from "@/screens/main/LandmarkScreen";
import { BroadcastComposeScreen } from "@/screens/main/BroadcastComposeScreen";
import { BroadcastSuccessScreen } from "@/screens/main/BroadcastSuccessScreen";
import { AddLandmarkScreen } from "@/screens/main/AddLandmarkScreen";
import { EditNeighborhoodScreen } from "@/screens/main/EditNeighborhoodScreen";
import { EditProfileScreen } from "@/screens/main/EditProfileScreen";
import { FriendProfileScreen } from "@/screens/main/FriendProfileScreen";
import { QRShareScreen } from "@/screens/friends/QRShareScreen";
import { QRScanScreen } from "@/screens/friends/QRScanScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

// Each tab gets a filled icon when focused and an outline icon otherwise —
// the standard iOS/Material pattern. Ionicons ships with the Expo SDK so
// no extra font config is required for native builds.
type TabIconName = "home" | "people" | "person";
const TAB_ICONS: Record<keyof MainTabParamList, TabIconName> = {
  Home: "home",
  Friends: "people",
  Me: "person",
};

function MainTabs() {
  const { pendingRequestCount } = useSession();
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const base = TAB_ICONS[route.name as keyof MainTabParamList];
        return {
          headerShown: false,
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.textTertiary,
          tabBarStyle: {
            backgroundColor: COLORS.surface,
            borderTopColor: COLORS.border,
          },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? base : (`${base}-outline` as const)}
              size={size}
              color={color}
            />
          ),
        };
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen
        name="Friends"
        component={FriendsScreen}
        options={{
          // Surfaces "(1)" on the Friends tab when there's a pending
          // friend request. Cleared once you accept/decline.
          tabBarBadge: pendingRequestCount > 0 ? pendingRequestCount : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.accent, color: "#fff" },
        }}
      />
      <Tabs.Screen name="Me" component={MeScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { loading, session, user, initError, retryInit, refreshBadges } = useSession();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);
  const t = useT();

  // Route a tapped notification to the right screen. Retries until the
  // navigation container is mounted — important for COLD STARTS, where the
  // tap launches the app and navRef.current is briefly null. Without the
  // retry, tapping a broadcast notification opened the app to Home and
  // "showed nothing" because the navigate fired before nav was ready.
  const routeFromData = useCallback(
    (data: any, attempt = 0) => {
      if (!data) return;
      if (!navRef.current) {
        if (attempt < 15) setTimeout(() => routeFromData(data, attempt + 1), 200);
        return;
      }
      if (data.type === "broadcast" && data.landmarkId) {
        navRef.current.navigate("Landmark", { landmarkId: data.landmarkId });
      } else if (data.type === "rsvp" && data.landmarkId) {
        navRef.current.navigate("Landmark", { landmarkId: data.landmarkId });
      } else if (data.type === "friend_request") {
        navRef.current.navigate("Main");
        refreshBadges?.();
      }
    },
    [refreshBadges]
  );

  useEffect(() => {
    // Cold start: handle the notification that LAUNCHED the app. The
    // response listener below does NOT reliably fire for that one.
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) routeFromData(resp.notification.request.content.data as any);
    });

    // Warm taps while the app is running.
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      routeFromData(resp.notification.request.content.data as any);
    });
    // Refresh the friend-request badge on RECEIVE (not just tap).
    const received = Notifications.addNotificationReceivedListener((notif) => {
      const data = notif.request.content.data as any;
      if (data?.type === "friend_request") refreshBadges?.();
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [routeFromData, refreshBadges]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  // We have a session but the profile fetch failed (network) — show a Retry
  // rather than hanging on the splash or wrongly routing to onboarding.
  if (session && !user && initError) {
    return (
      <View style={styles.retry}>
        <Text style={styles.retryEmoji}>📡</Text>
        <Text style={styles.retryTitle}>{t("session.loadFailed")}</Text>
        <Text style={styles.retrySub}>{t("session.loadFailedSub")}</Text>
        <Button title={t("common.retry")} onPress={retryInit} style={{ marginTop: SPACING.lg }} />
      </View>
    );
  }

  // Branching:
  //   no session          → Auth
  //   session, no profile → Onboarding
  //   otherwise           → Main (+ modals)
  const needsOnboarding = !!session && !user;

  return (
    <NavigationContainer ref={navRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <RootStack.Screen name="Auth" component={SignInScreen} />
        ) : needsOnboarding ? (
          <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabs} />
            <RootStack.Screen name="Landmark" component={LandmarkScreen} />
            <RootStack.Screen
              name="BroadcastCompose"
              component={BroadcastComposeScreen}
              options={{ presentation: "modal" }}
            />
            <RootStack.Screen
              name="BroadcastSuccess"
              component={BroadcastSuccessScreen}
              options={{ presentation: "transparentModal", animation: "fade" }}
            />
            <RootStack.Screen
              name="AddLandmark"
              component={AddLandmarkScreen}
              options={{ presentation: "modal" }}
            />
            <RootStack.Screen
              name="EditNeighborhood"
              component={EditNeighborhoodScreen}
              options={{ presentation: "modal" }}
            />
            <RootStack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ presentation: "modal" }}
            />
            <RootStack.Screen name="FriendProfile" component={FriendProfileScreen} />
            <RootStack.Screen name="QRShare" component={QRShareScreen} />
            <RootStack.Screen name="QRScan" component={QRScanScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  retry: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  retryEmoji: { fontSize: 56, marginBottom: SPACING.md },
  retryTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: "800",
    color: COLORS.textPrimary,
    textAlign: "center",
  },
  retrySub: {
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.xs,
  },
});
