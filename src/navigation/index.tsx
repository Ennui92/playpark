import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { useSession } from "@/contexts/SessionContext";
import { COLORS } from "@/utils/theme";
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
  const { loading, session, user } = useSession();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  const { refreshBadges } = useSession();

  // Deep-link from a tapped push:
  //   { type: 'broadcast', landmarkId } → Landmark detail
  //   { type: 'friend_request' }        → Friends tab
  //   { type: 'rsvp', landmarkId }      → Landmark detail (broadcaster sees RSVP context)
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any;
      if (!navRef.current) return;
      if (data?.type === "broadcast" && data.landmarkId) {
        navRef.current.navigate("Landmark", { landmarkId: data.landmarkId });
      } else if (data?.type === "rsvp" && data.landmarkId) {
        navRef.current.navigate("Landmark", { landmarkId: data.landmarkId });
      } else if (data?.type === "friend_request") {
        navRef.current.navigate("Main");
        // Refresh count so the badge updates immediately when the user lands.
        refreshBadges?.();
      }
    });
    // Also refresh the badge when a push is RECEIVED (not just tapped),
    // so the (1) appears without requiring app-foreground.
    const received = Notifications.addNotificationReceivedListener((notif) => {
      const data = notif.request.content.data as any;
      if (data?.type === "friend_request") refreshBadges?.();
    });
    return () => {
      sub.remove();
      received.remove();
    };
  }, [refreshBadges]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center" }}>
        <ActivityIndicator color={COLORS.accent} size="large" />
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
