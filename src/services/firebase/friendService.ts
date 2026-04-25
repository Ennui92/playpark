import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { db } from '@/config/firebase';
import { Friendship, FriendRequest } from '@/types';

const functions = getFunctions();

// ─── QR nonce generation ──────────────────────────────────────────────────────
// The nonce is written directly from the client so QR generation works
// independently of Cloud Function deployment. The sendFriendRequest Cloud
// Function still validates and consumes the nonce server-side.

export async function generateQRNonce(userId: string): Promise<string> {
  const nonce =
    Math.random().toString(36).substring(2, 10) +
    Math.random().toString(36).substring(2, 10) +
    Date.now().toString(36);

  const expiresAt = Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  await setDoc(doc(db, 'qrNonces', nonce), {
    userId,
    expiresAt,
    used: false,
  });

  return nonce;
}

// ─── Send friend request (calls Cloud Function for nonce validation) ──────────

interface SendFriendRequestParams {
  fromUserId: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  toUserId: string;
  nonce: string;
}

export async function sendFriendRequest(params: SendFriendRequestParams): Promise<void> {
  const send = httpsCallable<SendFriendRequestParams, void>(functions, 'sendFriendRequest');
  await send(params);
}

// ─── Get friends list ─────────────────────────────────────────────────────────

export async function getFriends(userId: string): Promise<Friendship[]> {
  const snap = await getDocs(
    query(
      collection(db, 'users', userId, 'friendships'),
      where('status', '==', 'active')
    )
  );
  return snap.docs.map((d) => d.data() as Friendship);
}

// ─── Get pending friend requests ──────────────────────────────────────────────

export async function getPendingRequests(userId: string): Promise<FriendRequest[]> {
  const snap = await getDocs(
    query(
      collection(db, 'pendingFriendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      where('expiresAt', '>', Timestamp.now())
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FriendRequest));
}

// ─── Accept friend request ────────────────────────────────────────────────────

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const accept = httpsCallable<{ requestId: string }, void>(functions, 'acceptFriendRequest');
  await accept({ requestId });
}
