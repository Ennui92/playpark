import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { FeedEntry } from '@/types';

/**
 * Subscribes to the user's personal feed subcollection.
 *
 * Feed entries are written here by the Cloud Function whenever a friend checks in
 * (fan-out pattern). This avoids the Firestore `in` query limit of 30 items.
 *
 * Returns an unsubscribe function.
 */
export function subscribeFeed(
  userId: string,
  onUpdate: (entries: FeedEntry[]) => void
): () => void {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - 8); // show last 8 hours of activity

  const q = query(
    collection(db, 'users', userId, 'feed'),
    where('expiresAt', '>', Timestamp.fromDate(cutoff)),
    orderBy('expiresAt', 'desc'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const entries: FeedEntry[] = snap.docs.map((doc) => ({
      checkInId: doc.id,
      ...(doc.data() as Omit<FeedEntry, 'checkInId'>),
    }));
    onUpdate(entries);
  });
}
