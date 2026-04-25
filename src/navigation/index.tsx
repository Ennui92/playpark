import React, { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { NavigationContainer, NavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
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
import { QRShareScreen } from "@/screens/friends/QRShareScreen";
import { QRScanScreen } from "@/screens/friends/QRScanScreen";

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textTertiary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Friends" component={FriendsScreen} />
      <Tabs.Screen name="Me" component={MeScreen} />
    </Tabs.Navigator>
  );
}

export function RootNavigator() {
  const { loading, session, user } = useSession();
  const navRef = useRef<NavigationContainerRef<RootStackParamList>>(null);

  // Deep-link from a tapped push: { type: 'broadcast', landmarkId }
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any;
      if (data?.type === "broadcast" && data.landmarkId && navRef.current) {
        navRef.current.navigate("Landmark", { landmarkId: data.landmarkId });
      }
    });
    return () => sub.remove();
  }, []);

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
            <RootStack.Screen name="QRShare" component={QRShareScreen} />
            <RootStack.Screen name="QRScan" component={QRScanScreen} />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
