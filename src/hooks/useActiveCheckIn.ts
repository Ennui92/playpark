import { useState, useEffect, useCallback } from 'react';
import { getActiveCheckIn, leavePlayground as leaveService } from '@/services/firebase/checkInService';
import { CheckIn } from '@/types';

export function useActiveCheckIn(userId: string | undefined) {
  const [activeCheckIn, setActiveCheckIn] = useState<CheckIn | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    getActiveCheckIn(userId).then((checkIn) => {
      setActiveCheckIn(checkIn);
      setLoading(false);
    });
  }, [userId]);

  const leavePlayground = useCallback(async () => {
    if (!activeCheckIn) return;
    await leaveService(activeCheckIn.id);
    setActiveCheckIn(null);
  }, [activeCheckIn]);

  return { activeCheckIn, loading, leavePlayground, setActiveCheckIn };
}
