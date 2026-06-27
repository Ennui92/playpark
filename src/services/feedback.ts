import { addDoc, collection } from "firebase/firestore";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { db } from "@/config/firebase";
import { getMyFamilyId } from "@/services/me";

// A lightweight in-app feedback inbox. Writes land in the `feedback`
// collection (write-only for users; read it from the Firebase console or via
// admin). No backend/Cloud Function needed, so it works for every user from
// day one.
export type FeedbackCategory = "idea" | "problem" | "love" | "other";

export async function submitFeedback(
  message: string,
  category: FeedbackCategory
): Promise<void> {
  const familyId = await getMyFamilyId();
  await addDoc(collection(db, "feedback"), {
    family_id: familyId,
    message: message.trim(),
    category,
    app_version: Constants.expoConfig?.version ?? "?",
    platform: Platform.OS,
    created_at: new Date().toISOString(),
  });
}
