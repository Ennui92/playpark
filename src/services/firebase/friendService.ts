import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db } from '@/config/firebase';
import { Friendship, FriendRequest } from '@/types';
import { getFunctions } from 'firebase/functions';

const functions = getFunctions();

// ─── QR nonce generation (calls Cloud Function) ───────────────────────────────

export async function generateQRNonce(userId: string): Promise<string> {
  const generateNonce = httpsCallable<{ userId: string }, { nonce: string }>(
    functions,
    'generateQRNonce'
  );
  const result = await generateNonce({ userId });
  return result.data.nonce;
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
