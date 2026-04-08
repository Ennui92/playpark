import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RootNavigator } from '@/navigation';
import { registerForPushNotifications } from '@/services/firebase/notificationService';

function AppWithAuth() {
  const { appUser } = useAuth();

  useEffect(() => {
    if (appUser) {
      registerForPushNotifications(appUser.uid);
    }
  }, [appUser?.uid]);

  return <RootNavigator />;
}

export function AppEntry() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  );
}
