import { Timestamp } from 'firebase/firestore';
import { differenceInMonths, differenceInYears, formatDistanceToNow, format } from 'date-fns';

export function ageFromBirthDate(birthDate: Timestamp): string {
  const date = birthDate.toDate();
  const now = new Date();
  const years = differenceInYears(now, date);
  if (years >= 2) return `${years}y`;
  const months = differenceInMonths(now, date);
  return `${months}m`;
}

export function timeAgo(ts: Timestamp): string {
  return formatDistanceToNow(ts.toDate(), { addSuffix: true });
}

export function formatTime(ts: Timestamp): string {
  return format(ts.toDate(), 'h:mm a');
}

export function formatDate(ts: Timestamp): string {
  return format(ts.toDate(), 'MMM d');
}

export function isNotificationMuted(mutedUntil: Timestamp | null): boolean {
  if (!mutedUntil) return false;
  return mutedUntil.toDate() > new Date();
}

/** End of today as a Timestamp — used for "mute for today" */
export function endOfTodayTimestamp(): Timestamp {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return Timestamp.fromDate(d);
}

export function statusLabel(status: 'en_route' | 'arrived' | 'left'): string {
  switch (status) {
    case 'en_route': return 'On the way';
    case 'arrived': return 'At the park';
    case 'left': return 'Left';
  }
}

export function statusColor(status: 'en_route' | 'arrived' | 'left'): string {
  switch (status) {
    case 'en_route': return '#2196F3';
    case 'arrived': return '#4CAF50';
    case 'left': return '#9E9E9E';
  }
}
