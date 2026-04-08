import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  MainTabParamList,
  FeedStackParamList,
  CheckInStackParamList,
  FriendsStackParamList,
  ProfileStackParamList,
} from '@/types';
import { COLORS } from '@/utils/theme';

// Screens
import { FeedScreen } from '@/screens/main/FeedScreen';
import { CheckInScreen } from '@/screens/main/CheckInScreen';
import { CheckInConfirmScreen } from '@/screens/main/CheckInConfirmScreen';
import { FriendsListScreen } from '@/screens/main/FriendsListScreen';
import { AddFriendScreen } from '@/screens/main/AddFriendScreen';
import { ProfileScreen } from '@/screens/main/ProfileScreen';
import { NotificationSettingsScreen } from '@/screens/main/NotificationSettingsScreen';
import { BadgesScreen } from '@/screens/main/BadgesScreen';
import { ChildrenListScreen } from '@/screens/main/ChildrenListScreen';
import { AddEditChildScreen } from '@/screens/main/AddEditChildScreen';

// ─── Stack navigators for each tab ───────────────────────────────────────────

const FeedStack = createNativeStackNavigator<FeedStackParamList>();
function FeedNavigator() {
  return (
    <FeedStack.Navigator screenOptions={{ headerShown: false }}>
      <FeedStack.Screen name="Feed" component={FeedScreen} />
    </FeedStack.Navigator>
  );
}

const CheckInStack = createNativeStackNavigator<CheckInStackParamList>();
function CheckInNavigator() {
  return (
    <CheckInStack.Navigator screenOptions={{ headerShown: false }}>
      <CheckInStack.Screen name="CheckIn" component={CheckInScreen} />
      <CheckInStack.Screen name="CheckInConfirm" component={CheckInConfirmScreen} />
    </CheckInStack.Navigator>
  );
}

const FriendsStack = createNativeStackNavigator<FriendsStackParamList>();
function FriendsNavigator() {
  return (
    <FriendsStack.Navigator screenOptions={{ headerShown: false }}>
      <FriendsStack.Screen name="FriendsList" component={FriendsListScreen} />
      <FriendsStack.Screen name="AddFriend" component={AddFriendScreen} />
    </FriendsStack.Navigator>
  );
}

const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
function ProfileNavigator() {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="Profile" component={ProfileScreen} />
      <ProfileStack.Screen name="ChildrenList" component={ChildrenListScreen} />
      <ProfileStack.Screen name="AddChild" component={AddEditChildScreen} />
      <ProfileStack.Screen name="EditChild" component={AddEditChildScreen} />
      <ProfileStack.Screen name="Badges" component={BadgesScreen} />
      <ProfileStack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="FeedTab" component={FeedNavigator} />
      <Tab.Screen name="CheckInTab" component={CheckInNavigator} />
      <Tab.Screen name="FriendsTab" component={FriendsNavigator} />
      <Tab.Screen name="ProfileTab" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

// ─── Custom tab bar with a prominent centre Check-In button ──────────────────

function CustomTabBar({ state, descriptors, navigation }: any) {
  const tabs = [
    { name: 'FeedTab', icon: '🏠', label: 'Feed' },
    { name: 'CheckInTab', icon: '📍', label: 'Check In', isCenter: true },
    { name: 'FriendsTab', icon: '👥', label: 'Friends' },
    { name: 'ProfileTab', icon: '👤', label: 'Profile' },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab, index) => {
        const isFocused = state.index === index;

        function onPress() {
          const event = navigation.emit({ type: 'tabPress', target: state.routes[index].key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(state.routes[index].name);
          }
        }

        if (tab.isCenter) {
          return (
            <TouchableOpacity key={tab.name} onPress={onPress} style={styles.centerButton}>
              <View style={styles.centerButtonInner}>
                <Text style={styles.centerButtonIcon}>{tab.icon}</Text>
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity key={tab.name} onPress={onPress} style={styles.tabItem}>
            <Text style={[styles.tabIcon, isFocused && styles.tabIconActive]}>{tab.icon}</Text>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 20,
    paddingTop: 10,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabIcon: {
    fontSize: 22,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  centerButton: {
    flex: 1,
    alignItems: 'center',
    marginTop: -20,
  },
  centerButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  centerButtonIcon: {
    fontSize: 26,
  },
});
