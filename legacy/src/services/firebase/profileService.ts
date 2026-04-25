import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { Child } from '@/types';

export async function getChildren(userId: string): Promise<Child[]> {
  const snap = await getDocs(collection(db, 'users', userId, 'children'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Child));
}

export async function getChild(userId: string, childId: string): Promise<Child | null> {
  const snap = await getDoc(doc(db, 'users', userId, 'children', childId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Child;
}

export async function addChild(
  userId: string,
  child: Omit<Child, 'id'>
): Promise<string> {
  const ref = await addDoc(collection(db, 'users', userId, 'children'), child);
  return ref.id;
}

export async function updateChild(
  userId: string,
  childId: string,
  updates: Partial<Omit<Child, 'id'>>
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'children', childId), updates as any);
}

export async function deleteChild(userId: string, childId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'children', childId));
}
