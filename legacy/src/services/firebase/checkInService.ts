import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  GeoPoint,
  getDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import { CheckIn, CheckInChild, CheckInStatus, Playground } from '@/types';

// ─── Create a check-in ───────────────────────────────────────────────────────

interface CreateCheckInParams {
  userId: string;
  userDisplayName: string;
  userAvatarUrl: string | null;
  playgroundId: string;
  playgroundName: string;
  status: CheckInStatus;
  children: CheckInChild[];
  message: string | null;
}

export async function createCheckIn(params: CreateCheckInParams): Promise<string> {
  // Expire in 6 hours
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 6);

  const checkInData: Omit<CheckIn, 'id'> = {
    ...params,
    plannedArrival: null,
    arrivedAt: params.status === 'arrived' ? (serverTimestamp() as any) : null,
    leftAt: null,
    createdAt: serverTimestamp() as any,
    expiresAt: Timestamp.fromDate(expiresAt),
    confirmedBy: [],
  };

  const ref = await addDoc(collection(db, 'checkIns'), checkInData);
  return ref.id;
  // Cloud Function will handle fan-out notifications
}

// ─── Leave playground ────────────────────────────────────────────────────────

export async function leavePlayground(checkInId: string): Promise<void> {
  await updateDoc(doc(db, 'checkIns', checkInId), {
    status: 'left',
    leftAt: serverTimestamp(),
  });
}

// ─── Confirm playdate ("I'll be there!") ─────────────────────────────────────

export async function confirmPlaydate(checkInId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'checkIns', checkInId), {
    confirmedBy: arrayUnion(userId),
  });
}

// ─── Get active check-in for a user ──────────────────────────────────────────

export async function getActiveCheckIn(userId: string): Promise<CheckIn | null> {
  const q = query(
    collection(db, 'checkIns'),
    where('userId', '==', userId),
    where('status', 'in', ['en_route', 'arrived']),
    where('expiresAt', '>', Timestamp.now()),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const doc_ = snap.docs[0];
  return { id: doc_.id, ...doc_.data() } as CheckIn;
}

// ─── Nearby playgrounds (Firestore query, no geo library needed for MVP) ─────
// In production, replace with a geo query library (geofire-common) or
// a Cloud Function that uses the Google Places API.

export async function getNearbyPlaygrounds(lat: number, lng: number): Promise<Playground[]> {
  // Simple bounding box — ±0.05 degrees (~5 km)
  const delta = 0.05;

  const q = query(
    collection(db, 'playgrounds'),
    where('location', '>=', new GeoPoint(lat - delta, lng - delta)),
    where('location', '<=', new GeoPoint(lat + delta, lng + delta)),
    orderBy('location'),
    limit(20)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Playground));
}

// ─── Create a user-defined playground ────────────────────────────────────────

export async function createPlayground(
  name: string,
  lat: number,
  lng: number,
  createdBy: string
): Promise<string> {
  const ref = await addDoc(collection(db, 'playgrounds'), {
    name,
    address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    location: new GeoPoint(lat, lng),
    googlePlaceId: null,
    createdBy,
    checkInCount: 0,
    totalVisits: 0,
  });
  return ref.id;
}
