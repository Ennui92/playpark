import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { supabase } from "@/config/supabase";

// Called once after sign-in. Asks for permission, registers the Expo push
// token, and stores it on public.users.push_token for the edge function to
// fan out pushes. Safe to call repeatedly — no-op on re-register.
export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    return null; // Simulators can't receive real pushes.
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("broadcasts", {
      name: "Friend broadcasts",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 150, 100, 150],
      lightColor: "#FF7A59",
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );
  const token = tokenData.data;

  // Persist on the user row. RLS allows self-update (users_update policy).
  await supabase.from("users").update({ push_token: token }).eq("id", userId);

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
