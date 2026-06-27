import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { Member, MemberAvatar, MemberRole } from "@/types";

export async function getFamilyMembers(familyId: string): Promise<Member[]> {
  const snap = await getDocs(collection(db, "families", familyId, "members"));
  return snap.docs
    .map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        name: x.name,
        role: x.role,
        avatar: (x.avatar ?? null) as MemberAvatar | null,
        emoji: (x.emoji ?? null) as string | null, // legacy render-only fallback
        birth_year: x.birth_year ?? null,
        created_at: x.created_at,
      } as Member;
    })
    .sort((a, b) => {
      // Grown-ups first, then by creation order.
      if (a.role !== b.role) return a.role === "parent" ? -1 : 1;
      return (a.created_at ?? "").localeCompare(b.created_at ?? "");
    });
}

export async function addFamilyMember(
  familyId: string,
  m: { name: string; role: MemberRole; avatar: MemberAvatar; birthYear: number | null }
): Promise<void> {
  await addDoc(collection(db, "families", familyId, "members"), {
    name: m.name.trim(),
    role: m.role,
    avatar: m.avatar,
    birth_year: m.birthYear,
    created_at: new Date().toISOString(),
  });
}

export async function updateFamilyMember(
  familyId: string,
  memberId: string,
  patch: { name?: string; role?: MemberRole; avatar?: MemberAvatar; birth_year?: number | null }
): Promise<void> {
  await updateDoc(doc(db, "families", familyId, "members", memberId), patch);
}

export async function removeFamilyMember(
  familyId: string,
  memberId: string
): Promise<void> {
  await deleteDoc(doc(db, "families", familyId, "members", memberId));
}
