import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";

// Expo SecureStore limits values to ~2KB. Supabase session tokens fit,
// but if they ever don't, we'd want to fall back to AsyncStorage. For now
// SecureStore is the right call — tokens are sensitive.
const ExpoSecureStorageAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const supabaseUrl = extra.supabaseUrl;
const supabaseAnonKey = extra.supabaseAnonKey;

if (!supabaseUrl || !supabaseAnonKey || supabaseAnonKey.startsWith("REPLACE_")) {
  // Fail loud in dev — silent mis-config makes for nasty bugs.
  console.warn(
    "[supabase] Missing/placeholder credentials in app.json → expo.extra. " +
      "Set supabaseUrl and supabaseAnonKey before running the app."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    storage: ExpoSecureStorageAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
