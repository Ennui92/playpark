import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/config/supabase";

// Called once after sign-in. Asks for permission, registers the Expo push
// token, and stores it on public.users.push_token for the edge function to
// fan out pushes. Safe to call repeatedly — no-op on re-register.
//
// THROWS on every recoverable failure with a clear message so callers can
// surface the real reason. The previous version returned null silently for
// permission denial and "not a real device", which made debugging zero-
// notification states impossible — the SessionContext call swallowed it
// with .catch(() => {}) and we'd see no token in the DB but no logs.
export async function registerForPushNotifications(userId: string): Promise<string> {
  if (!Device.isDevice) {
    throw new Error("Not a real device (simulator can't receive push)");
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") {
    throw new Error(
      "Notification permission denied. Enable it in your system settings → Apps → Outside → Notifications."
    );
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("broadcasts", {
      name: "Friend broadcasts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150],
      lightColor: "#FF7A59",
    });
    await Notifications.setNotificationChannelAsync("friend_requests", {
      name: "Friend requests",
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#FF7A59",
    });
    await Notifications.setNotificationChannelAsync("rsvps", {
      name: "Outing RSVPs",
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: "#FF7A59",
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Missing EAS projectId in app config");
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = tokenData.data;
  if (!token) {
    throw new Error("Expo returned no token");
  }

  // Persist on the user row. RLS allows self-update (users_update policy).
  const { error: dbErr } = await supabase
    .from("users")
    .update({ push_token: token })
    .eq("id", userId);
  if (dbErr) {
    throw new Error(`Failed to save token: ${dbErr.message}`);
  }

  return token;
}

// Foreground behavior — show banner + play sound.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
