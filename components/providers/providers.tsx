'use client';

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';
import { AmbienceController } from '@/components/navigation/sound-toggle';
import { ToastProvider } from '@/components/ui/toast';
import { AchievementAnnouncer } from './achievement-announcer';
import { AuthProvider } from './auth-provider';
import { StoreHydration } from './store-hydration';
import { SyncProvider } from './sync-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AuthProvider>
          <SyncProvider>
            <StoreHydration />
            <AchievementAnnouncer />
            <AmbienceController />
            {children}
          </SyncProvider>
        </AuthProvider>
      </ToastProvider>
    </MotionConfig>
  );
}
