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
// Avatar building blocks. Two axes: a person/hair "base" and an optional skin
// tone. Chicks/babies lead (parents reach for those for a little one). Hair
// variants (red/curly/white/bald) plus the blond forms (👱) cover hair colour;
// skin tone covers the rest, so the picker can represent kids of any look.
export const AVATAR_BASES = [
  "🐣", "🐥",
  "👶", "🧒", "👦", "👧",
  "👩", "👩‍🦰", "👩‍🦱", "👩‍🦳", "👱‍♀️",
  "👨", "👨‍🦰", "👨‍🦱", "👨‍🦳", "👨‍🦲", "👱‍♂️",
  "🧑", "🧑‍🦰", "🧑‍🦱", "🧑‍🦳", "👱",
  "🧕", "👵", "👴",
  "🦄", "🧸",
] as const;

// Fitzpatrick skin-tone modifiers (combine with a person base).
export const SKIN_TONES = ["🏻", "🏼", "🏽", "🏾", "🏿"] as const;

// Animals/objects can't take a skin tone; every person can.
const NON_TONEABLE = new Set(["🐣", "🐥", "🦄", "🧸"]);

export function isToneable(base: string): boolean {
  return !NON_TONEABLE.has(base);
}

// Insert the tone right after the person codepoint, before any ZWJ hair/gender
// sequence ("👩" + "🏽" => "👩🏽"; "👩‍🦰" + "🏽" => "👩🏽‍🦰"; "👱‍♀️" + "🏿" => "👱🏿‍♀️").
export function withSkinTone(base: string, tone: string): string {
  if (!tone) return base;
  const chars = [...base];
  return chars[0] + tone + chars.slice(1).join("");
}

// Split a stored emoji back into { base, tone } so the editor can re-select it.
export function splitTone(emoji: string): { base: string; tone: string } {
  const chars = [...emoji];
  if (chars[1] && (SKIN_TONES as readonly string[]).includes(chars[1])) {
    return { base: chars[0] + chars.slice(2).join(""), tone: chars[1] };
  }
  return { base: emoji, tone: "" };
}

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
