import { format, isToday, isTomorrow, differenceInMinutes } from "date-fns";

// "Now" within ±5min, "in 15 min" <1h, "at 3:30 PM", "tomorrow at 9 AM", else date.
export function formatWhen(date: Date): string {
  const diff = differenceInMinutes(date, new Date());
  if (diff >= -5 && diff <= 5) return "Now";
  if (diff > 5 && diff < 60) return `In ${diff} min`;
  const time = format(date, "h:mm a");
  if (isToday(date)) return `At ${time}`;
  if (isTomorrow(date)) return `Tomorrow at ${time}`;
  return `${format(date, "EEE, MMM d")} at ${time}`;
}
