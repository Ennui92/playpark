import { Timestamp, GeoPoint } from 'firebase/firestore';

// ─── User ────────────────────────────────────────────────────────────────────

export interface User {
  uid: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: Timestamp;
  fcmToken: string | null;
  notificationPrefs: NotificationPrefs;
  friendCount: number;
}

export interface NotificationPrefs {
  enabled: boolean;
  mutedUntil: Timestamp | null; // null = not muted
}

// ─── Child ───────────────────────────────────────────────────────────────────

export interface Child {
  id: string;
  name: string;
  birthDate: Timestamp;
  photoUrl: string | null;
  emoji: string | null; // fallback avatar if no photo
}

// ─── Friendship ──────────────────────────────────────────────────────────────

export type FriendshipStatus = 'active' | 'pending' | 'blocked';

export interface Friendship {
  friendUserId: string;
  friendDisplayName: string;
  friendAvatarUrl: string | null;
  connectedAt: Timestamp;
  status: FriendshipStatus;
}

// ─── Friend Request ──────────────────────────────────────────────────────────

export interface FriendRequest {
  id: string;
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  createdAt: Timestamp;
  status: 'pending' | 'accepted' | 'declined';
  expiresAt: Timestamp;
}

// ─── Playground ──────────────────────────────────────────────────────────────

export interface Playground {
  id: string;
  name: string;
  address: string;
  location: GeoPoint;
  googlePlaceId: string | null;
  createdBy: string | null;
  checkInCount: number; // active right now
  totalVisits: number;
}

// ─── Check-in ────────────────────────────────────────────────────────────────

export type CheckInStatus = 'en_route' | 'arrived' | 'left';

export interface CheckIn {
  id: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  playgroundId: string;
  playgroundName: string;
  status: CheckInStatus;
  children: CheckInChild[];
  message: string | null;
  plannedArrival: Timestamp | null;
  arrivedAt: Timestamp | null;
  leftAt: Timestamp | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  confirmedBy: string[]; // userIds who tapped "I'll be there"
}

export interface CheckInChild {
  childId: string;
  name: string;
  photoUrl: string | null;
}

// ─── Feed Entry ──────────────────────────────────────────────────────────────

// Stored at users/{uid}/feed/{checkInId} — denormalized for fast queries
export interface FeedEntry {
  checkInId: string;
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  playgroundId: string;
  playgroundName: string;
  status: CheckInStatus;
  children: CheckInChild[];
  message: string | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  confirmedBy: string[];
}

// ─── Gamification ────────────────────────────────────────────────────────────

export interface Badge {
  badgeId: string;
  earnedAt: Timestamp;
  seen: boolean;
}

export interface UserStats {
  totalCheckIns: number;
  currentStreak: number;
  longestStreak: number;
  thisMonthCheckIns: number;
  badges: Badge[];
  lastCheckInDate: string; // YYYY-MM-DD
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  count: number;
}

// ─── Badge Definitions ───────────────────────────────────────────────────────

export const BADGE_DEFINITIONS: Record<string, { label: string; description: string; emoji: string }> = {
  first_checkin: {
    label: 'First Steps',
    description: 'Checked in to your first playground',
    emoji: '🌟',
  },
  streak_7: {
    label: 'Week Warrior',
    description: '7-day check-in streak',
    emoji: '🔥',
  },
  streak_30: {
    label: 'Park Regular',
    description: '30-day check-in streak',
    emoji: '🏆',
  },
  social_5: {
    label: 'Playground Crew',
    description: 'Added 5 parent friends',
    emoji: '👨‍👩‍👧',
  },
  social_10: {
    label: 'Super Social',
    description: 'Added 10 parent friends',
    emoji: '🎉',
  },
  monthly_10: {
    label: 'Active Month',
    description: '10 check-ins in a single month',
    emoji: '📅',
  },
  confirmed_5: {
    label: 'Meet-up Maker',
    description: 'Confirmed 5 playdates',
    emoji: '🤝',
  },
};

// ─── Navigation ──────────────────────────────────────────────────────────────

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Onboarding: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  FeedTab: undefined;
  CheckInTab: undefined;
  FriendsTab: undefined;
  ProfileTab: undefined;
};

export type FeedStackParamList = {
  Feed: undefined;
  PlaygroundDetail: { playgroundId: string };
  FriendProfile: { userId: string };
  CheckInDetail: { checkInId: string };
};

export type CheckInStackParamList = {
  CheckIn: undefined;
  PlaygroundSearch: undefined;
  AddPlayground: undefined;
  EditPlayground: { playgroundId: string };
  CheckInConfirm: { playgroundId: string; playgroundName: string };
};

export type FriendsStackParamList = {
  FriendsList: undefined;
  AddFriend: undefined;
  FriendProfile: { userId: string };
  PendingRequests: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  ChildrenList: undefined;
  AddChild: undefined;
  EditChild: { childId: string };
  Badges: undefined;
  Leaderboard: undefined;
  NotificationSettings: undefined;
  Settings: undefined;
};
