import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { UserStats } from '@/types';

export async function getUserStats(userId: string): Promise<UserStats> {
  const snap = await getDoc(doc(db, 'userStats', userId));
  if (snap.exists()) return snap.data() as UserStats;

  // Return default stats if none exist yet
  const defaults: UserStats = {
    totalCheckIns: 0,
    currentStreak: 0,
    longestStreak: 0,
    thisMonthCheckIns: 0,
    badges: [],
    lastCheckInDate: '',
  };
  return defaults;
}
