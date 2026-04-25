import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { format } from 'date-fns';

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHECK-IN TRIGGER
//    When a new check-in is created:
//      a) Fan-out a feed entry to all the user's friends
//      b) Send a push notification to each friend
//      c) Increment playground.checkInCount
//      d) Update userStats (streak, monthly count)
// ─────────────────────────────────────────────────────────────────────────────

export const onCheckInCreated = functions.firestore
  .document('checkIns/{checkInId}')
  .onCreate(async (snap, context) => {
    const checkIn = snap.data();
    const checkInId = context.params.checkInId;
    const userId = checkIn.userId as string;

    // Get the user's friends
    const friendshipsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('friendships')
      .where('status', '==', 'active')
      .get();

    if (friendshipsSnap.empty) return;

    const feedEntry = {
      checkInId,
      userId: checkIn.userId,
      userDisplayName: checkIn.userDisplayName,
      userAvatarUrl: checkIn.userAvatarUrl,
      playgroundId: checkIn.playgroundId,
      playgroundName: checkIn.playgroundName,
      status: checkIn.status,
      children: checkIn.children,
      message: checkIn.message,
      createdAt: checkIn.createdAt,
      expiresAt: checkIn.expiresAt,
      confirmedBy: [],
    };

    const batch = db.batch();
    const fcmTokens: string[] = [];

    for (const friendDoc of friendshipsSnap.docs) {
      const friendId = friendDoc.data().friendUserId as string;

      // Write feed entry to friend's subcollection
      const feedRef = db.collection('users').doc(friendId).collection('feed').doc(checkInId);
      batch.set(feedRef, feedEntry);

      // Collect FCM token if notifications are enabled
      const friendUserSnap = await db.collection('users').doc(friendId).get();
      const friendUser = friendUserSnap.data();
      if (!friendUser) continue;

      const prefs = friendUser.notificationPrefs;
      if (!prefs?.enabled) continue;
      if (prefs.mutedUntil && prefs.mutedUntil.toDate() > new Date()) continue;
      if (friendUser.fcmToken) fcmTokens.push(friendUser.fcmToken);
    }

    await batch.commit();

    // Increment playground check-in count
    await db.collection('playgrounds').doc(checkIn.playgroundId).update({
      checkInCount: admin.firestore.FieldValue.increment(1),
      totalVisits: admin.firestore.FieldValue.increment(1),
    });

    // Update user stats (streaks, monthly count)
    await updateUserStats(userId);

    // Send push notifications in one batch
    if (fcmTokens.length > 0) {
      const statusText = checkIn.status === 'en_route' ? 'is heading to' : 'is at';
      const childNames = (checkIn.children as Array<{ name: string }>)
        .map((c) => c.name)
        .join(', ');
      const body = childNames
        ? `${checkIn.userDisplayName} ${statusText} ${checkIn.playgroundName} with ${childNames}`
        : `${checkIn.userDisplayName} ${statusText} ${checkIn.playgroundName}`;

      await messaging.sendEachForMulticast({
        tokens: fcmTokens,
        notification: {
          title: '🛝 Park time!',
          body,
        },
        android: { notification: { channelId: 'check-ins' } },
        apns: { payload: { aps: { sound: 'default' } } },
        data: { checkInId, playgroundId: checkIn.playgroundId },
      });
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHECK-IN STATUS UPDATE
//    When status changes (arrived / left), sync the feed entries in friends' feeds
// ─────────────────────────────────────────────────────────────────────────────

export const onCheckInUpdated = functions.firestore
  .document('checkIns/{checkInId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const checkInId = context.params.checkInId;

    if (before.status === after.status) return; // nothing to sync

    const userId = after.userId as string;

    // Update the feed entry in each friend's subcollection
    const friendshipsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('friendships')
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    for (const friendDoc of friendshipsSnap.docs) {
      const friendId = friendDoc.data().friendUserId as string;
      const feedRef = db.collection('users').doc(friendId).collection('feed').doc(checkInId);
      batch.update(feedRef, {
        status: after.status,
        arrivedAt: after.arrivedAt ?? null,
        leftAt: after.leftAt ?? null,
      });
    }

    await batch.commit();

    // Decrement playground count when leaving
    if (after.status === 'left' && before.status !== 'left') {
      await db.collection('playgrounds').doc(after.playgroundId).update({
        checkInCount: admin.firestore.FieldValue.increment(-1),
      });
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXPIRE STALE CHECK-INS
//    Runs every hour. Sets status='left' on check-ins past their expiresAt.
// ─────────────────────────────────────────────────────────────────────────────

export const expireCheckIns = functions.scheduler
  .onSchedule('every 60 minutes', async () => {
    const now = admin.firestore.Timestamp.now();
    const staleSnap = await db
      .collection('checkIns')
      .where('status', 'in', ['en_route', 'arrived'])
      .where('expiresAt', '<', now)
      .get();

    if (staleSnap.empty) return;

    const batch = db.batch();
    for (const doc_ of staleSnap.docs) {
      batch.update(doc_.ref, { status: 'left', leftAt: now });
    }
    await batch.commit();
  });

// ─────────────────────────────────────────────────────────────────────────────
// 4. GENERATE QR NONCE (callable)
//    Creates a short-lived, single-use nonce so QR codes can expire and
//    can't be replayed from screenshots.
// ─────────────────────────────────────────────────────────────────────────────

export const generateQRNonce = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');

  const userId = context.auth.uid;
  const nonce = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await db.collection('qrNonces').doc(nonce).set({
    userId,
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    used: false,
  });

  return { nonce };
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. SEND FRIEND REQUEST (callable)
//    Validates the QR nonce, then creates a pendingFriendRequest.
//    Auto-accepts immediately (for simplicity) and creates bidirectional
//    friendship docs atomically.
// ─────────────────────────────────────────────────────────────────────────────

export const sendFriendRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');

  const { fromUserId, fromDisplayName, fromAvatarUrl, toUserId, nonce } = data as {
    fromUserId: string;
    fromDisplayName: string;
    fromAvatarUrl: string | null;
    toUserId: string;
    nonce: string;
  };

  if (fromUserId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'User mismatch.');
  }

  // Validate nonce
  const nonceRef = db.collection('qrNonces').doc(nonce);
  const nonceDoc = await nonceRef.get();

  if (!nonceDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'invalid-nonce');
  }
  const nonceData = nonceDoc.data()!;
  if (nonceData.used) {
    throw new functions.https.HttpsError('already-exists', 'invalid-nonce');
  }
  if (nonceData.expiresAt.toDate() < new Date()) {
    throw new functions.https.HttpsError('deadline-exceeded', 'invalid-nonce');
  }
  if (nonceData.userId !== toUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid-nonce');
  }

  // Check not already friends
  const existingSnap = await db
    .collection('users')
    .doc(fromUserId)
    .collection('friendships')
    .doc(toUserId)
    .get();
  if (existingSnap.exists) {
    throw new functions.https.HttpsError('already-exists', 'already-friends');
  }

  // Get the target user's info
  const toUserSnap = await db.collection('users').doc(toUserId).get();
  if (!toUserSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }
  const toUser = toUserSnap.data()!;

  const now = admin.firestore.FieldValue.serverTimestamp();

  // Atomic: mark nonce as used + create both friendship docs + update counts
  await db.runTransaction(async (tx) => {
    tx.update(nonceRef, { used: true });

    // A → B
    tx.set(
      db.collection('users').doc(fromUserId).collection('friendships').doc(toUserId),
      {
        friendUserId: toUserId,
        friendDisplayName: toUser.displayName,
        friendAvatarUrl: toUser.avatarUrl ?? null,
        connectedAt: now,
        status: 'active',
      }
    );

    // B → A
    tx.set(
      db.collection('users').doc(toUserId).collection('friendships').doc(fromUserId),
      {
        friendUserId: fromUserId,
        friendDisplayName: fromDisplayName,
        friendAvatarUrl: fromAvatarUrl,
        connectedAt: now,
        status: 'active',
      }
    );

    // Increment friend counts
    tx.update(db.collection('users').doc(fromUserId), {
      friendCount: admin.firestore.FieldValue.increment(1),
    });
    tx.update(db.collection('users').doc(toUserId), {
      friendCount: admin.firestore.FieldValue.increment(1),
    });
  });

  // Check badge: social_5, social_10
  await checkSocialBadges(fromUserId);
  await checkSocialBadges(toUserId);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5b. ACCEPT / DECLINE FRIEND REQUEST
//     For flows where a request lands in `pendingFriendRequests` (not the
//     auto-accept QR flow). Accept = creates bidirectional friendship atomically.
//     Decline = marks request declined; requester is not notified.
// ─────────────────────────────────────────────────────────────────────────────

export const acceptFriendRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
  const { requestId } = data as { requestId: string };
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'requestId required.');

  const reqRef = db.collection('pendingFriendRequests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Request not found.');
  }
  const req = reqSnap.data()!;

  // Only recipient can accept
  if (req.toUserId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not your request.');
  }
  if (req.status !== 'pending') {
    throw new functions.https.HttpsError('failed-precondition', 'Already handled.');
  }
  if (req.expiresAt.toDate() < new Date()) {
    throw new functions.https.HttpsError('deadline-exceeded', 'Request expired.');
  }

  const toUserId = req.toUserId as string;
  const fromUserId = req.fromUserId as string;

  const toUserSnap = await db.collection('users').doc(toUserId).get();
  if (!toUserSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Your user record is missing.');
  }
  const toUser = toUserSnap.data()!;
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (tx) => {
    tx.update(reqRef, { status: 'accepted' });

    // from → to
    tx.set(
      db.collection('users').doc(fromUserId).collection('friendships').doc(toUserId),
      {
        friendUserId: toUserId,
        friendDisplayName: toUser.displayName,
        friendAvatarUrl: toUser.avatarUrl ?? null,
        connectedAt: now,
        status: 'active',
      }
    );
    // to → from
    tx.set(
      db.collection('users').doc(toUserId).collection('friendships').doc(fromUserId),
      {
        friendUserId: fromUserId,
        friendDisplayName: req.fromDisplayName,
        friendAvatarUrl: req.fromAvatarUrl ?? null,
        connectedAt: now,
        status: 'active',
      }
    );

    tx.update(db.collection('users').doc(fromUserId), {
      friendCount: admin.firestore.FieldValue.increment(1),
    });
    tx.update(db.collection('users').doc(toUserId), {
      friendCount: admin.firestore.FieldValue.increment(1),
    });
  });

  await checkSocialBadges(fromUserId);
  await checkSocialBadges(toUserId);
});

export const declineFriendRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Sign in first.');
  const { requestId } = data as { requestId: string };
  if (!requestId) throw new functions.https.HttpsError('invalid-argument', 'requestId required.');

  const reqRef = db.collection('pendingFriendRequests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Request not found.');
  }
  const req = reqSnap.data()!;

  // Only recipient can decline
  if (req.toUserId !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not your request.');
  }
  if (req.status !== 'pending') {
    // Idempotent: already handled
    return;
  }

  await reqRef.update({ status: 'declined' });
  // Requester is intentionally NOT notified.
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. CONFIRM PLAYDATE — sync confirmedBy to all friends' feed entries
// ─────────────────────────────────────────────────────────────────────────────

export const onCheckInConfirmed = functions.firestore
  .document('checkIns/{checkInId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data().confirmedBy as string[];
    const after = change.after.data().confirmedBy as string[];

    if (before.length === after.length) return;

    const checkInId = context.params.checkInId;
    const userId = change.after.data().userId as string;

    const friendshipsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('friendships')
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    for (const friendDoc of friendshipsSnap.docs) {
      const friendId = friendDoc.data().friendUserId as string;
      const feedRef = db.collection('users').doc(friendId).collection('feed').doc(checkInId);
      batch.update(feedRef, { confirmedBy: after });
    }
    await batch.commit();
  });

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function updateUserStats(userId: string): Promise<void> {
  const today = format(new Date(), 'yyyy-MM-dd');
  const statsRef = db.collection('userStats').doc(userId);
  const statsSnap = await statsRef.get();

  if (!statsSnap.exists) {
    await statsRef.set({
      totalCheckIns: 1,
      currentStreak: 1,
      longestStreak: 1,
      thisMonthCheckIns: 1,
      badges: [],
      lastCheckInDate: today,
    });
    await awardBadge(userId, 'first_checkin');
    return;
  }

  const stats = statsSnap.data()!;
  const lastDate = stats.lastCheckInDate as string;

  // Streak calculation
  const yesterday = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  let newStreak: number;
  if (lastDate === today) {
    newStreak = stats.currentStreak; // already checked in today
  } else if (lastDate === yesterday) {
    newStreak = stats.currentStreak + 1;
  } else {
    newStreak = 1; // streak broken
  }

  const newLongest = Math.max(newStreak, stats.longestStreak);

  // Monthly count reset if month changed
  const thisMonth = today.substring(0, 7);
  const lastMonth = lastDate.substring(0, 7);
  const thisMonthCount = thisMonth === lastMonth ? stats.thisMonthCheckIns + 1 : 1;

  await statsRef.update({
    totalCheckIns: admin.firestore.FieldValue.increment(1),
    currentStreak: newStreak,
    longestStreak: newLongest,
    thisMonthCheckIns: thisMonthCount,
    lastCheckInDate: today,
  });

  // Badge checks
  if (newStreak === 7) await awardBadge(userId, 'streak_7');
  if (newStreak === 30) await awardBadge(userId, 'streak_30');
  if (thisMonthCount === 10) await awardBadge(userId, 'monthly_10');
}

async function awardBadge(userId: string, badgeId: string): Promise<void> {
  const statsRef = db.collection('userStats').doc(userId);
  const statsSnap = await statsRef.get();
  const existing = (statsSnap.data()?.badges ?? []) as Array<{ badgeId: string }>;
  if (existing.some((b) => b.badgeId === badgeId)) return;

  await statsRef.update({
    badges: admin.firestore.FieldValue.arrayUnion({
      badgeId,
      earnedAt: admin.firestore.Timestamp.now(),
      seen: false,
    }),
  });

  // Notify the user about their new badge
  const userSnap = await db.collection('users').doc(userId).get();
  const token = userSnap.data()?.fcmToken as string | undefined;
  if (!token) return;

  const BADGE_LABELS: Record<string, string> = {
    first_checkin: '🌟 First Steps',
    streak_7: '🔥 Week Warrior',
    streak_30: '🏆 Park Regular',
    social_5: '👨‍👩‍👧 Playground Crew',
    social_10: '🎉 Super Social',
    monthly_10: '📅 Active Month',
    confirmed_5: '🤝 Meet-up Maker',
  };

  await messaging.send({
    token,
    notification: {
      title: 'New badge earned!',
      body: `You unlocked ${BADGE_LABELS[badgeId] ?? badgeId}`,
    },
    android: { notification: { channelId: 'badges' } },
  });
}

async function checkSocialBadges(userId: string): Promise<void> {
  const userSnap = await db.collection('users').doc(userId).get();
  const friendCount = (userSnap.data()?.friendCount ?? 0) as number;
  if (friendCount >= 5) await awardBadge(userId, 'social_5');
  if (friendCount >= 10) await awardBadge(userId, 'social_10');
}
