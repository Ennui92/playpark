import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Member, MemberRole } from "@/types";

// Preset people emojis offered as member avatars (no system emoji keyboard,
// so the picker stays one tap).
// Chicks and babies first — parents often pick those for a little one.
export const MEMBER_EMOJIS = [
  "🐣", "🐥", "👶", "🧒", "👦", "👧", "👩", "👨",
  "🧑", "👩‍🦰", "👨‍🦰", "🧕", "👵", "👴", "🦄", "🧸",
] as const;

export async function getFamilyMembers(familyId: string): Promise<Member[]> {
  const snap = await getDocs(collection(db, "families", familyId, "members"));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Member, "id">) }))
    .sort((a, b) => {
      // Grown-ups first, then by creation order.
      if (a.role !== b.role) return a.role === "parent" ? -1 : 1;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });
}

export async function addFamilyMember(
  familyId: string,
  m: { name: string; role: MemberRole; emoji: string; birthYear: number | null }
): Promise<void> {
  await addDoc(collection(db, "families", familyId, "members"), {
    name: m.name.trim(),
    role: m.role,
    emoji: m.emoji,
    birth_year: m.birthYear,
    created_at: new Date().toISOString(),
  });
}

export async function updateFamilyMember(
  familyId: string,
  memberId: string,
  patch: { name?: string; role?: MemberRole; emoji?: string; birth_year?: number | null }
): Promise<void> {
  await updateDoc(doc(db, "families", familyId, "members", memberId), patch);
}

export async function removeFamilyMember(
  familyId: string,
  memberId: string
): Promise<void> {
  await deleteDoc(doc(db, "families", familyId, "members", memberId));
}
